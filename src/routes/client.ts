import { Router, Request, Response } from "express";
import fs from "node:fs";
import { ContractDAO, ProbeDAO, IncidentDAO, SettlementDAO } from "../db";
import { paypalClient } from "../services/paypal_client";

const router = Router();

/**
 * Public client contract review
 */
router.get("/contracts/:id", (req: Request, res: Response) => {
  try {
    const contract = ContractDAO.getById(req.params.id);
    if (!contract) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }

    res.json({
      id: contract.id,
      title: contract.title,
      agency_name: contract.agency_name,
      client_name: contract.client_name,
      client_email: contract.client_email,
      site_url: contract.site_url,
      fee: contract.fee,
      currency: contract.currency,
      uptime_target: contract.uptime_target,
      billing_period_minutes: contract.billing_period_minutes,
      credit_tiers: JSON.parse(contract.credit_tiers_json || "[]"),
      maintenance_windows: JSON.parse(contract.maintenance_windows_json || "[]"),
      exclusions: JSON.parse(contract.exclusions_json || "[]"),
      status: contract.status,
      paypal_order_id: contract.paypal_order_id,
      paypal_authorization_id: contract.paypal_authorization_id,
      period_start: contract.period_start,
      period_end: contract.period_end
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 2. Hold Execution: Client approves the payment hold via PayPal.
 * Calls PayPal Orders v2 Authorize, locks funds, and activates contract.
 */
router.post("/contracts/:id/approve-hold", async (req: Request, res: Response) => {
  try {
    const contract = ContractDAO.getById(req.params.id);
    if (!contract) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }

    if (!contract.paypal_order_id) {
      res.status(400).json({ error: "No PayPal Order ID found on contract. Agency must confirm first." });
      return;
    }

    // Call PayPal Orders v2 Authorize endpoint
    const authResult = await paypalClient.authorizeOrder(contract.paypal_order_id);

    // Compute monitoring period
    const now = new Date();
    const periodStart = now.toISOString();
    const periodMinutes = contract.billing_period_minutes || 5; // Demo mode uses 5-minute period
    const periodEnd = new Date(now.getTime() + periodMinutes * 60 * 1000).toISOString();

    // Activate contract
    ContractDAO.activateContract(
      contract.id,
      authResult.authorization_id,
      authResult.authorized_amount,
      periodStart,
      periodEnd
    );

    console.log(`🚀 [Contract Activated] ${contract.id} is now ACTIVE. Authorization ID: ${authResult.authorization_id}`);

    res.json({
      success: true,
      contract_id: contract.id,
      status: "ACTIVE",
      authorization_id: authResult.authorization_id,
      authorized_amount: authResult.authorized_amount,
      currency: authResult.currency,
      honor_period_expires: authResult.honor_period_expires,
      validity_window_expires: authResult.expiration_time,
      period_start: periodStart,
      period_end: periodEnd,
      message: "Payment hold authorized successfully. Retainer Referee prober is now active."
    });
  } catch (err: any) {
    console.error("Hold approval error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 3. Watch: Live real-time uptime view for client
 */
router.get("/contracts/:id/uptime", (req: Request, res: Response) => {
  try {
    const contract = ContractDAO.getById(req.params.id);
    if (!contract) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }

    const telemetry = ProbeDAO.getRecentAggregates(contract.id);
    const recentProbes = ProbeDAO.getByContract(contract.id, 20);
    const incidents = IncidentDAO.getByContract(contract.id);

    // Compute remaining time in billing window
    let secondsRemaining = 0;
    if (contract.period_end) {
      const diff = new Date(contract.period_end).getTime() - Date.now();
      secondsRemaining = Math.max(0, Math.round(diff / 1000));
    }

    // Current status calculation
    const lastPing = telemetry.last_ping;
    let currentStatus = "UNKNOWN";
    if (lastPing) {
      if (lastPing.in_maintenance === 1) {
        currentStatus = "MAINTENANCE";
      } else if (lastPing.is_up === 1) {
        currentStatus = "HEALTHY";
      } else {
        currentStatus = "DOWN";
      }
    }

    // Calculate current live uptime %
    let currentUptimePct = 100.0;
    const eligiblePings = telemetry.total_pings - telemetry.maintenance_pings;
    if (eligiblePings > 0) {
      currentUptimePct = Math.round(((eligiblePings - telemetry.down_pings) / eligiblePings) * 100000) / 1000;
    }

    res.json({
      contract_id: contract.id,
      title: contract.title,
      site_url: contract.site_url,
      current_status: currentStatus,
      uptime_target: contract.uptime_target,
      current_uptime_pct: currentUptimePct,
      seconds_remaining: secondsRemaining,
      period_start: contract.period_start,
      period_end: contract.period_end,
      telemetry,
      recent_probes: recentProbes,
      incidents
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 5. Explain: Statement Download (PDF)
 */
router.get("/contracts/:id/statement.pdf", (req: Request, res: Response) => {
  try {
    const settlement = SettlementDAO.getByContract(req.params.id);
    if (!settlement || !settlement.pdf_path) {
      res.status(404).json({ error: "Settlement PDF statement not yet generated" });
      return;
    }

    if (!fs.existsSync(settlement.pdf_path)) {
      res.status(404).json({ error: "Statement file not found on disk" });
      return;
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="RetainerReferee_Statement_${req.params.id}.pdf"`);
    const stream = fs.createReadStream(settlement.pdf_path);
    stream.pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
