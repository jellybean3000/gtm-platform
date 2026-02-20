"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const TEAM_ID = "00000000-0000-0000-0000-000000000001";

interface CRMStatus {
  connected: boolean;
  portalId?: string;
  hubName?: string;
}

interface KBStats {
  documents: number;
  knowledgeChunks: number;
  webSources: number;
}

export default function SettingsPage() {
  const [crmStatus, setCrmStatus] = useState<CRMStatus | null>(null);
  const [kbStats, setKBStats] = useState<KBStats | null>(null);

  const fetchCrmStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/status");
      if (!res.ok) return;
      const data = await res.json();
      setCrmStatus(data);
    } catch {
      setCrmStatus({ connected: false });
    }
  }, []);

  const fetchKBStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/knowledge/stats?teamId=${TEAM_ID}`);
      if (!res.ok) return;
      const data = await res.json();
      setKBStats(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchCrmStatus();
    fetchKBStats();
  }, [fetchCrmStatus, fetchKBStats]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-heading mb-2">Settings</h1>
        <p className="text-sm text-text-muted">
          Manage your platform configuration and integrations.
        </p>
      </div>

      {/* Team */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-text-heading mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
          Team
        </h2>
        <div className="bg-card-bg border border-border-default rounded-[14px] p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-heading font-medium">
                GTM Platform Team
              </div>
              <div className="text-[10px] text-text-dim mt-0.5">
                Team ID: {TEAM_ID.slice(0, 8)}...
              </div>
            </div>
            <span className="text-[9px] uppercase tracking-[1px] px-2 py-1 rounded bg-[#10B981]/10 text-[#10B981]">
              Active
            </span>
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-text-heading mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
          Integrations
        </h2>
        <div className="space-y-3">
          {/* HubSpot */}
          <div className="bg-card-bg border border-border-default rounded-[14px] p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#F97316]/10 flex items-center justify-center">
                  <span className="text-sm">🔗</span>
                </div>
                <div>
                  <div className="text-sm text-text-heading font-medium">
                    HubSpot CRM
                  </div>
                  <div className="text-[10px] text-text-dim mt-0.5">
                    {crmStatus?.connected
                      ? `Connected to ${crmStatus.hubName || "HubSpot"} (Portal: ${crmStatus.portalId})`
                      : "Pipeline data, deal health, and contact insights"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-[9px] uppercase tracking-[1px] px-2 py-1 rounded ${
                    crmStatus?.connected
                      ? "bg-[#10B981]/10 text-[#10B981]"
                      : "bg-[#71717A]/10 text-[#71717A]"
                  }`}
                >
                  {crmStatus === null
                    ? "Checking..."
                    : crmStatus.connected
                      ? "Connected"
                      : "Not Connected"}
                </span>
                <Link
                  href="/agents/crm"
                  className="text-xs text-[#F97316] hover:underline"
                >
                  {crmStatus?.connected ? "Manage" : "Connect"} →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Knowledge Base */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-text-heading mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
          Knowledge Base
        </h2>
        <div className="bg-card-bg border border-border-default rounded-[14px] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-text-heading font-medium">
              Knowledge Engine Status
            </div>
            <Link
              href="/knowledge"
              className="text-xs text-[#F59E0B] hover:underline"
            >
              Manage →
            </Link>
          </div>
          {kbStats ? (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xl font-bold font-mono text-foreground">
                  {kbStats.documents}
                </div>
                <div className="text-[10px] uppercase tracking-[2px] text-text-muted mt-1">
                  Documents
                </div>
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-foreground">
                  {kbStats.knowledgeChunks}
                </div>
                <div className="text-[10px] uppercase tracking-[2px] text-text-muted mt-1">
                  Knowledge Chunks
                </div>
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-foreground">
                  {kbStats.webSources}
                </div>
                <div className="text-[10px] uppercase tracking-[2px] text-text-muted mt-1">
                  Web Sources
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-text-dim">Loading stats...</div>
          )}
        </div>
      </section>

      {/* AI Configuration */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-text-heading mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1]" />
          AI Configuration
        </h2>
        <div className="bg-card-bg border border-border-default rounded-[14px] p-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-text-body">LLM Provider</div>
                <div className="text-[10px] text-text-dim mt-0.5">
                  Anthropic Claude (claude-sonnet-4-5-20250929)
                </div>
              </div>
              <span className="text-[9px] uppercase tracking-[1px] px-2 py-1 rounded bg-[#10B981]/10 text-[#10B981]">
                Active
              </span>
            </div>
            <div className="border-t border-border-default" />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-text-body">Embeddings</div>
                <div className="text-[10px] text-text-dim mt-0.5">
                  Google Gemini (gemini-embedding-001, 3072 dims)
                </div>
              </div>
              <span className="text-[9px] uppercase tracking-[1px] px-2 py-1 rounded bg-[#10B981]/10 text-[#10B981]">
                Active
              </span>
            </div>
            <div className="border-t border-border-default" />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-text-body">Database</div>
                <div className="text-[10px] text-text-dim mt-0.5">
                  PostgreSQL with pgvector (Supabase)
                </div>
              </div>
              <span className="text-[9px] uppercase tracking-[1px] px-2 py-1 rounded bg-[#10B981]/10 text-[#10B981]">
                Active
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-text-heading mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
          Data Management
        </h2>
        <div className="bg-card-bg border border-[#EF4444]/10 rounded-[14px] p-5">
          <p className="text-xs text-text-dim mb-3">
            Data management tools for clearing agent runs, resetting the
            knowledge base, or disconnecting integrations.
          </p>
          <span className="text-[10px] text-text-dim italic">
            Coming soon
          </span>
        </div>
      </section>
    </div>
  );
}
