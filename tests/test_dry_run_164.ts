import { ContractDAO, ProbeDAO, IncidentDAO } from "../src/db";
import { settleEngine } from "../src/services/settle_engine";

async function test164() {
  const contractId = "TEST-164-" + Date.now();
  const contract = {
    id: contractId,
    title: "Hosting Retainer",
    agency_name: "Apex Studios",
    client_name: "Acme Corp",
    client_email: "client@example.com",
    site_url: "https://example.com",
    fee: 800,
    currency: "USD",
    uptime_target: 99.9,
    measurement_window: "30 days",
    billing_period_minutes: 43200,
    credit_tiers_json: JSON.stringify([
      { min_uptime: 99.5, max_uptime: 99.9, credit_pct: 10 },
      { min_uptime: 0, max_uptime: 99.5, credit_pct: 30 }
    ]),
    maintenance_windows_json: JSON.stringify([
      { day_of_week: "Sunday", start_time: "02:00", end_time: "04:00", timezone: "UTC" }
    ]),
    exclusions_json: "[]",
    status: "AUTHORIZED",
    paypal_order_id: "ORDER-" + Date.now(),
    paypal_authorization_id: "AUTH-" + Date.now(),
    paypal_capture_id: null,
    paypal_void_id: null,
    authorized_amount: 800,
    captured_amount: null,
    created_at: new Date().toISOString(),
    period_start: new Date(Date.now() - 30 * 86400000).toISOString(),
    period_end: new Date().toISOString(),
    raw_input_text: "Demo proposal text"
  };

  ContractDAO.create(contract as any);

  const now = new Date();
  const periodStart = new Date(contract.period_start);

  // Probe records: 164 down, 43036 up = 43200 total
  const probes = [];
  for (let i = 0; i < 164; i++) {
    probes.push({
      id: i + 1,
      contract_id: contractId,
      timestamp: new Date(now.getTime() - i * 60000).toISOString(),
      status_code: 503,
      response_time_ms: 1200,
      ssl_valid: 1,
      ssl_expiry: "2027-01-01T00:00:00Z",
      ssl_issuer: "Let's Encrypt",
      is_up: 0,
      in_maintenance: 0,
      error_message: "HTTP 503 Outage"
    });
  }
  for (let i = 0; i < 43036; i++) {
    probes.push({
      id: 165 + i,
      contract_id: contractId,
      timestamp: new Date(periodStart.getTime() + i * 60000).toISOString(),
      status_code: 200,
      response_time_ms: 120,
      ssl_valid: 1,
      ssl_expiry: "2027-01-01T00:00:00Z",
      ssl_issuer: "Let's Encrypt",
      is_up: 1,
      in_maintenance: 0,
      error_message: null
    });
  }

  const math = settleEngine.computeSettlementMath(contract as any, probes as any, periodStart, now);
  console.log("Dry Run SLA Math Result:");
  console.log("  Actual Uptime:", math.actualUptimePct + "%");
  console.log("  Target Uptime:", math.targetUptimePct + "%");
  console.log("  Credit Pct:", math.creditPct + "%");
  console.log("  Credit Amount: $" + math.creditAmount.toFixed(2));
  console.log("  Amount Owed: $" + math.amountOwed.toFixed(2));
  console.log("  Matched Tier:", math.matchedTier);

  if (math.actualUptimePct === 99.62 && math.creditAmount === 80 && math.amountOwed === 720) {
    console.log("✅ PERFECT MATCH: 99.62%, $80 credit, $720 captured!");
  } else {
    console.error("❌ MISMATCH!", math);
    process.exit(1);
  }
}

test164();
