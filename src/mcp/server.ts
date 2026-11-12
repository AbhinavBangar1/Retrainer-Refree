import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { mcpService } from "../services/mcp_service";

const server = new McpServer({
  name: "retainer-referee-mcp",
  version: "1.0.0"
});

// 1. create_contract_from_text
server.tool(
  "create_contract_from_text",
  "Parse an SLA proposal or contract text and create a draft contract. Never activates the contract.",
  {
    text: z.string().describe("The raw proposal or SLA text to extract"),
    clientName: z.string().describe("Name of the client organization"),
    siteUrl: z.string().describe("The website URL to be monitored")
  },
  async ({ text, clientName, siteUrl }) => {
    const outcome = await mcpService.executeTool("create_contract_from_text", { text, clientName, siteUrl });
    if (outcome.error) {
      return { isError: true, content: [{ type: "text", text: outcome.error }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(outcome.result, null, 2) }] };
  }
);

// 2. check_contract
server.tool(
  "check_contract",
  "Lint a contract before activation. Runs deterministic checks for tier overlaps, inversions, and AI clarity checks.",
  {
    contractId: z.string().describe("ID of the contract to check")
  },
  async ({ contractId }) => {
    const outcome = await mcpService.executeTool("check_contract", { contractId });
    if (outcome.error) {
      return { isError: true, content: [{ type: "text", text: outcome.error }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(outcome.result, null, 2) }] };
  }
);

// 3. backtest_contract
server.tool(
  "backtest_contract",
  "Replays historical probe records or uploaded CSV data through the contract math engine.",
  {
    contractId: z.string().describe("Contract ID"),
    csv: z.string().optional().describe("Optional raw CSV string of past checks")
  },
  async ({ contractId, csv }) => {
    const outcome = await mcpService.executeTool("backtest_contract", { contractId, csv });
    if (outcome.error) {
      return { isError: true, content: [{ type: "text", text: outcome.error }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(outcome.result, null, 2) }] };
  }
);

// 4. list_contracts
server.tool(
  "list_contracts",
  "List all contracts with status, current uptime, held PayPal authorization amount, and pending credits.",
  {
    status: z.string().optional().describe("Optional status filter")
  },
  async ({ status }) => {
    const outcome = await mcpService.executeTool("list_contracts", { status });
    if (outcome.error) {
      return { isError: true, content: [{ type: "text", text: outcome.error }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(outcome.result, null, 2) }] };
  }
);

// 5. get_uptime_report
server.tool(
  "get_uptime_report",
  "Returns recorded probe telemetry, current uptime percentage, and incident log.",
  {
    contractId: z.string().describe("Contract ID")
  },
  async ({ contractId }) => {
    const outcome = await mcpService.executeTool("get_uptime_report", { contractId });
    if (outcome.error) {
      return { isError: true, content: [{ type: "text", text: outcome.error }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(outcome.result, null, 2) }] };
  }
);

// 6. preview_settlement
server.tool(
  "preview_settlement",
  "Dry-run deterministic settlement calculation showing what amount code would capture and credit. Changes nothing.",
  {
    contractId: z.string().describe("Contract ID")
  },
  async ({ contractId }) => {
    const outcome = await mcpService.executeTool("preview_settlement", { contractId });
    if (outcome.error) {
      return { isError: true, content: [{ type: "text", text: outcome.error }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(outcome.result, null, 2) }] };
  }
);

// 7. settle_period
server.tool(
  "settle_period",
  "Executes final deterministic code settlement against PayPal authorization. STRICT GUARDRAIL: Rejected unless confirm: true.",
  {
    contractId: z.string().describe("Contract ID"),
    confirm: z.boolean().describe("Must be true to execute real settlement")
  },
  async ({ contractId, confirm }) => {
    const outcome = await mcpService.executeTool("settle_period", { contractId, confirm });
    if (outcome.error) {
      return { isError: true, content: [{ type: "text", text: outcome.error }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(outcome.result, null, 2) }] };
  }
);

// 8. get_statement
server.tool(
  "get_statement",
  "Returns the link to download the generated PDF statement and explanation.",
  {
    contractId: z.string().describe("Contract ID"),
    period: z.string().optional().describe("Optional period identifier")
  },
  async ({ contractId, period }) => {
    const outcome = await mcpService.executeTool("get_statement", { contractId, period });
    if (outcome.error) {
      return { isError: true, content: [{ type: "text", text: outcome.error }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(outcome.result, null, 2) }] };
  }
);

// 9. create_watch (Evidence Mode)
server.tool(
  "create_watch",
  "Evidence Mode: Start watching an un-enrolled vendor's website to claim credits manually. No PayPal hold required.",
  {
    vendorName: z.string().describe("Name of the vendor"),
    siteUrl: z.string().describe("Vendor website URL to probe"),
    monthlyFee: z.number().describe("Monthly retainer fee agreed"),
    termsText: z.string().describe("Agreed SLA or proposal text")
  },
  async ({ vendorName, siteUrl, monthlyFee, termsText }) => {
    const outcome = await mcpService.executeTool("create_watch", { vendorName, siteUrl, monthlyFee, termsText });
    if (outcome.error) {
      return { isError: true, content: [{ type: "text", text: outcome.error }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(outcome.result, null, 2) }] };
  }
);

// 10. get_claim_pack (Evidence Mode)
server.tool(
  "get_claim_pack",
  "Evidence Mode: Retrieves the generated Claim Pack with incident evidence, credit owed, SHA-256 log hash, and draft letter.",
  {
    watchId: z.string().describe("Watch ID")
  },
  async ({ watchId }) => {
    const outcome = await mcpService.executeTool("get_claim_pack", { watchId });
    if (outcome.error) {
      return { isError: true, content: [{ type: "text", text: outcome.error }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(outcome.result, null, 2) }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Retainer Referee MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error running MCP server:", err);
  process.exit(1);
});
