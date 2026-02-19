"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { DownloadButton } from "@/components/shared/DownloadButton";

const TEAM_ID = "00000000-0000-0000-0000-000000000001";
const ACCENT = "#6366F1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface KPIItem {
  name: string;
  current_value: string;
  previous_value: string;
  change_percent: number;
  trend: string;
  status: string;
  insight: string;
}

interface FunnelStage {
  name: string;
  volume: number;
  conversion_rate: string;
  drop_off_reasons: string[];
  optimization_suggestions: string[];
}

interface FunnelAnalysis {
  stages: FunnelStage[];
  overall_conversion: string;
  biggest_bottleneck: string;
}

interface CompetitiveLoss {
  competitor: string;
  losses: number;
  common_reason: string;
}

interface WinLossSummary {
  win_rate: string;
  total_deals: number;
  wins: number;
  losses: number;
  top_win_reasons: string[];
  top_loss_reasons: string[];
  avg_deal_size_won: string;
  avg_deal_size_lost: string;
  competitive_losses: CompetitiveLoss[];
}

interface ChurnAnalysis {
  churn_rate: string;
  churn_trend: string;
  at_risk_segments: string[];
  top_churn_reasons: string[];
  retention_recommendations: string[];
}

interface Recommendation {
  title: string;
  priority: string;
  impact: string;
  effort: string;
  category: string;
  action_items: string[];
}

interface StructuredOutput {
  kpi_dashboard: KPIItem[];
  funnel_analysis: FunnelAnalysis;
  win_loss_summary: WinLossSummary;
  churn_analysis: ChurnAnalysis;
  recommendations: Recommendation[];
}

interface RunHistory {
  id: string;
  status: string;
  input: Record<string, unknown>;
  tokensUsed: number | null;
  startedAt: string | null;
}

interface KnowledgeSource {
  id: string;
  content: string;
  sourceDocument: string;
  sourceUrl: string | null;
}

type ProgressStep = { label: string; status: "pending" | "active" | "done" };

const ANALYSIS_TYPES = [
  { value: "full_dashboard", label: "Full Dashboard" },
  { value: "funnel_analysis", label: "Funnel Analysis" },
  { value: "win_loss", label: "Win/Loss Analysis" },
  { value: "churn_analysis", label: "Churn Analysis" },
  { value: "kpi_review", label: "KPI Review" },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#10B981",
};

