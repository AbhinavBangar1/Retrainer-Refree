import React, { useState, useEffect } from "react";
import { McpDocsView } from "./components/McpDocsView";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"landing" | "mcp_docs">("landing");
  const [showSampleStatement, setShowSampleStatement] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "mcp_docs" || window.location.hash === "#mcp-docs") {
      setActiveTab("mcp_docs");
    }
  }, []);

  // Agency URL: in dev port 3000, or relative /agency in prod
  const agencyUrl = window.location.port === "3002" ? "http://localhost:3000" : "/agency";
  // Client URL: in dev port 3001, or relative /client in prod
  const clientUrl = window.location.port === "3002" ? "http://localhost:3001" : "/client";

  const handleNavClick = (sectionId: string) => {
    if (activeTab !== "landing") {
      setActiveTab("landing");
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF7E3] text-[#141414] font-mono selection:bg-[#141414] selection:text-[#FFF7E3]">
      {/* Top Navigation */}
      <header className="w-full bg-[#FFF7E3] border-b border-[#141414] px-12 py-5 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <button
            onClick={() => setActiveTab("landing")}
            className="font-serif text-2xl font-normal text-[#141414] tracking-tight bg-transparent border-none p-0 cursor-pointer text-left hover:opacity-85"
          >
            Retainer Referee
          </button>
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#66645E] border border-[#66645E] px-2 py-0.5">
            {activeTab === "mcp_docs" ? "M1 / MCP Docs" : "Overview"}
          </span>
        </div>

        <nav className="flex items-center gap-8 text-[11px] font-mono tracking-wider uppercase">
          {activeTab === "landing" ? (
            <>
              <a href="#how-it-works" className="text-[#66645E] hover:text-[#141414] no-underline">
                How It Works
              </a>
              <a href="#the-rule" className="text-[#66645E] hover:text-[#141414] no-underline">
                The Rule
              </a>
              <a href="#who-it-is-for" className="text-[#66645E] hover:text-[#141414] no-underline">
                Who It Is For
              </a>
              <a href="#sandbox" className="text-[#66645E] hover:text-[#141414] no-underline">
                Sandbox
              </a>
            </>
          ) : (
            <>
              <button
                onClick={() => setActiveTab("landing")}
                className="text-[#66645E] hover:text-[#141414] bg-transparent border-none p-0 cursor-pointer text-[11px] uppercase tracking-wider font-mono"
              >
                ← Back to Overview
              </button>
            </>
          )}

          <button
            onClick={() => {
              setActiveTab("mcp_docs");
              window.history.pushState(null, "", "#mcp-docs");
            }}
            className={`bg-transparent border-none cursor-pointer py-1 text-[11px] uppercase tracking-wider font-mono relative ${
              activeTab === "mcp_docs"
                ? "text-[#141414] font-medium"
                : "text-[#66645E] hover:text-[#141414]"
            }`}
          >
            MCP Docs
            {activeTab === "mcp_docs" && (
              <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#141414]" />
            )}
          </button>

          <div className="flex items-center gap-3 ml-4">
            <a
              href={agencyUrl}
              className="text-[11px] font-mono text-[#141414] hover:bg-[#141414] hover:text-[#FFF7E3] transition-colors border border-[#141414] px-3.5 py-1.5 no-underline font-medium"
            >
              Agency Portal ↗
            </a>
            <a
              href={clientUrl}
              className="text-[11px] font-mono text-[#141414] hover:bg-[#141414] hover:text-[#FFF7E3] transition-colors border border-[#141414] px-3.5 py-1.5 no-underline font-medium"
            >
              Client Portal ↗
            </a>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      {activeTab === "mcp_docs" ? (
        <McpDocsView />
      ) : (
        <main className="max-w-[1344px] mx-auto px-12 py-16">
        {/* HERO SECTION */}
        <section className="mb-24">
          <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
            RETAINER REFEREE
          </div>

          <h1 className="font-serif text-[68px] leading-[1.05] font-normal text-[#141414] tracking-tight m-0">
            Contracts that
          </h1>
          <h1 className="font-serif text-[68px] leading-[1.05] font-normal text-[#141414] tracking-tight mb-6">
            enforce themselves.
          </h1>

          <p className="text-[16px] text-[#66645E] max-w-[740px] leading-relaxed mb-10 font-mono">
            A client's fee is held by PayPal. A probe watches the site. Code pays out only what was earned. No tickets. No arguing.
          </p>

          <div className="flex items-center gap-4">
            <a href={agencyUrl} className="btn-primary py-3.5 px-7 text-[13px]">
              Start as agency
            </a>
            <button
              onClick={() => setShowVideoModal(true)}
              className="bg-[#141414] text-[#FFF7E3] hover:bg-[#2b2b2b] py-3.5 px-7 text-[13px] font-mono font-medium flex items-center gap-2 border border-[#141414] transition-all cursor-pointer"
            >
              <span>▶</span> Watch 2:48 demo
            </button>
            <button
              onClick={() => setShowSampleStatement(true)}
              className="btn-outline py-3.5 px-7 text-[13px]"
            >
              See a sample statement
            </button>
          </div>
        </section>

        {/* SECTION 1: HOW IT WORKS */}
        <section id="how-it-works" className="border-t border-[#141414] pt-14 mb-24 scroll-mt-24">
          <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-8">
            HOW IT WORKS
          </div>

          <div className="grid grid-cols-4 gap-10">
            <div>
              <div className="font-serif text-[42px] font-normal text-[#141414] mb-3">01</div>
              <div className="font-mono text-[15px] font-medium text-[#141414] mb-2">Paste the deal</div>
              <div className="font-mono text-[13px] text-[#66645E] leading-relaxed">
                AI turns a proposal or chat into strict terms you confirm.
              </div>
            </div>

            <div>
              <div className="font-serif text-[42px] font-normal text-[#141414] mb-3">02</div>
              <div className="font-mono text-[15px] font-medium text-[#141414] mb-2">PayPal holds the fee</div>
              <div className="font-mono text-[13px] text-[#66645E] leading-relaxed">
                Authorized, not charged.
              </div>
            </div>

            <div>
              <div className="font-serif text-[42px] font-normal text-[#141414] mb-3">03</div>
              <div className="font-mono text-[15px] font-medium text-[#141414] mb-2">Code watches</div>
              <div className="font-mono text-[13px] text-[#66645E] leading-relaxed">
                A probe checks the site every minute and logs every failure.
              </div>
            </div>

            <div>
              <div className="font-serif text-[42px] font-normal text-[#141414] mb-3">04</div>
              <div className="font-mono text-[15px] font-medium text-[#141414] mb-2">Pay what is earned</div>
              <div className="font-mono text-[13px] text-[#66645E] leading-relaxed">
                Partial capture, the rest released, and a statement with proof.
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: THE RULE */}
        <section id="the-rule" className="border-t border-[#141414] pt-14 mb-24 scroll-mt-24">
          <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
            THE RULE
          </div>
          <h2 className="font-serif text-[48px] font-normal text-[#141414] tracking-tight mb-10">
            AI never decides an amount.
          </h2>

          <div className="grid grid-cols-2 gap-16 border-t border-[#141414] pt-10">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-4">
                AI READS
              </div>
              <p className="font-serif text-[26px] leading-[1.3] text-[#141414] m-0">
                Messy contracts into clear terms, and credits into plain English.
              </p>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-4">
                CODE DECIDES
              </div>
              <p className="font-serif text-[26px] leading-[1.3] text-[#141414] m-0">
                Probing, uptime math, tiers, and every money decision.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 3: WHO IT IS FOR */}
        <section id="who-it-is-for" className="border-t border-[#141414] pt-14 mb-24 scroll-mt-24">
          <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-8">
            WHO IT IS FOR
          </div>

          <div className="grid grid-cols-2 gap-16">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-4">
                AGENCIES
              </div>
              <p className="font-serif text-[24px] leading-[1.35] text-[#141414] m-0">
                Stop arguing about credits. Get paid in full when you deliver, and show proof when you do not.
              </p>
              <div className="mt-6">
                <a href={agencyUrl} className="text-[12px] font-mono text-[#141414] underline hover:text-[#66645E]">
                  Go to Agency Workspace →
                </a>
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-4">
                CLIENTS
              </div>
              <p className="font-serif text-[24px] leading-[1.35] text-[#141414] m-0">
                Pay for uptime you actually get. Credits arrive on their own, with the evidence attached.
              </p>
              <div className="mt-6">
                <a href={clientUrl} className="text-[12px] font-mono text-[#141414] underline hover:text-[#66645E]">
                  Go to Client Portal →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: BLACK CTA BANNER */}
        <section id="sandbox" className="bg-[#141414] text-[#FFF7E3] p-16 mb-20 scroll-mt-24">
          <h2 className="font-serif text-[52px] font-normal text-[#FFF7E3] tracking-tight mb-8">
            Hold the fee. Prove the uptime.
          </h2>
          <div className="flex items-center gap-5">
            <a
              href={agencyUrl}
              className="bg-[#FFF7E3] text-[#141414] no-underline py-3.5 px-8 font-mono text-[13px] font-medium hover:opacity-90"
            >
              Start as agency
            </a>
            <a
              href={clientUrl}
              className="border border-[#FFF7E3] text-[#FFF7E3] no-underline py-3.5 px-8 font-mono text-[13px] font-medium hover:bg-[rgba(255,247,227,0.1)]"
            >
              Open Client Approval
            </a>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-[#141414] pt-8 pb-12 flex justify-between items-center text-[12px] text-[#66645E] font-mono">
          <span>Built for the PayPal AI hackathon. Sandbox only. No real money moves.</span>
          <div className="flex items-center gap-6">
            <a href={agencyUrl} className="hover:underline text-[#141414]">
              Agency Portal
            </a>
            <span>•</span>
            <a href={clientUrl} className="hover:underline text-[#141414]">
              Client Portal
            </a>
          </div>
        </footer>
      </main>
      )}

      {/* Interactive Sample Statement Modal */}
      {showSampleStatement && (
        <div className="fixed inset-0 bg-[rgba(20,20,20,0.6)] backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-[#FFF7E3] border border-[#141414] max-w-[840px] w-full p-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b border-[#141414] pb-4">
              <span className="text-[11px] uppercase font-mono tracking-widest text-[#66645E]">
                SAMPLE STATEMENT OF CREDIT
              </span>
              <button
                onClick={() => setShowSampleStatement(false)}
                className="bg-transparent border-none text-[#141414] text-xl cursor-pointer hover:opacity-70 font-mono"
              >
                ✕
              </button>
            </div>

            <h3 className="font-serif text-3xl font-normal text-[#141414] mb-2">
              Statement of credit
            </h3>
            <div className="text-[12px] text-[#66645E] font-mono mb-6">
              Period Oct 1 — Oct 31, 2026 &nbsp;|&nbsp; Contract CTR-NW-01 &nbsp;|&nbsp; Apex Studio to Northwind Dental
            </div>

            <blockquote className="font-serif italic text-xl leading-relaxed text-[#141414] mb-8 border-l-2 border-[#141414] pl-4">
              "Your site was down for 164 minutes across three incidents, bringing uptime to 99.62%, below the promised 99.9%. Under the agreed terms that earns a 10% credit. You are charged $720 of the $800 held."
            </blockquote>

            <div className="border-t border-[#141414] mb-6">
              <div className="py-2 border-b border-[#141414] flex justify-between text-[12px]">
                <span className="text-[#66645E]">Probes run</span>
                <span>43,200</span>
              </div>
              <div className="py-2 border-b border-[#141414] flex justify-between text-[12px]">
                <span className="text-[#66645E]">Downtime</span>
                <span>164 min</span>
              </div>
              <div className="py-2 border-b border-[#141414] flex justify-between text-[12px]">
                <span className="text-[#66645E]">Uptime / target</span>
                <span>99.62% / 99.9%</span>
              </div>
              <div className="py-2 border-b border-[#141414] flex justify-between text-[12px]">
                <span className="text-[#66645E]">Tier applied</span>
                <span>Tier 1, 10% credit</span>
              </div>
              <div className="py-2 border-b border-[#141414] flex justify-between text-[12px]">
                <span className="text-[#66645E]">Authorized Fee</span>
                <span>$800.00</span>
              </div>
              <div className="py-2 border-b border-[#141414] flex justify-between text-[12px]">
                <span className="text-[#66645E]">Credit</span>
                <span className="text-[#E05345]">-$80.00</span>
              </div>
              <div className="py-2 border-b border-[#141414] flex justify-between text-[12px] font-medium">
                <span>Captured Payout</span>
                <span>$720.00</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#141414]">
              <button
                onClick={() => setShowSampleStatement(false)}
                className="btn-outline"
              >
                Close
              </button>
              <a
                href={agencyUrl}
                className="btn-primary"
              >
                Open in Agency Portal →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Video Demo Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-[#FFF7E3] border-2 border-[#141414] p-6 max-w-4xl w-full relative shadow-2xl">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#141414]">
              <div>
                <h3 className="font-serif text-2xl font-normal text-[#141414] m-0">
                  Retainer Referee — Full Demo Film (2:48)
                </h3>
                <span className="text-[11px] font-mono text-[#66645E]">
                  Real PayPal sandbox hold, 164m downtime inject, 99.62% ($720 captured / $80 released) & MCP guardrails
                </span>
              </div>
              <button
                onClick={() => setShowVideoModal(false)}
                className="font-mono text-xl border border-[#141414] px-2.5 py-0.5 hover:bg-[#141414] hover:text-[#FFF7E3] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="bg-black aspect-video border border-[#141414] overflow-hidden flex items-center justify-center">
              <video
                controls
                autoPlay
                className="w-full h-full object-contain"
                src="http://localhost:5000/recordings/retainer_referee_preview_with_audio.mp4"
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="flex justify-between items-center pt-4 mt-2 text-[12px] font-mono text-[#66645E]">
              <span>Master film & individual scene clips in <code>recordings/</code></span>
              <button
                onClick={() => setShowVideoModal(false)}
                className="btn-outline py-1.5 px-4 text-[11px]"
              >
                Close Player
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
