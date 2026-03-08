"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const CustomerMode = dynamic(
  () => import("./_components/customers/CustomerMode"),
  { ssr: false }
);
const InvestorMode = dynamic(
  () => import("./_components/investors/InvestorMode"),
  { ssr: false }
);

type CrmMode = "customers" | "investors";

const STORAGE_KEY = "crm-mode";
const CUSTOMER_COLOR = "#F97316";
const INVESTOR_COLOR = "#8B5CF6";

export default function CRMPage() {
  const [mode, setMode] = useState<CrmMode>("customers");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "customers" || saved === "investors") {
      setMode(saved);
    }
  }, []);

  const handleModeChange = (newMode: CrmMode) => {
    setMode(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  };

  const accent = mode === "customers" ? CUSTOMER_COLOR : INVESTOR_COLOR;

  return (
    <div className="max-w-7xl mx-auto px-10 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: accent }}
          />
          <h1 className="text-2xl font-bold text-text-heading font-display">
            CRM Intelligence
          </h1>
        </div>
        <p className="text-text-secondary text-sm mb-4">
          {mode === "customers"
            ? "Deal health scoring, ICP matching, and AI-powered pipeline analysis powered by HubSpot data."
            : "Track and manage your investor pipeline for fundraising."}
        </p>

        {/* Mode Switcher — inline */}
        <div
          className="inline-flex rounded-full p-1 gap-1"
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <button
            onClick={() => handleModeChange("customers")}
            className="px-5 py-1.5 rounded-full text-sm font-semibold font-display transition-all"
            style={{
              background:
                mode === "customers" ? CUSTOMER_COLOR : "transparent",
              color: mode === "customers" ? "#FFFFFF" : "#A1A1AA",
              cursor: "pointer",
              border: "none",
              boxShadow:
                mode === "customers"
                  ? `0 0 12px ${CUSTOMER_COLOR}50`
                  : "none",
            }}
          >
            Customers
          </button>
          <button
            onClick={() => handleModeChange("investors")}
            className="px-5 py-1.5 rounded-full text-sm font-semibold font-display transition-all"
            style={{
              background:
                mode === "investors" ? INVESTOR_COLOR : "transparent",
              color: mode === "investors" ? "#FFFFFF" : "#A1A1AA",
              cursor: "pointer",
              border: "none",
              boxShadow:
                mode === "investors"
                  ? `0 0 12px ${INVESTOR_COLOR}50`
                  : "none",
            }}
          >
            Investors
          </button>
        </div>
      </div>

      {/* Mode content */}
      {mode === "customers" ? <CustomerMode /> : <InvestorMode />}
    </div>
  );
}