const STATUS_COLORS: Record<string, string> = {
  on_track: "#10B981",
  at_risk: "#F59E0B",
  behind: "#EF4444",
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function AnalyticsPage() {
  const [analysisType, setAnalysisType] = useState("full_dashboard");
  const [dataDescription, setDataDescription] = useState("");
  const [timePeriod, setTimePeriod] = useState("");
  const [segments, setSegments] = useState("");
  const [includeMarketResearch, setIncludeMarketResearch] = useState(true);
  const [mrAvailable, setMrAvailable] = useState(false);
  const [mrSummary, setMrSummary] = useState("");
  const [includeLivePipeline, setIncludeLivePipeline] = useState(false);
  const [pipelineAvailable, setPipelineAvailable] = useState(false);
  const [pipelineSummary, setPipelineSummary] = useState("");

  const [isRunning, setIsRunning] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [structured, setStructured] = useState<StructuredOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [savedToKB, setSavedToKB] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [runs, setRuns] = useState<RunHistory[]>([]);

  const outputRef = useRef<HTMLDivElement>(null);
  const mrOutputRef = useRef<string | null>(null);
  const pipelineDataRef = useRef<string | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/analytics/runs?teamId=${TEAM_ID}`);
      if (res.ok) { const data = await res.json(); setRuns(data.runs || []); }
    } catch { /* ignore */ }
  }, []);

  const checkMarketResearch = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/analytics/latest-market-research?teamId=${TEAM_ID}`);
      if (res.ok) {
        const data = await res.json();
        if (data.run) {
          setMrAvailable(true);
          const input = data.run.input as Record<string, string> | null;
          const output = data.run.output as { text?: string } | null;
          mrOutputRef.current = output?.text || null;
          setMrSummary(input?.product_description?.slice(0, 50) || "Market research available");
        }
      }
    } catch { /* ignore */ }
  }, []);

  const checkCrmContext = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/context");
      if (res.ok) {
        const data = await res.json();
        if (data.available) {
          setPipelineAvailable(true);
          setPipelineSummary(data.summary);
          pipelineDataRef.current = data.dealsSummary || null;
          setIncludeLivePipeline(true);
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchRuns(); checkMarketResearch(); checkCrmContext(); }, [fetchRuns, checkMarketResearch, checkCrmContext]);
  useEffect(() => { if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight; }, [streamedText]);

  async function fetchSources(runId: string) {
    try {
      const res = await fetch(`/api/agents/analytics/runs/${runId}`);
      if (res.ok) { const data = await res.json(); setSources(data.sources || []); }
    } catch { /* ignore */ }
  }

  async function handleRun() {
    if (!dataDescription.trim()) return;
    setIsRunning(true); setStreamedText(""); setStructured(null); setError(null);
    setCurrentRunId(null); setSources([]); setSavedToKB(false);
    setProgressSteps([
      { label: "Querying knowledge base", status: "active" },
      { label: "Analyzing data", status: "pending" },
      { label: "Generating insights", status: "pending" },
    ]);

    try {
      const input: Record<string, unknown> = {
        analysis_type: analysisType, data_description: dataDescription,
        time_period: timePeriod, segments,
      };
      if (includeMarketResearch && mrOutputRef.current) {
        input.market_research_context = mrOutputRef.current;
      }
      if (includeLivePipeline && pipelineDataRef.current) {
        input.live_pipeline_context = pipelineDataRef.current;
      }

      const res = await fetch("/api/agents/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, teamId: TEAM_ID }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Agent returned ${res.status}`);
      }
      if (!res.body) throw new Error("No response body");

      const runId = res.headers.get("X-Run-Id");
      if (runId) setCurrentRunId(runId);

      setProgressSteps(p => p.map((s, i) => i === 0 ? { ...s, status: "done" } : i === 1 ? { ...s, status: "active" } : s));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let advanced = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setStreamedText(fullText);
        if (!advanced && fullText.length > 200) {
          advanced = true;
          setProgressSteps(p => p.map((s, i) => i < 2 ? { ...s, status: "done" } : { ...s, status: "active" }));
        }
      }

      setProgressSteps(p => p.map(s => ({ ...s, status: "done" })));
      tryParseStructured(fullText);
      fetchRuns();
      if (runId) fetchSources(runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent failed");
      setProgressSteps([]);
    } finally {
      setIsRunning(false);
    }
  }

  async function handleSaveToKnowledge() {
    if (!streamedText || isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/agents/analytics/save-to-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: TEAM_ID, runId: currentRunId,
          title: `Analytics: ${ANALYSIS_TYPES.find(t => t.value === analysisType)?.label}`,
          content: streamedText,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSavedToKB(true);
    } catch { setError("Failed to save to knowledge base"); }
    finally { setIsSaving(false); }
  }

  function tryParseStructured(text: string) {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) { try { setStructured(JSON.parse(jsonMatch[1])); return; } catch { /* fall through */ } }
    try { setStructured(JSON.parse(text)); } catch { /* raw text */ }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ACCENT }} />
          <h1 className="text-2xl font-bold text-text-heading font-display">Analytics Agent</h1>
        </div>
        <p className="text-text-secondary text-sm">
          Generate KPI dashboards, funnel analysis, win/loss summaries, churn analysis, and strategic recommendations.
        </p>
      </div>

      {/* Input Form */}
      <div className="bg-card-bg border border-border-default rounded-card p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Analysis Type</label>
            <select value={analysisType} onChange={(e) => setAnalysisType(e.target.value)}
              className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#6366F1]/40 transition-colors">
              {ANALYSIS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Time Period</label>
            <input type="text" value={timePeriod} onChange={(e) => setTimePeriod(e.target.value)}
              placeholder="e.g., Last 90 days, Q4 2025, Year-over-year"
              className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#6366F1]/40 transition-colors" />
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Data Description</label>
          <textarea value={dataDescription} onChange={(e) => setDataDescription(e.target.value)}
            placeholder="Describe your data sources, current metrics, and what you want to analyze. Include any CSV/data context from your knowledge base..."
            rows={3}
            className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#6366F1]/40 transition-colors resize-none" />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Segments</label>
          <input type="text" value={segments} onChange={(e) => setSegments(e.target.value)}
            placeholder="e.g., Enterprise vs SMB, By region, By product line"
            className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#6366F1]/40 transition-colors" />
        </div>

        {/* Context Toggles */}
        <div className="flex gap-3 flex-wrap">
          <div className="max-w-md flex-1">
            <button onClick={() => mrAvailable && setIncludeMarketResearch(!includeMarketResearch)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                !mrAvailable ? "border-border-default text-text-dim cursor-not-allowed"
                  : includeMarketResearch ? "border-[#6366F1]/40 text-text-heading"
                    : "border-border-default text-text-secondary hover:border-[#6366F1]/20"}`}>
              <div className={`w-8 h-5 rounded-full relative transition-colors shrink-0 ${
                includeMarketResearch && mrAvailable ? "bg-[#6366F1]" : "bg-white/[0.08]"}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  includeMarketResearch && mrAvailable ? "translate-x-3.5" : "translate-x-0.5"}`} />
              </div>
              <div>
                <span className="block">Include Market Research</span>
                <span className="text-[10px] text-text-dim">
                  {mrAvailable ? `${mrSummary}...` : "No market research runs yet"}
                </span>
              </div>
            </button>
          </div>
          <div className="max-w-md flex-1">
            <button onClick={() => pipelineAvailable && setIncludeLivePipeline(!includeLivePipeline)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                !pipelineAvailable ? "border-border-default text-text-dim cursor-not-allowed"
                  : includeLivePipeline ? "border-[#F97316]/40 text-text-heading"
                    : "border-border-default text-text-secondary hover:border-[#F97316]/20"}`}>
              <div className={`w-8 h-5 rounded-full relative transition-colors shrink-0 ${
                includeLivePipeline && pipelineAvailable ? "bg-[#F97316]" : "bg-white/[0.08]"}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  includeLivePipeline && pipelineAvailable ? "translate-x-3.5" : "translate-x-0.5"}`} />
              </div>
              <div>
                <span className="block">Live Pipeline</span>
                <span className="text-[10px] text-text-dim">
                  {pipelineAvailable ? pipelineSummary : "No CRM data synced yet"}
                </span>
              </div>
            </button>
          </div>
        </div>

        <button onClick={handleRun} disabled={isRunning || !dataDescription.trim()}
          className="px-6 py-2.5 text-white font-medium text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ backgroundColor: ACCENT }}>
          {isRunning ? "Analyzing..." : `Run ${ANALYSIS_TYPES.find(t => t.value === analysisType)?.label}`}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[#EF4444] text-sm font-medium">Analysis Failed</p>
            <p className="text-[#EF4444]/70 text-xs mt-1">{error}</p>
          </div>
          <button onClick={handleRun} disabled={isRunning}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors disabled:opacity-50">
            Retry
          </button>
        </div>
      )}

      {/* Progress */}
      {isRunning && progressSteps.length > 0 && (
        <div className="bg-card-bg border border-border-default rounded-card p-4">
          <div className="flex items-center gap-6">
            {progressSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                {step.status === "done" ? (
                  <svg className="w-4 h-4 text-[#6366F1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.status === "active" ? (
                  <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: `${ACCENT} transparent ${ACCENT} ${ACCENT}` }} />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-border-default" />
                )}
                <span className={`text-xs ${step.status === "active" ? "text-text-heading font-medium" : step.status === "done" ? "text-[#6366F1]" : "text-text-dim"}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Streaming Output */}
      {(isRunning || streamedText) && !structured && (
        <div className="bg-card-bg border border-border-default rounded-card p-6">
          <h3 className="text-[10px] uppercase tracking-[2px] text-text-muted mb-3">
            {isRunning ? "Analyzing..." : "Raw Output"}
          </h3>
          <div ref={outputRef} className="max-h-96 overflow-y-auto font-mono text-sm text-text-body whitespace-pre-wrap leading-relaxed">
            {streamedText}
            {isRunning && <span className="inline-block w-2 h-4 ml-1 animate-pulse" style={{ backgroundColor: ACCENT }} />}
          </div>
        </div>
      )}

      {/* Structured Results */}
      {structured && (
        <>
          <StructuredResults data={structured} />

          <div className="flex items-center gap-3">
            <button onClick={handleSaveToKnowledge} disabled={isSaving || savedToKB}
              className="px-5 py-2.5 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor: savedToKB ? "#6366F1" : `${ACCENT}40`, color: savedToKB ? "#6366F1" : ACCENT, backgroundColor: savedToKB ? "rgba(99,102,241,0.1)" : "transparent" }}>
              {savedToKB ? "Saved to Knowledge Base" : isSaving ? "Saving..." : "Save to Knowledge Base"}
            </button>
            <DownloadButton
              content={JSON.stringify(structured, null, 2)}
              filename="analytics-report"
              formats={["json", "md", "csv"]}
              accentColor={ACCENT}
            />
            {savedToKB && <span className="text-xs text-[#6366F1]">Other agents can now reference this analysis.</span>}
          </div>
        </>
      )}

      {sources.length > 0 && <SourcesSection sources={sources} />}
      <RunHistorySection runs={runs} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible Section
// ---------------------------------------------------------------------------
function CollapsibleSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-card-bg border border-border-default rounded-card overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 pb-0 hover:bg-white/[0.01] transition-colors"
        style={{ paddingBottom: isOpen ? 0 : "1.5rem" }}>
        <h3 className="text-[10px] uppercase tracking-[2px]" style={{ color: ACCENT }}>{title}</h3>
        <svg className="w-4 h-4 text-text-muted transition-transform duration-200" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="p-6 pt-4">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Structured Results
// ---------------------------------------------------------------------------
function StructuredResults({ data }: { data: StructuredOutput }) {
  return (
    <div className="space-y-4">
      {/* KPI Dashboard */}
      {data.kpi_dashboard?.length > 0 && (
        <CollapsibleSection title="KPI Dashboard">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.kpi_dashboard.map((kpi, i) => {
              const statusColor = STATUS_COLORS[kpi.status] || "#71717A";
              return (
                <div key={i} className="border border-border-default rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-[2px] text-text-muted">{kpi.name}</span>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
                  </div>
                  <div className="flex items-end gap-2 mb-1">
                    <span className="text-xl font-bold text-text-heading font-mono">{kpi.current_value}</span>
                    {kpi.change_percent !== undefined && (
                      <span className={`text-xs font-mono mb-0.5 ${kpi.trend === "up" ? "text-[#10B981]" : kpi.trend === "down" ? "text-[#EF4444]" : "text-text-muted"}`}>
                        {kpi.trend === "up" ? "+" : kpi.trend === "down" ? "" : ""}{kpi.change_percent}%
                      </span>
                    )}
                  </div>
                  {kpi.previous_value && (
                    <p className="text-[10px] text-text-dim mb-1">Previous: {kpi.previous_value}</p>
                  )}
                  {kpi.insight && (
                    <p className="text-xs text-text-secondary mt-2 border-t border-border-default pt-2">{kpi.insight}</p>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {/* Funnel Analysis */}
      {data.funnel_analysis?.stages?.length > 0 && (
        <CollapsibleSection title="Funnel Analysis">
          <div className="space-y-3">
            {/* Funnel Waterfall */}
            <div className="space-y-2">
              {data.funnel_analysis.stages.map((stage, i) => {
                const maxVol = Math.max(...data.funnel_analysis.stages.map(s => s.volume || 0));
                const pct = maxVol > 0 ? ((stage.volume || 0) / maxVol) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-heading w-28 shrink-0">{stage.name}</span>
                      <div className="flex-1 h-8 bg-white/[0.04] rounded-lg overflow-hidden">
                        <div className="h-full rounded-lg flex items-center px-3"
                          style={{ width: `${Math.max(pct, 5)}%`, backgroundColor: `${ACCENT}${Math.round(30 + (i / data.funnel_analysis.stages.length) * 50).toString(16)}` }}>
                          <span className="text-[10px] font-mono text-white whitespace-nowrap">
                            {(stage.volume || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-text-muted w-14 text-right shrink-0">{stage.conversion_rate}</span>
                    </div>
                    {stage.drop_off_reasons?.length > 0 && (
                      <div className="ml-32 mt-1 mb-2">
                        {stage.drop_off_reasons.map((r, j) => (
                          <span key={j} className="text-[10px] text-[#EF4444] mr-3">- {r}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="border border-border-default rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Overall Conversion</p>
                <p className="text-lg font-bold font-mono" style={{ color: ACCENT }}>{data.funnel_analysis.overall_conversion}</p>
              </div>
              <div className="border border-border-default rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Biggest Bottleneck</p>
                <p className="text-sm text-[#EF4444]">{data.funnel_analysis.biggest_bottleneck}</p>
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Win/Loss Summary */}
      {data.win_loss_summary && (
        <CollapsibleSection title="Win/Loss Summary">
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="border border-border-default rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Win Rate</p>
                <p className="text-xl font-bold font-mono text-[#10B981]">{data.win_loss_summary.win_rate}</p>
              </div>
              <div className="border border-border-default rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Total Deals</p>
                <p className="text-xl font-bold font-mono text-text-heading">{data.win_loss_summary.total_deals}</p>
              </div>
              <div className="border border-border-default rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Avg Won Deal</p>
                <p className="text-lg font-bold font-mono text-[#10B981]">{data.win_loss_summary.avg_deal_size_won}</p>
              </div>
              <div className="border border-border-default rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Avg Lost Deal</p>
                <p className="text-lg font-bold font-mono text-[#EF4444]">{data.win_loss_summary.avg_deal_size_lost}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[2px] text-[#10B981] mb-2">Top Win Reasons</p>
                <ul className="space-y-1">
                  {data.win_loss_summary.top_win_reasons?.map((r, i) => (
                    <li key={i} className="text-xs text-text-body flex items-start gap-2">
                      <span className="text-[#10B981] shrink-0">+</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[2px] text-[#EF4444] mb-2">Top Loss Reasons</p>
                <ul className="space-y-1">
                  {data.win_loss_summary.top_loss_reasons?.map((r, i) => (
                    <li key={i} className="text-xs text-text-body flex items-start gap-2">
                      <span className="text-[#EF4444] shrink-0">-</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {data.win_loss_summary.competitive_losses?.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Competitive Losses</p>
                <div className="space-y-2">
                  {data.win_loss_summary.competitive_losses.map((cl, i) => (
                    <div key={i} className="flex items-center gap-3 border border-border-default rounded-lg px-4 py-2">
                      <span className="text-sm font-medium text-text-heading w-32">{cl.competitor}</span>
                      <span className="text-xs font-mono text-[#EF4444]">{cl.losses} losses</span>
                      <span className="text-xs text-text-secondary flex-1">{cl.common_reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Churn Analysis */}
      {data.churn_analysis && (
        <CollapsibleSection title="Churn Analysis">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-border-default rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Churn Rate</p>
                <p className="text-xl font-bold font-mono text-[#EF4444]">{data.churn_analysis.churn_rate}</p>
                <span className="text-[10px] text-text-dim">{data.churn_analysis.churn_trend}</span>
              </div>
              <div className="border border-border-default rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">At-Risk Segments</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {data.churn_analysis.at_risk_segments?.map((s, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[#EF4444]/10 text-[#EF4444]">{s}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Top Churn Reasons</p>
                <ul className="space-y-1">
                  {data.churn_analysis.top_churn_reasons?.map((r, i) => (
                    <li key={i} className="text-xs text-text-body">- {r}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[2px] text-[#10B981] mb-2">Retention Recommendations</p>
                <ul className="space-y-1">
                  {data.churn_analysis.retention_recommendations?.map((r, i) => (
                    <li key={i} className="text-xs text-[#10B981]">+ {r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Recommendations */}
      {data.recommendations?.length > 0 && (
        <CollapsibleSection title="Recommendations">
          <div className="space-y-3">
            {data.recommendations.map((rec, i) => {
              const prioColor = PRIORITY_COLORS[rec.priority] || "#71717A";
              return (
                <div key={i} className="border border-border-default rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-mono"
                      style={{ backgroundColor: `${prioColor}15`, color: prioColor }}>
                      {rec.priority}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-text-dim">{rec.category}</span>
                    <h4 className="text-sm font-medium text-text-heading flex-1">{rec.title}</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <p className="text-[10px] text-text-muted">Impact: <span className="text-text-body">{rec.impact}</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] text-text-muted">Effort: <span className="text-text-body">{rec.effort}</span></p>
                    </div>
                  </div>
                  {rec.action_items?.length > 0 && (
                    <ul className="space-y-0.5 mt-2 pt-2 border-t border-border-default">
                      {rec.action_items.map((a, j) => (
                        <li key={j} className="text-xs text-text-body">- {a}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sources Used
// ---------------------------------------------------------------------------
function SourcesSection({ sources }: { sources: KnowledgeSource[] }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="bg-card-bg border border-border-default rounded-card overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-4 hover:bg-white/[0.01] transition-colors">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span className="text-[10px] uppercase tracking-[2px] text-text-muted">Sources Used</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono" style={{ backgroundColor: `${ACCENT}20`, color: ACCENT }}>{sources.length}</span>
        </div>
        <svg className="w-4 h-4 text-text-muted transition-transform duration-200" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 space-y-2">
          {sources.map(s => (
            <div key={s.id} className="border border-border-default rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-text-heading">{s.sourceDocument}</span>
                {s.sourceUrl && <span className="text-[10px] text-text-dim truncate max-w-xs">{s.sourceUrl}</span>}
              </div>
              <p className="text-xs text-text-secondary line-clamp-2">{s.content.slice(0, 200)}{s.content.length > 200 ? "..." : ""}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Run History
// ---------------------------------------------------------------------------
function RunHistorySection({ runs }: { runs: RunHistory[] }) {
  if (runs.length === 0) return null;
  return (
    <div className="bg-card-bg border border-border-default rounded-card p-6">
      <h3 className="text-[10px] uppercase tracking-[2px] mb-4" style={{ color: ACCENT }}>Run History</h3>
      <div className="space-y-2">
        {runs.map(run => {
          const input = run.input as Record<string, string> | null;
          return (
            <div key={run.id} className="flex items-center justify-between border border-border-default rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${run.status === "completed" ? "bg-[#6366F1]" : run.status === "failed" ? "bg-[#EF4444]" : "bg-[#F59E0B]"}`} />
                <span className="text-sm text-text-body truncate max-w-md">
                  {ANALYSIS_TYPES.find(t => t.value === input?.analysis_type)?.label || "Analysis"} — {input?.time_period || ""}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-text-muted">
                {run.tokensUsed && <span>{run.tokensUsed.toLocaleString()} tokens</span>}
                <span>{run.startedAt ? new Date(run.startedAt).toLocaleDateString() : ""}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
