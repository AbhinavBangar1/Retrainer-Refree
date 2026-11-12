import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { WebhookLogDAO, ContractDAO } from "../db";

const router = Router();

/**
 * Ingest PayPal Sandbox Webhooks
 * Handles:
 * - PAYMENT.AUTHORIZATION.CREATED
 * - PAYMENT.CAPTURE.COMPLETED
 * - PAYMENT.AUTHORIZATION.VOIDED
 * - CHECKOUT.ORDER.APPROVED
 */
router.post("/paypal", async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const eventType = payload.event_type || "UNKNOWN";
    const eventId = payload.id || `EVT-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
    const resource = payload.resource || {};
    const resourceId = resource.id || "N/A";

    console.log(`🔔 [PayPal Webhook] Received ${eventType} (Event ID: ${eventId}, Resource: ${resourceId})`);

    // Log webhook event
    WebhookLogDAO.log({
      id: `WH-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
      event_id: eventId,
      event_type: eventType,
      resource_id: resourceId,
      payload_json: JSON.stringify(payload),
      received_at: new Date().toISOString()
    });

    // Synchronize contract state if relevant
    switch (eventType) {
      case "CHECKOUT.ORDER.APPROVED": {
        // Find contract by order ID
        const contracts = ContractDAO.getAll();
        const contract = contracts.find(c => c.paypal_order_id === resourceId);
        if (contract && contract.status === "PENDING_APPROVAL") {
          console.log(`ℹ️ [PayPal Webhook] Order ${resourceId} approved by client.`);
        }
        break;
      }
      case "PAYMENT.AUTHORIZATION.CREATED": {
        console.log(`ℹ️ [PayPal Webhook] Authorization created: ${resourceId}`);
        break;
      }
      case "PAYMENT.CAPTURE.COMPLETED": {
        console.log(`ℹ️ [PayPal Webhook] Capture completed: ${resourceId}`);
        break;
      }
      case "PAYMENT.AUTHORIZATION.VOIDED": {
        console.log(`ℹ️ [PayPal Webhook] Authorization voided: ${resourceId}`);
        break;
      }
    }

    res.status(200).json({ status: "success", received_event_id: eventId });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * List recent webhook logs
 */
router.get("/logs", (_req: Request, res: Response) => {
  try {
    const logs = WebhookLogDAO.getAll();
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
