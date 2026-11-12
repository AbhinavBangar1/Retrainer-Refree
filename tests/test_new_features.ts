import { contractChecker } from "../src/services/contract_checker";
import { evidenceService } from "../src/services/evidence_service";
import { mcpService } from "../src/services/mcp_service";
import { ContractDAO, WatchDAO, ClaimDAO, MCPAuditDAO } from "../src/db";
import { ContractRecord } from "../src/types";

async function runTests() {
  console.log("🧪 ========================================================");
  console.log("🧪 TESTING FEATURE 1: CONTRACT CHECKER & BACK-TEST (A2b)");
  console.log("🧪 ========================================================");

  // Create test contract with overlapping tiers matching Screen A2b
  const testContractId = `TEST-CTR-OVERLAP-${Date.now()}`;
  const overlappingContract: ContractRecord = {
    id: testContractId,
    title: "Website Retainer Agreement - Overlap Test",
    agency_name: "Apex Studio",
    client_name: "Northwind Dental",
    client_email: "billing@northwinddental.example",
    site_url: "https://northwinddental.example",
    fee: 800,
    currency: "USD",
    uptime_target: 99.9,
    measurement_window: "5 minutes (demo mode)",
    billing_period_minutes: 5,
    credit_tiers_json: JSON.stringify([
      { min_uptime: 99.5, max_uptime: 99.9, credit_pct: 10 },
      { min_uptime: 0, max_uptime: 99.5, credit_pct: 30 } // Both touch 99.5%
    ]),
    maintenance_windows_json: JSON.stringify([
      { day_of_week: "Sunday", start_time: "02:00", end_time: "04:00", timezone: "UTC" }
    ]),
    exclusions_json: JSON.stringify(["Sunday maintenance"]),
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
    raw_input_text: "Vendor will use best efforts and reasonable response time for incident resolution. Response time target is under 3 seconds."
  };

  ContractDAO.create(overlappingContract);

  // 1. Run Check
  const report1 = contractChecker.checkContract(overlappingContract);
  console.log(`[Check 1] Can activate: ${report1.can_activate} (Expected: false due to tier overlap)`);
  console.log(`[Check 1] Errors found: ${report1.errors.length} (${report1.errors.map(e => e.message).join("; ")})`);
  console.log(`[Check 1] Warnings found: ${report1.warnings.length} (${report1.warnings.map(w => w.message).join("; ")})`);
  console.log(`[Check 1] Advisories found: ${report1.advisories.length}`);
  console.log(`[Check 1] Verifiability Score: ${report1.score.label} (${report1.score.percentage}%)`);

  if (report1.can_activate) {
    throw new Error("FAIL: Contract with overlapping tiers should NOT be activatable!");
  }

  // 2. Run Back-test
  const backtest = contractChecker.backtestContract(overlappingContract);
  console.log(`[Backtest] Periods replayed: ${backtest.periods.map(p => `${p.period}: ${p.uptime}% -> $${p.credit}`).join(" | ")}`);
  console.log(`[Backtest] Total credit cost: $${backtest.total_credit_cost} (Expected: $320)`);
  if (backtest.total_credit_cost !== 320) {
    throw new Error(`FAIL: Expected $320 backtest cost, got $${backtest.total_credit_cost}`);
  }

  // 3. Apply suggested fixes
  const fixes = contractChecker.applyFixes(overlappingContract);
  ContractDAO.updateTiersAndTerms(
    overlappingContract.id,
    JSON.stringify(fixes.updatedTiers),
    JSON.stringify(fixes.updatedExclusions)
  );

  const fixedContract = ContractDAO.getById(overlappingContract.id)!;
  const report2 = contractChecker.checkContract(fixedContract);
  console.log(`[Check 2 after fix] Can activate: ${report2.can_activate} (Expected: true)`);
  console.log(`[Check 2 after fix] Errors remaining: ${report2.errors.length}`);
  if (!report2.can_activate || report2.errors.length > 0) {
    throw new Error("FAIL: Fixed contract should have 0 errors and be activatable!");
  }

  console.log("\n🧪 ========================================================");
  console.log("🧪 TESTING FEATURE 2: EVIDENCE MODE (X1 and X2)");
  console.log("🧪 ========================================================");

  // 1. Create Watch (Screen X1)
  const watchResult = await evidenceService.createWatch({
    vendorName: "Apex Studio",
    siteUrl: "https://northwinddental.example",
    monthlyFee: 800,
    termsText: "SLA Agreement: 99.9% uptime. Tier 1: 99.5%-99.9% earns 10% credit ($80). Below 99.5% earns 30% credit ($240)."
  });
  console.log(`[Watch Created] ID: ${watchResult.watch.id}, Vendor: ${watchResult.watch.vendor_name}, Fee: $${watchResult.watch.monthly_fee}`);

  // 2. Simulate Breach & Generate Claim Pack (Screen X2)
  const claim = await evidenceService.simulateBreach(watchResult.watch.id);
  console.log(`[Claim Pack Generated] Claim ID: ${claim.id}`);
  console.log(`[Claim Math] Recorded Uptime: ${claim.actual_uptime}% against Target ${claim.target_uptime}%`);
  console.log(`[Claim Math] Total Downtime: ${claim.total_downtime_minutes} minutes across ${claim.incidents.length} incidents`);
  console.log(`[Claim Math] Applied Tier: ${claim.tier_applied}, Credit Owed: $${claim.credit_owed}`);
  console.log(`[Claim Cryptography] SHA-256 Log Hash: ${claim.log_hash.substring(0, 16)}...`);
  console.log(`[Claim Letter Draft] "${claim.claim_letter.substring(0, 120)}..."`);
  console.log(`[Claim PDF Generated] Path: ${claim.pdf_path}`);
  console.log(`[Growth Loop Invite] Link: ${claim.invite_link}`);

  if (claim.credit_owed !== 80 || claim.actual_uptime !== 99.62) {
    throw new Error(`FAIL: Expected $80.00 credit and 99.62% uptime, got $${claim.credit_owed} and ${claim.actual_uptime}%`);
  }

  console.log("\n🧪 ========================================================");
  console.log("🧪 TESTING FEATURE 3: MCP SERVER & GUARDRAILS");
  console.log("🧪 ========================================================");

  // 1. List tools and verify no amount parameter exists in any schema
  const tools = mcpService.getToolDefinitions();
  console.log(`[MCP Tools] Registered ${tools.length} tools`);
  for (const t of tools) {
    const props = t.inputSchema?.properties || {};
    if ("amount" in props || "creditAmount" in props) {
      throw new Error(`FAIL: Guardrail violated! Tool '${t.name}' contains an amount parameter.`);
    }
  }
  console.log("🛡️ [Guardrail Verified] Zero tool schemas accept an amount parameter.");

  // 2. Test settle_period rejection without confirm: true
  const settleFail = await mcpService.executeTool("settle_period", {
    contractId: testContractId,
    confirm: false
  });
  console.log(`[MCP Guardrail] settle_period without confirm: error="${settleFail.error}"`);
  if (!settleFail.error || !settleFail.error.includes("strictly required")) {
    throw new Error("FAIL: settle_period must be rejected without confirm: true!");
  }

  // 3. Test create_contract_from_text via MCP
  const mcpDraft = await mcpService.executeTool("create_contract_from_text", {
    text: "Monthly retainer for Northwind Dental website maintenance. Fee: $800. Target uptime: 99.9%.",
    clientName: "Northwind Dental",
    siteUrl: "https://northwinddental.example"
  });
  console.log(`[MCP create_contract] Result: ${JSON.stringify(mcpDraft.result)}`);
  if (!mcpDraft.result?.contractId || mcpDraft.result?.status !== "DRAFT") {
    throw new Error("FAIL: MCP create_contract_from_text failed or did not return DRAFT status");
  }

  // 4. Verify Audit Ledger
  const auditLogs = MCPAuditDAO.getAll(10);
  console.log(`[MCP Audit Ledger] Logged ${auditLogs.length} calls. Latest: tool=${auditLogs[0]?.tool_name}, status=${auditLogs[0]?.status}`);
  if (auditLogs.length === 0) {
    throw new Error("FAIL: MCP audit log is empty!");
  }

  console.log("\n========================================================");
  console.log("🎉 ALL NEW FEATURES TESTED & VERIFIED WITH 100% SUCCESS!");
  console.log("========================================================\n");
}

runTests().catch(err => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
