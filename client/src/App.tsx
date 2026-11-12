import React, { useState, useEffect } from "react";
import { ClientHeader, ClientTab } from "./components/ClientHeader";
import { ApproveHoldView } from "./components/ApproveHoldView";
import { ClientLivePeriodView } from "./components/ClientLivePeriodView";
import { ClientStatementView } from "./components/ClientStatementView";
import { AddVendorView } from "./components/AddVendorView";
import { ClaimPackView } from "./components/ClaimPackView";
import { ClientContract, Settlement } from "./types";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ClientTab>("add_vendor");
  const [watchedId, setWatchedId] = useState<string | null>(null);
  const [contracts, setContracts] = useState<ClientContract[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string>("CTR-NW-01");
  const [currentContract, setCurrentContract] = useState<ClientContract | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);

  // Check URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam === "claims") setActiveTab("claims");
    else if (tabParam === "approve") setActiveTab("approve");
    else if (tabParam === "retainer") setActiveTab("retainer");
    else if (tabParam === "statements") setActiveTab("statements");
    else if (tabParam === "add_vendor") setActiveTab("add_vendor");
  }, []);

  // Default fallback contract matching design mockups
  const defaultContract: ClientContract = {
    id: "CTR-NW-01",
    title: "Website Retainer Agreement",
    agency_name: "Apex Studio",
    client_name: "Northwind Dental",
    client_email: "billing@northwinddental.example",
    site_url: "https://northwinddental.example",
    fee: 800,
    currency: "USD",
    uptime_target: 99.9,
    credit_tiers: [
      { min_uptime: 99.5, max_uptime: 99.9, credit_percent: 10 },
      { min_uptime: 0, max_uptime: 99.5, credit_percent: 30 }
    ],
    maintenance_windows: [
      { day_of_week: "Sunday", start_time_utc: "02:00", end_time_utc: "04:00" }
    ],
    exclusions: ["Sunday maintenance"],
    status: "PENDING_APPROVAL",
    paypal_order_id: "ORD-PP-78291044"
  };

  const fetchContracts = async () => {
    try {
      const res = await fetch("/api/contracts");
      if (res.ok) {
        const data = await res.json();
        if (data.contracts && data.contracts.length > 0) {
          const mapped: ClientContract[] = data.contracts.map((c: any) => ({
            id: c.id,
            title: c.title,
            agency_name: c.agency_name,
            client_name: c.client_name,
            client_email: c.client_email,
            site_url: c.site_url,
            fee: c.fee,
            currency: c.currency,
            uptime_target: c.uptime_target,
            billing_period_minutes: c.billing_period_minutes,
            credit_tiers: JSON.parse(c.credit_tiers_json || "[]"),
            maintenance_windows: JSON.parse(c.maintenance_windows_json || "[]"),
            exclusions: JSON.parse(c.exclusions_json || "[]"),
            status: c.status,
            paypal_order_id: c.paypal_order_id,
            paypal_authorization_id: c.paypal_authorization_id,
            period_start: c.period_start,
            period_end: c.period_end
          }));
          setContracts(mapped);
          setSelectedContractId(mapped[0].id);
          setCurrentContract(mapped[0]);
          return;
        }
      }
    } catch (err) {
      console.warn("Could not fetch contracts from backend, using default contract:", err);
    }

    setContracts([defaultContract]);
    setCurrentContract(defaultContract);
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  useEffect(() => {
    const found = contracts.find((c) => c.id === selectedContractId);
    if (found) {
      setCurrentContract(found);
    }
  }, [selectedContractId, contracts]);

  const activeContract = currentContract || defaultContract;

  return (
    <div className="min-h-screen bg-[#FFF7E3] text-[#141414] font-mono selection:bg-[#141414] selection:text-[#FFF7E3]">
      <ClientHeader
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        contracts={contracts}
        selectedContractId={selectedContractId}
        onSelectContractId={setSelectedContractId}
      />

      <main className="pb-24">
        {activeTab === "add_vendor" && (
          <AddVendorView
            onVendorAdded={(id) => {
              setWatchedId(id);
              setActiveTab("claims");
            }}
          />
        )}

        {activeTab === "claims" && (
          <ClaimPackView
            watchId={watchedId}
            onNewVendorClick={() => setActiveTab("add_vendor")}
          />
        )}

        {activeTab === "approve" && (
          <ApproveHoldView
            contract={activeContract}
            onApproved={() => {
              fetchContracts();
              setActiveTab("retainer");
            }}
          />
        )}

        {activeTab === "retainer" && (
          <ClientLivePeriodView contract={activeContract} />
        )}

        {activeTab === "statements" && (
          <ClientStatementView
            contract={activeContract}
            settlement={settlement}
          />
        )}
      </main>
    </div>
  );
};
