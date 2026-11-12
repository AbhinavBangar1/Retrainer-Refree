import { Router, Request, Response } from "express";
import { settleEngine } from "../services/settle_engine";

const router = Router();

/**
 * 4. Settle: Triggers deterministic code-based calculation and PayPal transaction
 */
router.post("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const settlement = await settleEngine.executeSettlement(id);

    res.json({
      success: true,
      message: "Contract settled successfully via deterministic code SLA engine.",
      settlement: {
        id: settlement.id,
        contract_id: settlement.contract_id,
        settled_at: settlement.settled_at,
        actual_uptime_pct: settlement.actual_uptime_pct,
        target_uptime_pct: settlement.target_uptime_pct,
        credit_pct: settlement.credit_pct,
        credit_tier_applied: JSON.parse(settlement.credit_tier_applied || "{}"),
        original_fee: settlement.original_fee,
        credit_amount: settlement.credit_amount,
        amount_owed: settlement.amount_owed,
        paypal_action: settlement.paypal_action,
        paypal_transaction_id: settlement.paypal_transaction_id,
        pdf_download_url: `/api/client/contracts/${settlement.contract_id}/statement.pdf`,
        ai_explanation: settlement.ai_explanation
      }
    });
  } catch (err: any) {
    console.error("Settlement error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
