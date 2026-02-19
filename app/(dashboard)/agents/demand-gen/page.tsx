"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { DownloadButton } from "@/components/shared/DownloadButton";

const TEAM_ID = "00000000-0000-0000-0000-000000000001";
const ACCENT = "#EC4899";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface BudgetAllocation {
  channel: string;
  percentage: number;
  rationale: string;
}

interface CampaignStrategy {
  name: string;
  objective: string;
  target_audience: string;
  channels: string[];
  budget_allocation: BudgetAllocation[];
  timeline: string;
  kpis: string[];
}

interface LandingPageSection {
  type: string;
  content: string;
}

interface LandingPage {
  name: string;
  url_slug: string;
  headline: string;
  subheadline: string;
  hero_cta: string;
  sections: LandingPageSection[];
  target_persona: string;
}

interface AdCreative {
  platform: string;
  format: string;
  headline: string;
  body: string;
  cta: string;
  targeting: string;
  variations: string[];
}

interface EventPlan {
  name: string;
  type: string;
  description: string;
  target_attendance: number;
  promotion_plan: string;
  content_outline: string[];
  follow_up: string;
}

interface FunnelStage {
  name: string;
  volume: number;
  conversion_rate: string;
  assumptions: string;
}

interface FunnelProjections {
  stages: FunnelStage[];
  projected_roi: string;
  time_to_impact: string;
}

interface StructuredOutput {
  campaign_strategy: CampaignStrategy;
  landing_pages: LandingPage[];
  ad_creative: AdCreative[];
  event_plans: EventPlan[];
  funnel_projections: FunnelProjections;
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

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function DemandGenPage() {
  const [campaignGoals, setCampaignGoals] = useState("");
  const [targetPersonas, setTargetPersonas] = useState("");
  const [budget, setBudget] = useState("");
  const [existingChannels, setExistingChannels] = useState("");
  const [timeline, setTimeline] = useState("");
  const [includePositioning, setIncludePositioning] = useState(true);
  const [positioningAvailable, setPositioningAvailable] = useState(false);
  const [positioningSummary, setPositioningSummary] = useState("");

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
  const positioningOutputRef = useRef<string | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/demand-gen/runs?teamId=${TEAM_ID}`);
      if (res.ok) { const data = await res.json(); setRuns(data.runs || []); }
    } catch { /* ignore */ }
  }, []);

  const checkPositioning = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/demand-gen/latest-positioning?teamId=${TEAM_ID}`);
      if (res.ok) {
        const data = await res.json();
        if (data.run) {
          setPositioningAvailable(true);
          const input = data.run.input as Record<string, string> | null;
          const output = data.run.output as { text?: string } | null;
          positioningOutputRef.current = output?.text || null;
          setPositioningSummary(input?.product_capabilities?.slice(0, 50) || "Positioning available");
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchRuns(); checkPositioning(); }, [fetchRuns, checkPositioning]);
  useEffect(() => { if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight; }, [streamedText]);

  async function fetchSources(runId: string) {
    try {
      const res = await fetch(`/api/agents/demand-gen/runs/${runId}`);
      if (res.ok) { const data = await res.json(); setSources(data.sources || []); }
    } catch { /* ignore */ }
  }

