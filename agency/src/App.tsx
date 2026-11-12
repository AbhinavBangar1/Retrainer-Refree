import React, { useState, useEffect } from "react";
import { Header, NavTab } from "./components/Header";
import { ContractsView } from "./components/ContractsView";
import { NewContractView } from "./components/NewContractView";
import { ContractCheckView } from "./components/ContractCheckView";
import { LivePeriodView } from "./components/LivePeriodView";
import { StatementView } from "./components/StatementView";
import { DemoControlView } from "./components/DemoControlView";
import { MCPAuditView } from "./components/MCPAuditView";
import { McpDocsView } from "./components/McpDocsView";
import { LandingView } from "./components/LandingView";
import { Contract, Settlement } from "./types";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>("contracts");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [currentSettlement, setCurrentSettlement] = useState<Settlement | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for Evidence Mode Growth-Loop invite query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromClaim = params.get("from_claim");
    const vendorName = params.get("vendor");
    const siteUrl = params.get("url");
    const feeStr = params.get("fee");
    const tabParam = params.get("tab");

    if (tabParam === "mcp_docs" || tabParam === "docs") {
      setActiveTab("mcp_docs");
    } else if (tabParam === "new_contract" || tabParam === "new") {
      setActiveTab("new_contract");
    } else if (tabParam === "check") {
      setActiveTab("check");
    } else if (tabParam === "periods") {
      setActiveTab("periods");
    } else if (tabParam === "statements") {
      setActiveTab("statements");
    } else if (tabParam === "demo") {
      setActiveTab("demo");
    } else if (tabParam === "mcp_audit" || tabParam === "audit") {
      setActiveTab("mcp_audit");
    } else if (tabParam === "landing") {
      setActiveTab("landing");
    }

    if (fromClaim && vendorName && siteUrl) {
      const inviteDraft: Contract = {
        id: `CTR-INV-${fromClaim.replace("CLM-", "")}`,
        title: `Website Retainer Agreement - ${vendorName}`,
        agency_name: vendorName,
        client_name: "Enrolled Customer",
        client_email: "billing@client.example",
        site_url: decodeURIComponent(siteUrl),
        fee: feeStr ? parseFloat(feeStr) : 800,
        currency: "USD",
        uptime_target: 99.9,
        credit_tiers: [
          { min_uptime: 99.5, max_uptime: 99.9, credit_pct: 10 },
          { min_uptime: 0, max_uptime: 99.5, credit_pct: 30 }
        ],
        maintenance_windows: [
          { day_of_week: "Sunday", start_time: "02:00", end_time: "04:00", timezone: "UTC" }
        ],
        exclusions: ["Sunday maintenance"],
        status: "DRAFT",
        created_at: new Date().toISOString()
      };
      setSelectedContract(inviteDraft);
      setActiveTab("check");
    }
  }, []);

  // Fetch contracts on initial mount
  const fetchContracts = async () => {
    try {
      const res = await fetch("/api/contracts");
      if (res.ok) {
        const data = await res.json();
        setContracts(data.contracts || []);
        if (data.contracts && data.contracts.length > 0 && !selectedContract) {
          setSelectedContract(data.contracts[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch contracts:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  const handleContractCreated = (newContract: Contract) => {
    setContracts((prev) => [newContract, ...prev]);
    setSelectedContract(newContract);
    setActiveTab("check"); // Automatically run Contract Checker first!
  };

  const handleSelectContract = (contract: Contract) => {
    setSelectedContract(contract);
    setActiveTab("periods");
  };

  const handleSettleComplete = (settlement: Settlement) => {
    setCurrentSettlement(settlement);
    fetchContracts();
    setActiveTab("statements");
  };

  const handleActivateContract = async (contractId: string) => {
    try {
      const res = await fetch(`/api/contracts/${contractId}/confirm`, { method: "POST" });
      if (res.ok) {
        await fetchContracts();
        setActiveTab("periods");
      }
    } catch (err) {
      console.error("Activation failed:", err);
      setActiveTab("periods");
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF7E3] text-[#141414] font-mono selection:bg-[#141414] selection:text-[#FFF7E3]">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        selectedContractId={selectedContract?.id}
      />

      <main className="pb-24">
        {activeTab === "contracts" && (
          <ContractsView
            contracts={contracts}
            onSelectContract={handleSelectContract}
            onNewContractClick={() => setActiveTab("new_contract")}
          />
        )}

        {activeTab === "new_contract" && (
          <NewContractView
            onContractCreated={handleContractCreated}
            onCancel={() => setActiveTab("contracts")}
          />
        )}

        {activeTab === "check" && (
          <ContractCheckView
            contract={selectedContract}
            onActivateContract={handleActivateContract}
            onViewContract={() => setActiveTab("periods")}
          />
        )}

        {activeTab === "periods" && selectedContract && (
          <LivePeriodView
            contract={selectedContract}
            onSettleComplete={handleSettleComplete}
            onGoToDemo={() => setActiveTab("demo")}
          />
        )}

        {activeTab === "periods" && !selectedContract && (
          <div className="max-w-[1344px] mx-auto px-12 py-20 text-center">
            <h2 className="font-serif text-3xl mb-4">No contract selected</h2>
            <p className="text-[#66645E] mb-6">Create a contract or pick one from the contracts list.</p>
            <button onClick={() => setActiveTab("new_contract")} className="btn-primary">
              Create New Contract
            </button>
          </div>
        )}

        {activeTab === "statements" && selectedContract && (
          <StatementView
            contract={selectedContract}
            settlement={currentSettlement}
          />
        )}

        {activeTab === "statements" && !selectedContract && (
          <div className="max-w-[1344px] mx-auto px-12 py-20 text-center">
            <h2 className="font-serif text-3xl mb-4">No settled statement available</h2>
            <p className="text-[#66645E] mb-6">Select a contract from the contracts ledger.</p>
            <button onClick={() => setActiveTab("contracts")} className="btn-outline">
              Back to Contracts
            </button>
          </div>
        )}

        {activeTab === "mcp_audit" && <MCPAuditView />}

        {activeTab === "mcp_docs" && <McpDocsView />}

        {activeTab === "demo" && selectedContract && (
          <DemoControlView
            contract={selectedContract}
            onSettlementTriggered={() => {
              fetchContracts();
              setActiveTab("statements");
            }}
          />
        )}

        {activeTab === "demo" && !selectedContract && (
          <div className="max-w-[1344px] mx-auto px-12 py-20 text-center">
            <h2 className="font-serif text-3xl mb-4">No active contract to simulate</h2>
            <button onClick={() => setActiveTab("new_contract")} className="btn-primary">
              Create New Contract First
            </button>
          </div>
        )}

        {activeTab === "landing" && (
          <LandingView
            onStartAsAgency={() => setActiveTab("new_contract")}
            onSeeSampleStatement={() => setActiveTab("statements")}
          />
        )}
      </main>
    </div>
  );
};
