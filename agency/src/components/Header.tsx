import React from "react";

export type NavTab = "contracts" | "new_contract" | "check" | "periods" | "statements" | "demo" | "mcp_audit" | "mcp_docs" | "landing";

interface HeaderProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  selectedContractId?: string | null;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onSelectTab, selectedContractId }) => {
  return (
    <header className="w-full bg-[#FFF7E3] border-b border-[#141414] px-12 py-5 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-8">
        <button
          onClick={() => onSelectTab("landing")}
          className="font-serif text-2xl font-normal text-[#141414] hover:opacity-80 cursor-pointer bg-transparent border-none p-0 tracking-tight"
        >
          Retainer Referee
        </button>
        <span className="text-[10px] uppercase font-mono tracking-widest text-[#66645E] border border-[#66645E] px-2 py-0.5">
          Agency Portal
        </span>
      </div>

      <nav className="flex items-center gap-7 text-[11px] font-mono tracking-wider uppercase">
        <button
          onClick={() => onSelectTab("contracts")}
          className={`bg-transparent border-none cursor-pointer py-1 relative ${
            activeTab === "contracts" || activeTab === "new_contract"
              ? "text-[#141414] font-medium"
              : "text-[#66645E] hover:text-[#141414]"
          }`}
        >
          Contracts
          {(activeTab === "contracts" || activeTab === "new_contract") && (
            <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#141414]" />
          )}
        </button>

        <button
          onClick={() => onSelectTab("check")}
          className={`bg-transparent border-none cursor-pointer py-1 relative ${
            activeTab === "check" ? "text-[#141414] font-medium" : "text-[#66645E] hover:text-[#141414]"
          }`}
        >
          Contract Check
          {activeTab === "check" && (
            <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#141414]" />
          )}
        </button>

        <button
          onClick={() => onSelectTab("periods")}
          className={`bg-transparent border-none cursor-pointer py-1 relative ${
            activeTab === "periods" ? "text-[#141414] font-medium" : "text-[#66645E] hover:text-[#141414]"
          }`}
        >
          Periods {selectedContractId ? `(${selectedContractId})` : ""}
          {activeTab === "periods" && (
            <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#141414]" />
          )}
        </button>

        <button
          onClick={() => onSelectTab("statements")}
          className={`bg-transparent border-none cursor-pointer py-1 relative ${
            activeTab === "statements" ? "text-[#141414] font-medium" : "text-[#66645E] hover:text-[#141414]"
          }`}
        >
          Statements
          {activeTab === "statements" && (
            <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#141414]" />
          )}
        </button>

        <button
          onClick={() => onSelectTab("mcp_docs")}
          className={`bg-transparent border-none cursor-pointer py-1 relative ${
            activeTab === "mcp_docs" ? "text-[#141414] font-medium" : "text-[#66645E] hover:text-[#141414]"
          }`}
        >
          MCP Docs
          {activeTab === "mcp_docs" && (
            <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#141414]" />
          )}
        </button>

        <button
          onClick={() => onSelectTab("mcp_audit")}
          className={`bg-transparent border-none cursor-pointer py-1 relative ${
            activeTab === "mcp_audit" ? "text-[#141414] font-medium" : "text-[#66645E] hover:text-[#141414]"
          }`}
        >
          MCP Audit
          {activeTab === "mcp_audit" && (
            <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#141414]" />
          )}
        </button>

        <button
          onClick={() => onSelectTab("demo")}
          className={`bg-transparent border-none cursor-pointer py-1 relative ${
            activeTab === "demo" ? "text-[#141414] font-medium" : "text-[#66645E] hover:text-[#141414]"
          }`}
        >
          Sandbox
          {activeTab === "demo" && (
            <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#141414]" />
          )}
        </button>

        <a
          href="http://localhost:3001"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 text-[11px] font-mono text-[#141414] hover:underline flex items-center gap-1.5 border border-[#141414] px-3 py-1.5"
          title="Open Client Approval Portal on port 3001"
        >
          Client View ↗
        </a>
      </nav>
    </header>
  );
};
