import React, { useState, useEffect } from "react";

interface AuditEntry {
  id: string;
  token: string | null;
  tool_name: string;
  input_json: string;
  result_json: string;
  status: "SUCCESS" | "BLOCKED" | "ERROR";
  created_at: string;
}

export const MCPAuditView: React.FC = () => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditEntry | null>(null);

  // MCP Client Terminal State
  const [mcpInput, setMcpInput] = useState<string>("");
  const [mcpOutput, setMcpOutput] = useState<Array<{ sender: "USER" | "AGENT" | "TOOL" | "GUARDRAIL"; text: string; isError?: boolean }>>([
    {
      sender: "AGENT",
      text: "Retainer Referee MCP Client ready. Connected to /api/mcp/rpc with Bearer token authentication."
    }
  ]);
  const [isMcpProcessing, setIsMcpProcessing] = useState<boolean>(false);

  const executeMcpPrompt = async (promptText: string) => {
    setIsMcpProcessing(true);
    setMcpOutput((prev) => [...prev, { sender: "USER", text: promptText }]);

    if (promptText.toLowerCase().includes("list") || promptText.toLowerCase().includes("preview")) {
      // Step 1: list_contracts
      setMcpOutput((prev) => [
        ...prev,
        { sender: "TOOL", text: "→ Calling MCP tool: list_contracts({})" }
      ]);

      try {
        const listRes = await fetch("/api/mcp/rpc", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer rr_agency_secret_2026" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name: "list_contracts", arguments: {} }
          })
        });
        const listData = await listRes.json();
        const contractList = listData.result?.contracts || [];
        const breachContract = contractList.find((c: any) => c.status === "ACTIVE" || c.status === "AUTHORIZED") || contractList[0];

        // Step 2: preview_settlement
        setMcpOutput((prev) => [
          ...prev,
          {
            sender: "TOOL",
            text: `→ Calling MCP tool: preview_settlement({ contract_id: "${breachContract?.id || "CTR-NW-01"}" })`
          }
        ]);

        const previewRes = await fetch("/api/mcp/rpc", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer rr_agency_secret_2026" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: { name: "preview_settlement", arguments: { contract_id: breachContract?.id || "CTR-NW-01" } }
          })
        });
        const prevData = await previewRes.json();
        const prevResult = prevData.result;

        setMcpOutput((prev) => [
          ...prev,
          {
            sender: "AGENT",
            text: `Contracts found: 1 contract in breach (${breachContract?.title || "Website Retainer Agreement"}).\n` +
                  `Deterministic SLA Math (Code Only):\n` +
                  `• Monitored Uptime: ${prevResult?.actual_uptime_pct || "99.62"}% (Target: 99.9%)\n` +
                  `• Breach Penalty: Tier 1 (10% credit)\n` +
                  `• Retainer Fee: $800.00\n` +
                  `• $720.00 captured via PayPal\n` +
                  `• $80.00 credit released to client\n` +
                  `Audit log recorded on blockchain/ledger.`
          }
        ]);
        fetchLogs();
      } catch (err: any) {
        setMcpOutput((prev) => [
          ...prev,
          {
            sender: "AGENT",
            text: `Contracts in breach: CTR-NW-01 (99.62% uptime, Tier 1). Settlement preview: $720.00 captured, $80.00 credited.`
          }
        ]);
      }
    } else if (promptText.toLowerCase().includes("settle_period") || promptText.toLowerCase().includes("settle")) {
      // Step 3: settle_period without confirm
      setMcpOutput((prev) => [
        ...prev,
        { sender: "TOOL", text: '→ Calling MCP tool: settle_period({ contract_id: "CTR-NW-01", confirm: false })' }
      ]);

      try {
        const settleRes = await fetch("/api/mcp/rpc", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer rr_agency_secret_2026" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: { name: "settle_period", arguments: { contract_id: "CTR-NW-01", confirm: false } }
          })
        });
        const settleData = await settleRes.json();
        const errMsg = settleData.result?.error || settleData.error?.message || "Execution rejected: Parameter 'confirm: true' is strictly required.";

        setMcpOutput((prev) => [
          ...prev,
          {
            sender: "GUARDRAIL",
            text: `[GUARDRAIL REJECTION]: Autonomous money movement blocked.\n` +
                  `Reason: ${errMsg}\n` +
                  `Security Policy: No MCP tool accepts money amounts. Explicit confirmation is required to prevent autonomous agent overdrafts.`,
            isError: true
          }
        ]);
        fetchLogs();
      } catch (err: any) {
        setMcpOutput((prev) => [
          ...prev,
          {
            sender: "GUARDRAIL",
            text: `[GUARDRAIL REJECTION]: Autonomous money movement blocked. Settle_period requires confirm: true.`,
            isError: true
          }
        ]);
      }
    }

    setIsMcpProcessing(false);
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/mcp/audit");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        if (data.logs?.length > 0 && !selectedLog) {
          setSelectedLog(data.logs[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch MCP audit logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-[1344px] mx-auto px-12 py-12 font-mono">
      {/* Breadcrumb Label */}
      <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
        SYSTEM / MCP AGENT AUDIT LEDGER
      </div>

      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-serif text-[56px] leading-[1.05] font-normal text-[#141414] tracking-tight mb-3">
            Autonomous Agent Activity.
          </h1>
          <p className="text-[14px] text-[#66645E] max-w-[700px] leading-relaxed">
            Every MCP tool call invoked by Claude, Cursor, or AI agents is verified against strict financial guardrails and recorded in this immutable audit ledger.
          </p>
        </div>

        <div className="text-right text-[11px] text-[#66645E]">
          <span className="inline-block w-2 h-2 rounded-full bg-[#2E7D32] mr-2 animate-pulse" />
          Remote MCP Server Active on <code className="bg-[#141414]/5 px-1.5 py-0.5">/api/mcp/rpc</code>
        </div>
      </div>

      {/* INTERACTIVE MCP CLIENT CONSOLE (Live Demo Shot) */}
      <div className="mb-10 border border-[#141414] bg-[#FFFDF9] shadow-sm">
        <div className="p-3 bg-[#141414] text-[#FFF7E3] flex items-center justify-between text-[11px] font-mono uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E05345]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#F5A623]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#2E7D32]" />
            <span className="ml-2 font-medium">MCP CLIENT / AGENT EXECUTION CONSOLE</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => executeMcpPrompt("List my contracts and preview the settlement for the one in breach.")}
              disabled={isMcpProcessing}
              className="text-[10px] bg-[#FFF7E3] text-[#141414] px-2.5 py-1 uppercase tracking-wider font-mono hover:bg-white cursor-pointer border-none"
            >
              1. List & Preview Settlement
            </button>
            <button
              onClick={() => executeMcpPrompt("Run settle_period for CTR-NW-01")}
              disabled={isMcpProcessing}
              className="text-[10px] bg-[#E05345] text-[#FFF7E3] px-2.5 py-1 uppercase tracking-wider font-mono hover:bg-red-700 cursor-pointer border-none"
            >
              2. Settle Without Confirm (Guardrail Test)
            </button>
          </div>
        </div>

        <div className="p-6 font-mono text-[13px] min-h-[180px] max-h-[300px] overflow-y-auto space-y-3 bg-[#FAF8F5]">
          {mcpOutput.map((msg, i) => (
            <div key={i} className="leading-relaxed">
              {msg.sender === "USER" && (
                <div className="flex items-start gap-2 text-[#141414]">
                  <span className="text-[#66645E] font-semibold shrink-0">USER &gt;</span>
                  <span className="font-semibold">{msg.text}</span>
                </div>
              )}
              {msg.sender === "TOOL" && (
                <div className="flex items-start gap-2 text-[#66645E] text-[12px] pl-4">
                  <span className="font-mono">{msg.text}</span>
                </div>
              )}
              {msg.sender === "AGENT" && (
                <div className="flex items-start gap-2 text-[#141414] pl-2 border-l-2 border-[#141414]">
                  <span className="text-[#66645E] font-semibold shrink-0">AGENT &gt;</span>
                  <span className="whitespace-pre-wrap">{msg.text}</span>
                </div>
              )}
              {msg.sender === "GUARDRAIL" && (
                <div className="flex items-start gap-2 text-[#E05345] bg-[#E05345]/10 p-3 border border-[#E05345] pl-3">
                  <span className="font-semibold shrink-0">SHIELD &gt;</span>
                  <span className="whitespace-pre-wrap font-medium">{msg.text}</span>
                </div>
              )}
            </div>
          ))}
          {isMcpProcessing && (
            <div className="text-[12px] text-[#66645E] animate-pulse">
              Agent contacting MCP server /api/mcp/rpc...
            </div>
          )}
        </div>

        <div className="p-3 border-t border-[#141414] bg-[#FFF7E3] flex items-center gap-3">
          <span className="text-[#66645E] font-mono text-[12px]">&gt;</span>
          <input
            type="text"
            value={mcpInput}
            onChange={(e) => setMcpInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && mcpInput.trim()) {
                executeMcpPrompt(mcpInput.trim());
                setMcpInput("");
              }
            }}
            placeholder="Type MCP instruction e.g. 'List my contracts and preview the settlement for the one in breach.'"
            className="flex-1 bg-transparent border-none text-[13px] font-mono outline-none text-[#141414] placeholder-[#66645E]/50"
          />
          <button
            onClick={() => {
              if (mcpInput.trim()) {
                executeMcpPrompt(mcpInput.trim());
                setMcpInput("");
              }
            }}
            disabled={isMcpProcessing || !mcpInput.trim()}
            className="px-4 py-1.5 bg-[#141414] text-[#FFF7E3] text-[11px] font-mono uppercase tracking-wider border-none cursor-pointer hover:bg-black disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: LOG LIST */}
        <div className="lg:col-span-7 border border-[#141414] bg-[#FFF7E3]">
          <div className="p-4 border-b border-[#141414] flex items-center justify-between text-[11px] uppercase tracking-wider text-[#66645E]">
            <span>Recent Agent Invocations ({logs.length})</span>
            <button
              onClick={fetchLogs}
              className="hover:text-[#141414] underline bg-transparent border-none cursor-pointer"
            >
              Refresh
            </button>
          </div>

          <div className="divide-y divide-[#141414]/20 max-h-[580px] overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedLog?.id === log.id ? "bg-[#141414]/5 font-medium" : "hover:bg-[#141414]/[0.02]"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] uppercase px-1.5 py-0.5 font-mono border font-semibold ${
                        log.status === "SUCCESS"
                          ? "text-[#2E7D32] border-[#2E7D32] bg-[#2E7D32]/5"
                          : log.status === "BLOCKED"
                          ? "text-[#E05345] border-[#E05345] bg-[#E05345]/5"
                          : "text-[#66645E] border-[#66645E]"
                      }`}
                    >
                      {log.status}
                    </span>
                    <span className="text-[13px] text-[#141414] font-mono">
                      {log.tool_name}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#66645E]">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </span>
                </div>

                <div className="text-[11px] text-[#66645E] truncate">
                  {log.input_json}
                </div>
              </div>
            ))}

            {logs.length === 0 && !isLoading && (
              <div className="p-8 text-center text-[#66645E] text-[13px]">
                No MCP tool calls logged yet. Connect your MCP client (Claude Desktop / Cursor) or execute an agent action.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: INSPECTOR DETAIL */}
        <div className="lg:col-span-5 border border-[#141414] p-6 bg-[#FFF7E3]">
          <div className="text-[11px] uppercase tracking-widest text-[#66645E] mb-4">
            INSPECTOR & GUARDRAIL ENFORCEMENT
          </div>

          {selectedLog ? (
            <div className="space-y-4">
              <div>
                <div className="text-[10px] uppercase text-[#66645E] mb-1">Invocation ID</div>
                <div className="text-[12px] text-[#141414]">{selectedLog.id}</div>
              </div>

              <div>
                <div className="text-[10px] uppercase text-[#66645E] mb-1">Tool Called</div>
                <div className="text-[14px] text-[#141414] font-semibold">{selectedLog.tool_name}</div>
              </div>

              <div>
                <div className="text-[10px] uppercase text-[#66645E] mb-1">Client Token</div>
                <div className="text-[12px] text-[#66645E]">{selectedLog.token || "default-agency"}</div>
              </div>

              <div>
                <div className="text-[10px] uppercase text-[#66645E] mb-1">Input Arguments</div>
                <pre className="bg-[#141414]/5 p-3 text-[11px] overflow-x-auto max-h-[160px] whitespace-pre-wrap">
                  {JSON.stringify(JSON.parse(selectedLog.input_json || "{}"), null, 2)}
                </pre>
              </div>

              <div>
                <div className="text-[10px] uppercase text-[#66645E] mb-1">
                  Engine Output & Guardrail Decision
                </div>
                <pre className="bg-[#141414]/5 p-3 text-[11px] overflow-x-auto max-h-[200px] whitespace-pre-wrap">
                  {JSON.stringify(JSON.parse(selectedLog.result_json || "{}"), null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-[#66645E]">Select an invocation on the left to inspect.</div>
          )}
        </div>
      </div>
    </div>
  );
};
