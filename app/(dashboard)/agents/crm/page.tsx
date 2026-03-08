"use client";

import { useState, useEffect } from "react";
import { ModeSwitcher, type CrmMode } from "./_components/ModeSwitcher";
import CustomerMode from "./_components/customers/CustomerMode";
import InvestorMode from "./_components/investors/InvestorMode";

const STORAGE_KEY = "crm-mode";
const CUSTOMER_COLOR = "#F97316";
const INVESTOR_COLOR = "#8B5CF6";

export default function CRMPage() {
  const [mode, setMode] = useState<CrmMode>("customers");

  // Persist mode to localStorage
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
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: accent }} />
          <h1 className="text-2xl font-bold text-text-heading font-display">
            CRM Intelligence
          </h1>
        </div>
        <p className="text-text-secondary text-sm mb-4">
          {mode === "customers"
            ? "Deal health scoring, ICP matching, and AI-powered pipeline analysis powered by HubSpot data."
            : "Track and manage your investor pipeline for fundraising."}
        </p>
        <ModeSwitcher mode={mode} onChange={handleModeChange} />
      </div>

      {/* Mode content */}
      {mode === "customers" ? <CustomerMode /> : <InvestorMode />}
    </div>
  );
}
