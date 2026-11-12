import React, { useState, useEffect } from "react";

interface EvidenceIncident {
  time_label: string;
  duration_minutes: number;
  reason: string;
  status_code: number;
}

interface ClaimData {
  id: string;
  watch_id: string;
  vendor_name: string;
  site_url: string;
  monthly_fee: number;
  actual_uptime: number;
  target_uptime: number;
  total_downtime_minutes: number;
  tier_applied: string;
  credit_pct: number;
  credit_owed: number;
  log_hash: string;
  probe_region: string;
  incidents: EvidenceIncident[];
  claim_letter: string;
  pdf_url?: string;
  invite_link?: string;
}

interface ClaimPackViewProps {
  watchId?: string | null;
  onNewVendorClick: () => void;
}

export const ClaimPackView: React.FC<ClaimPackViewProps> = ({ watchId, onNewVendorClick }) => {
  const [claim, setClaim] = useState<ClaimData>({
    id: "CLM-NW-01",
    watch_id: watchId || "WTC-01",
    vendor_name: "Northwind Hosting",
    site_url: "https://northwinddental.example",
    monthly_fee: 800,
    actual_uptime: 99.62,
    target_uptime: 99.9,
    total_downtime_minutes: 164,
    tier_applied: "Tier 1 (10%)",
    credit_pct: 10,
    credit_owed: 80,
    log_hash: "5f226850bae266d8...",
    probe_region: "us-east-1 (N. Virginia)",
    incidents: [
      { time_label: "Day 6, 14:02", duration_minutes: 94, reason: "HTTP 503", status_code: 503 },
      { time_label: "Day 14, 03:40", duration_minutes: 52, reason: "Timeout", status_code: 504 },
      { time_label: "Day 22, 21:15", duration_minutes: 18, reason: "SSL expired", status_code: 0 }
    ],
    claim_letter:
      "Hello Northwind Hosting, our monitoring recorded 164 minutes of downtime across three incidents this period, giving 99.62% uptime against the agreed 99.9%. Under Tier 1 of our agreement a 10% credit of $80.00 applies. The attached log lists each failed check. Please apply the credit.",
    pdf_url: "/api/evidence/claims/CLM-NW-01/pdf",
    invite_link: "http://localhost:3000/?from_claim=CLM-NW-01&vendor=Northwind%20Hosting&url=https%3A%2F%2Fnorthwinddental.example&fee=800"
  });

  const [copied, setCopied] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // Fetch real claim if watchId provided
  useEffect(() => {
    const fetchClaim = async () => {
      try {
        const res = await fetch("/api/evidence/claims");
        if (res.ok) {
          const data = await res.json();
          if (data.claims && data.claims.length > 0) {
            setClaim(data.claims[0]);
          }
        }
      } catch (err) {
        console.log("Using canonical claim preview:", err);
      }
    };
    fetchClaim();
  }, [watchId]);

  const handleCopyLetter = () => {
    navigator.clipboard.writeText(claim.claim_letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadPdf = () => {
    const url = claim.pdf_url || `/api/evidence/claims/${claim.id}/pdf`;
    window.open(url, "_blank");
  };

  const handleSimulateOutage = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch(`/api/evidence/watches/${claim.watch_id}/simulate-breach`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setClaim(data.claim);
      }
    } catch (err) {
      console.error("Outage simulation failed:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleInviteVendor = () => {
    const targetUrl = claim.invite_link || `http://localhost:3000/?from_claim=${claim.id}&vendor=${encodeURIComponent(claim.vendor_name)}&url=${encodeURIComponent(claim.site_url)}&fee=${claim.monthly_fee}`;
    window.open(targetUrl, "_blank");
  };

  return (
    <div className="max-w-[1344px] mx-auto px-12 py-12 font-mono">
      {/* Breadcrumb Label */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium">
          X2 / CLAIM PACK
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSimulateOutage}
            disabled={isSimulating}
            className="text-[10px] uppercase font-mono tracking-wider border border-[#E05345] text-[#E05345] px-2.5 py-1 hover:bg-[#E05345]/5 cursor-pointer bg-transparent"
          >
            {isSimulating ? "Injecting Breach..." : "Simulate Outage Breach (Demo)"}
          </button>
          <button
            onClick={onNewVendorClick}
            className="text-[10px] uppercase font-mono tracking-wider border border-[#141414] text-[#141414] px-2.5 py-1 hover:bg-[#141414] hover:text-[#FFF7E3] cursor-pointer bg-transparent"
          >
            + Add Another Vendor
          </button>
        </div>
      </div>

      {/* Main Headline */}
      <h1 className="font-serif text-[68px] leading-[1.05] font-normal text-[#141414] tracking-tight mb-4">
        You are owed ${claim.credit_owed.toFixed(0)}.
      </h1>

      <p className="text-[15px] text-[#66645E] max-w-[760px] leading-relaxed mb-12">
        Uptime {claim.actual_uptime}% against a {claim.target_uptime}% promise. Everything below is computed from the probe log.
      </p>

      {/* Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
        {/* LEFT COLUMN: EVIDENCE TABLE */}
        <div className="lg:col-span-6">
          <div className="border-t border-[#141414] pt-4 mb-2 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-widest font-mono text-[#141414] font-medium">
              EVIDENCE
            </span>
            <span className="text-[11px] font-mono text-[#66645E]">
              {claim.incidents.length} Breaches Logged
            </span>
          </div>

          <div className="divide-y divide-[#141414]/30 font-mono text-[13px]">
            {/* Incidents rows */}
            {claim.incidents.map((inc, idx) => (
              <div key={idx} className="py-3.5 flex items-center justify-between">
                <span className="text-[#141414]">{inc.time_label}</span>
                <span className="text-[#66645E]">
                  {inc.duration_minutes} min, {inc.reason}
                </span>
              </div>
            ))}

            {/* Fee / tier */}
            <div className="py-3.5 flex items-center justify-between pt-5">
              <span className="text-[#141414]">Fee / tier</span>
              <span className="text-[#141414]">
                ${claim.monthly_fee}, {claim.tier_applied}
              </span>
            </div>

            {/* Credit owed */}
            <div className="py-3.5 flex items-center justify-between">
              <span className="text-[#141414] font-medium">Credit owed</span>
              <span className="text-[#E05345] font-semibold text-[15px]">
                ${claim.credit_owed.toFixed(2)}
              </span>
            </div>

            {/* Log hash */}
            <div className="py-3.5 flex items-center justify-between">
              <span className="text-[#141414]">Log hash</span>
              <span className="text-[#66645E] text-[11px] font-mono">
                {claim.log_hash.length > 20
                  ? `[${claim.log_hash.substring(0, 10)}...]`
                  : `[${claim.log_hash}]`}
              </span>
            </div>

            {/* Probe region */}
            <div className="py-3.5 flex items-center justify-between">
              <span className="text-[#141414]">Probe region</span>
              <span className="text-[#66645E]">[{claim.probe_region}]</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: CLAIM LETTER BOX */}
        <div className="lg:col-span-6">
          <div className="border border-[#141414] p-8 bg-[#FFF7E3]">
            <div className="text-[11px] uppercase tracking-widest font-mono text-[#66645E] mb-6">
              CLAIM LETTER / DRAFT
            </div>

            {/* Letter Body in editorial serif */}
            <div className="font-serif text-[18px] leading-[1.45] text-[#141414] mb-8 font-normal">
              {claim.claim_letter}
            </div>

            {/* Button Actions */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCopyLetter}
                  className="btn-primary flex-1 py-3.5 text-[13px]"
                >
                  {copied ? "Copied to clipboard ✓" : "Copy letter"}
                </button>

                <button
                  onClick={handleDownloadPdf}
                  className="btn-outline flex-1 py-3 text-[13px]"
                >
                  Download PDF
                </button>
              </div>

              {/* Growth Loop Invite Button */}
              <button
                onClick={handleInviteVendor}
                className="w-full btn-outline py-3 text-[13px] border border-[#141414] text-center"
              >
                Invite vendor to enroll
              </button>
            </div>

            <div className="mt-5 text-[11px] text-[#66645E] font-mono leading-relaxed">
              Self-recorded evidence. A claim, not a guarantee. Letter written by AI from the figures only.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
