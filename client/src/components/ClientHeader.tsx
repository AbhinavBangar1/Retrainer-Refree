import React from "react";

export type ClientTab = "add_vendor" | "claims" | "approve" | "retainer" | "statements";

interface ClientHeaderProps {
  activeTab: ClientTab;
  onSelectTab: (tab: ClientTab) => void;
  contracts: Array<{ id: string; client_name: string }>;
  selectedContractId: string;
  onSelectContractId: (id: string) => void;
}

export const ClientHeader: React.FC<ClientHeaderProps> = ({
  activeTab,
  onSelectTab,
  contracts,
  selectedContractId,
  onSelectContractId
}) => {
  return (
    <header className="w-full bg-[#FFF7E3] border-b border-[#141414] px-12 py-5 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-8">
        <span className="font-serif text-2xl font-normal text-[#141414] tracking-tight">
          Retainer Referee
        </span>
        <span className="text-[10px] uppercase font-mono tracking-widest text-[#66645E] border border-[#66645E] px-2 py-0.5">
          Customer Portal
        </span>
      </div>

      <div className="flex items-center gap-8">
        <nav className="flex items-center gap-7 text-[11px] font-mono tracking-wider uppercase">
          <button
            onClick={() => onSelectTab("add_vendor")}
            className={`bg-transparent border-none cursor-pointer py-1 relative ${
              activeTab === "add_vendor"
                ? "text-[#141414] font-medium"
                : "text-[#66645E] hover:text-[#141414]"
            }`}
          >
            My Vendors
            {activeTab === "add_vendor" && (
              <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#141414]" />
            )}
          </button>

          <button
            onClick={() => onSelectTab("claims")}
            className={`bg-transparent border-none cursor-pointer py-1 relative ${
              activeTab === "claims"
                ? "text-[#141414] font-medium"
                : "text-[#66645E] hover:text-[#141414]"
            }`}
          >
            Claims
            {activeTab === "claims" && (
              <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#141414]" />
            )}
          </button>

          <button
            onClick={() => onSelectTab("approve")}
            className={`bg-transparent border-none cursor-pointer py-1 relative ${
              activeTab === "approve"
                ? "text-[#141414] font-medium"
                : "text-[#66645E] hover:text-[#141414]"
            }`}
          >
            Approve Hold
            {activeTab === "approve" && (
              <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#141414]" />
            )}
          </button>

          <button
            onClick={() => onSelectTab("retainer")}
            className={`bg-transparent border-none cursor-pointer py-1 relative ${
              activeTab === "retainer"
                ? "text-[#141414] font-medium"
                : "text-[#66645E] hover:text-[#141414]"
            }`}
          >
            My Retainer
            {activeTab === "retainer" && (
              <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#141414]" />
            )}
          </button>

          <button
            onClick={() => onSelectTab("statements")}
            className={`bg-transparent border-none cursor-pointer py-1 relative ${
              activeTab === "statements"
                ? "text-[#141414] font-medium"
                : "text-[#66645E] hover:text-[#141414]"
            }`}
          >
            Statements
            {activeTab === "statements" && (
              <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#141414]" />
            )}
          </button>

          <span className="text-[#66645E] border-l border-[#141414]/30 pl-4">
            CUSTOMER / EVIDENCE MODE
          </span>

          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 text-[11px] font-mono text-[#141414] hover:underline border border-[#141414] px-3 py-1.5"
            title="Open Agency Portal on port 3000"
          >
            Agency View ↗
          </a>
        </nav>
      </div>
    </header>
  );
};
