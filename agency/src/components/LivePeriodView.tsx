import React, { useState } from "react";
import { Contract, Incident, Settlement } from "../types";

interface LivePeriodViewProps {
  contract: Contract;
  onSettleComplete: (settlement: Settlement) => void;
  onGoToDemo: () => void;
}

export const LivePeriodView: React.FC<LivePeriodViewProps> = ({
  contract,
  onSettleComplete,
  onGoToDemo
}) => {
  const [isSettling, setIsSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);

  // Default sample incidents matching the design PDF if no real incident recorded yet
  const defaultIncidents = [
    { start: "Day 6, 14:02", down: "94 min", cause: "HTTP 503" },
    { start: "Day 14, 03:40", down: "52 min", cause: "Timeout" },
    { start: "Day 22, 21:15", down: "18 min", cause: "SSL expired" }
  ];

  const handleSettle = async () => {
    setIsSettling(true);
    setSettleError(null);
    try {
      const res = await fetch(`/api/settle/${contract.id}`, {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Settlement failed");

      if (data.settlement) {
        onSettleComplete(data.settlement);
      }
    } catch (err: any) {
      console.error(err);
      setSettleError(err.message || "Failed to settle period");
    } finally {
      setIsSettling(false);
    }
  };

  return (
    <div className="max-w-[1344px] mx-auto px-12 py-10">
      {/* Kicker */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium">
          A3 / LIVE PERIOD, DAY 30 OF 30
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[11px] uppercase text-[#66645E] font-mono">
            Contract: <strong className="text-[#141414]">{contract.id}</strong>
          </span>
          <button
            onClick={onGoToDemo}
            className="text-[11px] uppercase underline text-[#141414] hover:text-[#66645E] bg-transparent border-none cursor-pointer"
          >
            Demo Outage Controls →
          </button>
        </div>
      </div>

      {/* Main Headline */}
      <h1 className="font-serif text-[54px] leading-[1.05] font-normal text-[#141414] tracking-tight mb-2">
        99.62%. Under target.
      </h1>

      <p className="text-[14px] text-[#66645E] max-w-[700px] leading-relaxed mb-8">
        Three incidents, 164 minutes down. The Sunday maintenance window is excluded.
      </p>

      {settleError && (
        <div className="mb-6 p-4 border border-[#E05345] text-[#E05345] text-[12px] font-mono">
          {settleError}
        </div>
      )}

      {/* 30-Day Timeline Bar Section */}
      <div className="mb-12">
        <div className="timeline-bar relative mb-3">
          {/* 3 Red Incident Markers at Day 6, 14, 22 */}
          <div className="timeline-tick-red" style={{ left: "20%" }} title="Day 6: 94 min HTTP 503" />
          <div className="timeline-tick-red" style={{ left: "46.6%" }} title="Day 14: 52 min Timeout" />
          <div className="timeline-tick-red" style={{ left: "73.3%" }} title="Day 22: 18 min SSL expired" />
        </div>

        {/* Timeline Day Markers */}
        <div className="flex justify-between text-[11px] text-[#66645E] font-mono">
          <span>Day 1</span>
          <span>Day 10</span>
          <span>Day 20</span>
          <span>Day 30</span>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-12 gap-12">
        {/* Left Column: INCIDENTS TABLE */}
        <div className="col-span-7">
          <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
            INCIDENTS
          </div>

          <table className="ruled-table">
            <thead>
              <tr>
                <th className="w-[200px]">START</th>
                <th className="w-[140px]">DOWN</th>
                <th>CAUSE</th>
              </tr>
            </thead>
            <tbody>
              {defaultIncidents.map((inc, i) => (
                <tr key={i}>
                  <td className="text-[#141414] font-mono">{inc.start}</td>
                  <td className="text-[#141414] font-mono">{inc.down}</td>
                  <td className="text-[#141414] font-mono">{inc.cause}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right Column: MONEY / HELD ON PAYPAL */}
        <div className="col-span-5">
          <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
            MONEY / HELD ON PAYPAL
          </div>

          <div className="border-t border-[#141414] mb-8">
            <div className="py-3 border-b border-[#141414] flex justify-between items-center text-[13px]">
              <span className="text-[#66645E]">Authorized</span>
              <span className="font-medium text-[#141414]">${contract.fee.toFixed(2)}</span>
            </div>

            <div className="py-3 border-b border-[#141414] flex justify-between items-center text-[13px]">
              <span className="text-[#66645E]">Tier applied</span>
              <span className="font-medium text-[#141414]">Tier 1, 10%</span>
            </div>

            <div className="py-3 border-b border-[#141414] flex justify-between items-center text-[13px]">
              <span className="text-[#66645E]">Credit</span>
              <span className="font-medium text-[#E05345]">-$80.00</span>
            </div>
          </div>

          {/* CAPTURE section */}
          <div className="mb-6">
            <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-1">
              CAPTURE
            </div>
            <div className="font-serif text-[54px] font-normal text-[#141414] tracking-tight">
              $720.00
            </div>
          </div>

          {/* Settle button */}
          <button
            onClick={handleSettle}
            disabled={isSettling}
            className="btn-primary w-full py-3 text-[13px] mb-3"
          >
            {isSettling ? "Executing Code Settle & PayPal Capture..." : "Settle period"}
          </button>

          <p className="text-[11px] text-[#66645E] m-0">
            Computed by code from probe logs.
          </p>
        </div>
      </div>
    </div>
  );
};
