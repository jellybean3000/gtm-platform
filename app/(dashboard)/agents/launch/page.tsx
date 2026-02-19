"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { DownloadButton } from "@/components/shared/DownloadButton";

const TEAM_ID = "00000000-0000-0000-0000-000000000001";
const ACCENT = "#EF4444";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TimelineTask {
  name: string;
  owner: string;
  due_date: string;
  status: string;
  dependencies: string[];
  priority: string;
}

interface TimelinePhase {
  phase: string;
  start_date: string;
  end_date: string;
  tasks: TimelineTask[];
}

interface ChannelStrategy {
  channel: string;
  objective: string;
  tactics: string[];
  timing: string;
  success_metric: string;
  content_needed: string[];
}

interface ChecklistItem {
  item: string;
  status: string;
  owner: string;
  notes: string;
}

interface ChecklistCategory {
  category: string;
  items: ChecklistItem[];
}

interface ReadinessGate {
  gate: string;
  criteria: string[];
  status: string;
  blockers: string[];
  owner: string;
}

interface Risk {
  risk: string;
  likelihood: string;
  impact: string;
  mitigation: string;
  contingency: string;
  owner: string;
}

interface StructuredOutput {
  timeline: TimelinePhase[];
  channel_strategy: ChannelStrategy[];
  launch_checklist: ChecklistCategory[];
  readiness_gates: ReadinessGate[];
  risk_register: Risk[];
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

const LAUNCH_TYPES = [
  { value: "new_product", label: "New Product" },
  { value: "feature_launch", label: "Feature Launch" },
  { value: "market_expansion", label: "Market Expansion" },
  { value: "rebrand", label: "Rebrand / Repositioning" },
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#EF4444",
  high: "#F59E0B",
  medium: "#6366F1",
  low: "#10B981",
};

const GATE_STATUS_COLORS: Record<string, string> = {
  met: "#10B981",
  partially_met: "#F59E0B",
  not_met: "#EF4444",
};

const RISK_LEVEL_COLORS: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#10B981",
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function LaunchPlanningPage() {
  const [productName, setProductName] = useState("");
  const [launchDate, setLaunchDate] = useState("");
  const [launchType, setLaunchType] = useState("new_product");
  const [targetChannels, setTargetChannels] = useState("");
  const [teamResources, setTeamResources] = useState("");
  const [includeUpstream, setIncludeUpstream] = useState(true);
  const [upstreamAvailable, setUpstreamAvailable] = useState(false);
  const [upstreamSummary, setUpstreamSummary] = useState("");

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
  const upstreamOutputRef = useRef<string | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/launch/runs?teamId=${TEAM_ID}`);
      if (res.ok) { const data = await res.json(); setRuns(data.runs || []); }
    } catch { /* ignore */ }
  }, []);

  const checkUpstream = useCallback(async () => {
    // Check for content, sales-enablement, or demand-gen outputs
    for (const slug of ["content", "sales-enablement", "demand-gen"]) {
      try {
        const res = await fetch(`/api/agents/launch/latest-upstream?teamId=${TEAM_ID}&slug=${slug}`);
        if (res.ok) {
          const data = await res.json();
          if (data.run) {
            setUpstreamAvailable(true);
            const output = data.run.output as { text?: string } | null;
            const existing = upstreamOutputRef.current || "";
            upstreamOutputRef.current = existing + `\n\n--- ${slug} output ---\n` + (output?.text || "");
            setUpstreamSummary(prev => prev ? `${prev}, ${slug}` : slug);
          }
        }
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => { fetchRuns(); checkUpstream(); }, [fetchRuns, checkUpstream]);
  useEffect(() => { if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight; }, [streamedText]);

  async function fetchSources(runId: string) {
    try {
      const res = await fetch(`/api/agents/launch/runs/${runId}`);
      if (res.ok) { const data = await res.json(); setSources(data.sources || []); }
    } catch { /* ignore */ }
  }

  async function handleRun() {
    if (!productName.trim()) return;
    setIsRunning(true); setStreamedText(""); setStructured(null); setError(null);
    setCurrentRunId(null); setSources([]); setSavedToKB(false);
    setProgressSteps([
      { label: "Querying knowledge base", status: "active" },
      { label: "Building launch plan", status: "pending" },
      { label: "Generating structured output", status: "pending" },
    ]);

    try {
      const input: Record<string, unknown> = {
        product_name: productName, launch_date: launchDate,
        launch_type: launchType, target_channels: targetChannels,
        team_resources: teamResources,
      };
      if (includeUpstream && upstreamOutputRef.current) {
        input.upstream_agent_outputs = upstreamOutputRef.current;
      }

      const res = await fetch("/api/agents/launch", {
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
      const res = await fetch("/api/agents/launch/save-to-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: TEAM_ID, runId: currentRunId,
          title: `Launch Plan: ${productName}`,
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
          <h1 className="text-2xl font-bold text-text-heading font-display">Launch Planning Agent</h1>
        </div>
        <p className="text-text-secondary text-sm">
          Build launch timelines, channel strategies, checklists, readiness gates, and risk registers.
        </p>
      </div>

      {/* Input Form */}
      <div className="bg-card-bg border border-border-default rounded-card p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Product Name</label>
            <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g., Acme Analytics Pro"
              className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#EF4444]/40 transition-colors" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Launch Date</label>
            <input type="text" value={launchDate} onChange={(e) => setLaunchDate(e.target.value)}
              placeholder="e.g., March 15, 2026"
              className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#EF4444]/40 transition-colors" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Launch Type</label>
            <select value={launchType} onChange={(e) => setLaunchType(e.target.value)}
              className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#EF4444]/40 transition-colors">
              {LAUNCH_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Target Channels</label>
            <input type="text" value={targetChannels} onChange={(e) => setTargetChannels(e.target.value)}
              placeholder="e.g., Product Hunt, email, LinkedIn, webinar, press, partners"
              className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#EF4444]/40 transition-colors" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Team Resources</label>
            <input type="text" value={teamResources} onChange={(e) => setTeamResources(e.target.value)}
              placeholder="e.g., 2 PMMs, 1 content writer, 1 designer, engineering support"
              className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#EF4444]/40 transition-colors" />
          </div>
        </div>

        {/* Upstream Toggle */}
        <div className="max-w-md">
          <button onClick={() => upstreamAvailable && setIncludeUpstream(!includeUpstream)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm text-left transition-colors ${
              !upstreamAvailable ? "border-border-default text-text-dim cursor-not-allowed"
                : includeUpstream ? "border-[#EF4444]/40 text-text-heading"
                  : "border-border-default text-text-secondary hover:border-[#EF4444]/20"}`}>
            <div className={`w-8 h-5 rounded-full relative transition-colors shrink-0 ${
              includeUpstream && upstreamAvailable ? "bg-[#EF4444]" : "bg-white/[0.08]"}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                includeUpstream && upstreamAvailable ? "translate-x-3.5" : "translate-x-0.5"}`} />
            </div>
            <div>
              <span className="block">Include Upstream Agent Outputs</span>
              <span className="text-[10px] text-text-dim">
                {upstreamAvailable ? `Available: ${upstreamSummary}` : "No upstream agent runs yet"}
              </span>
            </div>
          </button>
        </div>

