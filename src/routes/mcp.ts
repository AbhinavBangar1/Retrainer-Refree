import { Router, Request, Response } from "express";
import { mcpService } from "../services/mcp_service";
import { MCPAuditDAO } from "../db";

const router = Router();

/**
 * Returns available MCP tools with their strict input schemas
 * GET /api/mcp/tools
 */
router.get("/tools", (_req: Request, res: Response) => {
  const tools = mcpService.getToolDefinitions();
  res.json({ tools });
});

/**
 * Standard JSON-RPC 2.0 endpoint for MCP clients
 * POST /api/mcp/rpc
 */
router.post("/rpc", async (req: Request, res: Response) => {
  const { jsonrpc, id, method, params } = req.body;
  const token = req.headers.authorization?.replace("Bearer ", "") || (req.headers["x-api-token"] as string) || null;

  if (jsonrpc !== "2.0") {
    res.status(400).json({ jsonrpc: "2.0", id: id || null, error: { code: -32600, message: "Invalid Request: jsonrpc must be '2.0'" } });
    return;
  }

  try {
    switch (method) {
      case "initialize": {
        res.json({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: { listChanged: false }
            },
            serverInfo: {
              name: "retainer-referee-mcp",
              version: "1.0.0",
              vendor: "Retainer Referee",
              description: "Deterministic Retainer Contract Enforcer & Evidence Engine"
            }
          }
        });
        break;
      }

      case "tools/list": {
        const tools = mcpService.getToolDefinitions();
        res.json({
          jsonrpc: "2.0",
          id,
          result: { tools }
        });
        break;
      }

      case "tools/call": {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        if (!toolName) {
          res.json({
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: "Missing tool name in params" }
          });
          return;
        }

        const outcome = await mcpService.executeTool(toolName, toolArgs, token);
        if (outcome.error) {
          res.json({
            jsonrpc: "2.0",
            id,
            result: {
              isError: true,
              content: [{ type: "text", text: outcome.error }]
            }
          });
        } else {
          res.json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: JSON.stringify(outcome.result, null, 2) }]
            }
          });
        }
        break;
      }

      default:
        res.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` }
        });
        break;
    }
  } catch (err: any) {
    res.status(500).json({
      jsonrpc: "2.0",
      id,
      error: { code: -32603, message: err.message || "Internal RPC Error" }
    });
  }
});

/**
 * Direct execution endpoint for web UI testing & agent calls
 * POST /api/mcp/execute
 */
router.post("/execute", async (req: Request, res: Response) => {
  try {
    const { toolName, args } = req.body;
    const token = req.headers.authorization?.replace("Bearer ", "") || (req.headers["x-api-token"] as string) || null;

    if (!toolName) {
      res.status(400).json({ error: "toolName is required" });
      return;
    }

    const outcome = await mcpService.executeTool(toolName, args || {}, token);
    if (outcome.error) {
      res.status(400).json({ error: outcome.error });
      return;
    }

    res.json({ success: true, result: outcome.result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Server-Sent Events (SSE) endpoint for remote MCP clients
 * GET /api/mcp/sse
 */
router.get("/sse", (req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });

  res.write(`event: endpoint\ndata: /api/mcp/rpc\n\n`);

  const keepAlive = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 15000);

  req.on("close", () => {
    clearInterval(keepAlive);
  });
});

/**
 * MCP Audit Ledger
 * GET /api/mcp/audit
 */
router.get("/audit", (_req: Request, res: Response) => {
  try {
    const logs = MCPAuditDAO.getAll(50);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
