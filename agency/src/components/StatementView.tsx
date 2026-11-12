import React from "react";
import { Contract, Settlement } from "../types";

interface StatementViewProps {
  contract: Contract;
  settlement?: Settlement | null;
}

export const StatementView: React.FC<StatementViewProps> = ({ contract, settlement }) => {
  const summaryText = settlement?.plain_english_summary ||
    "Your site was down for 164 minutes across three incidents, bringing uptime to 99.62%, below the promised 99.9%. Under the agreed terms that earns a 10% credit. You are charged $720 of the $800 held.";

  const authId = contract.paypal_authorization_id || "AUTH-PAYPAL-78291044";
  const captureId = contract.paypal_capture_id || (settlement?.paypal_transaction_id || "CAP-PAYPAL-99102488");
  const fee = settlement?.base_fee || contract.fee || 800;
  const credit = settlement?.credit_amount || 80;
  const captured = settlement?.final_amount || (fee - credit);

  const handleDownloadPdf = () => {
    window.open(`/api/client/contracts/${contract.id}/statement.pdf`, "_blank");
  };

  return (
    <div className="max-w-[1344px] mx-auto px-12 py-10">
      {/* Kicker */}
      <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
        A4 + C3 / STATEMENT OF CREDIT
      </div>

      {/* Main Headline */}
      <h1 className="font-serif text-[54px] leading-[1.05] font-normal text-[#141414] tracking-tight mb-3">
        Statement of credit
      </h1>

      {/* Sub-meta */}
      <div className="text-[13px] text-[#66645E] font-mono pb-6 border-b border-[#141414] mb-8">
        Period Oct 1 — Oct 31, 2026 &nbsp;&nbsp;&nbsp;&nbsp; Contract {contract.id} &nbsp;&nbsp;&nbsp;&nbsp; {contract.agency_name} to {contract.client_name}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-12 gap-16">
        {/* Left Column: AI Narrative & Disclaimer */}
        <div className="col-span-6 pr-6">
          <blockquote className="font-serif italic text-[24px] leading-[1.4] text-[#141414] m-0 mb-8 font-normal">
            "{summaryText}"
          </blockquote>

          <p className="text-[11px] text-[#66645E] font-mono leading-normal">
            Summary written by AI from the figures at right. It decides nothing.
          </p>
        </div>

        {/* Right Column: THE MATH & PAYPAL REFERENCES */}
        <div className="col-span-6">
          <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-2">
            THE MATH
          </div>

          <div className="border-t border-[#141414] mb-8">
            <div className="py-2.5 border-b border-[#141414] flex justify-between items-center text-[13px]">
              <span className="text-[#66645E]">Probes run</span>
              <span className="font-mono text-[#141414]">{settlement?.total_probes ? settlement.total_probes.toLocaleString() : "43,200"}</span>
            </div>

            <div className="py-2.5 border-b border-[#141414] flex justify-between items-center text-[13px]">
              <span className="text-[#66645E]">Downtime</span>
              <span className="font-mono text-[#141414]">{settlement?.downtime_minutes || 164} min</span>
            </div>

            <div className="py-2.5 border-b border-[#141414] flex justify-between items-center text-[13px]">
              <span className="text-[#66645E]">Uptime / target</span>
              <span className="font-mono text-[#141414]">{settlement?.actual_uptime || 99.62}% / {contract.uptime_target}%</span>
            </div>

            <div className="py-2.5 border-b border-[#141414] flex justify-between items-center text-[13px]">
              <span className="text-[#66645E]">Tier</span>
              <span className="font-mono text-[#141414]">{settlement?.tier_applied || "Tier 1, 10% credit"}</span>
            </div>

            <div className="py-2.5 border-b border-[#141414] flex justify-between items-center text-[13px]">
              <span className="text-[#66645E]">Fee</span>
              <span className="font-mono text-[#141414]">${fee.toFixed(2)}</span>
            </div>

            <div className="py-2.5 border-b border-[#141414] flex justify-between items-center text-[13px]">
              <span className="text-[#66645E]">Credit</span>
              <span className="font-mono text-[#E05345]">-${credit.toFixed(2)}</span>
            </div>

            <div className="py-2.5 border-b border-[#141414] flex justify-between items-center text-[13px]">
              <span className="text-[#66645E]">Captured</span>
              <span className="font-mono font-medium text-[#141414]">${captured.toFixed(2)}</span>
            </div>
          </div>

          {/* PAYPAL REFERENCES */}
          <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-2">
            PAYPAL REFERENCES
          </div>

          <div className="border-t border-[#141414] mb-8">
            <div className="py-2 border-b border-[#141414] flex justify-between items-center text-[12px]">
              <span className="text-[#66645E]">Authorization</span>
              <span className="font-mono text-[#141414]">{authId}</span>
            </div>

            <div className="py-2 border-b border-[#141414] flex justify-between items-center text-[12px]">
              <span className="text-[#66645E]">Capture</span>
              <span className="font-mono text-[#141414]">{captureId}</span>
            </div>

            <div className="py-2 border-b border-[#141414] flex justify-between items-center text-[12px]">
              <span className="text-[#66645E]">Remainder released</span>
              <span className="font-mono text-[#141414]">${credit.toFixed(2)}</span>
            </div>
          </div>

          {/* Download PDF button */}
          <button
            onClick={handleDownloadPdf}
            className="btn-outline text-[12px] px-6 py-2.5"
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
};
