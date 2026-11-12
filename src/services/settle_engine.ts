import crypto from "node:crypto";
import { ContractDAO, ProbeDAO, IncidentDAO, SettlementDAO } from "../db";
import { ContractRecord, CreditTier, ProbeRecord, SettlementRecord } from "../types";
import { paypalClient } from "./paypal_client";
import { aiExplainer } from "./ai_explainer";
import { pdfGenerator } from "./pdf_generator";

export interface SettlementComputation {
  totalMonitoredMinutes: number;
  maintenanceMinutes: number;
  eligibleMinutes: number;
  downtimeMinutes: number;
  actualUptimePct: number;
  targetUptimePct: number;
  matchedTier: CreditTier | null;
  creditPct: number;
  originalFee: number;
  creditAmount: number;
  amountOwed: number;
}

export class SettleEngine {
  /**
   * Deterministic mathematical calculation of SLA uptime and financial amounts.
   * STRICT HARD RULE: Code does all uptime math, tier selection, and money calculations.
   * AI is never permitted to calculate or alter these numbers.
   */
  public computeSettlementMath(
    contract: ContractRecord,
    probes: ProbeRecord[],
    periodStart: Date,
    periodEnd: Date
  ): SettlementComputation {
    const originalFee = contract.fee;
    const targetUptimePct = contract.uptime_target;
    const creditTiers: CreditTier[] = JSON.parse(contract.credit_tiers_json || "[]");

    const totalDurationMs = Math.max(1000, periodEnd.getTime() - periodStart.getTime());
    const totalMonitoredMinutes = Math.max(1, Math.round(totalDurationMs / (60 * 1000)));

    let eligibleMinutes = 0;
    let downtimeMinutes = 0;
    let maintenanceMinutes = 0;
    let actualUptimePct = 100.0;

    if (probes.length === 0) {
      // If no probe data exists during period, default to 100% eligible uptime
      eligibleMinutes = totalMonitoredMinutes;
      downtimeMinutes = 0;
      maintenanceMinutes = 0;
      actualUptimePct = 100.0;
    } else {
      let maintenanceCount = 0;
      let downCount = 0;
      let eligibleCount = 0;

      for (const p of probes) {
        if (p.in_maintenance === 1) {
          maintenanceCount++;
        } else {
          eligibleCount++;
          if (p.is_up === 0) {
            downCount++;
          }
        }
      }

      // Convert probe counts to estimated minutes
      // In a 1-minute interval prober, 1 probe = 1 minute
      const minutesPerProbe = probes.length > 1 
        ? totalMonitoredMinutes / probes.length 
        : 1;

      maintenanceMinutes = Math.round(maintenanceCount * minutesPerProbe);
      downtimeMinutes = Math.round(downCount * minutesPerProbe);
      eligibleMinutes = Math.max(1, totalMonitoredMinutes - maintenanceMinutes);

      if (eligibleCount === 0) {
        actualUptimePct = 100.0;
      } else {
        const rawUptime = ((eligibleCount - downCount) / eligibleCount) * 100;
        actualUptimePct = Math.round(rawUptime * 1000) / 1000; // 3 decimal places
      }
    }

    // Tier Selection (Code Only)
    // Sort credit tiers descending by min_uptime
    const sortedTiers = [...creditTiers].sort((a, b) => b.min_uptime - a.min_uptime);
    let matchedTier: CreditTier | null = null;
    let creditPct = 0;

    // Check if actual uptime is below target
    if (actualUptimePct < targetUptimePct) {
      for (const tier of sortedTiers) {
        if (actualUptimePct >= tier.min_uptime && actualUptimePct <= tier.max_uptime) {
          matchedTier = tier;
          creditPct = tier.credit_pct;
          break;
        }
      }

      // If uptime is even lower than all defined min_uptimes, apply highest credit tier
      if (!matchedTier && sortedTiers.length > 0) {
        const lowestTier = sortedTiers[sortedTiers.length - 1];
        if (actualUptimePct < lowestTier.min_uptime) {
          matchedTier = lowestTier;
          creditPct = lowestTier.credit_pct;
        }
      }
    }

    // Money calculation (Code Only)
    const rawCreditAmount = originalFee * (creditPct / 100);
    const creditAmount = Math.round(rawCreditAmount * 100) / 100;
    const amountOwed = Math.max(0, Math.round((originalFee - creditAmount) * 100) / 100);

    return {
      totalMonitoredMinutes,
      maintenanceMinutes,
      eligibleMinutes,
      downtimeMinutes,
      actualUptimePct,
      targetUptimePct,
      matchedTier,
      creditPct,
      originalFee,
      creditAmount,
      amountOwed
    };
  }