  async function handleRun() {
    if (!campaignGoals.trim()) return;
    setIsRunning(true); setStreamedText(""); setStructured(null); setError(null);
    setCurrentRunId(null); setSources([]); setSavedToKB(false);
    setProgressSteps([
      { label: "Querying knowledge base", status: "active" },
      { label: "Building campaign strategy", status: "pending" },
      { label: "Generating structured output", status: "pending" },
    ]);

    try {
      const input: Record<string, unknown> = {
        campaign_goals: campaignGoals, target_personas: targetPersonas,
        budget, existing_channels: existingChannels, timeline,
      };
      if (includePositioning && positioningOutputRef.current) {
        input.positioning_context = positioningOutputRef.current;
      }

      const res = await fetch("/api/agents/demand-gen", {
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
      const res = await fetch("/api/agents/demand-gen/save-to-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: TEAM_ID, runId: currentRunId,
          title: `Demand Gen: ${structured?.campaign_strategy?.name || "Campaign Strategy"}`,
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
          <h1 className="text-2xl font-bold text-text-heading font-display">Demand Generation Agent</h1>
        </div>
        <p className="text-text-secondary text-sm">
          Build campaign strategies, landing page copy, ad creative, event plans, and funnel projections.
        </p>
      </div>

      {/* Input Form */}
      <div className="bg-card-bg border border-border-default rounded-card p-6 space-y-4">
        <div>
          <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Campaign Goals</label>
          <textarea value={campaignGoals} onChange={(e) => setCampaignGoals(e.target.value)}
            placeholder="e.g., Generate 500 MQLs in Q2, increase brand awareness in enterprise segment..."
            rows={2}
            className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#EC4899]/40 transition-colors resize-none" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Target Personas</label>
            <input type="text" value={targetPersonas} onChange={(e) => setTargetPersonas(e.target.value)}
              placeholder="e.g., VP Engineering, CTO, Head of Product"
              className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#EC4899]/40 transition-colors" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Budget</label>
            <input type="text" value={budget} onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g., $50,000/quarter"
              className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#EC4899]/40 transition-colors" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Existing Channels</label>
            <input type="text" value={existingChannels} onChange={(e) => setExistingChannels(e.target.value)}
              placeholder="e.g., LinkedIn, Google Ads, Email, Blog, Webinars"
              className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#EC4899]/40 transition-colors" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Timeline</label>
            <input type="text" value={timeline} onChange={(e) => setTimeline(e.target.value)}
              placeholder="e.g., Q2 2026, Next 90 days"
              className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#EC4899]/40 transition-colors" />
          </div>
        </div>

        {/* Positioning Toggle */}
        <div className="max-w-md">
          <button onClick={() => positioningAvailable && setIncludePositioning(!includePositioning)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm text-left transition-colors ${
              !positioningAvailable ? "border-border-default text-text-dim cursor-not-allowed"
                : includePositioning ? "border-[#EC4899]/40 text-text-heading"
                  : "border-border-default text-text-secondary hover:border-[#EC4899]/20"}`}>
            <div className={`w-8 h-5 rounded-full relative transition-colors shrink-0 ${
              includePositioning && positioningAvailable ? "bg-[#EC4899]" : "bg-white/[0.08]"}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                includePositioning && positioningAvailable ? "translate-x-3.5" : "translate-x-0.5"}`} />
            </div>
            <div>
              <span className="block">Include Latest Positioning</span>
              <span className="text-[10px] text-text-dim">
                {positioningAvailable ? `${positioningSummary}...` : "No positioning runs yet"}
              </span>
            </div>
          </button>
        </div>

        <button onClick={handleRun} disabled={isRunning || !campaignGoals.trim()}
          className="px-6 py-2.5 text-white font-medium text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ backgroundColor: ACCENT }}>
          {isRunning ? "Generating..." : "Generate Campaign Strategy"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[#EF4444] text-sm font-medium">Generation Failed</p>
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
                  <svg className="w-4 h-4 text-[#EC4899]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.status === "active" ? (
                  <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: `${ACCENT} transparent ${ACCENT} ${ACCENT}` }} />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-border-default" />
                )}
                <span className={`text-xs ${step.status === "active" ? "text-text-heading font-medium" : step.status === "done" ? "text-[#EC4899]" : "text-text-dim"}`}>
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
            {isRunning ? "Generating..." : "Raw Output"}
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
              style={{ borderColor: savedToKB ? "#EC4899" : `${ACCENT}40`, color: savedToKB ? "#EC4899" : ACCENT, backgroundColor: savedToKB ? "rgba(236,72,153,0.1)" : "transparent" }}>
              {savedToKB ? "Saved to Knowledge Base" : isSaving ? "Saving..." : "Save to Knowledge Base"}
            </button>
            <DownloadButton
              content={JSON.stringify(structured, null, 2)}
              filename="demand-gen"
              formats={["json", "md"]}
              accentColor={ACCENT}
            />
            {savedToKB && <span className="text-xs text-[#EC4899]">Other agents can now reference this strategy.</span>}
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
      {/* Campaign Strategy */}
      {data.campaign_strategy && (
        <CollapsibleSection title="Campaign Strategy">
          <div className="space-y-4">
            <div className="border border-[#EC4899]/20 rounded-lg p-4 bg-[#EC4899]/[0.03]">
              <h4 className="text-lg font-semibold text-text-heading mb-1">{data.campaign_strategy.name}</h4>
              <p className="text-sm text-text-body">{data.campaign_strategy.objective}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Audience</p>
                  <p className="text-xs text-text-body">{data.campaign_strategy.target_audience}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Timeline</p>
                  <p className="text-xs text-text-body">{data.campaign_strategy.timeline}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Channels</p>
                  <div className="flex flex-wrap gap-1">
                    {data.campaign_strategy.channels?.map((ch, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[#EC4899]/10 text-[#EC4899]">{ch}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Budget Allocation */}
            {data.campaign_strategy.budget_allocation?.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Budget Allocation</p>
                <div className="space-y-2">
                  {data.campaign_strategy.budget_allocation.map((alloc, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-text-heading w-24 shrink-0">{alloc.channel}</span>
                      <div className="flex-1 h-6 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full rounded-full flex items-center px-2"
                          style={{ width: `${Math.min(alloc.percentage, 100)}%`, backgroundColor: `${ACCENT}40` }}>
                          <span className="text-[10px] font-mono text-white whitespace-nowrap">{alloc.percentage}%</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-text-dim w-48 shrink-0 hidden md:block">{alloc.rationale}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* KPIs */}
            {data.campaign_strategy.kpis?.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Key Performance Indicators</p>
                <div className="flex flex-wrap gap-2">
                  {data.campaign_strategy.kpis.map((kpi, i) => (
                    <span key={i} className="text-xs px-3 py-1.5 rounded-lg border border-border-default text-text-body">{kpi}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Landing Pages */}
      {data.landing_pages?.length > 0 && (
        <CollapsibleSection title="Landing Pages">
          <div className="space-y-4">
            {data.landing_pages.map((lp, i) => (
              <div key={i} className="border border-border-default rounded-lg overflow-hidden">
                <div className="bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#EC4899]/10 text-[#EC4899]">{lp.url_slug}</span>
                    {lp.target_persona && <span className="text-[10px] text-text-dim">for {lp.target_persona}</span>}
                  </div>
                  <h4 className="text-lg font-bold text-text-heading">{lp.headline}</h4>
                  <p className="text-sm text-text-secondary mt-1">{lp.subheadline}</p>
                  <div className="mt-3">
                    <span className="inline-block px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: ACCENT }}>
                      {lp.hero_cta}
                    </span>
                  </div>
                </div>
                {lp.sections?.length > 0 && (
                  <div className="p-4 border-t border-border-default">
                    <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Page Sections</p>
                    <div className="space-y-1">
                      {lp.sections.map((sec, j) => (
                        <div key={j} className="flex items-start gap-2">
                          <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/[0.04] text-text-dim shrink-0">{sec.type}</span>
                          <span className="text-xs text-text-body">{sec.content}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Ad Creative */}
      {data.ad_creative?.length > 0 && (
        <CollapsibleSection title="Ad Creative">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.ad_creative.map((ad, i) => (
              <div key={i} className="border border-border-default rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#EC4899]/10 text-[#EC4899]">{ad.platform}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-text-dim">{ad.format}</span>
                </div>
                <h4 className="text-sm font-semibold text-text-heading mb-1">{ad.headline}</h4>
                <p className="text-xs text-text-body mb-2">{ad.body}</p>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] px-3 py-1 rounded-full text-white font-medium" style={{ backgroundColor: ACCENT }}>{ad.cta}</span>
                </div>
                <p className="text-[10px] text-text-dim">Targeting: {ad.targeting}</p>
                {ad.variations?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border-default">
                    <p className="text-[10px] text-text-muted mb-1">Variations:</p>
                    {ad.variations.map((v, j) => (
                      <p key={j} className="text-[10px] text-text-secondary">- {v}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Event Plans */}
      {data.event_plans?.length > 0 && (
        <CollapsibleSection title="Event Plans">
          <div className="space-y-3">
            {data.event_plans.map((ev, i) => (
              <div key={i} className="border border-border-default rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-sm font-semibold text-text-heading">{ev.name}</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EC4899]/10 text-[#EC4899]">{ev.type}</span>
                  <span className="text-[10px] text-text-dim ml-auto">Target: {ev.target_attendance} attendees</span>
                </div>
                <p className="text-xs text-text-body mb-2">{ev.description}</p>
                {ev.content_outline?.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] text-text-muted mb-1">Content Outline:</p>
                    <ul className="space-y-0.5">{ev.content_outline.map((c, j) => <li key={j} className="text-xs text-text-body">- {c}</li>)}</ul>
                  </div>
                )}
                <p className="text-[10px] text-text-dim">Promotion: {ev.promotion_plan}</p>
                <p className="text-[10px] text-text-dim">Follow-up: {ev.follow_up}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Funnel Projections */}
      {data.funnel_projections?.stages?.length > 0 && (
        <CollapsibleSection title="Funnel Projections">
          <div className="space-y-3">
            {/* Funnel Waterfall */}
            <div className="space-y-2">
              {data.funnel_projections.stages.map((stage, i) => {
                const maxVolume = Math.max(...data.funnel_projections.stages.map(s => s.volume || 0));
                const pct = maxVolume > 0 ? ((stage.volume || 0) / maxVolume) * 100 : 0;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-text-heading w-32 shrink-0">{stage.name}</span>
                    <div className="flex-1 h-8 bg-white/[0.04] rounded-lg overflow-hidden">
                      <div className="h-full rounded-lg flex items-center px-3 transition-all duration-500"
                        style={{ width: `${Math.max(pct, 5)}%`, backgroundColor: `${ACCENT}${Math.round(30 + (i / data.funnel_projections.stages.length) * 40).toString(16)}` }}>
                        <span className="text-[10px] font-mono text-white whitespace-nowrap">
                          {(stage.volume || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-text-muted w-16 text-right shrink-0">{stage.conversion_rate}</span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="border border-border-default rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Projected ROI</p>
                <p className="text-sm text-text-heading font-medium">{data.funnel_projections.projected_roi}</p>
              </div>
              <div className="border border-border-default rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Time to Impact</p>
                <p className="text-sm text-text-heading font-medium">{data.funnel_projections.time_to_impact}</p>
              </div>
            </div>
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
                <span className={`w-2 h-2 rounded-full ${run.status === "completed" ? "bg-[#EC4899]" : run.status === "failed" ? "bg-[#EF4444]" : "bg-[#F59E0B]"}`} />
                <span className="text-sm text-text-body truncate max-w-md">
                  {input?.campaign_goals?.slice(0, 60) || "Campaign strategy"}
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
