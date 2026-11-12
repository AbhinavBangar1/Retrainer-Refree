import { Router, Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { evidenceService } from "../services/evidence_service";
import { ClaimDAO } from "../db";

const router = Router();

/**
 * Add a new vendor to watch (Screen X1)
 * POST /api/evidence/watches
 */
router.post("/watches", async (req: Request, res: Response) => {
  try {
    const { vendorName, siteUrl, monthlyFee, termsText, currency } = req.body;
    if (!vendorName || !siteUrl || !monthlyFee) {
      res.status(400).json({ error: "vendorName, siteUrl, and monthlyFee are required" });
      return;
    }

    const result = await evidenceService.createWatch({
      vendorName,
      siteUrl,
      monthlyFee: Number(monthlyFee),
      termsText: termsText || "",
      currency: currency || "USD"
    });

    res.status(201).json({
      success: true,
      watch: result.watch,
      message: "Vendor watch started. Telemetry active."
    });
  } catch (err: any) {
    console.error("Evidence watch creation failed:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * List all watched vendors
 * GET /api/evidence/watches
 */
router.get("/watches", (_req: Request, res: Response) => {
  try {
    const watches = evidenceService.getAllWatches();
    res.json({ watches });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get watch by ID
 * GET /api/evidence/watches/:id
 */
router.get("/watches/:id", (req: Request, res: Response) => {
  try {
    const watch = evidenceService.getWatch(req.params.id);
    if (!watch) {
      res.status(404).json({ error: "Watch not found" });
      return;
    }
    const claims = evidenceService.getClaimsForWatch(watch.id);
    res.json({ watch, claims });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Simulate outage breach and generate Claim Pack (Screen X2)
 * POST /api/evidence/watches/:id/simulate-breach
 */
router.post("/watches/:id/simulate-breach", async (req: Request, res: Response) => {
  try {
    const claim = await evidenceService.simulateBreach(req.params.id);
    res.json({
      success: true,
      claim,
      message: "Breach simulated. Claim pack generated with SHA-256 evidence log."
    });
  } catch (err: any) {
    console.error("Simulate breach failed:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * List all claims
 * GET /api/evidence/claims
 */
router.get("/claims", (_req: Request, res: Response) => {
  try {
    const claims = evidenceService.getAllClaims();
    res.json({ claims });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get claim by ID
 * GET /api/evidence/claims/:id
 */
router.get("/claims/:id", (req: Request, res: Response) => {
  try {
    const claim = evidenceService.getClaim(req.params.id);
    if (!claim) {
      res.status(404).json({ error: "Claim not found" });
      return;
    }
    res.json({ claim });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Download Claim Pack PDF
 * GET /api/evidence/claims/:id/pdf
 */
router.get("/claims/:id/pdf", (req: Request, res: Response) => {
  try {
    const claim = evidenceService.getClaim(req.params.id);
    if (!claim || !claim.pdf_path || !fs.existsSync(claim.pdf_path)) {
      res.status(404).json({ error: "Claim PDF not found or not yet generated" });
      return;
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=claim_pack_${claim.id}.pdf`);
    const stream = fs.createReadStream(claim.pdf_path);
    stream.pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update claim status (e.g. marked as 'sent' or 'enrolled')
 * POST /api/evidence/claims/:id/status
 */
router.post("/claims/:id/status", (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!status || !["draft", "sent", "enrolled"].includes(status)) {
      res.status(400).json({ error: "Valid status required: draft, sent, enrolled" });
      return;
    }

    ClaimDAO.updateStatus(req.params.id, status);
    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
