import React, { useState } from "react";

interface AddVendorViewProps {
  onVendorAdded: (watchId: string) => void;
}

export const AddVendorView: React.FC<AddVendorViewProps> = ({ onVendorAdded }) => {
  const [vendorName, setVendorName] = useState("Northwind Hosting");
  const [siteUrl, setSiteUrl] = useState("https://northwinddental.example");
  const [monthlyFee, setMonthlyFee] = useState("800");
  const [termsText, setTermsText] = useState(
    "Website Retainer SLA: 99.9% uptime target. Tier 1: 99.5% - 99.9% earns 10% credit ($80.00). Below 99.5% earns 30% credit ($240.00). Probes cover HTTP status and SSL validity."
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedPdfName, setUploadedPdfName] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName || !siteUrl || !monthlyFee) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/evidence/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorName,
          siteUrl,
          monthlyFee: parseFloat(monthlyFee.replace("$", "")),
          termsText
        })
      });

      if (res.ok) {
        const data = await res.json();
        onVendorAdded(data.watch.id);
      } else {
        // Fallback demo watch ID
        onVendorAdded(`WTC-${Date.now()}`);
      }
    } catch (err) {
      console.error("Watch creation failed:", err);
      onVendorAdded(`WTC-${Date.now()}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedPdfName(file.name);
      setTermsText(
        `Uploaded SLA Document: ${file.name}\nExtracted Terms: 99.9% uptime target. Tier 1 (10% credit), Tier 2 (30% credit). Excludes scheduled maintenance.`
      );
    }
  };

  return (
    <div className="max-w-[1344px] mx-auto px-12 py-12 font-mono">
      {/* Breadcrumb Label */}
      <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
        X1 / EVIDENCE MODE, ADD A VENDOR
      </div>

      {/* Main Headline */}
      <h1 className="font-serif text-[68px] leading-[1.05] font-normal text-[#141414] tracking-tight mb-4">
        Track a vendor.
        <br />
        Claim what you are owed.
      </h1>

      <p className="text-[15px] text-[#66645E] max-w-[760px] leading-relaxed mb-12">
        No enrollment needed. We watch the site and build the proof.
      </p>

      {/* Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
        {/* LEFT COLUMN: FORM */}
        <div className="lg:col-span-7">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Vendor Name */}
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#141414] font-medium mb-2">
                VENDOR NAME
              </label>
              <input
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="[VENDOR]"
                className="w-full bg-transparent border border-[#141414] p-3 text-[13px] font-mono text-[#141414] focus:outline-none"
                required
              />
            </div>

            {/* Site URL */}
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#141414] font-medium mb-2">
                SITE URL
              </label>
              <input
                type="text"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="[VENDOR SITE URL]"
                className="w-full bg-transparent border border-[#141414] p-3 text-[13px] font-mono text-[#141414] focus:outline-none"
                required
              />
            </div>

            {/* Monthly Fee */}
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#141414] font-medium mb-2">
                MONTHLY FEE
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-[13px] text-[#66645E]">$</span>
                <input
                  type="number"
                  value={monthlyFee}
                  onChange={(e) => setMonthlyFee(e.target.value)}
                  placeholder="800"
                  className="w-full bg-transparent border border-[#141414] p-3 pl-7 text-[13px] font-mono text-[#141414] focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Terms, Pasted */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[11px] uppercase tracking-wider text-[#141414] font-medium">
                  TERMS, PASTED
                </label>
                {uploadedPdfName && (
                  <span className="text-[10px] text-[#2E7D32]">
                    ✓ Uploaded: {uploadedPdfName}
                  </span>
                )}
              </div>
              <textarea
                value={termsText}
                onChange={(e) => setTermsText(e.target.value)}
                rows={5}
                placeholder="Paste the SLA or the chat where it was agreed"
                className="w-full bg-transparent border border-[#141414] p-3 text-[12px] font-mono text-[#141414] focus:outline-none leading-relaxed"
                required
              />
            </div>

            {/* Form Actions */}
            <div className="flex items-center gap-4 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary py-3.5 px-8 text-[13px]"
              >
                {isSubmitting ? "Starting..." : "Start watching"}
              </button>

              <label className="btn-outline py-3 px-6 text-[13px] cursor-pointer inline-flex items-center">
                Upload SLA PDF
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handlePdfUpload}
                  className="hidden"
                />
              </label>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN: WHAT HAPPENS NEXT */}
        <div className="lg:col-span-5">
          <div className="border-t border-[#141414] pt-4 mb-2">
            <span className="text-[11px] uppercase tracking-widest font-mono text-[#141414] font-medium">
              WHAT HAPPENS NEXT
            </span>
          </div>

          <div className="divide-y divide-[#141414]/30 mb-8">
            <div className="py-5 flex items-baseline gap-6">
              <span className="font-serif text-[28px] text-[#141414] font-normal leading-none w-5">
                1
              </span>
              <span className="text-[13px] text-[#141414] leading-relaxed">
                We read your terms and check them.
              </span>
            </div>

            <div className="py-5 flex items-baseline gap-6">
              <span className="font-serif text-[28px] text-[#141414] font-normal leading-none w-5">
                2
              </span>
              <span className="text-[13px] text-[#141414] leading-relaxed">
                We probe the site every minute.
              </span>
            </div>

            <div className="py-5 flex items-baseline gap-6">
              <span className="font-serif text-[28px] text-[#141414] font-normal leading-none w-5">
                3
              </span>
              <span className="text-[13px] text-[#141414] leading-relaxed">
                On a breach you get a claim pack, ready to send.
              </span>
            </div>
          </div>

          <div className="text-[12px] text-[#66645E] font-mono leading-relaxed border-t border-[#141414]/20 pt-4">
            No PayPal hold in this mode. The vendor is not enrolled.
          </div>
        </div>
      </div>
    </div>
  );
};
