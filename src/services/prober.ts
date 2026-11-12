import tls from "node:tls";
import https from "node:https";
import http from "node:http";
import { URL } from "node:url";
import crypto from "node:crypto";
import { ContractDAO, ProbeDAO, IncidentDAO } from "../db";
import { ContractRecord, MaintenanceWindow, ProbeRecord } from "../types";

export interface ProbeResult {
  statusCode: number;
  responseTimeMs: number;
  sslValid: boolean;
  sslExpiry: string | null;
  sslIssuer: string | null;
  isUp: boolean;
  inMaintenance: boolean;
  errorMessage: string | null;
}

export class ProberService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private intervalMs: number = 60000; // Default 1 minute
  private chaosOverrides: Map<string, {
    simulateDown: boolean;
    statusCode: number;
    reason: string;
    expiresAt?: number;
  }> = new Map();

  constructor() {
    // Demo interval can be overridden in env (e.g. 15000 for faster live demos)
    const envInterval = process.env.PROBE_INTERVAL_MS;
    if (envInterval) {
      this.intervalMs = parseInt(envInterval, 10);
    }
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`📡 [Prober] Background probing scheduler started (Interval: ${this.intervalMs / 1000}s)`);

    // Run first probe immediately after short boot delay
    setTimeout(() => this.probeAllActiveContracts(), 2000);

    this.timer = setInterval(() => {
      this.probeAllActiveContracts();
    }, this.intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log("⏹️ [Prober] Probing scheduler stopped");
  }

  public setIntervalMs(ms: number): void {
    this.intervalMs = ms;
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * Set chaos injection for testing/demos
   */
  public setChaos(contractId: string, options: {
    simulateDown: boolean;
    statusCode?: number;
    reason?: string;
    durationMs?: number;
  }): void {
    if (!options.simulateDown) {
      this.chaosOverrides.delete(contractId);
      console.log(`🛡️ [Prober] Chaos disabled for contract: ${contractId}`);
      return;
    }

    const expiresAt = options.durationMs ? Date.now() + options.durationMs : undefined;
    this.chaosOverrides.set(contractId, {
      simulateDown: true,
      statusCode: options.statusCode || 503,
      reason: options.reason || "Simulated 503 Service Unavailable",
      expiresAt
    });
    console.log(`💥 [Prober] Chaos ACTIVE for contract ${contractId}: ${options.reason || "Downtime simulated"}`);
  }

  public getChaos(contractId: string): boolean {
    const chaos = this.chaosOverrides.get(contractId);
    if (!chaos) return false;
    if (chaos.expiresAt && Date.now() > chaos.expiresAt) {
      this.chaosOverrides.delete(contractId);
      return false;
    }
    return chaos.simulateDown;
  }

  /**
   * Probes all contracts currently in ACTIVE status
   */
  public async probeAllActiveContracts(): Promise<void> {
    const activeContracts = ContractDAO.getActive();
    for (const contract of activeContracts) {
      try {
        await this.probeContract(contract);
      } catch (err: any) {
        console.error(`❌ [Prober] Error probing contract ${contract.id} (${contract.site_url}):`, err.message);
      }
    }
  }

  /**
   * Probe a single contract, record results, and manage incidents
   */
  public async probeContract(contract: ContractRecord): Promise<ProbeRecord> {
    const now = new Date();
    const timestamp = now.toISOString();

    // Check maintenance windows
    const maintenanceWindows: MaintenanceWindow[] = JSON.parse(contract.maintenance_windows_json || "[]");
    const inMaintenance = this.isInsideMaintenanceWindow(now, maintenanceWindows);

    // Check for chaos override
    const chaos = this.chaosOverrides.get(contract.id);
    let probeResult: ProbeResult;

    if (chaos && chaos.simulateDown && (!chaos.expiresAt || Date.now() <= chaos.expiresAt)) {
      probeResult = {
        statusCode: chaos.statusCode,
        responseTimeMs: 840,
        sslValid: true,
        sslExpiry: new Date(Date.now() + 90 * 86400000).toISOString(),
        sslIssuer: "Let's Encrypt Authority X3",
        isUp: false,
        inMaintenance,
        errorMessage: chaos.reason
      };
    } else {
      probeResult = await this.executeHttpAndSslProbe(contract.site_url, inMaintenance);
    }

    const probeRecord: ProbeRecord = {
      contract_id: contract.id,
      timestamp,
      status_code: probeResult.statusCode,
      response_time_ms: probeResult.responseTimeMs,
      ssl_valid: probeResult.sslValid ? 1 : 0,
      ssl_expiry: probeResult.sslExpiry,
      ssl_issuer: probeResult.sslIssuer,
      is_up: probeResult.isUp ? 1 : 0,
      in_maintenance: probeResult.inMaintenance ? 1 : 0,
      error_message: probeResult.errorMessage
    };

    // Save probe record
    ProbeDAO.insert(probeRecord);

    // Incident management:
    // Only count as incident if it is NOT in agreed maintenance window
    if (!probeResult.isUp && !probeResult.inMaintenance) {
      const activeIncident = IncidentDAO.getActive(contract.id);
      if (!activeIncident) {
        // Open new incident
        const newIncident = {
          id: `INC-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
          contract_id: contract.id,
          start_time: timestamp,
          end_time: null,
          duration_seconds: null,
          reason: probeResult.errorMessage || `HTTP Status ${probeResult.statusCode}`,
          resolved: 0
        };
        IncidentDAO.create(newIncident);
        console.warn(`🚨 [Incident Opened] Contract ${contract.id} down: ${newIncident.reason}`);
      }
    } else if (probeResult.isUp) {
      // If site is up and an incident was active, resolve it
      const activeIncident = IncidentDAO.getActive(contract.id);
      if (activeIncident) {
        const startMs = new Date(activeIncident.start_time).getTime();
        const endMs = now.getTime();
        const durationSeconds = Math.max(1, Math.round((endMs - startMs) / 1000));
        IncidentDAO.resolve(activeIncident.id, timestamp, durationSeconds);
        console.log(`✅ [Incident Resolved] Contract ${contract.id} restored after ${durationSeconds}s`);
      }
    }

    return probeRecord;
  }

  /**
   * Executes HTTP check and SSL certificate inspection
   */
  private async executeHttpAndSslProbe(urlStr: string, inMaintenance: boolean): Promise<ProbeResult> {
    const startTime = performance.now();
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(urlStr);
    } catch {
      return {
        statusCode: 0,
        responseTimeMs: 0,
        sslValid: false,
        sslExpiry: null,
        sslIssuer: null,
        isUp: false,
        inMaintenance,
        errorMessage: `Invalid URL: ${urlStr}`
      };
    }

    const isHttps = parsedUrl.protocol === "https:";
    let sslValid = true;
    let sslExpiry: string | null = null;
    let sslIssuer: string | null = null;
    let sslError: string | null = null;

    // Check SSL certificate if HTTPS
    if (isHttps) {
      try {
        const certInfo = await this.inspectSslCertificate(parsedUrl.hostname, parsedUrl.port ? parseInt(parsedUrl.port, 10) : 443);
        sslValid = certInfo.isValid;
        sslExpiry = certInfo.expiryDate;
        sslIssuer = certInfo.issuer;
        if (!certInfo.isValid) {
          sslError = certInfo.error || "SSL certificate invalid or expired";
        }
      } catch (err: any) {
        sslValid = false;
        sslError = `SSL Handshake Failed: ${err.message}`;
      }
    }

    // Measure HTTP response time & status
    try {
      const response = await fetch(urlStr, {
        method: "GET",
        headers: { "User-Agent": "RetainerReferee-Probe/1.0 (+https://retainerreferee.com)" },
        signal: AbortSignal.timeout(10000)
      });

      const responseTimeMs = Math.round(performance.now() - startTime);
      const isHttpUp = response.status >= 200 && response.status < 400;
      const isUp = isHttpUp && sslValid;

      return {
        statusCode: response.status,
        responseTimeMs,
        sslValid,
        sslExpiry,
        sslIssuer,
        isUp,
        inMaintenance,
        errorMessage: isUp ? null : (sslError || `HTTP ${response.status} ${response.statusText}`)
      };
    } catch (err: any) {
      const responseTimeMs = Math.round(performance.now() - startTime);
      return {
        statusCode: 0,
        responseTimeMs,
        sslValid,
        sslExpiry,
        sslIssuer,
        isUp: false,
        inMaintenance,
        errorMessage: sslError || err.message || "Network request failed"
      };
    }
  }

  /**
   * Inspect SSL certificate expiration and issuer using TLS socket
   */
  private inspectSslCertificate(hostname: string, port: number = 443): Promise<{
    isValid: boolean;
    expiryDate: string | null;
    issuer: string | null;
    error?: string;
  }> {
    return new Promise((resolve) => {
      const socket = tls.connect({
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false,
        timeout: 5000
      }, () => {
        try {
          const cert = socket.getPeerCertificate();
          socket.end();

          if (!cert || !cert.valid_to) {
            resolve({ isValid: false, expiryDate: null, issuer: null, error: "No peer certificate returned" });
            return;
          }

          const expiryDate = new Date(cert.valid_to);
          const isNotExpired = expiryDate.getTime() > Date.now();
          const rawIssuer = cert.issuer ? (cert.issuer.O || cert.issuer.CN || "Unknown Issuer") : null;
          const issuer = Array.isArray(rawIssuer) ? rawIssuer.join(", ") : (rawIssuer ? String(rawIssuer) : null);

          resolve({
            isValid: isNotExpired,
            expiryDate: expiryDate.toISOString(),
            issuer
          });
        } catch (err: any) {
          resolve({ isValid: false, expiryDate: null, issuer: null, error: err.message });
        }
      });

      socket.on("error", (err) => {
        socket.destroy();
        resolve({ isValid: false, expiryDate: null, issuer: null, error: err.message });
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve({ isValid: false, expiryDate: null, issuer: null, error: "TLS connection timed out" });
      });
    });
  }

  /**
   * Determine whether the given time falls inside any defined maintenance windows
   */
  public isInsideMaintenanceWindow(date: Date, windows: MaintenanceWindow[]): boolean {
    if (!windows || windows.length === 0) return false;

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDay = days[date.getUTCDay()];
    const currentHour = date.getUTCHours();
    const currentMinute = date.getUTCMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    for (const win of windows) {
      if (win.day_of_week && win.day_of_week.toLowerCase() !== currentDay.toLowerCase()) {
        continue;
      }

      const [startH, startM] = win.start_time.split(":").map(Number);
      const [endH, endM] = win.end_time.split(":").map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (startMinutes <= endMinutes) {
        if (currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes) {
          return true;
        }
      } else {
        // Spans midnight
        if (currentTimeMinutes >= startMinutes || currentTimeMinutes <= endMinutes) {
          return true;
        }
      }
    }

    return false;
  }
}

export const proberService = new ProberService();
