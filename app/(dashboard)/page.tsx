"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const TEAM_ID = "00000000-0000-0000-0000-000000000001";
const CRM_ACCENT = "#F97316";

const AGENT_COLORS: Record<string, string> = {
  "market-research": "#0EA5E9",
  pmf: "#14B8A6",
  positioning: "#8B5CF6",
  analytics: "#6366F1",
  content: "#F59E0B",
  "sales-enablement": "#10B981",
  "demand-gen": "#EC4899",
  launch: "#EF4444",
  crm: "#F97316",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PipelineStats {
  totalDeals: number;
  totalValue: number;
  avgHealthScore: number;
  dealsAtRisk: number;
  avgDaysInStage: number;
}

interface Deal {
  healthScore: number | null;
}

interface KBStats {
  documents: number;
  knowledgeChunks: number;
  webSources: number;
}

interface RecentRun {
  id: string;
  status: string;
  input: Record<string, unknown> | null;
  startedAt: string | null;
  agentName: string;
  agentSlug: string;
  tokensUsed: number | null;
}

// ---------------------------------------------------------------------------
// Quick actions
// ---------------------------------------------------------------------------
const QUICK_ACTIONS = [
  {
    label: "Upload Documents",
    description: "Add files to the Knowledge Base",
    href: "/knowledge",
    color: "#F59E0B",
  },
  {
    label: "Ask the GTM Engineer",
    description: "Run multi-agent strategies",
    href: "/orchestrator",
    color: "#10B981",
  },
  {
    label: "Create Content",
    description: "Blog posts, battle cards, case studies",
    href: "/agents/content",
    color: "#F59E0B",
  },
  {
    label: "Research a Market",
    description: "Competitors, ICPs, TAM/SAM/SOM",
    href: "/agents/market-research",
    color: "#0EA5E9",
  },
  {
    label: "Check Deals",
    description: "Pipeline health and deal intel",
    href: "/agents/crm",
    color: "#F97316",
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function Home() {
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null);
  const [healthDist, setHealthDist] = useState({ green: 0, yellow: 0, red: 0 });
  const [kbStats, setKBStats] = useState<KBStats | null>(null);
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);

  const fetchPipeline = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/deals");
      if (!res.ok) return;
      const data = await res.json();
      setPipelineStats(data.stats);

      const deals = (data.deals || []) as Deal[];
      let green = 0,
        yellow = 0,
        red = 0;
      for (const d of deals) {
        if (d.healthScore === null) {
          yellow++;
          continue;
        }
        if (d.healthScore >= 70) green++;
        else if (d.healthScore >= 40) yellow++;
        else red++;
      }
      setHealthDist({ green, yellow, red });
    } catch {
      /* CRM not available */
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

  const fetchRecentRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/recent-runs?teamId=${TEAM_ID}`);
      if (!res.ok) return;
      const data = await res.json();
      setRecentRuns(data.runs || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchPipeline();
    fetchKBStats();
    fetchRecentRuns();
  }, [fetchPipeline, fetchKBStats, fetchRecentRuns]);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Welcome section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-heading mb-2">
          Welcome to GTM Platform
        </h1>
        <p className="text-text-muted text-sm">
          Multi-Agent Go-To-Market Intelligence — what would you like to work on?
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="no-underline group"
          >
            <div className="bg-card-bg border border-border-default rounded-[14px] p-4 hover:border-opacity-30 transition-all group-hover:-translate-y-0.5"
              style={{ ["--hover-color" as string]: action.color }}
            >
              <div
                className="w-2 h-2 rounded-full mb-3"
                style={{ background: action.color }}
              />
              <div className="text-xs font-medium text-text-heading mb-1">
                {action.label}
              </div>
              <div className="text-[10px] text-text-dim leading-relaxed">
                {action.description}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Stats cards row */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* Knowledge Base Health */}
        <Link href="/knowledge" className="no-underline">
          <div className="bg-card-bg border border-border-default rounded-[14px] p-5 hover:border-[#F59E0B]/20 transition-colors">
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: "#F59E0B" }}
              />
              <span className="text-[10px] uppercase tracking-[2px] font-semibold text-[#F59E0B]">
                Knowledge Base
              </span>
            </div>

            {kbStats ? (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-2xl font-bold font-mono text-foreground">
                    {kbStats.documents}
                  </div>
                  <div className="text-[10px] uppercase tracking-[2px] text-text-muted mt-1">
                    Documents
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold font-mono text-foreground">
                    {kbStats.knowledgeChunks}
                  </div>
                  <div className="text-[10px] uppercase tracking-[2px] text-text-muted mt-1">
                    Chunks
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold font-mono text-foreground">
                    {kbStats.webSources}
                  </div>
                  <div className="text-[10px] uppercase tracking-[2px] text-text-muted mt-1">
                    Web Sources
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-text-dim">
                Upload documents to get started
              </div>
            )}
          </div>
        </Link>

        {/* Pipeline Health */}
        <Link href="/agents/crm" className="no-underline">
          <div className="bg-card-bg border border-border-default rounded-[14px] p-5 hover:border-[#F97316]/20 transition-colors">
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: CRM_ACCENT }}
              />
              <span className="text-[10px] uppercase tracking-[2px] font-semibold text-[#F97316]">
                Pipeline Health
              </span>
            </div>

            {pipelineStats && pipelineStats.totalDeals > 0 ? (
              <>
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <div className="text-2xl font-bold font-mono text-foreground">
                      $
                      {pipelineStats.totalValue >= 1000
                        ? `${(pipelineStats.totalValue / 1000).toFixed(0)}k`
                        : pipelineStats.totalValue.toLocaleString()}
                    </div>
                    <div className="text-[10px] uppercase tracking-[2px] text-text-muted mt-1">
                      Pipeline Value
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="text-2xl font-bold font-mono"
                      style={{
                        color:
                          pipelineStats.dealsAtRisk > 0
                            ? "#EF4444"
                            : "#10B981",
                      }}
                    >
                      {pipelineStats.dealsAtRisk}
                    </div>
                    <div className="text-[10px] uppercase tracking-[2px] text-text-muted mt-1">
                      At Risk
                    </div>
                  </div>
                </div>

                {healthDist.green + healthDist.yellow + healthDist.red > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] text-text-dim">
                        {pipelineStats.totalDeals} deals
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden flex bg-background">
                      {healthDist.green > 0 && (
                        <div
                          className="h-full"
                          style={{
                            width: `${(healthDist.green / pipelineStats.totalDeals) * 100}%`,
                            background: "#10B981",
                          }}
                        />
                      )}
                      {healthDist.yellow > 0 && (
                        <div
                          className="h-full"
                          style={{
                            width: `${(healthDist.yellow / pipelineStats.totalDeals) * 100}%`,
                            background: "#FBBF24",
                          }}
                        />
                      )}
                      {healthDist.red > 0 && (
                        <div
                          className="h-full"
                          style={{
                            width: `${(healthDist.red / pipelineStats.totalDeals) * 100}%`,
                            background: "#EF4444",
                          }}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1 text-[10px] text-text-dim">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                        {healthDist.green} healthy
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-text-dim">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]" />
                        {healthDist.yellow} at risk
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-text-dim">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                        {healthDist.red} critical
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs text-text-dim">
                Connect HubSpot to see pipeline data
              </div>
            )}
          </div>
        </Link>
      </div>

      {/* Recent Agent Runs */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] uppercase tracking-[2px] font-semibold text-text-muted">
            Recent Agent Runs
          </span>
        </div>

        {recentRuns.length > 0 ? (
          <div className="bg-card-bg border border-border-default rounded-[14px] divide-y divide-border-default">
            {recentRuns.map((run) => {
              const color = AGENT_COLORS[run.agentSlug] || "#71717A";
              const inputSummary = run.input
                ? Object.values(run.input)
                    .filter((v) => typeof v === "string")
                    .join(", ")
                    .slice(0, 80)
                : "";

              return (
                <Link
                  key={run.id}
                  href={`/agents/${run.agentSlug}`}
                  className="no-underline"
                >
                  <div className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-text-heading">
                          {run.agentName}
                        </span>
                        <span
                          className={`text-[9px] uppercase tracking-[1px] px-1.5 py-0.5 rounded ${
                            run.status === "completed"
                              ? "bg-[#10B981]/10 text-[#10B981]"
                              : run.status === "failed"
                                ? "bg-[#EF4444]/10 text-[#EF4444]"
                                : "bg-[#FBBF24]/10 text-[#FBBF24]"
                          }`}
                        >
                          {run.status}
                        </span>
                      </div>
                      {inputSummary && (
                        <div className="text-[10px] text-text-dim truncate mt-0.5">
                          {inputSummary}
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-text-dim shrink-0">
                      {run.startedAt
                        ? formatTimeAgo(new Date(run.startedAt))
                        : ""}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="bg-card-bg border border-border-default rounded-[14px] p-8 text-center">
            <p className="text-xs text-text-dim">
              No agent runs yet. Use the Orchestrator or run an individual agent to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}
