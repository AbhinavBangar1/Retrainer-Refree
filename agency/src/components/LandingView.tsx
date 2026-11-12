import React from "react";

interface LandingViewProps {
  onStartAsAgency: () => void;
  onSeeSampleStatement: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onStartAsAgency,
  onSeeSampleStatement
}) => {
  return (
    <div className="max-w-[1344px] mx-auto px-12 py-10">
      {/* Hero Section */}
      <div className="mb-20">
        <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
          RETAINER REFEREE
        </div>

        <h1 className="font-serif text-[68px] leading-[1.05] font-normal text-[#141414] tracking-tight m-0">
          Contracts that
        </h1>
        <h1 className="font-serif text-[68px] leading-[1.05] font-normal text-[#141414] tracking-tight mb-6">
          enforce themselves.
        </h1>

        <p className="text-[16px] text-[#66645E] max-w-[720px] leading-relaxed mb-8">
          A client's fee is held by PayPal. A probe watches the site. Code pays out only what was earned. No tickets. No arguing.
        </p>

        <div className="flex items-center gap-4">
          <button onClick={onStartAsAgency} className="btn-primary py-3 px-6 text-[13px]">
            Start as agency
          </button>
          <button onClick={onSeeSampleStatement} className="btn-outline py-3 px-6 text-[13px]">
            See a sample statement
          </button>
        </div>
      </div>

      <div className="border-t border-[#141414] pt-14 mb-20">
        <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-8">
          HOW IT WORKS
        </div>

        <div className="grid grid-cols-4 gap-8">
          <div>
            <div className="font-serif text-[38px] font-normal text-[#141414] mb-3">01</div>
            <div className="font-mono text-[14px] font-medium text-[#141414] mb-2">Paste the deal</div>
            <div className="font-mono text-[12px] text-[#66645E] leading-relaxed">
              AI turns a proposal or chat into strict terms you confirm.
            </div>
          </div>

          <div>
            <div className="font-serif text-[38px] font-normal text-[#141414] mb-3">02</div>
            <div className="font-mono text-[14px] font-medium text-[#141414] mb-2">PayPal holds the fee</div>
            <div className="font-mono text-[12px] text-[#66645E] leading-relaxed">
              Authorized, not charged.
            </div>
          </div>

          <div>
            <div className="font-serif text-[38px] font-normal text-[#141414] mb-3">03</div>
            <div className="font-mono text-[14px] font-medium text-[#141414] mb-2">Code watches</div>
            <div className="font-mono text-[12px] text-[#66645E] leading-relaxed">
              A probe checks the site every minute and logs every failure.
            </div>
          </div>

          <div>
            <div className="font-serif text-[38px] font-normal text-[#141414] mb-3">04</div>
            <div className="font-mono text-[14px] font-medium text-[#141414] mb-2">Pay what is earned</div>
            <div className="font-mono text-[12px] text-[#66645E] leading-relaxed">
              Partial capture, the rest released, and a statement with proof.
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: THE RULE */}
      <div className="border-t border-[#141414] pt-14 mb-20">
        <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
          THE RULE
        </div>
        <h2 className="font-serif text-[44px] font-normal text-[#141414] tracking-tight mb-8">
          AI never decides an amount.
        </h2>

        <div className="grid grid-cols-2 gap-16 border-t border-[#141414] pt-8">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
              AI READS
            </div>
            <p className="font-serif text-[24px] leading-snug text-[#141414] m-0">
              Messy contracts into clear terms, and credits into plain English.
            </p>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
              CODE DECIDES
            </div>
            <p className="font-serif text-[24px] leading-snug text-[#141414] m-0">
              Probing, uptime math, tiers, and every money decision.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 3: WHO IT IS FOR */}
      <div className="border-t border-[#141414] pt-14 mb-20">
        <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-8">
          WHO IT IS FOR
        </div>

        <div className="grid grid-cols-2 gap-16">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
              AGENCIES
            </div>
            <p className="font-serif text-[22px] leading-snug text-[#141414] m-0">
              Stop arguing about credits. Get paid in full when you deliver, and show proof when you do not.
            </p>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
              CLIENTS
            </div>
            <p className="font-serif text-[22px] leading-snug text-[#141414] m-0">
              Pay for uptime you actually get. Credits arrive on their own, with the evidence attached.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 4: BLACK CTA BANNER */}
      <div className="bg-[#141414] text-[#FFF7E3] p-14 mb-16">
        <h2 className="font-serif text-[48px] font-normal text-[#FFF7E3] tracking-tight mb-8">
          Hold the fee. Prove the uptime.
        </h2>
        <button
          onClick={onStartAsAgency}
          className="bg-[#FFF7E3] text-[#141414] border-none py-3.5 px-8 font-mono text-[13px] font-medium cursor-pointer hover:opacity-90"
        >
          Start as agency
        </button>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-[#141414] pt-6 pb-12 flex justify-between items-center text-[11px] text-[#66645E] font-mono">
        <span>Built for the PayPal AI hackathon. Sandbox only. No real money moves.</span>
        <a href="http://localhost:3001" target="_blank" rel="noopener noreferrer" className="hover:underline text-[#141414]">
          Open Client Portal →
        </a>
      </footer>
    </div>
  );
};
