import React, { useState } from "react";
import { Contract } from "../types";

interface NewContractViewProps {
  onContractCreated: (contract: Contract) => void;
  onCancel: () => void;
}

export const NewContractView: React.FC<NewContractViewProps> = ({
  onContractCreated,
  onCancel
}) => {
  const initialThread = `Agency: Retainer is $800/month, site stays up 99.9%.
Client: What if it goes down?
Agency: 10% back under 99.9, 30% back under 99.5.
Client: And updates?
Agency: Sundays 2 to 4am UTC don't count.`;

  const [rawText, setRawText] = useState(initialThread);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Form terms state
  const [terms, setTerms] = useState({
    title: "Website Retainer Agreement",
    agency_name: "Apex Studio",
    client_name: "Northwind Dental",
    client_email: "billing@northwinddental.example",
    site_url: "https://northwinddental.example",
    fee: 800,
    currency: "USD",
    uptime_target: 99.9,
    measurement_window: "30 days",
    billing_period_minutes: 5, // Demo 5 minutes
    excluded: "Sun 02:00 to 04:00 UTC",
    tier1: "99.5 to 99.9% = 10% credit",
    tier2: "Below 99.5% = 30% credit"
  });

  const handleExtract = async () => {
    setIsExtracting(true);
    setExtractError(null);
    try {
      const res = await fetch("/api/contracts/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: rawText })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");

      if (data.extracted) {
        const ext = data.extracted;
        const t1 = ext.credit_tiers?.[0];
        const t2 = ext.credit_tiers?.[1];
        const mw = ext.maintenance_windows?.[0];

        setTerms({
          title: ext.title || "Website Retainer Agreement",
          agency_name: ext.agency_name || "Apex Studio",
          client_name: ext.client_name || "Northwind Dental",
          client_email: ext.client_email || "billing@client.example",
          site_url: ext.site_url || "https://northwinddental.example",
          fee: ext.fee || 800,
          currency: ext.currency || "USD",
          uptime_target: ext.uptime_target || 99.9,
          measurement_window: ext.measurement_window || "30 days",
          billing_period_minutes: ext.billing_period_minutes || 5,
          excluded: mw ? `${mw.day_of_week} ${mw.start_time_utc} to ${mw.end_time_utc} UTC` : "Sun 02:00 to 04:00 UTC",
          tier1: t1 ? `${t1.min_uptime} to ${t1.max_uptime}% = ${t1.credit_percent}% credit` : "99.5 to 99.9% = 10% credit",
          tier2: t2 ? `Below ${t2.max_uptime}% = ${t2.credit_percent}% credit` : "Below 99.5% = 30% credit"
        });
      }
    } catch (err: any) {
      console.error(err);
      setExtractError(err.message || "Failed to extract terms from text");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleConfirmAndHold = async () => {
    setIsSubmitting(true);
    setExtractError(null);
    try {
      // 1. Create contract record in database
      const createRes = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: terms.title,
          agency_name: terms.agency_name,
          client_name: terms.client_name,
          client_email: terms.client_email,
          site_url: terms.site_url,
          fee: Number(terms.fee),
          currency: terms.currency,
          uptime_target: Number(terms.uptime_target),
          measurement_window: terms.measurement_window,
          billing_period_minutes: Number(terms.billing_period_minutes),
          credit_tiers: [
            { min_uptime: 99.5, max_uptime: 99.9, credit_pct: 10 },
            { min_uptime: 0, max_uptime: 99.5, credit_pct: 30 }
          ],
          maintenance_windows: [
            { day_of_week: "Sunday", start_time: "02:00", end_time: "04:00", timezone: "UTC" }
          ],
          exclusions: ["Agreed maintenance windows", "Client DNS or registrar failure"],
          raw_input_text: rawText
        })
      });

      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || "Failed to create contract");

      const contract: Contract = createData.contract;

      // 2. Generate PayPal Orders v2 Order with intent AUTHORIZE
      const confirmRes = await fetch(`/api/contracts/${contract.id}/confirm`, {
        method: "POST"
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) throw new Error(confirmData.error || "PayPal order creation failed");

      contract.paypal_order_id = confirmData.paypal_order_id;
      contract.status = "PENDING_APPROVAL";

      onContractCreated(contract);
    } catch (err: any) {
      console.error(err);
      setExtractError(err.message || "Failed to confirm contract terms");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1344px] mx-auto px-12 py-10">
      {/* Kicker */}
      <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
        A2 / NEW CONTRACT
      </div>

      {/* Headlines */}
      <h1 className="font-serif text-[54px] leading-[1.05] font-normal text-[#141414] tracking-tight m-0">
        Paste the deal.
      </h1>
      <h1 className="font-serif text-[54px] leading-[1.05] font-normal text-[#141414] tracking-tight mb-4">
        We write the rules.
      </h1>

      <p className="text-[13px] text-[#66645E] max-w-[620px] leading-relaxed mb-10">
        Drop in the proposal or chat. AI reads it into terms you confirm. Code does the rest.
      </p>

      {extractError && (
        <div className="mb-6 p-4 border border-[#E05345] text-[#E05345] text-[12px] font-mono">
          {extractError}
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-12">
        {/* Left Column: SOURCE / PASTED THREAD */}
        <div>
          <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
            SOURCE / PASTED THREAD
          </div>

          <div className="border border-[#141414] p-6 bg-[rgba(20,20,20,0.01)] min-h-[340px] flex flex-col justify-between">
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={10}
              className="w-full bg-transparent border-none text-[13px] font-mono text-[#141414] leading-relaxed focus:outline-none resize-none"
              placeholder="Paste contract proposal, email, or chat thread here..."
            />

            <div className="pt-4 border-t border-[#141414] flex items-center justify-between">
              <span className="text-[10px] text-[#66645E] uppercase tracking-wider">
                Raw Input Document
              </span>
              <button
                onClick={handleExtract}
                disabled={isExtracting}
                className="btn-outline text-[11px] py-1.5 px-3"
              >
                {isExtracting ? "Extracting with AI..." : "Re-extract with AI"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: PARSED TERMS */}
        <div>
          <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
            PARSED TERMS / CONFIRM BEFORE ACTIVATING
          </div>

          <div className="border-t border-[#141414]">
            {/* 7-Row Table */}
            <div className="py-3 border-b border-[#141414] flex justify-between items-center text-[13px]">
              <span className="text-[#66645E]">Monthly fee</span>
              {isEditing ? (
                <input
                  type="number"
                  value={terms.fee}
                  onChange={(e) => setTerms({ ...terms, fee: Number(e.target.value) })}
                  className="border border-[#141414] px-2 py-0.5 text-right w-28 bg-transparent text-[13px] font-mono"
                />
              ) : (
                <span className="font-medium text-[#141414]">${terms.fee} {terms.currency}</span>
              )}
            </div>

            <div className="py-3 border-b border-[#141414] flex justify-between items-center text-[13px]">
              <span className="text-[#66645E]">Uptime target</span>
              {isEditing ? (
                <input
                  type="number"
                  step="0.01"
                  value={terms.uptime_target}
                  onChange={(e) => setTerms({ ...terms, uptime_target: Number(e.target.value) })}
                  className="border border-[#141414] px-2 py-0.5 text-right w-24 bg-transparent text-[13px] font-mono"
                />
              ) : (
                <span className="font-medium text-[#141414]">{terms.uptime_target}%</span>
              )}
            </div>

            <div className="py-3 border-b border-[#141414] flex justify-between items-center text-[13px]">
              <span className="text-[#66645E]">Window</span>
              <span className="font-medium text-[#141414]">{terms.measurement_window}</span>
            </div>

            <div className="py-3 border-b border-[#141414] flex justify-between items-center text-[13px]">
              <span className="text-[#66645E]">Excluded</span>
              <span className="font-medium text-[#141414]">{terms.excluded}</span>
            </div>

            <div className="py-3 border-b border-[#141414] flex justify-between items-center text-[13px]">
              <span className="text-[#66645E]">Tier 1</span>
              <span className="font-medium text-[#141414]">{terms.tier1}</span>
            </div>

            <div className="py-3 border-b border-[#141414] flex justify-between items-center text-[13px]">
              <span className="text-[#66645E]">Tier 2</span>
              <span className="font-medium text-[#141414]">{terms.tier2}</span>
            </div>

            <div className="py-3 border-b border-[#141414] flex justify-between items-center text-[13px]">
              <span className="text-[#66645E]">Monitored URL</span>
              {isEditing ? (
                <input
                  type="text"
                  value={terms.site_url}
                  onChange={(e) => setTerms({ ...terms, site_url: e.target.value })}
                  className="border border-[#141414] px-2 py-0.5 w-60 bg-transparent text-[13px] font-mono"
                />
              ) : (
                <span className="font-medium text-[#141414]">{terms.site_url}</span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4 mt-8 mb-4">
            <button
              onClick={handleConfirmAndHold}
              disabled={isSubmitting}
              className="btn-primary"
            >
              {isSubmitting ? "Generating PayPal Hold..." : "Confirm terms and request hold"}
            </button>

            <button
              onClick={() => setIsEditing(!isEditing)}
              className="btn-outline"
            >
              {isEditing ? "Done editing" : "Edit terms"}
            </button>

            <button
              onClick={onCancel}
              className="text-[11px] uppercase tracking-wider text-[#66645E] hover:text-[#141414] ml-2"
            >
              Cancel
            </button>
          </div>

          {/* Footnote */}
          <p className="text-[11px] text-[#66645E] leading-normal m-0">
            Nothing is charged. PayPal authorizes the fee and captures only what is earned.
          </p>
        </div>
      </div>
    </div>
  );
};
