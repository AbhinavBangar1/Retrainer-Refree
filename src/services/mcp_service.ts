import crypto from "node:crypto";
import { ContractDAO, ProbeDAO, IncidentDAO, SettlementDAO, MCPAuditDAO } from "../db";
import { ContractRecord, CreditTier, MCPAuditRecord } from "../types";
import { contractChecker } from "./contract_checker";
import { settleEngine } from "./settle_engine";
import { llmExtractor } from "./llm_extractor";
import { evidenceService } from "./evidence_service";

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export class MCPService {
  private defaultToken = "rr_agency_secret_2026";

  /**
   * Tool declarations - STRICT HARD RULE: NO TOOL SCHEMA ACCEPTS AN AMOUNT FIELD
   */
  public getToolDefinitions(): MCPToolDefinition[] {
    return [
      {
        name: "create_contract_from_text",
        description: "Parse an SLA proposal or contract text and create a draft contract. Never activates the contract.",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "The raw proposal or SLA text to extract" },
            clientName: { type: "string", description: "Name of the client organization" },
            siteUrl: { type: "string", description: "The website URL to be monitored" }
          },
          required: ["text", "clientName", "siteUrl"]
        }
      },
      {
        name: "check_contract",
        description: "Lint a contract before activation. Runs deterministic checks for tier overlaps, inversions, and AI clarity checks. Returns errors, warnings, and verifiability score.",
        inputSchema: {
          type: "object",
          properties: {
            contractId: { type: "string", description: "ID of the contract to check (e.g. CTR-XXXX)" }
          },
          required: ["contractId"]
        }
      },
      {
        name: "backtest_contract",
        description: "Replays historical probe records or uploaded CSV data through the contract math engine. Returns per-period uptime, tier applied, credit cost, and total.",
        inputSchema: {
          type: "object",
          properties: {
            contractId: { type: "string", description: "Contract ID" },
            csv: { type: "string", description: "Optional raw CSV string of past checks (timestamp, status)" }
          },
          required: ["contractId"]
        }
      },
      {
        name: "list_contracts",
        description: "List all contracts with their status, current uptime, held PayPal authorization amount, and pending credits.",
        inputSchema: {
          type: "object",
          properties: {
            status: { type: "string", description: "Optional status filter (e.g. ACTIVE, DRAFT, PENDING_APPROVAL, SETTLED)" }
          }
        }
      },
      {
        name: "get_uptime_report",
        description: "Returns recorded probe telemetry, current uptime percentage, and incident log for the active monitoring period.",
        inputSchema: {
          type: "object",
          properties: {
            contractId: { type: "string", description: "Contract ID" }
          },
          required: ["contractId"]
        }
      },
      {
        name: "preview_settlement",
        description: "Dry-run deterministic settlement calculation showing what amount code would capture and credit. Changes nothing.",
        inputSchema: {
          type: "object",
          properties: {
            contractId: { type: "string", description: "Contract ID" }
          },
          required: ["contractId"]
        }
      },
      {
        name: "settle_period",
        description: "Executes final deterministic code settlement against PayPal authorization. STRICT GUARDRAIL: Rejected unless confirm is set to true.",
        inputSchema: {
          type: "object",
          properties: {
            contractId: { type: "string", description: "Contract ID" },
            confirm: { type: "boolean", description: "Must explicitly be set to true to execute real financial settlement" }
          },
          required: ["contractId", "confirm"]
        }
      },
      {
        name: "get_statement",
        description: "Returns the link to download the generated PDF statement and explanation.",
        inputSchema: {
          type: "object",
          properties: {
            contractId: { type: "string", description: "Contract ID" },
            period: { type: "string", description: "Optional settlement period identifier" }
          },
          required: ["contractId"]
        }
      },
      {
        name: "create_watch",
        description: "Evidence Mode: Start watching an un-enrolled vendor's website to claim credits manually. No PayPal hold required.",
        inputSchema: {
          type: "object",
          properties: {
            vendorName: { type: "string", description: "Name of the vendor" },
            siteUrl: { type: "string", description: "Vendor website URL to probe" },
            monthlyFee: { type: "number", description: "Monthly retainer fee agreed" },
            termsText: { type: "string", description: "Agreed SLA or proposal text" }
          },
          required: ["vendorName", "siteUrl", "monthlyFee", "termsText"]
        }
      },
      {
        name: "get_claim_pack",
        description: "Evidence Mode: Retrieves the generated Claim Pack with incident evidence, credit owed, SHA-256 log hash, and AI draft letter.",
        inputSchema: {
          type: "object",
          properties: {
            watchId: { type: "string", description: "Watch ID" }
          },
          required: ["watchId"]
        }
      }
    ];
  }

  /**
   * Execute an MCP Tool with audit logging and strict guardrails
   */
  public async executeTool(
    toolName: string,
    args: Record<string, any>,
    token?: string | null
  ): Promise<{ result?: any; error?: string }> {
    const auditId = `MCP-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
    const now = new Date().toISOString();
    let status: "SUCCESS" | "BLOCKED" | "ERROR" = "SUCCESS";
    let finalResult: any = null;
    let errorMessage: string | undefined;

    try {
      switch (toolName) {
        case "create_contract_from_text": {
          const { text, clientName, siteUrl } = args;
          if (!text || !clientName || !siteUrl) {
            throw new Error("Missing required fields: text, clientName, siteUrl");
          }

          const extracted = await llmExtractor.extractContractTerms(text);
          const contractId = `CTR-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
          const newContract: ContractRecord = {
            id: contractId,
            title: extracted.data.title || `Website Retainer Agreement - ${clientName}`,
            agency_name: extracted.data.agency_name || "Apex Studio",
            client_name: clientName,
            client_email: extracted.data.client_email || "billing@example.com",
            site_url: siteUrl,
            fee: extracted.data.fee || 800,
            currency: extracted.data.currency || "USD",
            uptime_target: extracted.data.uptime_target || 99.9,
            measurement_window: "5 minutes (demo mode)",
            billing_period_minutes: extracted.data.billing_period_minutes || 5,
            credit_tiers_json: JSON.stringify(extracted.data.credit_tiers || [
              { min_uptime: 99.5, max_uptime: 99.9, credit_pct: 10 },
              { min_uptime: 0, max_uptime: 99.5, credit_pct: 30 }
            ]),
            maintenance_windows_json: JSON.stringify(extracted.data.maintenance_windows || []),
            exclusions_json: JSON.stringify(extracted.data.exclusions || []),
            status: "DRAFT", // Guardrail: Always created in DRAFT state
            paypal_order_id: null,
            paypal_authorization_id: null,
            paypal_capture_id: null,
            paypal_void_id: null,
            authorized_amount: null,
            captured_amount: null,
            created_at: now,
            period_start: null,
            period_end: null,
            raw_input_text: text
          };

          ContractDAO.create(newContract);
          finalResult = {
            contractId: newContract.id,
            status: "DRAFT",
            fee: newContract.fee,
            currency: newContract.currency,
            uptime_target: newContract.uptime_target,
            message: "Draft contract created. Human confirmation and client PayPal authorization required to activate."
          };
          break;
        }

        case "check_contract": {
          const { contractId } = args;
          const contract = ContractDAO.getById(contractId);
          if (!contract) throw new Error(`Contract not found: ${contractId}`);

          const report = contractChecker.checkContract(contract);
          finalResult = {
            contractId,
            canActivate: report.can_activate,
            verifiabilityScore: report.score,
            errorsCount: report.errors.length,
            warningsCount: report.warnings.length,
            advisoriesCount: report.advisories.length,
            errors: report.errors.map(e => ({ code: e.code, message: e.message, suggestion: e.suggestion })),
            warnings: report.warnings.map(w => ({ code: w.code, message: w.message, suggestion: w.suggestion })),
            advisories: report.advisories.map(a => ({ code: a.code, message: a.message, suggestion: a.suggestion }))
          };
          break;
        }

        case "backtest_contract": {
          const { contractId, csv } = args;
          const contract = ContractDAO.getById(contractId);
          if (!contract) throw new Error(`Contract not found: ${contractId}`);

          const result = contractChecker.backtestContract(contract, csv);
          finalResult = result;
          break;
        }

        case "list_contracts": {
          const { status: statusFilter } = args;
          let contracts = ContractDAO.getAll();
          if (statusFilter) {
            contracts = contracts.filter(c => c.status === statusFilter);
          }

          finalResult = {
            count: contracts.length,
            contracts: contracts.map(c => ({
              id: c.id,
              client_name: c.client_name,
              site_url: c.site_url,
              status: c.status,
              fee: c.fee,
              currency: c.currency,
              uptime_target: c.uptime_target,
              authorized_amount: c.authorized_amount,
              captured_amount: c.captured_amount,
              created_at: c.created_at
            }))
          };
          break;
        }

        case "get_uptime_report": {
          const { contractId } = args;
          const contract = ContractDAO.getById(contractId);
          if (!contract) throw new Error(`Contract not found: ${contractId}`);

          const telemetry = ProbeDAO.getRecentAggregates(contract.id);
          const incidents = IncidentDAO.getByContract(contract.id);

          const totalPings = telemetry.total_pings;
          const upPings = telemetry.up_pings;
          const uptimePct = totalPings > 0 ? Math.round((upPings / totalPings) * 10000) / 100 : 100;

          finalResult = {
            contractId,
            target_uptime: contract.uptime_target,
            current_uptime: uptimePct,
            total_probes: totalPings,
            failed_probes: telemetry.down_pings,
            avg_response_time_ms: telemetry.avg_response_time_ms,
            incidents_count: incidents.length,
            incidents: incidents.slice(0, 5)
          };
          break;
        }

        case "preview_settlement": {
          const { contractId } = args;
          const contract = ContractDAO.getById(contractId);
          if (!contract) throw new Error(`Contract not found: ${contractId}`);

          const periodStart = contract.period_start ? new Date(contract.period_start) : new Date(Date.now() - 5 * 60 * 1000);
          const periodEnd = new Date();
          const probes = ProbeDAO.getByPeriod(contract.id, periodStart.toISOString(), periodEnd.toISOString());

          // Deterministic math check
          const math = settleEngine.computeSettlementMath(contract, probes, periodStart, periodEnd);
          finalResult = {
            contractId,
            dryRun: true,
            originalFee: math.originalFee,
            actualUptimePct: math.actualUptimePct,
            targetUptimePct: math.targetUptimePct,
            creditPct: math.creditPct,
            creditAmount: math.creditAmount,
            amountToCapture: math.amountOwed,
            action: math.amountOwed > 0 ? "CAPTURE" : "VOID",
            note: "Preview only. No payment or authorization altered."
          };
          break;
        }

        case "settle_period": {
          const { contractId, confirm } = args;
          if (confirm !== true) {
            status = "BLOCKED";
            throw new Error("Settlement rejected: 'confirm: true' is strictly required to execute real financial settlement.");
          }

          const contract = ContractDAO.getById(contractId);
          if (!contract) throw new Error(`Contract not found: ${contractId}`);

          // Guardrail: checker errors block activation/settlement
          const check = contractChecker.checkContract(contract);
          if (check.errors.length > 0) {
            status = "BLOCKED";
            throw new Error(`Activation blocked: ${check.errors.length} checker error(s) must be cleared first.`);
          }

          const settlement = await settleEngine.executeSettlement(contractId);
          finalResult = {
            settlementId: settlement.id,
            contractId: settlement.contract_id,
            settledAt: settlement.settled_at,
            actualUptimePct: settlement.actual_uptime_pct,
            creditPct: settlement.credit_pct,
            originalFee: settlement.original_fee,
            creditAmount: settlement.credit_amount,
            capturedAmount: settlement.amount_owed,
            paypalAction: settlement.paypal_action,
            paypalTransactionId: settlement.paypal_transaction_id,
            pdfUrl: `/api/client/contracts/${contractId}/statement.pdf`
          };
          break;
        }

        case "get_statement": {
          const { contractId } = args;
          const contract = ContractDAO.getById(contractId);
          if (!contract) throw new Error(`Contract not found: ${contractId}`);

          const settlement = SettlementDAO.getByContract(contractId);
          finalResult = {
            contractId,
            hasSettlement: !!settlement,
            pdfUrl: `/api/client/contracts/${contractId}/statement.pdf`,
            settlementDetails: settlement ? {
              settlementId: settlement.id,
              capturedAmount: settlement.amount_owed,
              creditAmount: settlement.credit_amount,
              uptimePct: settlement.actual_uptime_pct
            } : null
          };
          break;
        }

        case "create_watch": {
          const { vendorName, siteUrl, monthlyFee, termsText } = args;
          if (!vendorName || !siteUrl || !monthlyFee || !termsText) {
            throw new Error("Missing required fields: vendorName, siteUrl, monthlyFee, termsText");
          }

          const { watch } = await evidenceService.createWatch({
            vendorName,
            siteUrl,
            monthlyFee: Number(monthlyFee),
            termsText
          });

          finalResult = {
            watchId: watch.id,
            vendorName: watch.vendor_name,
            siteUrl: watch.site_url,
            monthlyFee: watch.monthly_fee,
            status: watch.status,
            message: "Evidence mode probe initialized. Ready to record uptime and build claims."
          };
          break;
        }

        case "get_claim_pack": {
          const { watchId } = args;
          let claims = evidenceService.getClaimsForWatch(watchId);
          let claim = claims.length > 0 ? claims[0] : null;

          if (!claim) {
            // Generate breach and claim pack automatically
            claim = await evidenceService.simulateBreach(watchId);
          }

          finalResult = {
            claimId: claim.id,
            watchId: claim.watch_id,
            vendorName: claim.vendor_name,
            siteUrl: claim.site_url,
            actualUptime: claim.actual_uptime,
            targetUptime: claim.target_uptime,
            totalDowntimeMinutes: claim.total_downtime_minutes,
            tierApplied: claim.tier_applied,
            creditOwed: claim.credit_owed,
            sha256LogHash: claim.log_hash,
            probeRegion: claim.probe_region,
            claimLetterDraft: claim.claim_letter,
            pdfUrl: claim.pdf_url,
            inviteLink: claim.invite_link,
            status: claim.status
          };
          break;
        }

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (err: any) {
      if (status !== "BLOCKED") status = "ERROR";
      errorMessage = err.message || "Execution error";
    }

    // Record in MCP Audit Ledger
    const auditRecord: MCPAuditRecord = {
      id: auditId,
      token: token || "default-agency",
      tool_name: toolName,
      input_json: JSON.stringify(args),
      result_json: JSON.stringify(finalResult || { error: errorMessage }),
      status,
      created_at: now
    };
    MCPAuditDAO.log(auditRecord);

    if (errorMessage) {
      return { error: errorMessage };
    }
    return { result: finalResult };
  }
}

export const mcpService = new MCPService();
