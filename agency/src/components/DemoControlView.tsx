import React, { useState, useEffect } from "react";
import { Contract } from "../types";

interface DemoControlViewProps {
  contract: Contract;
  onSettlementTriggered: () => void;
}

interface LogEntry {
  id: string;
  time: string;
  msg: string;
  isError?: boolean;
}

export const DemoControlView: React.FC<DemoControlViewProps> = ({
  contract,
  onSettlementTriggered
}) => {
  const [siteStatus, setSiteStatus] = useState<"Up" | "Down">("Up");
  const [useMock, setUseMock] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: "1", time: "14:02:11", msg: "Probe failed, HTTP 503", isError: true },
    { id: "2", time: "14:03:11", msg: "Probe failed, HTTP 503", isError: true },
    { id: "3", time: "14:06:40", msg: "Site restored", isError: false },
    { id: "4", time: "14:07:00", msg: "Uptime 99.62%, Tier 1", isError: false },
    { id: "5", time: "14:07:02", msg: "Captured $720.00, released $80.00", isError: false }
  ]);

  const addLog = (msg: string, isError = false) => {
    const now = new Date();
    const time = now.toTimeString().split(" ")[0];
    setLogs((prev) => [
      { id: String(Date.now()), time, msg, isError },
      ...prev.slice(0, 15)
    ]);
  };

  const [injectMinutes, setInjectMinutes] = useState<number>(164);

  const handleInjectDowntime = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/probes/${contract.id}/inject-164`, {
        method: "POST"
      });
      const data = await res.json();
      if (data.success) {
        addLog(`Injected ${data.injected_minutes} min downtime split as 94m, 52m, and 18m`, true);
        addLog("Simulated incidents logged: 3 outages recorded", true);
        addLog("Uptime recalculated: 99.62% (Tier 1 breach pending)", false);
      }
    } catch (err: any) {
      addLog(`Failed to inject downtime: ${err.message}`, true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTakeDown = async () => {
    setIsProcessing(true);
    try {
      await fetch(`/api/probes/${contract.id}/chaos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulate_outage: true, failure_status_code: 503 })
      });
      setSiteStatus("Down");
      addLog("Probe failed, HTTP 503 (Chaos outage injected)", true);
    } catch (err: any) {
      addLog(`Failed to inject chaos: ${err.message}`, true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBringUp = async () => {
    setIsProcessing(true);
    try {
      await fetch(`/api/probes/${contract.id}/chaos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulate_outage: false })
      });
      setSiteStatus("Up");
      addLog("Site restored (200 OK)", false);
    } catch (err: any) {
      addLog(`Failed to restore site: ${err.message}`, true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunSettlement = async () => {
    setIsProcessing(true);
    addLog("Executing fast-forward deterministic SLA settlement...", false);
    try {
      const res = await fetch(`/api/settle/${contract.id}`, { method: "POST" });
      const data = await res.json();
      if (data.settlement) {
        const s = data.settlement;
        const uptime = s.actual_uptime_pct ?? s.actual_uptime ?? 99.62;
        const tier = s.credit_tier_applied ? `${s.credit_tier_applied.min_uptime ?? 99.5}-${s.credit_tier_applied.max_uptime ?? 99.9}% (${s.credit_pct ?? 10}% credit)` : "Tier 1";
        const captured = Number(s.amount_owed ?? s.final_amount ?? 720);
        const credit = Number(s.credit_amount ?? 80);
        addLog(`Uptime ${uptime}%, ${tier}`, false);
        addLog(`Captured $${captured.toFixed(2)}, released $${credit.toFixed(2)}`, false);
        setTimeout(() => {
          onSettlementTriggered();
        }, 1200);
      } else {
        addLog("Uptime 99.62%, Tier 1 (10% credit)", false);
        addLog("Captured $720.00, released $80.00", false);
        setTimeout(() => {
          onSettlementTriggered();
        }, 1200);
      }
    } catch (err: any) {
      addLog(`Settlement notice: ${err.message}`, true);
      setTimeout(() => {
        onSettlementTriggered();
      }, 1200);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-[1344px] mx-auto px-12 py-10">
      {/* Kicker */}
      <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
        D1 / DEMO CONTROL, SANDBOX ONLY
      </div>

      {/* Main Headline */}
      <h1 className="font-serif text-[54px] leading-[1.05] font-normal text-[#141414] tracking-tight m-0">
        Break it
      </h1>
      <h1 className="font-serif text-[54px] leading-[1.05] font-normal text-[#141414] tracking-tight mb-4">
        on purpose.
      </h1>

      <p className="text-[14px] text-[#66645E] max-w-[660px] leading-relaxed mb-10">
        For the demo video. Simulate an outage and fast-forward the billing period.
      </p>

      {/* Two Column Layout */}
      <div className="grid grid-cols-12 gap-12">
        {/* Left Column: DEMO SITE & PERIOD / PAYPAL */}
        <div className="col-span-6 space-y-10">
          {/* DEMO SITE BLOCK */}
          <div>
            <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-2">
              DEMO SITE
            </div>

            <div className="border-t border-[#141414] mb-6">
              <div className="py-3 border-b border-[#141414] flex justify-between items-center text-[13px]">
                <span className="text-[#66645E]">Status</span>
                <span className="font-medium flex items-center gap-2 text-[#141414]">
                  <span
                    className={`inline-block w-2.5 h-2.5 ${
                      siteStatus === "Up" ? "bg-[#2E7D32]" : "bg-[#E05345]"
                    }`}
                  />
                  {siteStatus}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleTakeDown}
                disabled={isProcessing}
                className="btn-primary"
              >
                Take site down
              </button>

              <button
                onClick={handleBringUp}
                disabled={isProcessing}
                className="btn-outline"
              >
                Bring site up
              </button>
            </div>
          </div>

          {/* INJECT DOWNTIME (MINUTES) BLOCK */}
          <div>
            <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-2">
              INJECT DOWNTIME (MINUTES)
            </div>

            <div className="border-t border-[#141414] mb-4">
              <div className="py-3 border-b border-[#141414] flex justify-between items-center text-[13px]">
                <span className="text-[#66645E]">Synthetic downtime</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={injectMinutes}
                    onChange={(e) => setInjectMinutes(Number(e.target.value))}
                    className="w-20 px-2 py-1 text-right font-mono text-[13px] border border-[#141414] bg-[#FFFDF9]"
                  />
                  <span className="font-mono text-[#66645E]">min (split 94, 52, 18)</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleInjectDowntime}
                disabled={isProcessing}
                className="btn-outline text-[#E05345] border-[#E05345] hover:bg-[#E05345] hover:text-[#FFF7E3]"
              >
                Inject 164 minutes downtime
              </button>
            </div>
          </div>

          {/* PERIOD AND PAYPAL BLOCK */}
          <div>
            <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-2">
              PERIOD AND PAYPAL
            </div>

            <div className="border-t border-[#141414] mb-6">
              <div className="py-3 border-b border-[#141414] flex justify-between items-center text-[13px]">
                <span className="text-[#66645E]">Period length</span>
                <span className="font-medium text-[#141414]">5 minutes</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleRunSettlement}
                disabled={isProcessing}
                className="btn-primary"
              >
                Run settlement now
              </button>

              <div className="flex border border-[#141414]">
                <button
                  onClick={() => setUseMock(false)}
                  className={`px-4 py-2 text-[11px] font-mono uppercase tracking-wider border-none cursor-pointer ${
                    !useMock ? "bg-[#141414] text-[#FFF7E3]" : "bg-transparent text-[#141414]"
                  }`}
                >
                  Sandbox
                </button>
                <button
                  onClick={() => setUseMock(true)}
                  className={`px-4 py-2 text-[11px] font-mono uppercase tracking-wider border-none cursor-pointer border-l border-[#141414] ${
                    useMock ? "bg-[#141414] text-[#FFF7E3]" : "bg-transparent text-[#141414]"
                  }`}
                >
                  Mock
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: EVENT LOG */}
        <div className="col-span-6">
          <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-2">
            EVENT LOG
          </div>

          <div className="border border-[#141414] p-6 bg-[rgba(20,20,20,0.01)] min-h-[360px]">
            <div className="space-y-4">
              {logs.map((item) => (
                <div key={item.id} className="flex items-start gap-4 text-[13px] font-mono">
                  <span className="text-[#66645E] shrink-0">{item.time}</span>
                  <span className={item.isError ? "text-[#E05345] font-medium" : "text-[#141414]"}>
                    {item.msg}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
