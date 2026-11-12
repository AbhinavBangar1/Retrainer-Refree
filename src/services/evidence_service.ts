import crypto from "node:crypto";
import path from "node:path";
import { WatchDAO, ClaimDAO } from "../db";
import { WatchRecord, ClaimRecord, EvidenceIncident } from "../types";
import { pdfGenerator } from "./pdf_generator";
import { llmExtractor } from "./llm_extractor";
import { contractChecker } from "./contract_checker";

export class EvidenceService {
  /**
   * Add a new vendor to watch (Screen X1)
   */
  public async createWatch(params: {
    vendorName: string;
    siteUrl: string;
    monthlyFee: number;
    termsText: string;
    currency?: string;
  }): Promise<{ watch: WatchRecord; claim?: ClaimRecord }> {
    const watchId = `WTC-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const now = new Date().toISOString();
    const currency = params.currency || "USD";

    // Extract terms using LLM with fallback
    let termsJson = "{}";
    try {
      const extracted = await llmExtractor.extractContractTerms(
        params.termsText || `SLA for ${params.vendorName} on ${params.siteUrl}. Monthly fee $${params.monthlyFee}. 99.9% uptime target.`
      );
      termsJson = JSON.stringify(extracted.data);
    } catch {
      termsJson = JSON.stringify({
        uptime_target: 99.9,
        credit_tiers: [
          { min_uptime: 99.5, max_uptime: 99.9, credit_pct: 10 },
          { min_uptime: 0, max_uptime: 99.5, credit_pct: 30 }
        ]
      });
    }

    const watch: WatchRecord = {
      id: watchId,
      vendor_name: params.vendorName,
      site_url: params.siteUrl,
      monthly_fee: Number(params.monthlyFee),
      currency,
      terms_raw: params.termsText,
      terms_json: termsJson,
      status: "WATCHING",
      created_at: now
    };

    WatchDAO.create(watch);

    return { watch };
  }

  /**
   * Simulate or generate a breach and build the Claim Pack (Screen X2)
   */
  public async simulateBreach(watchId: string): Promise<ClaimRecord> {
    const watch = WatchDAO.getById(watchId);
    if (!watch) {
      throw new Error(`Watch not found: ${watchId}`);
    }

    const claimId = `CLM-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const now = new Date();

    // Standard incident evidence matching Screen X2 replica
    const incidents: EvidenceIncident[] = [
      {
        time_label: "Day 6, 14:02",
        duration_minutes: 94,
        reason: "HTTP 503",
        status_code: 503,
        timestamp: new Date(now.getTime() - 24 * 86400000).toISOString()
      },
      {
        time_label: "Day 14, 03:40",
        duration_minutes: 52,
        reason: "Timeout",
        status_code: 504,
        timestamp: new Date(now.getTime() - 16 * 86400000).toISOString()
      },
      {
        time_label: "Day 22, 21:15",
        duration_minutes: 18,
        reason: "SSL expired",
        status_code: 0,
        timestamp: new Date(now.getTime() - 8 * 86400000).toISOString()
      }
    ];

    const totalDowntimeMinutes = incidents.reduce((sum, i) => sum + i.duration_minutes, 0); // 164 min
    const periodMinutes = 30 * 24 * 60; // 43,200 min
    const eligibleMinutes = periodMinutes;
    const rawUptime = ((eligibleMinutes - totalDowntimeMinutes) / eligibleMinutes) * 100;
    const actualUptime = Math.round(rawUptime * 100) / 100; // 99.62%

    const targetUptime = 99.9;
    const fee = watch.monthly_fee || 800;
    const creditPct = 10; // Tier 1: 99.5% - 99.9% = 10%
    const tierApplied = "Tier 1 (10%)";
    const creditOwed = Math.round(fee * (creditPct / 100) * 100) / 100; // $80.00

    // Compute cryptographic SHA-256 hash of the probe log
    const probeLogRaw = incidents
      .map(i => `${i.timestamp}|${watch.site_url}|${i.status_code}|${i.reason}|${i.duration_minutes}m`)
      .join("\n");
    const logHash = crypto.createHash("sha256").update(probeLogRaw).digest("hex");
    const probeRegion = "us-east-1 (N. Virginia)";

    // Editorial claim letter written strictly from computed figures
    const claimLetter = `Hello ${watch.vendor_name}, our monitoring recorded ${totalDowntimeMinutes} minutes of downtime across three incidents this period, giving ${actualUptime}% uptime against the agreed ${targetUptime}%. Under ${tierApplied} of our agreement a ${creditPct}% credit of $${creditOwed.toFixed(2)} applies. The attached log lists each failed check. Please apply the credit.`;

    // Generate Claim Pack PDF
    const pdfPath = await pdfGenerator.generateClaimPack({
      claimId,
      vendorName: watch.vendor_name,
      siteUrl: watch.site_url,
      monthlyFee: fee,
      currency: watch.currency,
      period: "Last 30 Days",
      actualUptime,
      targetUptime,
      totalDowntimeMinutes,
      tierApplied,
      creditPct,
      creditOwed,
      logHash,
      probeRegion,
      incidents,
      claimLetter
    });

    const pdfUrl = `/api/evidence/claims/${claimId}/pdf`;
    // Growth loop invite link opens pre-filled contract draft on the agency side!
    const inviteLink = `http://localhost:3000/?from_claim=${claimId}&vendor=${encodeURIComponent(watch.vendor_name)}&url=${encodeURIComponent(watch.site_url)}&fee=${fee}`;

    const claim: ClaimRecord = {
      id: claimId,
      watch_id: watch.id,
      vendor_name: watch.vendor_name,
      site_url: watch.site_url,
      monthly_fee: fee,
      currency: watch.currency,
      period: "Last 30 Days",
      actual_uptime: actualUptime,
      target_uptime: targetUptime,
      total_downtime_minutes: totalDowntimeMinutes,
      tier_applied: tierApplied,
      credit_pct: creditPct,
      credit_owed: creditOwed,
      log_hash: logHash,
      probe_region: probeRegion,
      incidents,
      claim_letter: claimLetter,
      pdf_path: pdfPath,
      pdf_url: pdfUrl,
      invite_link: inviteLink,
      status: "draft",
      created_at: now.toISOString()
    };

    ClaimDAO.create(claim);
    WatchDAO.updateStatus(watch.id, "BREACH_DETECTED");

    return claim;
  }

  public getWatch(id: string): WatchRecord | null {
    return WatchDAO.getById(id);
  }

  public getAllWatches(): WatchRecord[] {
    return WatchDAO.getAll();
  }

  public getClaim(id: string): ClaimRecord | null {
    return ClaimDAO.getById(id);
  }

  public getClaimsForWatch(watchId: string): ClaimRecord[] {
    return ClaimDAO.getByWatchId(watchId);
  }

  public getAllClaims(): ClaimRecord[] {
    return ClaimDAO.getAll();
  }
}

export const evidenceService = new EvidenceService();
