import fs from "node:fs";
import { ContractDAO, ProbeDAO, IncidentDAO, SettlementDAO, WebhookLogDAO } from "../src/db";
import { llmExtractor } from "../src/services/llm_extractor";
import { paypalClient } from "../src/services/paypal_client";
import { proberService } from "../src/services/prober";
import { settleEngine } from "../src/services/settle_engine";
import { ContractRecord } from "../src/types";

function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`❌ FAILED ASSERTION: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function runCoreLoopVerification() {
  console.log("\n==================================================================");
  console.log("⚖️  STARTING RETAINER REFEREE END-TO-END CORE LOOP VERIFICATION");
  console.log("==================================================================\n");

  // -------------------------------------------------------------------------
  // STEP 1: EXTRACT (Messy proposal text -> strict JSON schema via LLM)
  // -------------------------------------------------------------------------
  console.log("--- [STEP 1: EXTRACT] ---");
  const sampleProposal = `
    Hi Sarah, here is our proposal for maintaining the Nordic Craft Store (https://nordiccrafts.com).
    Agency: Apex Digital Studio
    Client: Nordic Craft Goods (sarah@nordiccrafts.com)
    Monthly Retainer Fee: $1,500.00 USD.
    SLA Commitment: We guarantee 99.9% monthly uptime.
    Credit Structure:
    - If uptime is between 99.5% and 99.9%, you receive an automatic 10% credit.
    - If uptime falls below 99.5%, you receive an automatic 30% credit.
    Maintenance Window: Sunday 02:00 to 04:00 UTC (excluded from SLA).
    Exclusions: Upstream registrar/DNS outages and unapproved client repo commits.
    Measurement window: 5 minutes (demo mode).
  `;

  const extractResult = await llmExtractor.extractContractTerms(sampleProposal);
  const terms = extractResult.data;

  assert(Boolean(terms.title), "Title extracted");
  assert(terms.fee === 1500, `Extracted fee: $${terms.fee} (expected 1500)`);
  assert(terms.currency === "USD", "Currency is USD");
  assert(terms.uptime_target === 99.9, "Target uptime is 99.9%");
  assert(terms.credit_tiers.length >= 2, "Extracted at least 2 credit tiers");
  assert(terms.credit_tiers[0].credit_pct === 10, "First tier credit is 10%");
  assert(terms.credit_tiers[1].credit_pct === 30, "Second tier credit is 30%");
  assert(terms.maintenance_windows.length > 0, "Maintenance window extracted");
  assert(terms.maintenance_windows[0].start_time === "02:00", "Maintenance starts 02:00");
  assert(terms.maintenance_windows[0].end_time === "04:00", "Maintenance ends 04:00");

  // Agency confirms terms and creates DRAFT contract
  const contractId = `TEST-CTR-${Date.now()}`;
  const contractRecord: ContractRecord = {
    id: contractId,
    title: terms.title,
    agency_name: terms.agency_name,
    client_name: terms.client_name,
    client_email: terms.client_email,
    site_url: "https://example.com", // use accessible domain for live network probe
    fee: terms.fee,
    currency: terms.currency,
    uptime_target: terms.uptime_target,
    measurement_window: terms.measurement_window,
    billing_period_minutes: 5,
    credit_tiers_json: JSON.stringify(terms.credit_tiers),
    maintenance_windows_json: JSON.stringify(terms.maintenance_windows),
    exclusions_json: JSON.stringify(terms.exclusions),
    status: "DRAFT",
    paypal_order_id: null,
    paypal_authorization_id: null,
    paypal_capture_id: null,
    paypal_void_id: null,
    authorized_amount: null,
    captured_amount: null,
    created_at: new Date().toISOString(),
    period_start: null,
    period_end: null,
    raw_input_text: sampleProposal
  };

  ContractDAO.create(contractRecord);
  const savedContract = ContractDAO.getById(contractId);
  assert(savedContract !== null && savedContract.status === "DRAFT", "Contract saved in DB with status DRAFT");

  // -------------------------------------------------------------------------
  // STEP 2: HOLD (PayPal Orders v2 AUTHORIZE -> Client Approves Hold)
  // -------------------------------------------------------------------------
  console.log("\n--- [STEP 2: HOLD (PAYPAL ORDERS V2 AUTHORIZATION)] ---");
  const order = await paypalClient.createAuthorizationOrder({
    contractId: contractRecord.id,
    title: contractRecord.title,
    fee: contractRecord.fee,
    currency: contractRecord.currency
  });

  assert(Boolean(order.id), `PayPal Order created: ${order.id}`);
  assert(order.intent === "AUTHORIZE", "PayPal Order intent is strictly AUTHORIZE");

  ContractDAO.updatePayPalOrder(contractId, order.id, "PENDING_APPROVAL");

  // Client approves hold
  const authResult = await paypalClient.authorizeOrder(order.id);
  assert(Boolean(authResult.authorization_id), `PayPal Authorization ID obtained: ${authResult.authorization_id}`);
  assert(Boolean(authResult.honor_period_expires), `PayPal 3-day Honor Period set: ${authResult.honor_period_expires}`);
  assert(Boolean(authResult.expiration_time), `PayPal 29-day Validity Window set: ${authResult.expiration_time}`);

  // Activate contract
  const now = new Date();
  const periodStart = now.toISOString();
  const periodEnd = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  ContractDAO.activateContract(contractId, authResult.authorization_id, authResult.authorized_amount, periodStart, periodEnd);

  const activeContract = ContractDAO.getById(contractId);
  assert(activeContract?.status === "ACTIVE", "Contract is now ACTIVE with funds authorized on hold");

  // -------------------------------------------------------------------------
  // STEP 3: WATCH (Prober Scheduler, Maintenance Filter & Incident Manager)
  // -------------------------------------------------------------------------
  console.log("\n--- [STEP 3: WATCH (PROBING, MAINTENANCE, & INCIDENTS)] ---");
  // Test live probe against target URL
  const probe = await proberService.probeContract(activeContract!);
  assert(probe.contract_id === contractId, "Probe linked to contract");
  assert(probe.response_time_ms >= 0, `Probe latency measured: ${probe.response_time_ms}ms`);
  assert(probe.ssl_valid === 1, "SSL certificate validated");

  // Test maintenance window filter
  const sundayMaintenanceDate = new Date("2026-11-08T02:30:00Z"); // A Sunday at 02:30 UTC
  const inWindow = proberService.isInsideMaintenanceWindow(sundayMaintenanceDate, terms.maintenance_windows);
  assert(inWindow === true, "Probe correctly flagged in agreed maintenance window (Sunday 02:30 UTC)");

  const mondayNormalDate = new Date("2026-11-09T14:00:00Z"); // Monday at 14:00 UTC
  const outsideWindow = proberService.isInsideMaintenanceWindow(mondayNormalDate, terms.maintenance_windows);
  assert(outsideWindow === false, "Probe correctly flagged outside maintenance window");

  // Test incident management with chaos injection
  console.log("  Injecting chaos failure (simulating 503 outage)...");
  proberService.setChaos(contractId, { simulateDown: true, statusCode: 503, reason: "HTTP 503 Database Connection Pool Exhausted" });
  await proberService.probeContract(activeContract!);
  const activeIncident = IncidentDAO.getActive(contractId);
  assert(activeIncident !== null, "Incident successfully created upon failure");
  assert(activeIncident?.reason.includes("503"), "Incident records root cause");

  // Restore service
  console.log("  Restoring service (resolving outage)...");
  proberService.setChaos(contractId, { simulateDown: false });
  await proberService.probeContract(activeContract!);
  const incidentAfterRecovery = IncidentDAO.getActive(contractId);
  assert(incidentAfterRecovery === null, "Active incident resolved upon service restoration");

  // -------------------------------------------------------------------------
  // STEP 4: SETTLE (Deterministic Math & Tier Selection - HARD RULE)
  // -------------------------------------------------------------------------
  console.log("\n--- [STEP 4: SETTLE (DETERMINISTIC CODE MATH & PAYPAL SETTLEMENT)] ---");

  // Test deterministic math engine edge cases:
  // Edge Case A: 100% uptime -> 0% credit -> full fee $1,500
  const math100 = settleEngine.computeSettlementMath(activeContract!, [], now, new Date(now.getTime() + 300000));
  assert(math100.actualUptimePct === 100, "Math: 100% uptime");
  assert(math100.creditPct === 0, "Math: 0% credit tier");
  assert(math100.amountOwed === 1500, "Math: Full $1,500 owed to agency");

  // Edge Case B: Simulated probes with 99.7% uptime (matches 10% credit tier: 99.5 - 99.9%)
  // 1000 probes: 3 down, 997 up = 99.7%
  const simulatedProbesTier1 = Array.from({ length: 1000 }, (_, i) => ({
    contract_id: contractId,
    timestamp: new Date(now.getTime() + i * 1000).toISOString(),
    status_code: i < 3 ? 503 : 200,
    response_time_ms: 120,
    ssl_valid: 1,
    ssl_expiry: null,
    ssl_issuer: null,
    is_up: i < 3 ? 0 : 1,
    in_maintenance: 0,
    error_message: i < 3 ? "503 Error" : null
  }));

  const mathTier1 = settleEngine.computeSettlementMath(activeContract!, simulatedProbesTier1, now, new Date(now.getTime() + 1000000));
  assert(mathTier1.actualUptimePct === 99.7, `Math: Actual uptime is 99.7% (expected 99.7%)`);
  assert(mathTier1.creditPct === 10, `Math: Matched 10% credit tier`);
  assert(mathTier1.creditAmount === 150, `Math: Credit deducted is $150 (10% of $1,500)`);
  assert(mathTier1.amountOwed === 1350, `Math: Net amount owed is $1,350 ($1,500 - $150)`);

  // Edge Case C: Severe outage 98.0% uptime (below 99.5% -> 30% credit tier)
  const simulatedProbesTier2 = Array.from({ length: 100 }, (_, i) => ({
    contract_id: contractId,
    timestamp: new Date(now.getTime() + i * 1000).toISOString(),
    status_code: i < 2 ? 503 : 200,
    response_time_ms: 120,
    ssl_valid: 1,
    ssl_expiry: null,
    ssl_issuer: null,
    is_up: i < 2 ? 0 : 1,
    in_maintenance: 0,
    error_message: i < 2 ? "503 Error" : null
  }));
  const mathTier2 = settleEngine.computeSettlementMath(activeContract!, simulatedProbesTier2, now, new Date(now.getTime() + 100000));
  assert(mathTier2.actualUptimePct === 98.0, `Math: Actual uptime is 98.0%`);
  assert(mathTier2.creditPct === 30, `Math: Matched 30% credit tier`);
  assert(mathTier2.creditAmount === 450, `Math: Credit deducted is $450`);
  assert(mathTier2.amountOwed === 1050, `Math: Net amount owed is $1,050 ($1,500 - $450)`);

  // Edge Case D: Maintenance window exclusion test in math engine
  // 100 probes total: 10 in maintenance (down), 90 outside maintenance (up) -> eligible uptime must be 100%!
  const simulatedProbesMaintenance = [
    ...Array.from({ length: 10 }, (_, i) => ({
      contract_id: contractId,
      timestamp: new Date(now.getTime() + i * 1000).toISOString(),
      status_code: 503,
      response_time_ms: 120,
      ssl_valid: 1,
      ssl_expiry: null,
      ssl_issuer: null,
      is_up: 0,
      in_maintenance: 1, // AGREED MAINTENANCE
      error_message: "Routine server restart"
    })),
    ...Array.from({ length: 90 }, (_, i) => ({
      contract_id: contractId,
      timestamp: new Date(now.getTime() + (i + 10) * 1000).toISOString(),
      status_code: 200,
      response_time_ms: 120,
      ssl_valid: 1,
      ssl_expiry: null,
      ssl_issuer: null,
      is_up: 1,
      in_maintenance: 0,
      error_message: null
    }))
  ];
  const mathMaint = settleEngine.computeSettlementMath(activeContract!, simulatedProbesMaintenance, now, new Date(now.getTime() + 100000));
  assert(mathMaint.maintenanceMinutes >= 0, "Maintenance minutes tracked");
  assert(mathMaint.actualUptimePct === 100, `Maintenance downtime excluded: Uptime is ${mathMaint.actualUptimePct}% (expected 100%)`);
  assert(mathMaint.creditPct === 0, "0% penalty applied during approved maintenance");

  // Execute full settlement on our active test contract
  console.log("  Executing live settlement on contract...");
  const settlement = await settleEngine.executeSettlement(contractId);

  assert(Boolean(settlement.id), `Settlement created: ${settlement.id}`);
  assert(settlement.paypal_action === "CAPTURE", `PayPal action: ${settlement.paypal_action}`);
  assert(Boolean(settlement.paypal_transaction_id), `PayPal Capture ID: ${settlement.paypal_transaction_id}`);
  assert(settlement.amount_owed > 0, `Amount captured: $${settlement.amount_owed}`);

  const settledContract = ContractDAO.getById(contractId);
  assert(settledContract?.status === "SETTLED", "Contract status updated to SETTLED in DB");
  assert(settledContract?.captured_amount === settlement.amount_owed, "Captured amount matches settlement math");

  // -------------------------------------------------------------------------
  // STEP 5: EXPLAIN (AI Plain-English Summary & PDF Statement)
  // -------------------------------------------------------------------------
  console.log("\n--- [STEP 5: EXPLAIN (AI NARRATIVE & PDF STATEMENT)] ---");
  assert(Boolean(settlement.ai_explanation), "AI Plain-English summary generated");
  console.log(`  AI Narrative Preview:\n  "${settlement.ai_explanation.substring(0, 160)}..."`);

  assert(Boolean(settlement.pdf_path), `PDF path: ${settlement.pdf_path}`);
  assert(fs.existsSync(settlement.pdf_path), "PDF file exists on disk");

  const pdfBuffer = fs.readFileSync(settlement.pdf_path);
  assert(pdfBuffer.length > 2000, `PDF size: ${pdfBuffer.length} bytes (non-empty document)`);
  const pdfHeader = pdfBuffer.toString("utf-8", 0, 5);
  assert(pdfHeader === "%PDF-", `PDF valid file format verified (magic header: ${pdfHeader})`);

  // -------------------------------------------------------------------------
  // STEP 6: PAYPAL WEBHOOKS (Authorization, Capture, Void logging)
  // -------------------------------------------------------------------------
  console.log("\n--- [STEP 6: PAYPAL WEBHOOK LOGGING] ---");
  WebhookLogDAO.log({
    id: `WH-TEST-${Date.now()}`,
    event_id: "WH-EVT-992384729",
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource_id: settlement.paypal_transaction_id,
    payload_json: JSON.stringify({
      id: "WH-EVT-992384729",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: settlement.paypal_transaction_id,
        status: "COMPLETED",
        amount: { currency_code: "USD", value: settlement.amount_owed.toFixed(2) }
      }
    }),
    received_at: new Date().toISOString()
  });

  const webhookLogs = WebhookLogDAO.getAll(5);
  assert(webhookLogs.length > 0, "Webhook log entry recorded");
  assert(webhookLogs[0].event_type === "PAYMENT.CAPTURE.COMPLETED", "Capture webhook event stored");

  console.log("\n==================================================================");
  console.log("🎉 ALL CORE LOOP VERIFICATION CHECKS PASSED WITH 100% INTEGRITY!");
  console.log("==================================================================\n");

  // Clean exit
  process.exit(0);
}

runCoreLoopVerification().catch((err) => {
  console.error("FATAL VERIFICATION ERROR:", err);
  process.exit(1);
});
