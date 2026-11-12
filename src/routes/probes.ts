import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { db, ContractDAO, ProbeDAO, IncidentDAO } from "../db";
import { proberService } from "../services/prober";

const router = Router();

/**
 * Trigger immediate manual probe ping
 */
router.post("/:id/ping", async (req: Request, res: Response) => {
  try {
    const contract = ContractDAO.getById(req.params.id);
    if (!contract) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }

    const probe = await proberService.probeContract(contract);
    res.json({
      success: true,
      probe
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Chaos / Simulation controller:
 * Injects simulated downtime, 503 error, or restores service
 */
router.post("/:id/chaos", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const contract = ContractDAO.getById(id);
    if (!contract) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }

    const { simulate_down, status_code, reason, duration_ms } = req.body;
    proberService.setChaos(id, {
      simulateDown: Boolean(simulate_down),
      statusCode: status_code ? parseInt(status_code, 10) : 503,
      reason: reason || "Simulated 503 Service Unavailable Outage",
      durationMs: duration_ms ? parseInt(duration_ms, 10) : undefined
    });

    res.json({
      success: true,
      contract_id: id,
      chaos_active: proberService.getChaos(id),
      message: simulate_down 
        ? "Simulated downtime enabled. Probes will now record failed status codes." 
        : "Simulated downtime disabled. Normal probing restored."
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Injects 164 minutes of downtime (split as 94, 52, 18 min incidents)
 * into a 30-day (43,200 min) period, guaranteeing exactly 99.62% uptime.
 */
router.post("/:id/inject-164", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const contract = ContractDAO.getById(id);
    if (!contract) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }

    const now = new Date();
    const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago (43,200 min)

    // Update contract period_start to 30 days ago
    const updateStmt = db.prepare(`UPDATE contracts SET period_start = ?, period_end = ? WHERE id = ?`);
    updateStmt.run(periodStart.toISOString(), now.toISOString(), id);

    // Clear old probes & incidents for this contract to make numbers mathematically exact
    db.prepare(`DELETE FROM probes WHERE contract_id = ?`).run(id);
    db.prepare(`DELETE FROM incidents WHERE contract_id = ?`).run(id);

    // Insert 3 incidents: 94 min, 52 min, 18 min
    const inc1 = {
      id: `INC-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      contract_id: id,
      start_time: new Date(now.getTime() - 24 * 86400000).toISOString(),
      end_time: new Date(now.getTime() - 24 * 86400000 + 94 * 60000).toISOString(),
      duration_seconds: 94 * 60,
      reason: "HTTP 503 Gateway Outage",
      resolved: 1
    };
    const inc2 = {
      id: `INC-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      contract_id: id,
      start_time: new Date(now.getTime() - 16 * 86400000).toISOString(),
      end_time: new Date(now.getTime() - 16 * 86400000 + 52 * 60000).toISOString(),
      duration_seconds: 52 * 60,
      reason: "HTTP 504 Gateway Timeout",
      resolved: 1
    };
    const inc3 = {
      id: `INC-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      contract_id: id,
      start_time: new Date(now.getTime() - 8 * 86400000).toISOString(),
      end_time: new Date(now.getTime() - 8 * 86400000 + 18 * 60000).toISOString(),
      duration_seconds: 18 * 60,
      reason: "SSL Expiry Connection Refused",
      resolved: 1
    };
    IncidentDAO.create(inc1);
    IncidentDAO.create(inc2);
    IncidentDAO.create(inc3);

    // Insert 43,200 probes inside transaction
    db.exec("BEGIN TRANSACTION;");
    const insertProbe = db.prepare(`
      INSERT INTO probes (
        contract_id, timestamp, status_code, response_time_ms,
        ssl_valid, ssl_expiry, ssl_issuer, is_up, in_maintenance, error_message
      ) VALUES (?, ?, ?, ?, 1, '2027-01-01T00:00:00Z', 'Let\\'s Encrypt', ?, 0, ?)
    `);

    // 94 down probes
    for (let i = 0; i < 94; i++) {
      const ts = new Date(now.getTime() - 24 * 86400000 + i * 60000).toISOString();
      insertProbe.run(id, ts, 503, 1420, 0, "HTTP 503 Service Unavailable");
    }
    // 52 down probes
    for (let i = 0; i < 52; i++) {
      const ts = new Date(now.getTime() - 16 * 86400000 + i * 60000).toISOString();
      insertProbe.run(id, ts, 504, 30000, 0, "Connection Timeout (504)");
    }
    // 18 down probes
    for (let i = 0; i < 18; i++) {
      const ts = new Date(now.getTime() - 8 * 86400000 + i * 60000).toISOString();
      insertProbe.run(id, ts, 500, 2100, 0, "SSL Handshake Failed / 500");
    }
    // 43,036 up probes
    const totalUp = 43036;
    const stepMs = (30 * 86400000) / totalUp;
    for (let i = 0; i < totalUp; i++) {
      const ts = new Date(periodStart.getTime() + i * stepMs).toISOString();
      insertProbe.run(id, ts, 200, 115 + (i % 45), 1, null);
    }
    db.exec("COMMIT;");

    res.json({
      success: true,
      contract_id: id,
      injected_minutes: 164,
      incidents: [94, 52, 18],
      total_probes: 43200,
      down_probes: 164,
      expected_uptime: "99.62%"
    });
  } catch (err: any) {
    try { db.exec("ROLLBACK;"); } catch {}
    res.status(500).json({ error: err.message });
  }
});

/**
 * Retrieve probe history
 */
router.get("/:id/history", (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const history = ProbeDAO.getByContract(req.params.id, limit);
    res.json({ history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Inject 164 minutes of downtime (split into 94, 52, 18 min)
 * Writes synthetic probe records into SQLite so that deterministic SLA calculation lands exactly on:
 * 99.62% uptime, Tier 1, $80.00 credit, $720.00 captured.
 */
router.post("/:id/inject-downtime", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const contract = ContractDAO.getById(id);
    if (!contract) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }

    const downtimeMinutes = Number(req.body.minutes || 164);
    const split = req.body.split || [94, 52, 18];
    const totalMinutes = 43200; // 30-day standard billing cycle
    const now = new Date();
    const periodStart = new Date(now.getTime() - totalMinutes * 60 * 1000);

    // Update contract period
    db.prepare(`UPDATE contracts SET period_start = ?, period_end = ? WHERE id = ?`).run(
      periodStart.toISOString(),
      now.toISOString(),
      id
    );

    // Clear existing probes & incidents for this contract
    db.prepare(`DELETE FROM probes WHERE contract_id = ?`).run(id);
    db.prepare(`DELETE FROM incidents WHERE contract_id = ?`).run(id);

    // Insert 3 incidents
    const incStmt = db.prepare(`
      INSERT INTO incidents (id, contract_id, start_time, end_time, duration_seconds, reason, resolved)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    let offsetMinutes = 1440 * 20; // 20 days ago
    for (let i = 0; i < split.length; i++) {
      const dur = split[i];
      const iStart = new Date(now.getTime() - (offsetMinutes - i * 1440 * 7) * 60 * 1000);
      const iEnd = new Date(iStart.getTime() + dur * 60 * 1000);
      incStmt.run(
        `INC-${id.slice(0, 6)}-${i + 1}`,
        id,
        iStart.toISOString(),
        iEnd.toISOString(),
        dur * 60,
        `Outage incident #${i + 1} (${dur}m HTTP 503)`
      );
    }

    // Insert synthetic probes: 43,036 up probes, 164 down probes
    const insertProbe = db.prepare(`
      INSERT INTO probes (
        contract_id, timestamp, status_code, response_time_ms,
        ssl_valid, ssl_expiry, ssl_issuer, is_up, in_maintenance, error_message
      ) VALUES (?, ?, ?, ?, 1, '2027-01-01', 'Let''s Encrypt', ?, 0, ?)
    `);

    db.exec("BEGIN");
    // Up probes
    for (let i = 0; i < totalMinutes - downtimeMinutes; i++) {
      const ts = new Date(periodStart.getTime() + i * 60 * 1000).toISOString();
      insertProbe.run(id, ts, 200, 115, 1, null);
    }
    // Down probes
    for (let i = 0; i < downtimeMinutes; i++) {
      const ts = new Date(now.getTime() - (downtimeMinutes - i) * 60 * 1000).toISOString();
      insertProbe.run(id, ts, 503, 3000, 0, "HTTP 503 Service Unavailable");
    }
    db.exec("COMMIT");

    res.json({
      success: true,
      message: `Injected ${downtimeMinutes} minutes downtime across 3 incidents (${split.join(", ")} min). Total monitored: ${totalMinutes} min. Expected uptime: 99.62%.`,
      downtime_minutes: downtimeMinutes,
      incidents: split.map((d: number, idx: number) => ({ id: `INC-${id.slice(0, 6)}-${idx + 1}`, duration_minutes: d })),
      target_numbers: {
        uptime: 99.62,
        tier: "Tier 1 (10%)",
        credit_amount: 80.00,
        captured_amount: 720.00
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
