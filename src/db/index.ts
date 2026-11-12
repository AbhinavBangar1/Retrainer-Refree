import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { 
  ContractRecord, 
  ProbeRecord, 
  IncidentRecord, 
  SettlementRecord, 
  WebhookLogRecord,
  WatchRecord,
  ClaimRecord,
  MCPAuditRecord
} from "../types";

const DB_DIR = path.resolve(process.cwd(), "data");
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, "retainer_referee.db");
export const db = new DatabaseSync(DB_PATH);

// Enable WAL mode, busy timeout, and foreign keys for high performance and concurrency
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS contracts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    agency_name TEXT NOT NULL,
    client_name TEXT NOT NULL,
    client_email TEXT NOT NULL,
    site_url TEXT NOT NULL,
    fee REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    uptime_target REAL NOT NULL DEFAULT 99.9,
    measurement_window TEXT NOT NULL DEFAULT '5 minutes (demo mode)',
    billing_period_minutes INTEGER NOT NULL DEFAULT 5,
    credit_tiers_json TEXT NOT NULL,
    maintenance_windows_json TEXT NOT NULL,
    exclusions_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    paypal_order_id TEXT,
    paypal_authorization_id TEXT,
    paypal_capture_id TEXT,
    paypal_void_id TEXT,
    authorized_amount REAL,
    captured_amount REAL,
    created_at TEXT NOT NULL,
    period_start TEXT,
    period_end TEXT,
    raw_input_text TEXT
  );

  CREATE TABLE IF NOT EXISTS probes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms REAL NOT NULL,
    ssl_valid INTEGER NOT NULL DEFAULT 1,
    ssl_expiry TEXT,
    ssl_issuer TEXT,
    is_up INTEGER NOT NULL DEFAULT 1,
    in_maintenance INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    FOREIGN KEY(contract_id) REFERENCES contracts(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_probes_contract_time ON probes (contract_id, timestamp);

  CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    duration_seconds REAL,
    reason TEXT NOT NULL,
    resolved INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(contract_id) REFERENCES contracts(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_incidents_contract ON incidents (contract_id);

  CREATE TABLE IF NOT EXISTS settlements (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL,
    settled_at TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    total_monitored_minutes REAL NOT NULL,
    maintenance_minutes REAL NOT NULL,
    eligible_minutes REAL NOT NULL,
    downtime_minutes REAL NOT NULL,
    actual_uptime_pct REAL NOT NULL,
    target_uptime_pct REAL NOT NULL,
    credit_tier_applied TEXT NOT NULL,
    credit_pct REAL NOT NULL,
    original_fee REAL NOT NULL,
    credit_amount REAL NOT NULL,
    amount_owed REAL NOT NULL,
    paypal_action TEXT NOT NULL,
    paypal_transaction_id TEXT NOT NULL,
    pdf_path TEXT NOT NULL,
    ai_explanation TEXT NOT NULL,
    FOREIGN KEY(contract_id) REFERENCES contracts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS webhook_logs (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    received_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS watches (
    id TEXT PRIMARY KEY,
    vendor_name TEXT NOT NULL,
    site_url TEXT NOT NULL,
    monthly_fee REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    terms_raw TEXT NOT NULL,
    terms_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'WATCHING',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    watch_id TEXT NOT NULL,
    vendor_name TEXT NOT NULL,
    site_url TEXT NOT NULL,
    monthly_fee REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    period TEXT NOT NULL,
    actual_uptime REAL NOT NULL,
    target_uptime REAL NOT NULL,
    total_downtime_minutes REAL NOT NULL,
    tier_applied TEXT NOT NULL,
    credit_pct REAL NOT NULL,
    credit_owed REAL NOT NULL,
    log_hash TEXT NOT NULL,
    probe_region TEXT NOT NULL,
    incidents_json TEXT NOT NULL,
    claim_letter TEXT NOT NULL,
    pdf_path TEXT,
    pdf_url TEXT,
    invite_link TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL,
    FOREIGN KEY(watch_id) REFERENCES watches(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS mcp_audit_logs (
    id TEXT PRIMARY KEY,
    token TEXT,
    tool_name TEXT NOT NULL,
    input_json TEXT NOT NULL,
    result_json TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

export const ContractDAO = {
  create(contract: ContractRecord): void {
    const stmt = db.prepare(`
      INSERT INTO contracts (
        id, title, agency_name, client_name, client_email, site_url,
        fee, currency, uptime_target, measurement_window, billing_period_minutes,
        credit_tiers_json, maintenance_windows_json, exclusions_json,
        status, paypal_order_id, paypal_authorization_id, paypal_capture_id,
        paypal_void_id, authorized_amount, captured_amount, created_at,
        period_start, period_end, raw_input_text
      ) VALUES (
        @id, @title, @agency_name, @client_name, @client_email, @site_url,
        @fee, @currency, @uptime_target, @measurement_window, @billing_period_minutes,
        @credit_tiers_json, @maintenance_windows_json, @exclusions_json,
        @status, @paypal_order_id, @paypal_authorization_id, @paypal_capture_id,
        @paypal_void_id, @authorized_amount, @captured_amount, @created_at,
        @period_start, @period_end, @raw_input_text
      )
    `);
    stmt.run(contract as any);
  },

  getById(id: string): ContractRecord | null {
    const stmt = db.prepare(`SELECT * FROM contracts WHERE id = ?`);
    const row = stmt.get(id);
    return (row as unknown as ContractRecord) || null;
  },

  getAll(): ContractRecord[] {
    const stmt = db.prepare(`SELECT * FROM contracts ORDER BY created_at DESC`);
    return stmt.all() as unknown as ContractRecord[];
  },

  getActive(): ContractRecord[] {
    const stmt = db.prepare(`SELECT * FROM contracts WHERE status = 'ACTIVE'`);
    return stmt.all() as unknown as ContractRecord[];
  },

  updateStatus(id: string, status: string): void {
    const stmt = db.prepare(`UPDATE contracts SET status = ? WHERE id = ?`);
    stmt.run(status, id);
  },

  updateTiersAndTerms(id: string, credit_tiers_json: string, exclusions_json: string): void {
    const stmt = db.prepare(`UPDATE contracts SET credit_tiers_json = ?, exclusions_json = ? WHERE id = ?`);
    stmt.run(credit_tiers_json, exclusions_json, id);
  },

  updatePayPalOrder(id: string, paypal_order_id: string, status: string): void {
    const stmt = db.prepare(`UPDATE contracts SET paypal_order_id = ?, status = ? WHERE id = ?`);
    stmt.run(paypal_order_id, status, id);
  },

  activateContract(
    id: string, 
    paypal_authorization_id: string, 
    authorized_amount: number,
    period_start: string,
    period_end: string
  ): void {
    const stmt = db.prepare(`
      UPDATE contracts 
      SET status = 'ACTIVE',
          paypal_authorization_id = ?,
          authorized_amount = ?,
          period_start = ?,
          period_end = ?
      WHERE id = ?
    `);
    stmt.run(paypal_authorization_id, authorized_amount, period_start, period_end, id);
  },

  recordSettlement(
    id: string,
    status: string,
    paypal_action: "CAPTURE" | "VOID" | "REFUND",
    txId: string,
    captured_amount: number
  ): void {
    const field = paypal_action === "CAPTURE" 
      ? "paypal_capture_id" 
      : (paypal_action === "VOID" ? "paypal_void_id" : "paypal_capture_id");
    
    const stmt = db.prepare(`
      UPDATE contracts 
      SET status = ?,
          ${field} = ?,
          captured_amount = ?
      WHERE id = ?
    `);
    stmt.run(status, txId, captured_amount, id);
  }
};

export const ProbeDAO = {
  insert(probe: ProbeRecord): void {
    const stmt = db.prepare(`
      INSERT INTO probes (
        contract_id, timestamp, status_code, response_time_ms,
        ssl_valid, ssl_expiry, ssl_issuer, is_up, in_maintenance, error_message
      ) VALUES (
        @contract_id, @timestamp, @status_code, @response_time_ms,
        @ssl_valid, @ssl_expiry, @ssl_issuer, @is_up, @in_maintenance, @error_message
      )
    `);
    stmt.run(probe as any);
  },

  getByContract(contractId: string, limit: number = 100): ProbeRecord[] {
    const stmt = db.prepare(`
      SELECT * FROM probes 
      WHERE contract_id = ? 
      ORDER BY id DESC 
      LIMIT ?
    `);
    return stmt.all(contractId, limit) as unknown as ProbeRecord[];
  },

  getByPeriod(contractId: string, startIso: string, endIso: string): ProbeRecord[] {
    const stmt = db.prepare(`
      SELECT * FROM probes 
      WHERE contract_id = ? AND timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp ASC
    `);
    return stmt.all(contractId, startIso, endIso) as unknown as ProbeRecord[];
  },

  getRecentAggregates(contractId: string): {
    total_pings: number;
    up_pings: number;
    down_pings: number;
    maintenance_pings: number;
    avg_response_time_ms: number;
    last_ping: ProbeRecord | null;
  } {
    const statsStmt = db.prepare(`
      SELECT 
        COUNT(*) as total_pings,
        SUM(CASE WHEN is_up = 1 THEN 1 ELSE 0 END) as up_pings,
        SUM(CASE WHEN is_up = 0 AND in_maintenance = 0 THEN 1 ELSE 0 END) as down_pings,
        SUM(CASE WHEN in_maintenance = 1 THEN 1 ELSE 0 END) as maintenance_pings,
        AVG(response_time_ms) as avg_response_time_ms
      FROM probes
      WHERE contract_id = ?
    `);
    const stats = statsStmt.get(contractId) as any;

    const lastStmt = db.prepare(`
      SELECT * FROM probes WHERE contract_id = ? ORDER BY id DESC LIMIT 1
    `);
    const last_ping = (lastStmt.get(contractId) as unknown as ProbeRecord) || null;

    return {
      total_pings: Number(stats?.total_pings || 0),
      up_pings: Number(stats?.up_pings || 0),
      down_pings: Number(stats?.down_pings || 0),
      maintenance_pings: Number(stats?.maintenance_pings || 0),
      avg_response_time_ms: Math.round(Number(stats?.avg_response_time_ms || 0)),
      last_ping
    };
  }
};

export const IncidentDAO = {
  create(incident: IncidentRecord): void {
    const stmt = db.prepare(`
      INSERT INTO incidents (id, contract_id, start_time, end_time, duration_seconds, reason, resolved)
      VALUES (@id, @contract_id, @start_time, @end_time, @duration_seconds, @reason, @resolved)
    `);
    stmt.run(incident as any);
  },

  getActive(contractId: string): IncidentRecord | null {
    const stmt = db.prepare(`
      SELECT * FROM incidents WHERE contract_id = ? AND resolved = 0 ORDER BY start_time DESC LIMIT 1
    `);
    const row = stmt.get(contractId);
    return (row as unknown as IncidentRecord) || null;
  },

  resolve(id: string, end_time: string, duration_seconds: number): void {
    const stmt = db.prepare(`
      UPDATE incidents SET end_time = ?, duration_seconds = ?, resolved = 1 WHERE id = ?
    `);
    stmt.run(end_time, duration_seconds, id);
  },

  getByContract(contractId: string): IncidentRecord[] {
    const stmt = db.prepare(`
      SELECT * FROM incidents WHERE contract_id = ? ORDER BY start_time DESC
    `);
    return stmt.all(contractId) as unknown as IncidentRecord[];
  }
};

export const SettlementDAO = {
  create(settlement: SettlementRecord): void {
    const stmt = db.prepare(`
      INSERT INTO settlements (
        id, contract_id, settled_at, period_start, period_end,
        total_monitored_minutes, maintenance_minutes, eligible_minutes,
        downtime_minutes, actual_uptime_pct, target_uptime_pct,
        credit_tier_applied, credit_pct, original_fee, credit_amount,
        amount_owed, paypal_action, paypal_transaction_id, pdf_path, ai_explanation
      ) VALUES (
        @id, @contract_id, @settled_at, @period_start, @period_end,
        @total_monitored_minutes, @maintenance_minutes, @eligible_minutes,
        @downtime_minutes, @actual_uptime_pct, @target_uptime_pct,
        @credit_tier_applied, @credit_pct, @original_fee, @credit_amount,
        @amount_owed, @paypal_action, @paypal_transaction_id, @pdf_path, @ai_explanation
      )
    `);
    stmt.run(settlement as any);
  },

  getByContract(contractId: string): SettlementRecord | null {
    const stmt = db.prepare(`
      SELECT * FROM settlements WHERE contract_id = ? ORDER BY settled_at DESC LIMIT 1
    `);
    const row = stmt.get(contractId);
    return (row as unknown as SettlementRecord) || null;
  }
};

export const WebhookLogDAO = {
  log(record: WebhookLogRecord): void {
    const stmt = db.prepare(`
      INSERT INTO webhook_logs (id, event_id, event_type, resource_id, payload_json, received_at)
      VALUES (@id, @event_id, @event_type, @resource_id, @payload_json, @received_at)
    `);
    stmt.run(record as any);
  },

  getAll(limit: number = 50): WebhookLogRecord[] {
    const stmt = db.prepare(`SELECT * FROM webhook_logs ORDER BY received_at DESC LIMIT ?`);
    return stmt.all(limit) as unknown as WebhookLogRecord[];
  }
};

export const WatchDAO = {
  create(watch: WatchRecord): void {
    const stmt = db.prepare(`
      INSERT INTO watches (id, vendor_name, site_url, monthly_fee, currency, terms_raw, terms_json, status, created_at)
      VALUES (@id, @vendor_name, @site_url, @monthly_fee, @currency, @terms_raw, @terms_json, @status, @created_at)
    `);
    stmt.run(watch as any);
  },

  getById(id: string): WatchRecord | null {
    const stmt = db.prepare(`SELECT * FROM watches WHERE id = ?`);
    const row = stmt.get(id);
    return (row as unknown as WatchRecord) || null;
  },

  getAll(): WatchRecord[] {
    const stmt = db.prepare(`SELECT * FROM watches ORDER BY created_at DESC`);
    return stmt.all() as unknown as WatchRecord[];
  },

  updateStatus(id: string, status: string): void {
    const stmt = db.prepare(`UPDATE watches SET status = ? WHERE id = ?`);
    stmt.run(status, id);
  }
};

export const ClaimDAO = {
  create(claim: ClaimRecord): void {
    const stmt = db.prepare(`
      INSERT INTO claims (
        id, watch_id, vendor_name, site_url, monthly_fee, currency, period,
        actual_uptime, target_uptime, total_downtime_minutes, tier_applied,
        credit_pct, credit_owed, log_hash, probe_region, incidents_json,
        claim_letter, pdf_path, pdf_url, invite_link, status, created_at
      ) VALUES (
        @id, @watch_id, @vendor_name, @site_url, @monthly_fee, @currency, @period,
        @actual_uptime, @target_uptime, @total_downtime_minutes, @tier_applied,
        @credit_pct, @credit_owed, @log_hash, @probe_region, @incidents_json,
        @claim_letter, @pdf_path, @pdf_url, @invite_link, @status, @created_at
      )
    `);
    const { incidents, ...rest } = claim;
    const payload = {
      ...rest,
      incidents_json: JSON.stringify(incidents || [])
    };
    stmt.run(payload as any);
  },

  getById(id: string): ClaimRecord | null {
    const stmt = db.prepare(`SELECT * FROM claims WHERE id = ?`);
    const row = stmt.get(id) as any;
    if (!row) return null;
    return {
      ...row,
      incidents: JSON.parse(row.incidents_json || "[]")
    };
  },

  getByWatchId(watchId: string): ClaimRecord[] {
    const stmt = db.prepare(`SELECT * FROM claims WHERE watch_id = ? ORDER BY created_at DESC`);
    const rows = stmt.all(watchId) as any[];
    return rows.map(row => ({
      ...row,
      incidents: JSON.parse(row.incidents_json || "[]")
    }));
  },

  getAll(): ClaimRecord[] {
    const stmt = db.prepare(`SELECT * FROM claims ORDER BY created_at DESC`);
    const rows = stmt.all() as any[];
    return rows.map(row => ({
      ...row,
      incidents: JSON.parse(row.incidents_json || "[]")
    }));
  },

  updateStatus(id: string, status: string): void {
    const stmt = db.prepare(`UPDATE claims SET status = ? WHERE id = ?`);
    stmt.run(status, id);
  }
};

export const MCPAuditDAO = {
  log(record: MCPAuditRecord): void {
    const stmt = db.prepare(`
      INSERT INTO mcp_audit_logs (id, token, tool_name, input_json, result_json, status, created_at)
      VALUES (@id, @token, @tool_name, @input_json, @result_json, @status, @created_at)
    `);
    stmt.run(record as any);
  },

  getAll(limit: number = 50): MCPAuditRecord[] {
    const stmt = db.prepare(`SELECT * FROM mcp_audit_logs ORDER BY created_at DESC LIMIT ?`);
    return stmt.all(limit) as unknown as MCPAuditRecord[];
  }
};


export function closeDb(): void {
  try {
    db.close();
  } catch {}
}
