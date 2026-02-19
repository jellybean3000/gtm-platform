"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { DownloadButton } from "@/components/shared/DownloadButton";

const ACCENT = "#F97316";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Deal {
  id: string;
  hubspotDealId: string;
  dealName: string;
  amount: string | null;
  stage: string | null;
  pipeline: string | null;
  closeDate: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  daysInStage: number | null;
  healthScore: number | null;
  activityCount: number;
  lastSyncedAt: string;
}

interface PipelineStats {
  totalDeals: number;
  totalValue: number;
  avgHealthScore: number;
  dealsAtRisk: number;
  avgDaysInStage: number;
}

interface DealHealthResult {
  score: number;
  color: "green" | "yellow" | "red";
  label: string;
  riskFactors: string[];
}

interface ICPMatchResult {
  score: number;
  matchingCriteria: string[];
  gaps: string[];
  icpSourcesFound: boolean;
}

interface NextStepRecommendation {
  action: string;
  reasoning: string;
  supportingMaterial: string;
  urgency: "immediate" | "this_week" | "this_month";
}

interface DealAnalysis {
  deal: Record<string, unknown>;
  healthScore: DealHealthResult;
  icpMatch: ICPMatchResult | null;
  recommendations: NextStepRecommendation[];
  knowledgeSourcesUsed: string[];
}

interface SyncLog {
  id: string;
  syncType: string;
  status: string;
  dealsCount: number | null;
  contactsCount: number | null;
  activitiesCount: number | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

// ---------------------------------------------------------------------------
// Stage ordering for kanban
// ---------------------------------------------------------------------------
const STAGE_ORDER = [
  "appointmentscheduled",
  "qualifiedtobuy",
  "presentationscheduled",
  "decisionmakerboughtin",
  "contractsent",
  "closedwon",
  "closedlost",
];

function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
    appointmentscheduled: "Appointment Scheduled",
    qualifiedtobuy: "Qualified to Buy",
    presentationscheduled: "Presentation Scheduled",
    decisionmakerboughtin: "Decision Maker Bought In",
    contractsent: "Contract Sent",
    closedwon: "Closed Won",
    closedlost: "Closed Lost",
  };
  return labels[stage.toLowerCase()] || stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function healthColor(score: number | null): string {
  if (score === null) return "#52525B";
  if (score >= 70) return "#10B981";
  if (score >= 40) return "#FBBF24";
  return "#EF4444";
}

