export interface CreditTier {
  min_uptime: number;
  max_uptime: number;
  credit_percent: number;
}

export interface MaintenanceWindow {
  day_of_week: string;
  start_time_utc: string;
  end_time_utc: string;
}

export interface ClientContract {
  id: string;
  title: string;
  agency_name: string;
  client_name: string;
  client_email: string;
  site_url: string;
  fee: number;
  currency: string;
  uptime_target: number;
  billing_period_minutes?: number;
  credit_tiers: CreditTier[];
  maintenance_windows: MaintenanceWindow[];
  exclusions: string[];
  status: string;
  paypal_order_id?: string | null;
  paypal_authorization_id?: string | null;
  period_start?: string | null;
  period_end?: string | null;
}

export interface Settlement {
  id: string;
  contract_id: string;
  settled_at: string;
  total_probes: number;
  downtime_minutes: number;
  actual_uptime: number;
  target_uptime: number;
  tier_applied?: string | null;
  credit_percent: number;
  base_fee: number;
  credit_amount: number;
  final_amount: number;
  paypal_action: "CAPTURE" | "VOID";
  paypal_transaction_id?: string | null;
  plain_english_summary?: string | null;
  pdf_path?: string | null;
}
