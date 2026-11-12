import React from "react";
import { ClientContract } from "../types";

interface ClientLivePeriodViewProps {
  contract: ClientContract;
}

export const ClientLivePeriodView: React.FC<ClientLivePeriodViewProps> = ({ contract }) => {
  const fee = contract.fee || 800;
  const targetUptime = contract.uptime_target || 99.9;

  return (
    <div className="max-w-[1344px] mx-auto px-12 py-10">
      {/* Kicker */}
      <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
        C2 / MY RETAINER, DAY 12 OF 30
      </div>

      {/* Main Headline */}
      <h1 className="font-serif text-[54px] leading-[1.05] font-normal text-[#141414] tracking-tight mb-2">
        99.97%. On target.
      </h1>

      <p className="text-[14px] text-[#66645E] max-w-[700px] leading-relaxed mb-10">
        No incidents so far. Your site is monitored every minute.
      </p>

      {/* 30-Day Timeline Bar Section */}
      <div className="mb-14">
        <div className="timeline-bar relative mb-3">
          {/* Black tick at Day 12 */}
          <div className="timeline-tick-black" style={{ left: "40%" }} />
        </div>

        {/* Timeline Day Markers */}
        <div className="relative text-[11px] font-mono text-[#66645E] h-6">
          <span className="absolute left-0">Day 1</span>
          <span className="absolute left-[40%] -translate-x-1/2 text-[#141414] font-medium">
            Day 12 (today)
          </span>
          <span className="absolute right-0">Day 30</span>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-12 gap-16">
        {/* Left Column: TERMS */}
        <div className="col-span-6">
          <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
            TERMS
          </div>

          <div className="border-t border-[#141414]">
            <div className="py-3.5 border-b border-[#141414] flex justify-between items-center text-[13px]">
              <span className="text-[#66645E]">Target</span>
              <span className="font-medium text-[#141414]">{targetUptime}%</span>
            </div>

            <div className="py-3.5 border-b border-[#141414] flex justify-between items-center text-[13px]">
              <span className="text-[#66645E]">Excluded</span>
              <span className="font-medium text-[#141414]">Sun 02:00 to 04:00 UTC</span>
            </div>

            <div className="py-3.5 border-b border-[#141414] flex justify-between items-center text-[13px]">
              <span className="text-[#66645E]">Settles</span>
              <span className="font-medium text-[#141414]">In 18 days</span>
            </div>
          </div>
        </div>

        {/* Right Column: IF THE PERIOD ENDED TODAY CARD */}
        <div className="col-span-6">
          <div className="border border-[#141414] p-8 bg-[rgba(20,20,20,0.01)]">
            <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-2">
              IF THE PERIOD ENDED TODAY
            </div>

            <div className="font-serif text-[56px] font-normal text-[#141414] tracking-tight mb-4">
              ${fee.toFixed(2)}
            </div>

            <div className="border-t border-[#141414] pt-4 text-[13px] text-[#66645E] leading-normal">
              Held on PayPal. Any credit is applied automatically.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
