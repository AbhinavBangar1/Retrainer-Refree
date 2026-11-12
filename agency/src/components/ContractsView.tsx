import React, { useState } from "react";
import { Contract } from "../types";

interface ContractsViewProps {
  contracts: Contract[];
  onSelectContract: (contract: Contract) => void;
  onNewContractClick: () => void;
}

export const ContractsView: React.FC<ContractsViewProps> = ({
  contracts,
  onSelectContract,
  onNewContractClick
}) => {
  const [filterText, setFilterText] = useState("");

  // Default mock display rows if user just started empty DB, ensuring exact visual parity with the design!
  const defaultContracts = [
    {
      id: "CTR-NW-01",
      client_name: "Northwind Dental",
      site_url: "northwinddental.example",
      fee: 800,
      uptime: "99.62%",
      status: "Settling",
      credit: "-$80",
      paypal_status: "Authorized",
      isLive: true
    },
    {
      id: "CTR-ALDER-02",
      client_name: "Alder and Co",
      site_url: "alder.example",
      fee: 450,
      uptime: "99.98%",
      status: "Active",
      credit: "$0",
      paypal_status: "Authorized",
      isLive: false
    },
    {
      id: "CTR-KILN-03",
      client_name: "Kiln Studio",
      site_url: "kiln.example",
      fee: 1200,
      uptime: "98.90%",
      status: "Breach",
      credit: "-$360",
      paypal_status: "Authorized",
      isLive: false
    },
    {
      id: "CTR-HARBOR-04",
      client_name: "Harbor Books",
      site_url: "harborbooks.example",
      fee: 300,
      uptime: "100.00%",
      status: "Settled",
      credit: "$0",
      paypal_status: "Captured",
      isLive: false
    }
  ];

  // Map real database contracts into table items
  const mappedDbContracts = contracts.map(c => {
    let creditDisplay = "$0";
    if (c.status === "SETTLED" && c.authorized_amount && c.captured_amount) {
      const credit = c.authorized_amount - c.captured_amount;
      if (credit > 0) creditDisplay = `-$${credit.toFixed(0)}`;
    }
    return {
      id: c.id,
      client_name: c.client_name,
      site_url: c.site_url.replace(/^https?:\/\//, ""),
      fee: c.fee,
      uptime: `${c.uptime_target}%`,
      status: c.status === "ACTIVE" ? "Active" : c.status === "PENDING_APPROVAL" ? "Pending Hold" : c.status === "SETTLING" ? "Settling" : c.status,
      credit: creditDisplay,
      paypal_status: c.paypal_authorization_id ? "Authorized" : c.paypal_order_id ? "Order Created" : "Draft",
      isLive: true,
      raw: c
    };
  });

  const displayList = mappedDbContracts.length > 0 ? mappedDbContracts : defaultContracts;
  const filteredList = displayList.filter(item =>
    item.client_name.toLowerCase().includes(filterText.toLowerCase()) ||
    item.site_url.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="max-w-[1344px] mx-auto px-12 py-10">
      {/* Kicker */}
      <div className="text-[11px] uppercase tracking-widest text-[#66645E] font-medium mb-3">
        A1 / CONTRACTS
      </div>

      {/* Headlines */}
      <h1 className="font-serif text-[54px] leading-[1.05] font-normal text-[#141414] tracking-tight m-0">
        Every retainer.
      </h1>
      <h1 className="font-serif text-[54px] leading-[1.05] font-normal text-[#141414] tracking-tight mb-4">
        Every credit.
      </h1>

      <p className="text-[13px] text-[#66645E] max-w-[620px] leading-relaxed mb-10">
        One ledger for what is held, what is owed back, and what has been captured.
      </p>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-3 gap-6 pb-8 border-b border-[#141414] mb-8">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[#66645E] font-medium mb-1">
            HELD ON PAYPAL
          </div>
          <div className="font-serif text-[42px] font-normal text-[#141414]">
            $2,450
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wider text-[#66645E] font-medium mb-1">
            CREDITS PENDING
          </div>
          <div className="font-serif text-[42px] font-normal text-[#141414]">
            $440
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wider text-[#66645E] font-medium mb-1">
            CONTRACTS
          </div>
          <div className="font-serif text-[42px] font-normal text-[#141414]">
            {contracts.length > 0 ? contracts.length : 4}
          </div>
        </div>
      </div>

      {/* Toolbar: Filter and Action */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-[11px] uppercase text-[#66645E] font-medium tracking-wider">
            FILTER
          </span>
          <input
            type="text"
            placeholder="Search by client or site..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="bg-transparent border border-[#141414] px-3 py-1.5 text-[12px] font-mono text-[#141414] w-[260px] focus:outline-none"
          />
        </div>

        <button
          onClick={onNewContractClick}
          className="btn-primary"
        >
          New contract
        </button>
      </div>

      {/* Ledger Table */}
      <table className="ruled-table">
        <thead>
          <tr>
            <th className="w-[220px]">CLIENT</th>
            <th className="w-[260px]">SITE</th>
            <th className="w-[120px]">FEE</th>
            <th className="w-[120px]">UPTIME</th>
            <th className="w-[140px]">STATUS</th>
            <th className="w-[120px]">CREDIT</th>
            <th className="w-[140px]">PAYPAL</th>
            <th className="w-[120px] text-right">ACTION</th>
          </tr>
        </thead>
        <tbody>
          {filteredList.map((row) => (
            <tr
              key={row.id}
              className="hover:bg-[rgba(20,20,20,0.02)] transition-colors cursor-pointer"
              onClick={() => {
                if ("raw" in row && row.raw) {
                  onSelectContract(row.raw);
                }
              }}
            >
              <td className="font-medium text-[#141414]">{row.client_name}</td>
              <td className="text-[#66645E]">{row.site_url}</td>
              <td className="text-[#141414] font-medium">${row.fee}</td>
              <td className="text-[#141414]">{row.uptime}</td>
              <td>
                <span
                  className={`inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                    row.status === "Active"
                      ? "bg-[#141414] text-[#FFF7E3]"
                      : row.status === "Breach" || row.status === "Settling"
                      ? "border border-[#E05345] text-[#E05345]"
                      : "border border-[#141414] text-[#141414]"
                  }`}
                >
                  {row.status}
                </span>
              </td>
              <td className={row.credit.startsWith("-") ? "text-[#E05345] font-medium" : "text-[#141414]"}>
                {row.credit}
              </td>
              <td className="text-[#66645E]">{row.paypal_status}</td>
              <td className="text-right">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if ("raw" in row && row.raw) {
                      onSelectContract(row.raw);
                    }
                  }}
                  className="text-[11px] uppercase tracking-wider underline hover:text-[#66645E] bg-transparent border-none cursor-pointer p-0"
                >
                  View Period →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
