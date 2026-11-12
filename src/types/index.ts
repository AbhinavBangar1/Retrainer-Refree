import { z } from "zod";

// Maintenance window schema
export const MaintenanceWindowSchema = z.object({
  id: z.string().optional(),
  day_of_week: z.string().optional(), // e.g. "Sunday" or null for any day
  start_time: z.string(),              // "02:00" (HH:MM in 24hr UTC or specified tz)
  end_time: z.string(),                // "04:00"
  timezone: z.string().default("UTC"),
  description: z.string().optional()
});

export type MaintenanceWindow = z.infer<typeof MaintenanceWindowSchema>;

// Credit tier schema
// Example: 99.5% to 99.9% = 10% credit, below 99.5% = 30% credit
export const CreditTierSchema = z.object({
  min_uptime: z.number().min(0).max(100),
  max_uptime: z.number().min(0).max(100),
  credit_pct: z.number().min(0).max(100)
});

export type CreditTier = z.infer<typeof CreditTierSchema>;

// Contract extraction schema
export const ContractExtractionSchema = z.object({
  title: z.string().min(1, "Contract title is required"),
  agency_name: z.string().min(1, "Agency name is required"),
  client_name: z.string().min(1, "Client name is required"),
  client_email: z.string().email("Valid client email is required"),
  site_url: z.string().url("Valid website URL is required"),
  fee: z.number().positive("Fee must be greater than zero"),
  currency: z.string().default("USD"),
  uptime_target: z.number().min(80).max(100),
  measurement_window: z.string().default("5 minutes (demo mode)"),
  billing_period_minutes: z.number().int().positive().default(5),
  credit_tiers: z.array(CreditTierSchema).min(1, "At least one credit tier is required"),
  maintenance_windows: z.array(MaintenanceWindowSchema).default([]),
  exclusions: z.array(z.string()).default([])
});

export type ContractExtraction = z.infer<typeof ContractExtractionSchema>;

export type ContractStatus = 
  | "DRAFT" 
  | "PENDING_APPROVAL" 
  | "ACTIVE" 
  | "SETTLING" 
  | "SETTLED" 
  | "VOIDED"
  | "REFUNDED";

export interface ContractRecord {
  id: string;
  title: string;
  agency_name: string;
  client_name: string;
  client_email: string;
  site_url: string;
  fee: number;
  currency: string;
  uptime_target: number;
  measurement_window: string;
  billing_period_minutes: number;
  credit_tiers_json: string;
  maintenance_windows_json: string;
  exclusions_json: string;
  status: ContractStatus;
  paypal_order_id: string | null;
  paypal_authorization_id: string | null;
  paypal_capture_id: string | null;
  paypal_void_id: string | null;
  authorized_amount: number | null;
  captured_amount: number | null;
  created_at: string;
  period_start: string | null;
  period_end: string | null;
  raw_input_text: string | null;
}

export interface ProbeRecord {
  id?: number;
  contract_id: string;
  timestamp: string;
  status_code: number;
  response_time_ms: number;
  ssl_valid: number; // 1 or 0
  ssl_expiry: string | null;
  ssl_issuer: string | null;
  is_up: number;     // 1 or 0
  in_maintenance: number; // 1 or 0
  error_message: string | null;
}

export interface IncidentRecord {
  id: string;
  contract_id: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  reason: string;
  resolved: number; // 1 or 0
}

export interface SettlementRecord {
  id: string;
  contract_id: string;
  settled_at: string;
  period_start: string;
  period_end: string;
  total_monitored_minutes: number;
  maintenance_minutes: number;
  eligible_minutes: number;
  downtime_minutes: number;
  actual_uptime_pct: number;
  target_uptime_pct: number;
  credit_tier_applied: string;
  credit_pct: number;
  original_fee: number;
  credit_amount: number;
  amount_owed: number;
  paypal_action: "CAPTURE" | "VOID" | "REFUND";
  paypal_transaction_id: string;
  pdf_path: string;
  ai_explanation: string;
}

export interface WebhookLogRecord {
  id: string;
  event_id: string;
  event_type: string;
  resource_id: string;
  payload_json: string;
  received_at: string;
}

// ==========================================
// FEATURE 1: CONTRACT CHECKER & BACKTEST
// ==========================================

export type FindingSeverity = "ERROR" | "WARNING" | "ADVISORY";
export type FindingSource = "CODE" | "AI";

export interface CheckerFinding {
  id: string;
  severity: FindingSeverity;
  source: FindingSource;
  code: string;
  title: string;
  message: string;
  suggestion?: string;
  clause?: string;
  blocking: boolean;
}

export interface VerifiabilityScore {
  enforceable: number;
  total: number;
  label: string; // e.g. "5 of 7"
  percentage: number;
}

export interface CheckerResult {
  contract_id: string;
  can_activate: boolean;
  score: VerifiabilityScore;
  errors: CheckerFinding[];
  warnings: CheckerFinding[];
  advisories: CheckerFinding[];
  all_findings: CheckerFinding[];
}

export interface BacktestPeriod {
  period: string; // e.g. "Sep", "Aug", "Jul"
  uptime: number; // e.g. 99.94
  tier: string;   // e.g. "None", "Tier 1 (10%)", "Tier 2 (30%)"
  credit: number; // e.g. 0, 80, 240
}

export interface BacktestResult {
  contract_id: string;
  site_url: string;
  periods: BacktestPeriod[];
  total_credit_cost: number;
  summary_message: string;
}

// ==========================================
// FEATURE 2: EVIDENCE MODE (CUSTOMER SIDE)
// ==========================================

export interface WatchRecord {
  id: string;
  vendor_name: string;
  site_url: string;
  monthly_fee: number;
  currency: string;
  terms_raw: string;
  terms_json: string;
  status: "WATCHING" | "BREACH_DETECTED" | "RESOLVED";
  created_at: string;
}

export interface EvidenceIncident {
  time_label: string; // e.g. "Day 6, 14:02"
  duration_minutes: number;
  reason: string; // e.g. "HTTP 503", "Timeout", "SSL expired"
  status_code: number;
  timestamp: string;
}

export interface ClaimRecord {
  id: string;
  watch_id: string;
  vendor_name: string;
  site_url: string;
  monthly_fee: number;
  currency: string;
  period: string; // e.g. "Current Period (30 Days)"
  actual_uptime: number; // e.g. 99.62
  target_uptime: number; // e.g. 99.9
  total_downtime_minutes: number; // e.g. 164
  tier_applied: string; // e.g. "Tier 1 (10%)"
  credit_pct: number; // 10
  credit_owed: number; // 80.00
  log_hash: string; // SHA-256
  probe_region: string; // e.g. "us-east-1 (N. Virginia)"
  incidents: EvidenceIncident[];
  claim_letter: string;
  pdf_path?: string;
  pdf_url?: string;
  invite_link?: string;
  status: "draft" | "sent" | "enrolled";
  created_at: string;
}

// ==========================================
// FEATURE 3: MCP AUDIT LEDGER
// ==========================================

export interface MCPAuditRecord {
  id: string;
  token: string | null;
  tool_name: string;
  input_json: string;
  result_json: string;
  status: "SUCCESS" | "BLOCKED" | "ERROR";
  created_at: string;
}