  /**
   * Complete end-to-end settlement execution:
   * 1. Query probes and compute SLA math
   * 2. Execute PayPal transaction (Capture, Void, or Refund)
   * 3. Request LLM plain-English explanation (from computed numbers only)
   * 4. Generate PDF statement
   * 5. Record settlement in DB
   */
  public async executeSettlement(contractId: string): Promise<SettlementRecord> {
    const contract = ContractDAO.getById(contractId);
    if (!contract) {
      throw new Error(`Contract not found: ${contractId}`);
    }

    const now = new Date();
    const periodStart = contract.period_start ? new Date(contract.period_start) : new Date(Date.now() - 5 * 60 * 1000);
    const periodEnd = now;

    // Query all probes recorded for this contract in the period
    const probes = ProbeDAO.getByPeriod(contract.id, periodStart.toISOString(), periodEnd.toISOString());

    // 1. Math calculation (Code Only)
    const math = this.computeSettlementMath(contract, probes, periodStart, periodEnd);
    console.log(`📊 [Settlement Math] Contract ${contract.id}: Uptime ${math.actualUptimePct}% (Target: ${math.targetUptimePct}%). Credit: ${math.creditPct}%. Fee: $${math.originalFee} -> Owed: $${math.amountOwed}`);

    // 2. PayPal Transaction Execution
    let paypalAction: "CAPTURE" | "VOID" | "REFUND" = "CAPTURE";
    let paypalTransactionId = "";

    const authId = contract.paypal_authorization_id || "AUTH-DEMO-MOCK";

    if (math.amountOwed > 0) {
      // Capture only the amount owed with final_capture: true
      const captureResult = await paypalClient.captureAuthorization({
        authorizationId: authId,
        amount: math.amountOwed,
        currency: contract.currency,
        isFinalCapture: true,
        note: `Retainer Referee settlement: ${math.actualUptimePct}% uptime, ${math.creditPct}% credit applied`
      });
      paypalAction = "CAPTURE";
      paypalTransactionId = captureResult.id;
      console.log(`💳 [PayPal Captured] $${math.amountOwed} captured with final_capture: true (Capture ID: ${captureResult.id})`);
    } else {
      // Void authorization if nothing is owed (100% credit)
      const voidResult = await paypalClient.voidAuthorization(authId);
      paypalAction = "VOID";
      paypalTransactionId = voidResult.id;
      console.log(`🚫 [PayPal Voided] $0 owed. Authorization voided (Void ID: ${voidResult.id})`);
    }

    // 3. AI Explanation (Generated purely from the computed numbers)
    const incidents = IncidentDAO.getByContract(contract.id);
    const aiExplanation = await aiExplainer.generateSettlementExplanation({
      contractTitle: contract.title,
      agencyName: contract.agency_name,
      clientName: contract.client_name,
      siteUrl: contract.site_url,
      targetUptimePct: math.targetUptimePct,
      actualUptimePct: math.actualUptimePct,
      downtimeMinutes: math.downtimeMinutes,
      maintenanceMinutes: math.maintenanceMinutes,
      totalMonitoredMinutes: math.totalMonitoredMinutes,
      creditTierApplied: math.matchedTier 
        ? `${math.matchedTier.min_uptime}%-${math.matchedTier.max_uptime}% (${math.matchedTier.credit_pct}% credit)` 
        : "None (Full SLA met)",
      creditPct: math.creditPct,
      originalFee: math.originalFee,
      creditAmount: math.creditAmount,
      amountOwed: math.amountOwed,
      currency: contract.currency,
      paypalAction,
      paypalTransactionId,
      incidentCount: incidents.length
    });

    // 4. Generate PDF Statement
    const settlementId = `SETTLE-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
    const pdfPath = await pdfGenerator.generateStatement({
      settlementId,
      contract,
      math,
      paypalAction,
      paypalTransactionId,
      aiExplanation,
      incidents,
      probesCount: probes.length
    });

    // 5. Save Settlement Record in DB
    const settlementRecord: SettlementRecord = {
      id: settlementId,
      contract_id: contract.id,
      settled_at: now.toISOString(),
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      total_monitored_minutes: math.totalMonitoredMinutes,
      maintenance_minutes: math.maintenanceMinutes,
      eligible_minutes: math.eligibleMinutes,
      downtime_minutes: math.downtimeMinutes,
      actual_uptime_pct: math.actualUptimePct,
      target_uptime_pct: math.targetUptimePct,
      credit_tier_applied: JSON.stringify(math.matchedTier || {}),
      credit_pct: math.creditPct,
      original_fee: math.originalFee,
      credit_amount: math.creditAmount,
      amount_owed: math.amountOwed,
      paypal_action: paypalAction,
      paypal_transaction_id: paypalTransactionId,
      pdf_path: pdfPath,
      ai_explanation: aiExplanation
    };

    SettlementDAO.create(settlementRecord);

    // Update contract status to SETTLED or VOIDED
    const finalContractStatus = paypalAction === "VOID" ? "VOIDED" : "SETTLED";
    ContractDAO.recordSettlement(
      contract.id,
      finalContractStatus,
      paypalAction,
      paypalTransactionId,
      math.amountOwed
    );

    return settlementRecord;
  }
}

export const settleEngine = new SettleEngine();
