import React, { useState } from "react";
import { ClientContract } from "../types";

interface ApproveHoldViewProps {
  contract: ClientContract;
  onApproved: () => void;
}

export const ApproveHoldView: React.FC<ApproveHoldViewProps> = ({ contract, onApproved }) => {
  const [isApproving, setIsApproving] = useState(false);
  const [approvalSuccess, setApprovalSuccess] = useState(false);
  const [showPayPalModal, setShowPayPalModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agencyName = contract.agency_name || "Apex Studio";
  const siteUrl = contract.site_url ? contract.site_url.replace(/^https?:\/\//, "") : "northwinddental.example";
  const fee = contract.fee || 800;

  const handleApprove = async () => {
    setIsApproving(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/contracts/${contract.id}/approve-hold`, {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed");

      setShowPayPalModal(false);
      setApprovalSuccess(true);
      setTimeout(() => {
        onApproved();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to approve payment hold");
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="max-w-[1344px] mx-auto px-12 py-10">
      {/* Kicker */}
      <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
        C1 / APPROVE HOLD
      </div>

      {/* Headlines */}
      <h1 className="font-serif text-[54px] leading-[1.05] font-normal text-[#141414] tracking-tight m-0">
        Pay for uptime
      </h1>
      <h1 className="font-serif text-[54px] leading-[1.05] font-normal text-[#141414] tracking-tight mb-4">
        you actually get.
      </h1>

      <p className="text-[14px] text-[#66645E] max-w-[680px] leading-relaxed mb-10">
        {agencyName} set these terms for {siteUrl}. Review them, then approve.
      </p>

      {error && (
        <div className="mb-6 p-4 border border-[#E05345] text-[#E05345] text-[12px] font-mono">
          {error}
        </div>
      )}

      {approvalSuccess && (
        <div className="mb-6 p-4 border border-[#2E7D32] bg-[#E8F5E9] text-[#2E7D32] text-[13px] font-mono">
          ✓ Payment hold authorized with PayPal sandbox! Retainer monitoring activated.
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-12 gap-16">
        {/* Left Column: WHAT YOU PAY */}
        <div className="col-span-6">
          <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
            WHAT YOU PAY
          </div>

          <div className="border-t border-[#141414] mb-6">
            <div className="py-4 border-b border-[#141414] flex justify-between items-center text-[14px]">
              <span className="text-[#141414]">Up 99.9% or better</span>
              <span className="font-medium text-[#141414]">${fee.toFixed(2)}</span>
            </div>

            <div className="py-4 border-b border-[#141414] flex justify-between items-center text-[14px]">
              <span className="text-[#141414]">Between 99.5 and 99.9%</span>
              <span className="font-medium text-[#141414]">${(fee * 0.9).toFixed(2)}</span>
            </div>

            <div className="py-4 border-b border-[#141414] flex justify-between items-center text-[14px]">
              <span className="text-[#141414]">Below 99.5%</span>
              <span className="font-medium text-[#141414]">${(fee * 0.7).toFixed(2)}</span>
            </div>
          </div>

          <p className="text-[12px] text-[#66645E] leading-normal m-0">
            Planned maintenance, Sun 02:00 to 04:00 UTC, does not count against uptime.
          </p>
        </div>

        {/* Right Column: HOLD TODAY CARD */}
        <div className="col-span-6">
          <div className="border border-[#141414] p-8 bg-[rgba(20,20,20,0.01)]">
            <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-2">
              HOLD TODAY
            </div>

            <div className="font-serif text-[56px] font-normal text-[#141414] tracking-tight mb-4">
              ${fee.toFixed(2)}
            </div>

            <div className="border-t border-[#141414] pt-4 mb-6 text-[13px] text-[#141414] leading-relaxed">
              Not charged today. PayPal holds the amount and captures only what is earned at period end.
            </div>

            <button
              onClick={() => setShowPayPalModal(true)}
              disabled={isApproving || approvalSuccess}
              className="btn-primary w-full py-3.5 text-[14px] mb-3"
            >
              {approvalSuccess
                ? "Payment Hold Authorized ✓"
                : "Approve with PayPal"}
            </button>

            <p className="text-[11px] text-[#66645E] m-0">
              Sandbox checkout. No real money moves.
            </p>
          </div>
        </div>
      </div>

      {/* Realistic PayPal Sandbox Authorization Modal */}
      {showPayPalModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#FFFDF8] border-2 border-[#141414] w-full max-w-md p-8 shadow-2xl relative font-mono">
            <div className="flex items-center justify-between pb-4 border-b border-[#141414]">
              <div className="flex items-center gap-2">
                <span className="font-serif italic font-bold text-[22px] text-[#003087]">
                  Pay<span className="text-[#0079C1]">Pal</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-[#FFF7E3] border border-[#141414] uppercase tracking-wider text-[#66645E]">
                  Sandbox
                </span>
              </div>
              <span className="text-[11px] text-[#66645E]">Orders API v2</span>
            </div>

            <div className="py-6 space-y-4">
              <div className="text-[12px] text-[#66645E]">AUTHORIZATION RECIPIENT</div>
              <div className="text-[18px] font-medium text-[#141414]">{agencyName}</div>

              <div className="bg-[rgba(20,20,20,0.03)] border border-[#141414] p-4 flex justify-between items-center">
                <div>
                  <div className="text-[11px] text-[#66645E] uppercase tracking-wider">Holding Amount</div>
                  <div className="text-[26px] font-serif font-bold text-[#141414]">${fee.toFixed(2)} USD</div>
                </div>
                <span className="text-[10px] px-2.5 py-1 bg-[#141414] text-[#FFF7E3] font-mono font-medium">
                  INTENT: AUTHORIZE
                </span>
              </div>

              <div className="text-[12px] text-[#66645E] leading-relaxed border-t border-[#141414]/20 pt-3">
                <div>• Funds held today: <strong>${fee.toFixed(2)} USD</strong></div>
                <div>• Charged today: <strong>$0.00 USD</strong></div>
                <div className="text-[11px] text-[#66645E] mt-1">Settlement code releases or captures at period end.</div>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={handleApprove}
                disabled={isApproving}
                className="w-full py-3.5 bg-[#0070BA] hover:bg-[#003087] text-white font-medium text-[14px] border border-[#003087] transition-colors cursor-pointer"
              >
                {isApproving ? "Authorizing via PayPal Orders v2..." : "Complete Sandbox Authorization"}
              </button>
              <button
                onClick={() => setShowPayPalModal(false)}
                className="text-[11px] uppercase tracking-wider text-[#66645E] hover:text-[#141414] text-center py-1 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
