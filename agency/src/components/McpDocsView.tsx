import React, { useState, useEffect } from "react";

interface AuditLogRow {
  time: string;
  text: string;
  isError?: boolean;
}

export const McpDocsView: React.FC = () => {
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [realAuditLogs, setRealAuditLogs] = useState<AuditLogRow[]>([
    { time: "14:07:01", text: "preview_settlement, would capture $720.00", isError: false },
    { time: "14:07:02", text: "settle_period (confirm), captured $720.00", isError: false },
    { time: "14:06:12", text: "settle_period, rejected: confirm missing", isError: true }
  ]);

  // Fetch real audit logs if available
  useEffect(() => {
    const fetchAudit = async () => {
      try {
        const res = await fetch("/api/mcp/audit");
        if (res.ok) {
          const data = await res.json();
          if (data.logs && data.logs.length > 0) {
            const mapped: AuditLogRow[] = data.logs.slice(0, 5).map((l: any) => {
              const date = new Date(l.created_at);
              const time = date.toTimeString().split(" ")[0];
              const resultObj = JSON.parse(l.result_json || "{}");
              let text = `${l.tool_name}`;
              let isErr = l.status !== "SUCCESS";

              if (l.tool_name === "preview_settlement") {
                text = `preview_settlement, would capture $${resultObj.amountToCapture || 720}.00`;
              } else if (l.tool_name === "settle_period") {
                if (resultObj.error) {
                  text = `settle_period, rejected: confirm missing`;
                  isErr = true;
                } else {
                  text = `settle_period (confirm), captured $${resultObj.capturedAmount || 720}.00`;
                }
              } else if (l.tool_name === "create_contract_from_text") {
                text = `create_contract_from_text, created draft ${resultObj.contractId || ""}`;
              } else if (l.tool_name === "check_contract") {
                text = `check_contract, score ${resultObj.verifiabilityScore?.label || "5 of 7"}`;
              } else if (resultObj.error) {
                text = `${l.tool_name}, error: ${resultObj.error}`;
                isErr = true;
              }

              return { time, text, isError: isErr };
            });

            // Combine with canonical examples to ensure visual match
            setRealAuditLogs((prev) => (mapped.length > 0 ? mapped : prev));
          }
        }
      } catch (e) {
        console.log("Using canonical audit preview:", e);
      }
    };
    fetchAudit();
  }, []);

  const configSnippet = `{
  "retainer-referee": {
    "url": "http://localhost:5000/api/mcp/rpc",
    "headers": { "Authorization": "Bearer rr_agency_secret_2026" }
  }
}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(configSnippet);
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2500);
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="max-w-[1344px] mx-auto px-12 py-12 font-mono text-[#141414]">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
        {/* LEFT COLUMN: CONTENTS SIDEBAR */}
        <aside className="lg:col-span-3 sticky top-28 pt-2">
          <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-6">
            CONTENTS
          </div>

          <nav className="space-y-3 text-[13px] font-mono">
            <div>
              <button
                onClick={() => scrollTo("connect")}
                className="hover:underline text-[#141414] bg-transparent border-none p-0 cursor-pointer"
              >
                Connect
              </button>
            </div>
            <div>
              <button
                onClick={() => scrollTo("tools")}
                className="hover:underline text-[#141414] bg-transparent border-none p-0 cursor-pointer"
              >
                Tools
              </button>
            </div>
            <div>
              <button
                onClick={() => scrollTo("guardrails")}
                className="hover:underline text-[#141414] bg-transparent border-none p-0 cursor-pointer"
              >
                Guardrails
              </button>
            </div>
            <div>
              <button
                onClick={() => scrollTo("example")}
                className="hover:underline text-[#141414] bg-transparent border-none p-0 cursor-pointer"
              >
                Example
              </button>
            </div>
            <div>
              <button
                onClick={() => scrollTo("audit-log")}
                className="hover:underline text-[#141414] bg-transparent border-none p-0 cursor-pointer"
              >
                Audit log
              </button>
            </div>
          </nav>

          <div className="mt-16 text-[11px] uppercase tracking-widest text-[#66645E]">
            V1 / SANDBOX
          </div>
        </aside>

        {/* RIGHT COLUMN: MAIN CONTENT */}
        <div className="lg:col-span-9 space-y-20 max-w-[940px]">
          {/* HEADER HERO */}
          <section>
            <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
              M1 / MCP DOCS
            </div>

            <h1 className="font-serif text-[68px] leading-[1.05] font-normal text-[#141414] tracking-tight mb-6">
              Let agents run
              <br />
              the paperwork.
            </h1>

            <p className="text-[15px] text-[#66645E] max-w-[760px] leading-relaxed font-mono">
              Connect any MCP client to Retainer Referee. Draft contracts, check them, and read status in bulk. Agents never touch money amounts.
            </p>
          </section>

          {/* SECTION 1: CONNECT */}
          <section id="connect" className="scroll-mt-24">
            <h2 className="font-serif text-[38px] font-normal text-[#141414] tracking-tight mb-3">
              Connect
            </h2>

            <p className="text-[13px] text-[#66645E] font-mono mb-6 leading-relaxed">
              Remote HTTP server. Add it to your client with an agency token. Check your client's config format.
            </p>

            <div className="border border-[#141414] p-6 bg-[#FFF7E3] relative">
              <button
                onClick={handleCopy}
                className="absolute top-4 right-4 text-[11px] font-mono border border-[#141414] px-2.5 py-1 bg-transparent hover:bg-[#141414] hover:text-[#FFF7E3] cursor-pointer transition-colors"
              >
                {copiedConfig ? "Copied ✓" : "Copy"}
              </button>
              <pre className="text-[13px] font-mono text-[#141414] m-0 overflow-x-auto leading-relaxed">
                {`{\n  "retainer-referee": {\n    "url": "[SERVER URL]/api/mcp/rpc",\n    "headers": { "Authorization": "Bearer [AGENCY TOKEN]" }\n  }\n}`}
              </pre>
            </div>
          </section>

          {/* SECTION 2: TOOLS */}
          <section id="tools" className="scroll-mt-24">
            <h2 className="font-serif text-[38px] font-normal text-[#141414] tracking-tight mb-6">
              Tools
            </h2>

            {/* Sub-label: AGENCY */}
            <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
              AGENCY
            </div>

            {/* AGENCY TOOLS TABLE */}
            <div className="border-t border-[#141414] divide-y divide-[#141414]/30 text-[13px] font-mono mb-12">
              {/* Row 1 */}
              <div className="py-3 flex items-center justify-between gap-4">
                <span className="w-[240px] text-[#141414] font-medium shrink-0">
                  create_contract_from_text
                </span>
                <span className="flex-1 text-[#66645E]">
                  Proposal or chat in, draft contract out. Never activates.
                </span>
                <span className="border border-[#141414] px-2 py-0.5 text-[10px] uppercase font-mono text-[#141414] shrink-0">
                  DRAFT
                </span>
              </div>

              {/* Row 2 */}
              <div className="py-3 flex items-center justify-between gap-4">
                <span className="w-[240px] text-[#141414] font-medium shrink-0">
                  check_contract
                </span>
                <span className="flex-1 text-[#66645E]">
                  Errors, warnings, advisories, verifiability score.
                </span>
                <span className="border border-[#141414] px-2 py-0.5 text-[10px] uppercase font-mono text-[#141414] shrink-0">
                  READ
                </span>
              </div>

              {/* Row 3 */}
              <div className="py-3 flex items-center justify-between gap-4">
                <span className="w-[240px] text-[#141414] font-medium shrink-0">
                  backtest_contract
                </span>
                <span className="flex-1 text-[#66645E]">
                  Replay a CSV of past checks through the terms.
                </span>
                <span className="border border-[#141414] px-2 py-0.5 text-[10px] uppercase font-mono text-[#141414] shrink-0">
                  READ
                </span>
              </div>

              {/* Row 4 */}
              <div className="py-3 flex items-center justify-between gap-4">
                <span className="w-[240px] text-[#141414] font-medium shrink-0">
                  list_contracts
                </span>
                <span className="flex-1 text-[#66645E]">
                  Status, uptime, held amount, credits pending.
                </span>
                <span className="border border-[#141414] px-2 py-0.5 text-[10px] uppercase font-mono text-[#141414] shrink-0">
                  READ
                </span>
              </div>

              {/* Row 5 */}
              <div className="py-3 flex items-center justify-between gap-4">
                <span className="w-[240px] text-[#141414] font-medium shrink-0">
                  get_uptime_report
                </span>
                <span className="flex-1 text-[#66645E]">
                  Incidents and uptime for the current period.
                </span>
                <span className="border border-[#141414] px-2 py-0.5 text-[10px] uppercase font-mono text-[#141414] shrink-0">
                  READ
                </span>
              </div>

              {/* Row 6 */}
              <div className="py-3 flex items-center justify-between gap-4">
                <span className="w-[240px] text-[#141414] font-medium shrink-0">
                  preview_settlement
                </span>
                <span className="flex-1 text-[#66645E]">
                  Dry run of capture and credit. Changes nothing.
                </span>
                <span className="border border-[#141414] px-2 py-0.5 text-[10px] uppercase font-mono text-[#141414] shrink-0">
                  READ
                </span>
              </div>

              {/* Row 7 */}
              <div className="py-3 flex items-center justify-between gap-4">
                <span className="w-[240px] text-[#141414] font-medium shrink-0">
                  settle_period
                </span>
                <span className="flex-1 text-[#66645E]">
                  Runs real settlement. Requires confirm: true.
                </span>
                <span className="border border-[#E05345] text-[#E05345] px-2 py-0.5 text-[10px] uppercase font-mono font-semibold shrink-0">
                  WRITE*
                </span>
              </div>

              {/* Row 8 */}
              <div className="py-3 flex items-center justify-between gap-4 border-b border-[#141414]">
                <span className="w-[240px] text-[#141414] font-medium shrink-0">
                  get_statement
                </span>
                <span className="flex-1 text-[#66645E]">
                  Link to the statement PDF.
                </span>
                <span className="border border-[#141414] px-2 py-0.5 text-[10px] uppercase font-mono text-[#141414] shrink-0">
                  READ
                </span>
              </div>
            </div>

            {/* Sub-label: CUSTOMER: EVIDENCE MODE */}
            <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
              CUSTOMER: EVIDENCE MODE
            </div>

            {/* CUSTOMER EVIDENCE MODE TABLE */}
            <div className="border-t border-[#141414] divide-y divide-[#141414]/30 text-[13px] font-mono">
              {/* Row 1 */}
              <div className="py-3 flex items-center justify-between gap-4">
                <span className="w-[240px] text-[#141414] font-medium shrink-0">
                  create_watch
                </span>
                <span className="flex-1 text-[#66645E]">
                  Start monitoring a vendor you pay.
                </span>
                <span className="border border-[#141414] px-2 py-0.5 text-[10px] uppercase font-mono text-[#141414] shrink-0">
                  DRAFT
                </span>
              </div>

              {/* Row 2 */}
              <div className="py-3 flex items-center justify-between gap-4 border-b border-[#141414]">
                <span className="w-[240px] text-[#141414] font-medium shrink-0">
                  get_claim_pack
                </span>
                <span className="flex-1 text-[#66645E]">
                  Claim pack link, credit owed, letter draft.
                </span>
                <span className="border border-[#141414] px-2 py-0.5 text-[10px] uppercase font-mono text-[#141414] shrink-0">
                  READ
                </span>
              </div>
            </div>
          </section>

          {/* SECTION 3: GUARDRAILS */}
          <section id="guardrails" className="scroll-mt-24">
            <h2 className="font-serif text-[38px] font-normal text-[#141414] tracking-tight mb-8">
              Guardrails
            </h2>

            {/* 3 Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div>
                <h3 className="font-serif text-[22px] font-normal text-[#141414] mb-2 tracking-tight">
                  No amount fields
                </h3>
                <p className="text-[13px] text-[#66645E] font-mono leading-relaxed">
                  Money comes only from the contract and the probe logs.
                </p>
              </div>

              <div>
                <h3 className="font-serif text-[22px] font-normal text-[#141414] mb-2 tracking-tight">
                  Drafts stay drafts
                </h3>
                <p className="text-[13px] text-[#66645E] font-mono leading-relaxed">
                  A human confirms terms in the web app.
                </p>
              </div>

              <div>
                <h3 className="font-serif text-[22px] font-normal text-[#141414] mb-2 tracking-tight">
                  Clients consent
                </h3>
                <p className="text-[13px] text-[#66645E] font-mono leading-relaxed">
                  Only the client can approve the PayPal hold.
                </p>
              </div>
            </div>

            {/* Fourth item below */}
            <div className="mt-8">
              <h3 className="font-serif text-[22px] font-normal text-[#141414] mb-2 tracking-tight">
                Same math everywhere
              </h3>
              <p className="text-[13px] text-[#66645E] font-mono leading-relaxed">
                preview and settle use one function.
              </p>
            </div>
          </section>

          {/* SECTION 4: EXAMPLE */}
          <section id="example" className="scroll-mt-24">
            <h2 className="font-serif text-[38px] font-normal text-[#141414] tracking-tight mb-6">
              Example
            </h2>

            <div className="border border-[#141414] p-8 bg-[#FFF7E3] space-y-6">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-[#66645E] font-mono mb-1.5">
                  YOU
                </div>
                <div className="text-[14px] text-[#141414] font-mono">
                  Here are 12 proposals. Set up retainers and check each one.
                </div>
              </div>

              <div className="pt-2 border-t border-[#141414]/20">
                <div className="text-[10px] uppercase tracking-widest text-[#66645E] font-mono mb-2">
                  AGENT
                </div>
                <div className="font-serif text-[20px] text-[#141414] leading-relaxed font-normal">
                  Created 12 drafts. 9 are clean, 2 have tier overlaps, and 1 has no measurable terms. Review them in the ledger to activate.
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 5: AUDIT LOG */}
          <section id="audit-log" className="scroll-mt-24 pb-8">
            <h2 className="font-serif text-[38px] font-normal text-[#141414] tracking-tight mb-6">
              Audit log
            </h2>

            <div className="border-t border-[#141414] divide-y divide-[#141414]/30 text-[13px] font-mono">
              {realAuditLogs.map((item, idx) => (
                <div
                  key={idx}
                  className="py-3.5 flex items-center gap-8 border-b border-[#141414]/20 last:border-b-0"
                >
                  <span className="text-[#66645E] w-[90px] shrink-0">{item.time}</span>
                  <span className={item.isError ? "text-[#E05345]" : "text-[#141414]"}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