        <button onClick={handleRun} disabled={isRunning || !productName.trim()}
          className="px-6 py-2.5 text-white font-medium text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ backgroundColor: ACCENT }}>
          {isRunning ? "Planning..." : "Generate Launch Plan"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[#EF4444] text-sm font-medium">Planning Failed</p>
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
                  <svg className="w-4 h-4 text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.status === "active" ? (
                  <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: `${ACCENT} transparent ${ACCENT} ${ACCENT}` }} />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-border-default" />
                )}
                <span className={`text-xs ${step.status === "active" ? "text-text-heading font-medium" : step.status === "done" ? "text-[#EF4444]" : "text-text-dim"}`}>
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
            {isRunning ? "Planning..." : "Raw Output"}
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
              style={{ borderColor: savedToKB ? "#EF4444" : `${ACCENT}40`, color: savedToKB ? "#EF4444" : ACCENT, backgroundColor: savedToKB ? "rgba(239,68,68,0.1)" : "transparent" }}>
              {savedToKB ? "Saved to Knowledge Base" : isSaving ? "Saving..." : "Save to Knowledge Base"}
            </button>
            <DownloadButton
              content={JSON.stringify(structured, null, 2)}
              filename="launch-plan"
              formats={["json", "md"]}
              accentColor={ACCENT}
            />
            {savedToKB && <span className="text-xs text-[#EF4444]">Launch plan saved to knowledge base.</span>}
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
      {/* Timeline (Gantt-style) */}
      {data.timeline?.length > 0 && (
        <CollapsibleSection title="Launch Timeline">
          <div className="space-y-6">
            {data.timeline.map((phase, i) => (
              <div key={i}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ACCENT, opacity: 1 - i * 0.15 }} />
                  <h4 className="text-sm font-semibold text-text-heading">{phase.phase}</h4>
                  <span className="text-[10px] text-text-dim font-mono">{phase.start_date} → {phase.end_date}</span>
                </div>
                <div className="ml-6 space-y-1.5">
                  {phase.tasks?.map((task, j) => {
                    const prioColor = PRIORITY_COLORS[task.priority] || "#71717A";
                    const statusIcon = task.status === "completed" ? "bg-[#10B981]"
                      : task.status === "in_progress" ? "bg-[#F59E0B]"
                      : "bg-white/[0.1]";
                    return (
                      <div key={j} className="flex items-center gap-3 border border-border-default rounded-lg px-4 py-2">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusIcon}`} />
                        <span className="text-xs text-text-body flex-1">{task.name}</span>
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono shrink-0"
                          style={{ backgroundColor: `${prioColor}15`, color: prioColor }}>
                          {task.priority}
                        </span>
                        <span className="text-[10px] text-text-dim w-20 text-right shrink-0">{task.owner}</span>
                        <span className="text-[10px] font-mono text-text-dim w-20 text-right shrink-0">{task.due_date}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Channel Strategy */}
      {data.channel_strategy?.length > 0 && (
        <CollapsibleSection title="Channel Strategy">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.channel_strategy.map((ch, i) => (
              <div key={i} className="border border-border-default rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-sm font-semibold text-text-heading">{ch.channel}</h4>
                  <span className="text-[10px] text-text-dim ml-auto">{ch.timing}</span>
                </div>
                <p className="text-xs text-text-body mb-2">{ch.objective}</p>
                {ch.tactics?.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] text-text-muted mb-1">Tactics:</p>
                    <ul className="space-y-0.5">{ch.tactics.map((t, j) => <li key={j} className="text-xs text-text-body">- {t}</li>)}</ul>
                  </div>
                )}
                <p className="text-[10px] text-text-dim">Success: {ch.success_metric}</p>
                {ch.content_needed?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {ch.content_needed.map((c, j) => (
                      <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-[#EF4444]/10 text-[#EF4444]">{c}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Launch Checklist */}
      {data.launch_checklist?.length > 0 && (
        <CollapsibleSection title="Launch Checklist">
          <div className="space-y-4">
            {data.launch_checklist.map((cat, i) => (
              <div key={i}>
                <h4 className="text-xs font-semibold text-text-heading mb-2">{cat.category}</h4>
                <div className="space-y-1">
                  {cat.items?.map((item, j) => {
                    const checked = item.status === "completed";
                    const inProg = item.status === "in_progress";
                    return (
                      <div key={j} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border-default">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                          checked ? "bg-[#10B981] border-[#10B981]" : inProg ? "border-[#F59E0B]" : "border-border-default"}`}>
                          {checked && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {inProg && <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />}
                        </div>
                        <span className={`text-xs flex-1 ${checked ? "text-text-muted line-through" : "text-text-body"}`}>{item.item}</span>
                        <span className="text-[10px] text-text-dim w-20 text-right">{item.owner}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Readiness Gates */}
      {data.readiness_gates?.length > 0 && (
        <CollapsibleSection title="Readiness Gates">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.readiness_gates.map((gate, i) => {
              const gateColor = GATE_STATUS_COLORS[gate.status] || "#71717A";
              return (
                <div key={i} className="border rounded-lg p-4" style={{ borderColor: `${gateColor}30` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: gateColor, boxShadow: `0 0 8px ${gateColor}40` }} />
                    <h4 className="text-sm font-medium text-text-heading">{gate.gate}</h4>
                    <span className="text-[10px] uppercase tracking-wider ml-auto" style={{ color: gateColor }}>
                      {gate.status?.replace(/_/g, " ")}
                    </span>
                  </div>
                  <ul className="space-y-0.5 mb-2">
                    {gate.criteria?.map((c, j) => (
                      <li key={j} className="text-xs text-text-body">- {c}</li>
                    ))}
                  </ul>
                  {gate.blockers?.length > 0 && gate.blockers[0] && (
                    <div className="mt-2 pt-2 border-t border-border-default">
                      <p className="text-[10px] text-[#EF4444]">Blockers: {gate.blockers.join(", ")}</p>
                    </div>
                  )}
                  <p className="text-[10px] text-text-dim mt-1">Owner: {gate.owner}</p>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {/* Risk Register */}
      {data.risk_register?.length > 0 && (
        <CollapsibleSection title="Risk Register">
          <div className="space-y-3">
            {data.risk_register.map((risk, i) => {
              const likColor = RISK_LEVEL_COLORS[risk.likelihood] || "#71717A";
              const impColor = RISK_LEVEL_COLORS[risk.impact] || "#71717A";
              return (
                <RiskCard key={i} risk={risk} likColor={likColor} impColor={impColor} />
              );
            })}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risk Card (expandable)
// ---------------------------------------------------------------------------
function RiskCard({ risk, likColor, impColor }: { risk: Risk; likColor: string; impColor: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border border-border-default rounded-lg overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.01] transition-colors">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono"
            style={{ backgroundColor: `${likColor}15`, color: likColor }}>
            L:{risk.likelihood}
          </span>
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono"
            style={{ backgroundColor: `${impColor}15`, color: impColor }}>
            I:{risk.impact}
          </span>
        </div>
        <span className="text-sm text-text-heading font-medium flex-1">{risk.risk}</span>
        <span className="text-[10px] text-text-dim shrink-0">{risk.owner}</span>
        <svg className="w-4 h-4 text-text-muted transition-transform duration-200 shrink-0" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 space-y-2">
          <div>
            <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Mitigation</p>
            <p className="text-xs text-text-body">{risk.mitigation}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Contingency</p>
            <p className="text-xs text-text-body">{risk.contingency}</p>
          </div>
        </div>
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
                <span className={`w-2 h-2 rounded-full ${run.status === "completed" ? "bg-[#EF4444]" : run.status === "failed" ? "bg-[#EF4444]/50" : "bg-[#F59E0B]"}`} />
                <span className="text-sm text-text-body truncate max-w-md">
                  {input?.product_name || "Launch plan"} — {LAUNCH_TYPES.find(t => t.value === input?.launch_type)?.label || ""}
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
