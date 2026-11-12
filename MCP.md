# Retainer Referee MCP Server

A thin, hardened Model Context Protocol (MCP) server that empowers AI agents (Claude, Cursor, Antigravity) to set up and monitor website retainers in bulk with strict financial guardrails.

---

## 🛡️ Strict Financial Guardrails

1. **No Tool Accepts an Amount**: Money calculations are 100% deterministic code-driven. No tool schema contains an amount field.
2. **Drafts Stay Drafts**: AI agents can only generate contracts in `DRAFT` status. Activation requires human confirmation and client consent.
3. **Clients Consent Themselves**: The PayPal authorization hold requires the client's explicit PayPal approval. An agent cannot approve holds.
4. **Deterministic Settlement Math**: `preview_settlement` and `settle_period` use the exact same calculation function.
5. **Confirmation Enforced**: `settle_period` is strictly rejected unless `confirm: true` is passed.
6. **Immutable Audit Ledger**: Every call is logged with token, tool, inputs, and result in the `mcp_audit_logs` table and visible at `/agency` under **MCP Audit**.

---

## 🔌 Connection Configuration

### 1. Claude Desktop (`claude_desktop_config.json`)

To connect Claude Desktop to Retainer Referee via stdio:

```json
{
  "mcpServers": {
    "retainer-referee": {
      "command": "npx",
      "args": [
        "ts-node",
        "c:/Users/Abhinav Bangar/Desktop/hacks/Paypal/src/mcp/server.ts"
      ],
      "env": {
        "PORT": "5000",
        "MCP_API_TOKEN": "rr_agency_secret_2026"
      }
    }
  }
}
```

### 2. Remote HTTP / Streamable JSON-RPC Transport

The Retainer Referee backend hosts a remote MCP endpoint:
- **HTTP POST RPC**: `http://localhost:5000/api/mcp/rpc`
- **SSE Stream**: `http://localhost:5000/api/mcp/sse`
- **Auth Header**: `Authorization: Bearer rr_agency_secret_2026` or `x-api-token: rr_agency_secret_2026`

---

## 🛠️ Available MCP Tools

### Agency Side
| Tool | Input Schema | Description |
|---|---|---|
| `create_contract_from_text` | `{ text, clientName, siteUrl }` | Extracts SLA terms from proposal text into a draft contract. Never activates. |
| `check_contract` | `{ contractId }` | Lints contract for tier gaps/overlaps, inversions, and vague wording. Returns verifiability score. |
| `backtest_contract` | `{ contractId, csv? }` | Replays past probe checks through contract math. Returns "This SLA would have cost you $X". |
| `list_contracts` | `{ status? }` | Lists contracts with status, uptime, held authorization, and pending credits. |
| `get_uptime_report` | `{ contractId }` | Returns probe telemetry, current uptime percentage, and incident history. |
| `preview_settlement` | `{ contractId }` | Dry run of deterministic capture and credit calculations. Modifies nothing. |
| `settle_period` | `{ contractId, confirm: true }` | Runs real settlement against PayPal authorization. Fails without `confirm: true`. |
| `get_statement` | `{ contractId, period? }` | Returns statement PDF download link and explanation. |

### Customer Side (Evidence Mode)
| Tool | Input Schema | Description |
|---|---|---|
| `create_watch` | `{ vendorName, siteUrl, monthlyFee, termsText }` | Starts monitoring an un-enrolled vendor's URL without PayPal hold. |
| `get_claim_pack` | `{ watchId }` | Retrieves evidence timeline, calculated credit owed, SHA-256 log hash, and AI claim letter. |

---

## 💡 Working Example Walkthrough

### Example 1: Bulk Proposal Intake & Linting
An agency receives 12 proposals and gives them to Claude:

```json
// Agent calls create_contract_from_text
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "create_contract_from_text",
    "arguments": {
      "text": "Northwind Dental monthly retainer. 99.9% uptime target. Fee: $800. Tier 1: 99.5%-99.9% 10% credit. Tier 2: 0-99.5% 30% credit.",
      "clientName": "Northwind Dental",
      "siteUrl": "https://northwinddental.example"
    }
  }
}
```

Response:
```json
{
  "contractId": "CTR-BB7AC93B8C",
  "status": "DRAFT",
  "fee": 800,
  "currency": "USD",
  "uptime_target": 99.9,
  "message": "Draft contract created. Human confirmation and client PayPal authorization required to activate."
}
```

Next, agent calls `check_contract`:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "check_contract",
    "arguments": {
      "contractId": "CTR-BB7AC93B8C"
    }
  }
}
```

Response:
```json
{
  "canActivate": false,
  "verifiabilityScore": { "enforceable": 5, "total": 7, "label": "5 of 7" },
  "errors": [
    {
      "code": "TIER_OVERLAP",
      "message": "Tier 1 and Tier 2 both cover 99.5%.",
      "suggestion": "Suggest: Tier 2 applies below 99.5%."
    }
  ]
}
```

The agent reports back to the user:
> *"Contract CTR-BB7AC93B8C has 1 tier overlap at 99.5%. Review in the web app at http://localhost:3000 to apply suggested fixes and clear errors before activation."*

---

### Example 2: Evidence Mode Claim Pack via MCP
A client monitors an agency and asks their AI agent to pull the claim pack:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "get_claim_pack",
    "arguments": {
      "watchId": "WTC-16F1127D"
    }
  }
}
```

Response:
```json
{
  "claimId": "CLM-DFCC5CD2",
  "vendorName": "Apex Studio",
  "actualUptime": 99.62,
  "targetUptime": 99.9,
  "totalDowntimeMinutes": 164,
  "tierApplied": "Tier 1 (10%)",
  "creditOwed": 80.00,
  "sha256LogHash": "5f226850bae266d8...",
  "claimLetterDraft": "Hello Apex Studio, our monitoring recorded 164 minutes of downtime across three incidents this period, giving 99.62% uptime against the agreed 99.9%. Under Tier 1 of our agreement a 10% credit of $80.00 applies. The attached log lists each failed check. Please apply the credit.",
  "pdfUrl": "/api/evidence/claims/CLM-DFCC5CD2/pdf",
  "inviteLink": "http://localhost:3000/?from_claim=CLM-DFCC5CD2&vendor=Apex%20Studio&url=https%3A%2F%2Fnorthwinddental.example&fee=800"
}
```
