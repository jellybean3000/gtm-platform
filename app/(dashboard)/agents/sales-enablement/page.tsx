"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { DownloadButton } from "@/components/shared/DownloadButton";

const TEAM_ID = "00000000-0000-0000-0000-000000000001";
const ACCENT = "#10B981";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Objection {
  objection: string;
  category: string;
  what_they_mean: string;
  response: string;
  evidence: string[];
  follow_up: string;
}

interface EmailStep {
  step: number;
  subject: string;
  body: string;
  send_timing: string;
  purpose: string;
}

interface EmailSequence {
  name: string;
  target_persona: string;
  emails: EmailStep[];
}

interface DemoStep {
  step: number;
  name: string;
  duration: string;
  talking_points: string[];
  demo_actions: string[];
  transition: string;
  if_objection: string;
}

interface DemoScript {
  title: string;
  duration_minutes: number;
  steps: DemoStep[];
}

interface QualCriterion {
  criterion: string;
  questions: string[];
  green_flags: string[];
  red_flags: string[];
  scoring: string;
}

interface QualFramework {
  name: string;
  criteria: QualCriterion[];
}

interface ROIInput {
  name: string;
  type: string;
  default_value: number;
  description: string;
}

interface ROICalc {
  name: string;
  formula: string;
  unit: string;
}

interface ROICalculator {
  title: string;
  inputs: ROIInput[];
  calculations: ROICalc[];
  assumptions: string[];
}

interface TalkTrack {
  scenario: string;
  opening: string;
  key_questions: string[];
  value_statements: string[];
  closing: string;
}