function healthLabel(score: number | null): string {
  if (score === null) return "Unknown";
  if (score >= 70) return "Healthy";
  if (score >= 40) return "At Risk";
  return "Critical";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CRMPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [activeSection, setActiveSection] = useState<"pipeline" | "analysis" | "settings">("pipeline");

  // Deal detail panel
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [dealAnalysis, setDealAnalysis] = useState<DealAnalysis | null>(null);
  const [analyzingDeal, setAnalyzingDeal] = useState(false);

  // Pipeline analysis (streaming)
  const [analysisInput, setAnalysisInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [streamedOutput, setStreamedOutput] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  // Settings / sync
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    dealsCount: number;
    contactsCount: number;
    activitiesCount: number;
    error?: string;
  } | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [showSyncLog, setShowSyncLog] = useState(false);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------
  const fetchDeals = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/deals");
      if (!res.ok) return;
      const data = await res.json();
      setDeals(data.deals || []);
      setStats(data.stats || null);
      setConnected(true);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/status");
      const data = await res.json();
      setConnected(data.connected);
      if (!data.connected) setLoading(false);
    } catch {
      setConnected(false);
      setLoading(false);
    }
  }, []);

  const fetchSyncLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/sync");
      const data = await res.json();
      setSyncLogs(data.logs || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchStatus().then(() => {
      fetchDeals();
      fetchSyncLogs();
    });
  }, [fetchStatus, fetchDeals, fetchSyncLogs]);

  // -------------------------------------------------------------------------
  // Deal analysis
  // -------------------------------------------------------------------------
  const analyzeDeal = async (deal: Deal) => {
    setSelectedDeal(deal);
    setDealAnalysis(null);
    setAnalyzingDeal(true);
    try {
      const res = await fetch(`/api/crm/deals/${deal.hubspotDealId}/analyze`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setDealAnalysis(data);
      }
    } catch {
      // ignore
    } finally {
      setAnalyzingDeal(false);
    }
  };

  // -------------------------------------------------------------------------
  // Pipeline analysis (streaming)
  // -------------------------------------------------------------------------
  const runPipelineAnalysis = async () => {
    if (!analysisInput.trim() || isRunning) return;
    setIsRunning(true);
    setStreamedOutput("");

    try {
      const res = await fetch("/api/agents/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: {
            analysis_type: "pipeline_review",
            request: analysisInput,
            deal_count: stats?.totalDeals || 0,
            pipeline_value: stats?.totalValue || 0,
          },
          teamId: "00000000-0000-0000-0000-000000000001",
        }),
      });

      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setStreamedOutput(accumulated);
        if (outputRef.current) {
          outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
      }
    } catch {
      setStreamedOutput("Error running pipeline analysis.");
    } finally {
      setIsRunning(false);
    }
  };

  // -------------------------------------------------------------------------
  // Sync handler
  // -------------------------------------------------------------------------
  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/crm/sync", { method: "POST" });
      const data = await res.json();
      setSyncResult(data);
      if (data.error) {
        toast.error("CRM sync failed");
      } else {
        toast.success(`Synced ${data.dealsCount} deals, ${data.contactsCount} contacts`);
      }
      fetchDeals();
      fetchSyncLogs();
    } catch {
      setSyncResult({ dealsCount: 0, contactsCount: 0, activitiesCount: 0, error: "Sync failed" });
      toast.error("CRM sync failed");
    } finally {
      setSyncing(false);
    }
  };

  // -------------------------------------------------------------------------
  // Group deals by stage for kanban
  // -------------------------------------------------------------------------
  const stageGroups: Record<string, Deal[]> = {};
  for (const deal of deals) {
    const stage = deal.stage || "unknown";
    if (!stageGroups[stage]) stageGroups[stage] = [];
    stageGroups[stage].push(deal);
  }
  // Sort deals within each stage by health score (worst first)
  for (const stage of Object.keys(stageGroups)) {
    stageGroups[stage].sort((a, b) => (a.healthScore ?? 50) - (b.healthScore ?? 50));
  }
  // Order stages
  const orderedStages = Object.keys(stageGroups).sort((a, b) => {
    const ai = STAGE_ORDER.indexOf(a.toLowerCase());
    const bi = STAGE_ORDER.indexOf(b.toLowerCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-10 py-8">
        <div className="bg-card-bg border border-border-default rounded-card p-12 text-center">
          <p className="text-text-dim font-mono text-sm">Loading CRM data...</p>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="max-w-6xl mx-auto px-10 py-8">
        <Header />
        <div className="bg-card-bg border border-border-default rounded-card p-12 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 text-3xl"
            style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}30` }}
          >
            🔗
          </div>
          <h2 className="text-xl font-bold text-foreground font-display mb-2">
            HubSpot Not Connected
          </h2>
          <p className="text-text-dim text-sm max-w-md mx-auto mb-6 leading-relaxed">
            To connect HubSpot, add your Private App access token as the
            HUBSPOT_ACCESS_TOKEN environment variable, then run a sync.
          </p>
          <code className="inline-block px-5 py-2.5 bg-background border border-border-default rounded-lg font-mono text-xs text-text-body">
            HUBSPOT_ACCESS_TOKEN=pat-na2-...
          </code>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-10 py-8">
      <Header />

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-5 gap-3 mb-6">
          <KPICard label="Total Deals" value={String(stats.totalDeals)} />
          <KPICard
            label="Pipeline Value"
            value={`$${stats.totalValue >= 1000 ? `${(stats.totalValue / 1000).toFixed(0)}k` : stats.totalValue.toLocaleString()}`}
          />
          <KPICard
            label="Avg Health"
            value={String(stats.avgHealthScore)}
            valueColor={healthColor(stats.avgHealthScore)}
          />
          <KPICard
            label="Deals at Risk"
            value={String(stats.dealsAtRisk)}
            valueColor={stats.dealsAtRisk > 0 ? "#EF4444" : "#10B981"}
          />
          <KPICard
            label="Avg Days in Stage"
            value={String(stats.avgDaysInStage)}
          />
        </div>
      )}

      {/* Section tabs */}
      <div className="flex gap-0 border-b border-border-default mb-6">
        {(["pipeline", "analysis", "settings"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSection(tab)}
            className="px-5 py-2.5 text-sm font-semibold font-display capitalize transition-all"
            style={{
              background: "transparent",
              border: "none",
              borderBottom: activeSection === tab ? `2px solid ${ACCENT}` : "2px solid transparent",
              color: activeSection === tab ? "#FAFAFA" : "#71717A",
              cursor: "pointer",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Pipeline Section */}
      {activeSection === "pipeline" && (
        <>
          {deals.length === 0 ? (
            <div className="bg-card-bg border border-border-default rounded-card p-12 text-center">
              <p className="text-text-dim text-sm">
                No deals synced yet. Go to Settings and run a sync first.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-3" style={{ minWidth: orderedStages.length * 260 }}>
                {orderedStages.map((stage) => (
                  <div
                    key={stage}
                    className="flex-shrink-0 bg-card-bg border border-border-default rounded-card p-3"
                    style={{ width: 250 }}
                  >
                    {/* Stage header */}
                    <div className="flex items-center justify-between mb-3 px-1">
                      <span className="text-[10px] uppercase tracking-[2px] text-text-muted font-semibold truncate">
                        {stageLabel(stage)}
                      </span>
                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background: `${ACCENT}20`, color: ACCENT }}
                      >
                        {stageGroups[stage].length}
                      </span>
                    </div>

                    {/* Deal cards */}
                    <div className="space-y-2">
                      {stageGroups[stage].map((deal) => (
                        <button
                          key={deal.id}
                          onClick={() => analyzeDeal(deal)}
                          className="w-full text-left bg-background border border-border-default rounded-lg p-3 transition-all hover:-translate-y-0.5"
                          style={{
                            cursor: "pointer",
                            borderColor:
                              selectedDeal?.id === deal.id
                                ? `${ACCENT}60`
                                : undefined,
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs text-foreground font-medium leading-tight truncate">
                              {deal.dealName}
                            </span>
                            <span
                              className="flex-shrink-0 w-2.5 h-2.5 rounded-full mt-0.5"
                              style={{
                                background: healthColor(deal.healthScore),
                                boxShadow: `0 0 6px ${healthColor(deal.healthScore)}40`,
                              }}
                              title={`Health: ${deal.healthScore ?? "?"}/100`}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[11px] font-mono text-text-body">
                              {deal.amount
                                ? `$${Number(deal.amount).toLocaleString()}`
                                : "—"}
                            </span>
                            <span className="text-[10px] text-text-dim">
                              {deal.daysInStage !== null
                                ? `${deal.daysInStage}d`
                                : ""}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Analysis Section */}
      {activeSection === "analysis" && (
        <div className="space-y-4">
          <div className="bg-card-bg border border-border-default rounded-card p-6">
            <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">
              Pipeline Analysis Request
            </label>
            <textarea
              value={analysisInput}
              onChange={(e) => setAnalysisInput(e.target.value)}
              placeholder="e.g., Review stalled deals, Pipeline forecast, Which deals need immediate attention?"
              rows={3}
              className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none resize-none"
              style={{ borderColor: isRunning ? `${ACCENT}40` : undefined }}
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={runPipelineAnalysis}
                disabled={isRunning || !analysisInput.trim()}
                className="px-6 py-2.5 text-white font-medium text-sm rounded-lg disabled:opacity-50"
                style={{ backgroundColor: ACCENT, cursor: isRunning ? "not-allowed" : "pointer" }}
              >
                {isRunning ? "Analyzing..." : "Run Analysis"}
              </button>
            </div>
          </div>

          {(streamedOutput || isRunning) && (
            <div className="bg-card-bg border border-border-default rounded-card p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full" style={{ background: ACCENT }} />
                <span className="text-[10px] uppercase tracking-[2px] font-semibold" style={{ color: ACCENT }}>
                  Pipeline Analysis
                </span>
              </div>
              <div
                ref={outputRef}
                className="font-mono text-sm text-text-body leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap"
              >
                {streamedOutput}
                {isRunning && (
                  <span
                    className="inline-block w-2 h-4 ml-1 animate-pulse"
                    style={{ backgroundColor: ACCENT }}
                  />
                )}
              </div>
              {streamedOutput && !isRunning && (
                <div className="mt-3">
                  <DownloadButton
                    content={streamedOutput}
                    filename="crm-analysis"
                    formats={["md", "txt"]}
                    accentColor={ACCENT}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Settings Section */}
      {activeSection === "settings" && (
        <div className="space-y-4">
          {/* Connection status */}
          <div className="bg-card-bg border border-border-default rounded-card p-5">
            <div className="flex items-center gap-3">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: "#10B981", boxShadow: "0 0 8px rgba(16,185,129,0.5)" }}
              />
              <span className="text-foreground text-sm font-semibold font-display">
                HubSpot Connected
              </span>
            </div>
          </div>

          {/* Sync controls */}
          <div className="bg-card-bg border border-border-default rounded-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-text-heading text-sm font-semibold font-display">
                  Data Sync
                </div>
                <div className="text-text-dim text-xs mt-0.5 font-mono">
                  {syncLogs.length > 0 && syncLogs[0].completedAt
                    ? `Last synced: ${new Date(syncLogs[0].completedAt).toLocaleString()}`
                    : "Never synced"}
                  {syncLogs.length > 0 &&
                    syncLogs[0].status === "completed" &&
                    ` — ${syncLogs[0].dealsCount ?? 0} deals, ${syncLogs[0].contactsCount ?? 0} contacts, ${syncLogs[0].activitiesCount ?? 0} activities`}
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => setShowSyncLog(!showSyncLog)}
                  className="bg-transparent border border-border-default rounded-lg px-3.5 py-1.5 text-text-body text-xs cursor-pointer font-display hover:border-text-dim transition-colors"
                >
                  {showSyncLog ? "Hide Log" : "Sync Log"}
                </button>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="text-white rounded-lg px-4 py-1.5 text-xs font-semibold disabled:opacity-50 font-display"
                  style={{ backgroundColor: ACCENT, cursor: syncing ? "not-allowed" : "pointer" }}
                >
                  {syncing ? "Syncing..." : "Sync Now"}
                </button>
              </div>
            </div>

            {syncResult && (
              <div
                className="mt-3 px-3.5 py-2.5 rounded-lg text-xs font-mono"
                style={{
                  background: syncResult.error ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
                  border: syncResult.error
                    ? "1px solid rgba(239,68,68,0.2)"
                    : "1px solid rgba(16,185,129,0.2)",
                  color: syncResult.error ? "#FCA5A5" : "#6EE7B7",
                }}
              >
                {syncResult.error
                  ? `Sync failed: ${syncResult.error}`
                  : `Synced ${syncResult.dealsCount} deals, ${syncResult.contactsCount} contacts, ${syncResult.activitiesCount} activities`}
              </div>
            )}

            {showSyncLog && syncLogs.length > 0 && (
              <div className="mt-3">
                {syncLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex justify-between py-1.5 text-[11px] font-mono"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                  >
                    <span className="text-text-dim">
                      {new Date(log.startedAt).toLocaleString()}
                    </span>
                    <span
                      style={{
                        color:
                          log.status === "completed"
                            ? "#6EE7B7"
                            : log.status === "failed"
                              ? "#FCA5A5"
                              : "#FBBF24",
                      }}
                    >
                      {log.status}
                    </span>
                    <span className="text-text-body">
                      {log.status === "completed"
                        ? `${log.dealsCount ?? 0}d / ${log.contactsCount ?? 0}c / ${log.activitiesCount ?? 0}a`
                        : log.error || "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deal Detail Slide-out Panel */}
      {selectedDeal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={() => {
              setSelectedDeal(null);
              setDealAnalysis(null);
            }}
          />

          {/* Panel */}
          <div
            className="fixed top-0 right-0 z-50 h-full overflow-y-auto border-l border-border-default"
            style={{ width: 420, background: "#09090B" }}
          >
            <div className="p-6 space-y-5">
              {/* Close button */}
              <button
                onClick={() => {
                  setSelectedDeal(null);
                  setDealAnalysis(null);
                }}
                className="text-text-dim hover:text-foreground text-lg absolute top-4 right-4 cursor-pointer bg-transparent border-none"
              >
                ✕
              </button>

              {/* Deal header */}
              <div>
                <h2 className="text-lg font-bold text-foreground font-display pr-8">
                  {selectedDeal.dealName}
                </h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedDeal.stage && (
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded"
                      style={{ background: `${ACCENT}20`, color: ACCENT }}
                    >
                      {stageLabel(selectedDeal.stage)}
                    </span>
                  )}
                  {selectedDeal.amount && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-background border border-border-default text-text-body">
                      ${Number(selectedDeal.amount).toLocaleString()}
                    </span>
                  )}
                  {selectedDeal.closeDate && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-background border border-border-default text-text-dim">
                      Close: {new Date(selectedDeal.closeDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {selectedDeal.daysInStage !== null && (
                  <p className="text-text-dim text-xs mt-2 font-mono">
                    {selectedDeal.daysInStage} days in current stage
                  </p>
                )}
              </div>

              {/* Loading state */}
              {analyzingDeal && (
                <div className="bg-card-bg border border-border-default rounded-card p-6 text-center">
                  <div
                    className="inline-block w-6 h-6 border-2 rounded-full animate-spin mb-3"
                    style={{ borderColor: `${ACCENT}30`, borderTopColor: ACCENT }}
                  />
                  <p className="text-text-dim text-xs font-mono">
                    Analyzing deal intelligence...
                  </p>
                </div>
              )}

              {/* Health Score */}
              {dealAnalysis && (
                <>
                  <div className="bg-card-bg border border-border-default rounded-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: ACCENT }} />
                      <span className="text-[10px] uppercase tracking-[2px] font-semibold" style={{ color: ACCENT }}>
                        Health Score
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className="text-3xl font-bold font-mono"
                        style={{ color: healthColor(dealAnalysis.healthScore.score) }}
                      >
                        {dealAnalysis.healthScore.score}
                      </span>
                      <div>
                        <span
                          className="text-xs font-semibold"
                          style={{ color: healthColor(dealAnalysis.healthScore.score) }}
                        >
                          {dealAnalysis.healthScore.label}
                        </span>
                        <span className="text-text-dim text-[10px] ml-1">/ 100</span>
                      </div>
                    </div>
                    {/* Score bar */}
                    <div className="h-1.5 bg-background rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${dealAnalysis.healthScore.score}%`,
                          background: healthColor(dealAnalysis.healthScore.score),
                        }}
                      />
                    </div>
                    {/* Risk factors */}
                    {dealAnalysis.healthScore.riskFactors.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {dealAnalysis.healthScore.riskFactors.map((rf, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <span className="text-red-400 mt-0.5">!</span>
                            <span className="text-text-body">{rf}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ICP Match */}
                  {dealAnalysis.icpMatch && (
                    <div className="bg-card-bg border border-border-default rounded-card p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full" style={{ background: ACCENT }} />
                        <span className="text-[10px] uppercase tracking-[2px] font-semibold" style={{ color: ACCENT }}>
                          ICP Match
                        </span>
                        <span className="text-xs font-mono ml-auto" style={{ color: healthColor(dealAnalysis.icpMatch.score) }}>
                          {dealAnalysis.icpMatch.score}/100
                        </span>
                      </div>
                      <div className="h-1.5 bg-background rounded-full overflow-hidden mb-3">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${dealAnalysis.icpMatch.score}%`,
                            background: healthColor(dealAnalysis.icpMatch.score),
                          }}
                        />
                      </div>
                      {dealAnalysis.icpMatch.matchingCriteria.length > 0 && (
                        <div className="space-y-1 mb-2">
                          {dealAnalysis.icpMatch.matchingCriteria.map((mc, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <span className="text-green-400 mt-0.5">✓</span>
                              <span className="text-text-body">{mc}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {dealAnalysis.icpMatch.gaps.length > 0 && (
                        <div className="space-y-1">
                          {dealAnalysis.icpMatch.gaps.map((g, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <span className="text-red-400 mt-0.5">✗</span>
                              <span className="text-text-dim">{g}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Recommendations */}
                  {dealAnalysis.recommendations.length > 0 && (
                    <div className="bg-card-bg border border-border-default rounded-card p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full" style={{ background: ACCENT }} />
                        <span className="text-[10px] uppercase tracking-[2px] font-semibold" style={{ color: ACCENT }}>
                          Recommended Next Steps
                        </span>
                      </div>
                      <div className="space-y-3">
                        {dealAnalysis.recommendations.map((rec, i) => (
                          <div
                            key={i}
                            className="bg-background border border-border-default rounded-lg p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs text-foreground font-medium leading-snug">
                                {rec.action}
                              </p>
                              <UrgencyBadge urgency={rec.urgency} />
                            </div>
                            <p className="text-[11px] text-text-body mt-1.5 leading-relaxed">
                              {rec.reasoning}
                            </p>
                            {rec.supportingMaterial && (
                              <p className="text-[10px] mt-1.5 font-mono" style={{ color: ACCENT }}>
                                {rec.supportingMaterial}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Activity summary */}
                  <div className="bg-card-bg border border-border-default rounded-card p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: ACCENT }} />
                      <span className="text-[10px] uppercase tracking-[2px] font-semibold" style={{ color: ACCENT }}>
                        Deal Activity
                      </span>
                    </div>
                    <p className="text-xs text-text-body font-mono">
                      {selectedDeal.activityCount} activities linked to this deal
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Header() {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ACCENT }} />
        <h1 className="text-2xl font-bold text-text-heading font-display">
          CRM Intelligence
        </h1>
      </div>
      <p className="text-text-secondary text-sm">
        Deal health scoring, ICP matching, and AI-powered pipeline analysis
        powered by HubSpot data.
      </p>
    </div>
  );
}

function KPICard({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-card-bg border border-border-default rounded-card p-4 text-center">
      <div
        className="text-2xl font-bold font-mono"
        style={{ color: valueColor || "#FAFAFA" }}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-[2px] text-text-muted mt-1">
        {label}
      </div>
    </div>
  );
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    immediate: { bg: "rgba(239,68,68,0.15)", text: "#FCA5A5", label: "Act Now" },
    this_week: { bg: "rgba(251,191,36,0.15)", text: "#FBBF24", label: "This Week" },
    this_month: { bg: "rgba(16,185,129,0.15)", text: "#6EE7B7", label: "This Month" },
  };
  const c = config[urgency] || config.this_week;
  return (
    <span
      className="flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider"
      style={{ background: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  );
}
