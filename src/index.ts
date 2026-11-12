import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "node:path";
import contractsRouter from "./routes/contracts";
import clientRouter from "./routes/client";
import settleRouter from "./routes/settle";
import probesRouter from "./routes/probes";
import webhooksRouter from "./routes/webhooks";
import evidenceRouter from "./routes/evidence";
import mcpRouter from "./routes/mcp";
import { proberService } from "./services/prober";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Retainer Referee Backend",
    timestamp: new Date().toISOString(),
    demo_mode: true,
    rules: {
      paypal_honor_period_days: 3,
      paypal_validity_window_days: 29,
      ai_role: "Extraction & Explanation Only",
      code_role: "All Probing, Math, Tier Selection, and Financial Decisions"
    }
  });
});

// API Routes
app.use("/api/contracts", contractsRouter);
app.use("/api/client", clientRouter);
app.use("/api/settle", settleRouter);
app.use("/api/probes", probesRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/evidence", evidenceRouter);
app.use("/api/mcp", mcpRouter);

// Serve Recordings & Media
app.use("/recordings", express.static(path.join(__dirname, "../recordings")));

// Serve Landing, Agency and Client frontends
app.use("/landing", express.static(path.join(__dirname, "../dist/landing")));
app.use("/agency", express.static(path.join(__dirname, "../dist/agency")));
app.use("/client", express.static(path.join(__dirname, "../dist/client")));

// Root serves landing page
app.use(express.static(path.join(__dirname, "../dist/landing")));
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "../dist/landing/index.html"));
});

// Export express app
export default app;

// Start server only when executed directly
if (require.main === module) {
  proberService.start();

  const server = app.listen(PORT, () => {
    console.log(`
================================================================
⚖️  RETAINER REFEREE BACKEND RUNNING ON http://localhost:${PORT}
================================================================
• Core Loop Endpoints:
  1. Extract: POST /api/contracts/extract (LLM with Zod validation & retry)
  2. Hold:    POST /api/contracts/:id/confirm (PayPal Orders v2 intent AUTHORIZE)
              POST /api/client/contracts/:id/approve-hold (Authorize order)
  3. Watch:   POST /api/probes/:id/ping, POST /api/probes/:id/chaos
  4. Settle:  POST /api/settle/:id (Deterministic code math & capture/void)
  5. Explain: GET  /api/client/contracts/:id/statement.pdf (PDF statement)
  Webhooks:   POST /api/webhooks/paypal (Authorization, capture, void)
================================================================
`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("\nGracefully stopping Retainer Referee...");
    proberService.stop();
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