interface StructuredOutput {
  objection_playbook: Objection[];
  email_sequences: EmailSequence[];
  demo_script: DemoScript;
  qualification_framework: QualFramework;
  roi_calculator: ROICalculator;
  talk_tracks: TalkTrack[];
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

const OUTPUT_TYPES = [
  { value: "objection_playbook", label: "Objection Playbook" },
  { value: "demo_script", label: "Demo Script" },
  { value: "email_sequence", label: "Email Sequence" },
  { value: "qualification_criteria", label: "Qualification Framework" },
  { value: "roi_calculator", label: "ROI Calculator" },
  { value: "talk_track", label: "Talk Track" },
];

const OBJECTION_CATEGORIES: Record<string, string> = {
  price: "#EF4444",
  timing: "#F59E0B",
  competition: "#8B5CF6",
  need: "#0EA5E9",
  authority: "#EC4899",
  trust: "#6366F1",
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function SalesEnablementPage() {
  const [outputType, setOutputType] = useState("objection_playbook");
  const [targetPersona, setTargetPersona] = useState("");
  const [knownObjections, setKnownObjections] = useState("");
  const [salesProcess, setSalesProcess] = useState("");
  const [includePositioning, setIncludePositioning] = useState(true);
  const [positioningAvailable, setPositioningAvailable] = useState(false);
  const [positioningSummary, setPositioningSummary] = useState("");
  const [includeCrmContext, setIncludeCrmContext] = useState(false);
  const [crmAvailable, setCrmAvailable] = useState(false);
  const [crmSummary, setCrmSummary] = useState("");

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
  const [objectionSearch, setObjectionSearch] = useState("");

  const outputRef = useRef<HTMLDivElement>(null);
  const positioningOutputRef = useRef<string | null>(null);
  const crmDataRef = useRef<string | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/sales-enablement/runs?teamId=${TEAM_ID}`);
      if (res.ok) { const data = await res.json(); setRuns(data.runs || []); }
    } catch { /* ignore */ }
  }, []);

  const checkPositioning = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/sales-enablement/latest-positioning?teamId=${TEAM_ID}`);
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

  const checkCrmContext = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/context");
      if (res.ok) {
        const data = await res.json();
        if (data.available) {
          setCrmAvailable(true);
          setCrmSummary(data.summary);
          crmDataRef.current = data.activitiesSummary || null;
          setIncludeCrmContext(true);
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchRuns(); checkPositioning(); checkCrmContext(); }, [fetchRuns, checkPositioning, checkCrmContext]);
  useEffect(() => { if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight; }, [streamedText]);

  async function fetchSources(runId: string) {
    try {
      const res = await fetch(`/api/agents/sales-enablement/runs/${runId}`);
      if (res.ok) { const data = await res.json(); setSources(data.sources || []); }
    } catch { /* ignore */ }
  }

  async function handleRun() {
    if (!targetPersona.trim()) return;
    setIsRunning(true); setStreamedText(""); setStructured(null); setError(null);
    setCurrentRunId(null); setSources([]); setSavedToKB(false);
    setProgressSteps([
      { label: "Querying knowledge base", status: "active" },
      { label: "Building sales materials", status: "pending" },
      { label: "Generating structured output", status: "pending" },
    ]);

    try {
      const input: Record<string, unknown> = {
        output_type: outputType, target_persona: targetPersona,
        known_objections: knownObjections, sales_process: salesProcess,
      };
      if (includePositioning && positioningOutputRef.current) {
        input.positioning_context = positioningOutputRef.current;
      }
      if (includeCrmContext && crmDataRef.current) {
        input.crm_context = crmDataRef.current;
      }

      const res = await fetch("/api/agents/sales-enablement", {
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
      const res = await fetch("/api/agents/sales-enablement/save-to-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: TEAM_ID, runId: currentRunId,
          title: `Sales Enablement: ${OUTPUT_TYPES.find(t => t.value === outputType)?.label}`,
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
          <h1 className="text-2xl font-bold text-text-heading font-display">Sales Enablement Agent</h1>
        </div>
        <p className="text-text-secondary text-sm">
          Build objection playbooks, demo scripts, email sequences, qualification frameworks, and ROI calculators.
        </p>
      </div>

      {/* Input Form */}
      <div className="bg-card-bg border border-border-default rounded-card p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">What to Generate</label>
            <select value={outputType} onChange={(e) => setOutputType(e.target.value)}
              className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#10B981]/40 transition-colors">
              {OUTPUT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Target Persona</label>
            <input type="text" value={targetPersona} onChange={(e) => setTargetPersona(e.target.value)}
              placeholder="e.g., VP Engineering, CTO, Head of Product"
              className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#10B981]/40 transition-colors" />
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Known Objections</label>
          <textarea value={knownObjections} onChange={(e) => setKnownObjections(e.target.value)}
            placeholder='e.g., "Too expensive", "We already have a solution", "Not a priority right now"...'
            rows={2}
            className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#10B981]/40 transition-colors resize-none" />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Sales Process Description</label>
          <textarea value={salesProcess} onChange={(e) => setSalesProcess(e.target.value)}
            placeholder="Describe your sales motion: inbound/outbound, deal size, cycle length, key stakeholders..."
            rows={2}
            className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#10B981]/40 transition-colors resize-none" />
        </div>

        {/* Context Toggles */}
        <div className="flex gap-3 flex-wrap">
          <div className="max-w-md flex-1">
            <button onClick={() => positioningAvailable && setIncludePositioning(!includePositioning)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                !positioningAvailable ? "border-border-default text-text-dim cursor-not-allowed"
                  : includePositioning ? "border-[#10B981]/40 text-text-heading"
                    : "border-border-default text-text-secondary hover:border-[#10B981]/20"}`}>
              <div className={`w-8 h-5 rounded-full relative transition-colors shrink-0 ${
                includePositioning && positioningAvailable ? "bg-[#10B981]" : "bg-white/[0.08]"}`}>
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
          <div className="max-w-md flex-1">
            <button onClick={() => crmAvailable && setIncludeCrmContext(!includeCrmContext)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                !crmAvailable ? "border-border-default text-text-dim cursor-not-allowed"
                  : includeCrmContext ? "border-[#F97316]/40 text-text-heading"
                    : "border-border-default text-text-secondary hover:border-[#F97316]/20"}`}>
              <div className={`w-8 h-5 rounded-full relative transition-colors shrink-0 ${
                includeCrmContext && crmAvailable ? "bg-[#F97316]" : "bg-white/[0.08]"}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  includeCrmContext && crmAvailable ? "translate-x-3.5" : "translate-x-0.5"}`} />
              </div>
              <div>
                <span className="block">CRM Objections</span>
                <span className="text-[10px] text-text-dim">
                  {crmAvailable ? crmSummary : "No CRM data synced yet"}
                </span>
              </div>
            </button>
          </div>
        </div>

        <button onClick={handleRun} disabled={isRunning || !targetPersona.trim()}
          className="px-6 py-2.5 text-white font-medium text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ backgroundColor: ACCENT }}>
          {isRunning ? "Generating..." : `Generate ${OUTPUT_TYPES.find(t => t.value === outputType)?.label}`}
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
                  <svg className="w-4 h-4 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.status === "active" ? (
                  <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: `${ACCENT} transparent ${ACCENT} ${ACCENT}` }} />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-border-default" />
                )}
                <span className={`text-xs ${step.status === "active" ? "text-text-heading font-medium" : step.status === "done" ? "text-[#10B981]" : "text-text-dim"}`}>
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
          <StructuredResults data={structured} objectionSearch={objectionSearch} setObjectionSearch={setObjectionSearch} />

          <div className="flex items-center gap-3">
            <button onClick={handleSaveToKnowledge} disabled={isSaving || savedToKB}
              className="px-5 py-2.5 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor: savedToKB ? "#10B981" : `${ACCENT}40`, color: savedToKB ? "#10B981" : ACCENT, backgroundColor: savedToKB ? "rgba(16,185,129,0.1)" : "transparent" }}>
              {savedToKB ? "Saved to Knowledge Base" : isSaving ? "Saving..." : "Save to Knowledge Base"}
            </button>
            <DownloadButton
              content={JSON.stringify(structured, null, 2)}
              filename="sales-enablement"
              formats={["json", "md"]}
              accentColor={ACCENT}
            />
            {savedToKB && <span className="text-xs text-[#10B981]">Other agents can now reference these materials.</span>}
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
function StructuredResults({ data, objectionSearch, setObjectionSearch }: { data: StructuredOutput; objectionSearch: string; setObjectionSearch: (s: string) => void }) {
  return (
    <div className="space-y-4">
      {/* Objection Playbook */}
      {data.objection_playbook?.length > 0 && (
        <CollapsibleSection title="Objection Playbook">
          <input type="text" value={objectionSearch} onChange={(e) => setObjectionSearch(e.target.value)}
            placeholder="Search objections..."
            className="w-full bg-background border border-border-default rounded-lg px-4 py-2 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#10B981]/40 transition-colors mb-4" />
          <div className="space-y-3">
            {data.objection_playbook
              .filter(o => !objectionSearch || o.objection.toLowerCase().includes(objectionSearch.toLowerCase()) || o.category?.toLowerCase().includes(objectionSearch.toLowerCase()))
              .map((obj, i) => (
                <ObjectionCard key={i} objection={obj} />
              ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Email Sequences */}
      {data.email_sequences?.length > 0 && (
        <CollapsibleSection title="Email Sequences">
          <div className="space-y-6">
            {data.email_sequences.map((seq, i) => (
              <div key={i}>
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="text-sm font-semibold text-text-heading">{seq.name}</h4>
                  {seq.target_persona && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-text-muted">{seq.target_persona}</span>
                  )}
                </div>
                <div className="space-y-3">
                  {seq.emails?.map((email, j) => (
                    <div key={j} className="border border-border-default rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ backgroundColor: `${ACCENT}15`, color: ACCENT }}>
                          Step {email.step}
                        </span>
                        <span className="text-[10px] text-text-dim">{email.send_timing}</span>
                        {email.purpose && <span className="text-[10px] text-text-dim italic">— {email.purpose}</span>}
                      </div>
                      <p className="text-xs font-medium text-text-heading mb-1">Subject: {email.subject}</p>
                      <p className="text-xs text-text-body whitespace-pre-wrap leading-relaxed">{email.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Demo Script */}
      {data.demo_script?.steps?.length > 0 && (
        <CollapsibleSection title="Demo Script">
          <div className="flex items-center gap-3 mb-4">
            <h4 className="text-sm font-semibold text-text-heading">{data.demo_script.title}</h4>
            {data.demo_script.duration_minutes && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-text-muted">~{data.demo_script.duration_minutes} min</span>
            )}
          </div>
          <div className="space-y-3">
            {data.demo_script.steps.map((step, i) => (
              <div key={i} className="border border-border-default rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ backgroundColor: `${ACCENT}15`, color: ACCENT }}>
                    Step {step.step}
                  </span>
                  <span className="text-sm font-medium text-text-heading">{step.name}</span>
                  <span className="text-[10px] text-text-dim ml-auto">{step.duration}</span>
                </div>
                {step.talking_points?.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Talking Points</p>
                    <ul className="space-y-0.5">{step.talking_points.map((tp, j) => <li key={j} className="text-xs text-text-body">- {tp}</li>)}</ul>
                  </div>
                )}
                {step.demo_actions?.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Demo Actions</p>
                    <ul className="space-y-0.5">{step.demo_actions.map((da, j) => <li key={j} className="text-xs text-[#0EA5E9]">→ {da}</li>)}</ul>
                  </div>
                )}
                {step.transition && <p className="text-xs text-text-secondary italic">Transition: {step.transition}</p>}
                {step.if_objection && (
                  <p className="text-xs text-[#F59E0B] mt-1">If objection: {step.if_objection}</p>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Qualification Framework */}
      {data.qualification_framework?.criteria?.length > 0 && (
        <CollapsibleSection title={`Qualification Framework: ${data.qualification_framework.name || ""}`}>
          <div className="space-y-3">
            {data.qualification_framework.criteria.map((c, i) => (
              <div key={i} className="border border-border-default rounded-lg p-4">
                <h4 className="text-sm font-medium text-text-heading mb-2">{c.criterion}</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Questions</p>
                    <ul className="space-y-0.5">{c.questions?.map((q, j) => <li key={j} className="text-xs text-text-body">- {q}</li>)}</ul>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[2px] text-[#10B981] mb-1">Green Flags</p>
                    <ul className="space-y-0.5">{c.green_flags?.map((g, j) => <li key={j} className="text-xs text-[#10B981]">+ {g}</li>)}</ul>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[2px] text-[#EF4444] mb-1">Red Flags</p>
                    <ul className="space-y-0.5">{c.red_flags?.map((r, j) => <li key={j} className="text-xs text-[#EF4444]">- {r}</li>)}</ul>
                  </div>
                </div>
                {c.scoring && <p className="text-xs text-text-muted mt-2">Scoring: {c.scoring}</p>}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* ROI Calculator */}
      {data.roi_calculator?.inputs?.length > 0 && (
        <CollapsibleSection title="ROI Calculator">
          <ROICalculatorWidget calculator={data.roi_calculator} />
        </CollapsibleSection>
      )}

      {/* Talk Tracks */}
      {data.talk_tracks?.length > 0 && (
        <CollapsibleSection title="Talk Tracks">
          <div className="space-y-3">
            {data.talk_tracks.map((tt, i) => (
              <div key={i} className="border border-border-default rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-medium text-text-heading">{tt.scenario}</h4>
                <div>
                  <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Opening</p>
                  <p className="text-xs text-text-body">{tt.opening}</p>
                </div>
                {tt.key_questions?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Key Questions</p>
                    <ul className="space-y-0.5">{tt.key_questions.map((q, j) => <li key={j} className="text-xs text-text-body">- {q}</li>)}</ul>
                  </div>
                )}
                {tt.value_statements?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Value Statements</p>
                    <ul className="space-y-0.5">{tt.value_statements.map((v, j) => <li key={j} className="text-xs text-[#10B981]">{v}</li>)}</ul>
                  </div>
                )}
                <div>
                  <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Close / Next Steps</p>
                  <p className="text-xs text-text-body">{tt.closing}</p>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Objection Card
// ---------------------------------------------------------------------------
function ObjectionCard({ objection: obj }: { objection: Objection }) {
  const [isOpen, setIsOpen] = useState(false);
  const catColor = OBJECTION_CATEGORIES[obj.category?.toLowerCase()] || "#71717A";

  return (
    <div className="border border-border-default rounded-lg overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.01] transition-colors">
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-mono shrink-0"
          style={{ backgroundColor: `${catColor}15`, color: catColor }}>
          {obj.category || "general"}
        </span>
        <span className="text-sm text-text-heading font-medium flex-1">&ldquo;{obj.objection}&rdquo;</span>
        <svg className="w-4 h-4 text-text-muted transition-transform duration-200 shrink-0" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">What They Mean</p>
            <p className="text-xs text-text-secondary">{obj.what_they_mean}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">How to Respond</p>
            <p className="text-xs text-text-body">{obj.response}</p>
          </div>
          {obj.evidence?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Evidence to Share</p>
              <ul className="space-y-0.5">{obj.evidence.map((e, i) => <li key={i} className="text-xs text-[#10B981]">→ {e}</li>)}</ul>
            </div>
          )}
          {obj.follow_up && (
            <div>
              <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Follow Up</p>
              <p className="text-xs text-text-body italic">{obj.follow_up}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ROI Calculator Widget
// ---------------------------------------------------------------------------
function ROICalculatorWidget({ calculator }: { calculator: ROICalculator }) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const defaults: Record<string, number> = {};
    calculator.inputs?.forEach(inp => { defaults[inp.name] = inp.default_value || 0; });
    return defaults;
  });

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-text-heading">{calculator.title}</h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {calculator.inputs?.map((inp, i) => (
          <div key={i}>
            <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-1">{inp.name}</label>
            <input type="number" value={values[inp.name] || 0}
              onChange={(e) => setValues(prev => ({ ...prev, [inp.name]: parseFloat(e.target.value) || 0 }))}
              className="w-full bg-background border border-border-default rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#10B981]/40 transition-colors" />
            {inp.description && <p className="text-[10px] text-text-dim mt-0.5">{inp.description}</p>}
          </div>
        ))}
      </div>

      {calculator.calculations?.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-2">Calculations</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {calculator.calculations.map((calc, i) => (
              <div key={i} className="border border-border-default rounded-lg p-3">
                <p className="text-[10px] text-text-muted mb-1">{calc.name}</p>
                <p className="text-xs text-text-body">{calc.formula}</p>
                <p className="text-[10px] text-text-dim mt-1">Unit: {calc.unit}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {calculator.assumptions?.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Assumptions</p>
          <ul className="space-y-0.5">
            {calculator.assumptions.map((a, i) => (
              <li key={i} className="text-xs text-text-secondary">- {typeof a === "string" ? a : String(a)}</li>
            ))}
          </ul>
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
                <span className={`w-2 h-2 rounded-full ${run.status === "completed" ? "bg-[#10B981]" : run.status === "failed" ? "bg-[#EF4444]" : "bg-[#F59E0B]"}`} />
                <span className="text-sm text-text-body truncate max-w-md">
                  {OUTPUT_TYPES.find(t => t.value === input?.output_type)?.label || "Agent run"} — {input?.target_persona || ""}
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
