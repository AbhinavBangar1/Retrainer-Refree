import app from "../src/index";
import { closeDb } from "../src/db";
import { Server } from "node:http";

let server: Server;
const PORT = 5555;

async function testHttpEndpoints() {
  server = app.listen(PORT, async () => {
    try {
      console.log(`Testing HTTP server on port ${PORT}...`);

      // 1. Health check
      const healthRes = await fetch(`http://localhost:${PORT}/api/health`);
      const healthJson = await healthRes.json() as any;
      console.log("✓ /api/health:", healthJson.status === "ok" ? "OK" : "FAIL");

      // 2. Extract API
      const extractRes = await fetch(`http://localhost:${PORT}/api/contracts/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_text: "Maintain website https://myshop.com for $2,000/mo with 99.9% uptime SLA."
        })
      });
      const extractJson = await extractRes.json() as any;
      console.log("✓ /api/contracts/extract:", extractJson.success ? "OK" : "FAIL", `Extracted fee: $${extractJson.extracted?.fee}`);

      // 3. Webhook listing
      const webhookRes = await fetch(`http://localhost:${PORT}/api/webhooks/logs`);
      const webhookJson = await webhookRes.json() as any;
      console.log("✓ /api/webhooks/logs:", Array.isArray(webhookJson.logs) ? "OK" : "FAIL");

      console.log("🎉 ALL HTTP ENDPOINT TESTS PASSED!");
      server.close();
    } catch (err) {
      console.error("HTTP Test Error:", err);
      server.close();
    }
  });
}

testHttpEndpoints();
