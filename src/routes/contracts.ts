import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { ContractDAO, ProbeDAO, IncidentDAO, SettlementDAO } from "../db";
import { llmExtractor } from "../services/llm_extractor";
import { paypalClient } from "../services/paypal_client";
import { contractChecker } from "../services/contract_checker";
import { ContractExtractionSchema, ContractRecord } from "../types";

const router = Router();

/**
 * 1. Extract: Agency pastes proposal or chat thread.
 * LLM returns strict JSON validated against ContractExtractionSchema with retries.
 */
router.post("/extract", async (req: Request, res: Response) => {
  try {
    const { raw_text } = req.body;
    if (!raw_text || typeof raw_text !== "string" || !raw_text.trim()) {
      res.status(400).json({ error: "raw_text string is required" });
      return;
    }

    const result = await llmExtractor.extractContractTerms(raw_text);
    res.json({
      success: true,
      attempts: result.attempts,
      extracted: result.data
    });
  } catch (err: any) {
    console.error("Extraction error:", err);
    res.status(500).json({ error: err.message || "Contract extraction failed" });
  }
});

/**
 * Create contract record from verified extracted terms
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const parseResult = ContractExtractionSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: "Validation failed against contract schema",
        issues: parseResult.error.format()
      });
      return;
    }

    const data = parseResult.data;
    const contractId = `CTR-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
    const now = new Date().toISOString();

    const record: ContractRecord = {
      id: contractId,
      title: data.title,
      agency_name: data.agency_name,
      client_name: data.client_name,
      client_email: data.client_email,
      site_url: data.site_url,
      fee: data.fee,
      currency: data.currency,
      uptime_target: data.uptime_target,
      measurement_window: data.measurement_window,
      billing_period_minutes: data.billing_period_minutes,
      credit_tiers_json: JSON.stringify(data.credit_tiers),
      maintenance_windows_json: JSON.stringify(data.maintenance_windows),
      exclusions_json: JSON.stringify(data.exclusions),
      status: "DRAFT",
      paypal_order_id: null,
      paypal_authorization_id: null,
      paypal_capture_id: null,
      paypal_void_id: null,
      authorized_amount: null,
      captured_amount: null,
      created_at: now,
      period_start: null,
      period_end: null,
      raw_input_text: req.body.raw_input_text || null
    };

    ContractDAO.create(record);
    res.status(201).json({ success: true, contract: record });
  } catch (err: any) {
    console.error("Contract creation error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * List all contracts
 */
router.get("/", (_req: Request, res: Response) => {
  try {
    const contracts = ContractDAO.getAll();
    res.json({ contracts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get contract details with telemetry, incident, and settlement records
 */
router.get("/:id", (req: Request, res: Response) => {
  try {
    const contract = ContractDAO.getById(req.params.id);
    if (!contract) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }

    const telemetry = ProbeDAO.getRecentAggregates(contract.id);
    const incidents = IncidentDAO.getByContract(contract.id);
    const settlement = SettlementDAO.getByContract(contract.id);

    res.json({
      contract,
      telemetry,
      incidents,
      settlement
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 2. Hold Preparation: Agency confirms terms and generates PayPal Orders v2 with intent AUTHORIZE
 */
router.post("/:id/confirm", async (req: Request, res: Response) => {
  try {
    const contract = ContractDAO.getById(req.params.id);
    if (!contract) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }

    // Create PayPal Orders v2 Order with intent: "AUTHORIZE"
    const order = await paypalClient.createAuthorizationOrder({
      contractId: contract.id,
      title: contract.title,
      fee: contract.fee,
      currency: contract.currency
    });

    // Update contract status to PENDING_APPROVAL
    ContractDAO.updatePayPalOrder(contract.id, order.id, "PENDING_APPROVAL");

    res.json({
      success: true,
      contract_id: contract.id,
      paypal_order_id: order.id,
      status: "PENDING_APPROVAL",
      approval_url: order.links.find(l => l.rel === "approve")?.href || null,
      message: "PayPal authorization order created. Ready for client approval."
    });
  } catch (err: any) {
    console.error("Confirmation / PayPal Order creation failed:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 1. Contract Checker (Agency side, screen A2b)
 * POST /api/contracts/:id/check
 * Returns deterministic code errors, warnings, AI advisories, and verifiability score
 */
router.post("/:id/check", (req: Request, res: Response) => {
  try {
    const contract = ContractDAO.getById(req.params.id);
    if (!contract) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }

    const report = contractChecker.checkContract(contract);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Back-test contract against historical uptime CSV
 * POST /api/contracts/:id/backtest
 */
router.post("/:id/backtest", (req: Request, res: Response) => {
  try {
    const contract = ContractDAO.getById(req.params.id);
    if (!contract) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }

    const { csv } = req.body;
    const result = contractChecker.backtestContract(contract, csv);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Apply suggested fixes to contract
 * POST /api/contracts/:id/apply-fixes
 */
router.post("/:id/apply-fixes", (req: Request, res: Response) => {
  try {
    const contract = ContractDAO.getById(req.params.id);
    if (!contract) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }

    const { updatedTiers, updatedExclusions } = contractChecker.applyFixes(contract);
    ContractDAO.updateTiersAndTerms(
      contract.id,
      JSON.stringify(updatedTiers),
      JSON.stringify(updatedExclusions)
    );

    const updatedContract = ContractDAO.getById(contract.id);
    const newReport = updatedContract ? contractChecker.checkContract(updatedContract) : null;

    res.json({
      success: true,
      contract: updatedContract,
      report: newReport
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
