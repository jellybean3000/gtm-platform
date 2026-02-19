"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const TEAM_ID = "00000000-0000-0000-0000-000000000001";
const ACCENT = "#F59E0B";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ContentMetadata {
  title: string;
  content_type: string;
  target_persona: string;
  funnel_stage: string;
  key_messages_used: string[];
  word_count: number;
  suggested_distribution: string[];
}

interface StructuredOutput {
  metadata: ContentMetadata;
  content: string;
}

interface RunHistory {
  id: string;
  status: string;
  input: Record<string, unknown>;
  output: { text?: string } | null;
  tokensUsed: number | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface KnowledgeSource {
  id: string;
  content: string;
  sourceDocument: string;
  sourceUrl: string | null;
}

type ProgressStep = {
  label: string;
  status: "pending" | "active" | "done";
};

const CONTENT_TYPES = [
  { value: "blog_post", label: "Blog Post" },
  { value: "one_pager", label: "One-Pager" },
  { value: "battle_card", label: "Battle Card" },
  { value: "case_study", label: "Case Study" },
  { value: "sales_deck", label: "Sales Deck" },
  { value: "press_release", label: "Press Release" },
];

const FUNNEL_STAGES = [
  { value: "awareness", label: "Awareness" },
  { value: "consideration", label: "Consideration" },
  { value: "decision", label: "Decision" },
  { value: "retention", label: "Retention" },
];

function getFileExtension(contentType: string): string {
  switch (contentType) {
    case "blog_post":
    case "case_study":
      return ".md";
    case "press_release":
      return ".md";
    case "one_pager":
    case "battle_card":
    case "sales_deck":
      return ".md";
    default:
      return ".md";
  }
}

function getContentTypeLabel(value: string): string {
  return CONTENT_TYPES.find((ct) => ct.value === value)?.label || value;
}

function getFunnelStageLabel(value: string): string {
  return FUNNEL_STAGES.find((fs) => fs.value === value)?.label || value;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function ContentPage() {
  const [contentType, setContentType] = useState("blog_post");
  const [targetPersona, setTargetPersona] = useState("");
  const [funnelStage, setFunnelStage] = useState("awareness");
  const [additionalContext, setAdditionalContext] = useState("");
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
  const [activeView, setActiveView] = useState<"create" | "library">("create");
  const [libraryFilter, setLibraryFilter] = useState({ type: "", persona: "", stage: "" });

  const outputRef = useRef<HTMLDivElement>(null);
  const positioningOutputRef = useRef<string | null>(null);
  const crmDataRef = useRef<string | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/content/runs?teamId=${TEAM_ID}`);
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch {
      // ignore
    }
  }, []);

  const checkPositioning = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/agents/content/latest-positioning?teamId=${TEAM_ID}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.run) {
          setPositioningAvailable(true);
          const input = data.run.input as Record<string, string> | null;
          const output = data.run.output as { text?: string } | null;
          positioningOutputRef.current = output?.text || null;
          setPositioningSummary(
            input?.product_capabilities?.slice(0, 50) || "Positioning available"
          );
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const checkCrmContext = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/context");
      if (res.ok) {
        const data = await res.json();
        if (data.available) {
          setCrmAvailable(true);
          setCrmSummary(data.summary);
          crmDataRef.current = data.dealsSummary || null;
          setIncludeCrmContext(true);
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchRuns();
    checkPositioning();
    checkCrmContext();
  }, [fetchRuns, checkPositioning, checkCrmContext]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [streamedText]);

  async function fetchSources(runId: string) {
    try {
      const res = await fetch(`/api/agents/content/runs/${runId}`);
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources || []);
      }
    } catch {
      // ignore
    }
  }

  function initProgressSteps() {
    setProgressSteps([
      { label: "Querying knowledge base", status: "active" },
      { label: "Writing content", status: "pending" },
      { label: "Finalizing document", status: "pending" },
    ]);
  }

  function advanceProgress(stepIndex: number) {
    setProgressSteps((prev) =>
      prev.map((step, i) => {
        if (i < stepIndex) return { ...step, status: "done" };
        if (i === stepIndex) return { ...step, status: "active" };
        return step;
      })
    );
  }

  function completeAllProgress() {
    setProgressSteps((prev) => prev.map((s) => ({ ...s, status: "done" })));
  }

  async function handleRun() {
    if (!targetPersona.trim() && !additionalContext.trim()) return;

    setIsRunning(true);
    setStreamedText("");
    setStructured(null);
    setError(null);
    setCurrentRunId(null);
    setSources([]);
    setSavedToKB(false);
    initProgressSteps();

    try {
      const input: Record<string, unknown> = {
        content_type: contentType,
        target_persona: targetPersona,
        funnel_stage: funnelStage,
        additional_context: additionalContext,
      };

      if (includePositioning && positioningOutputRef.current) {
        input.positioning_context = positioningOutputRef.current;
      }
      if (includeCrmContext && crmDataRef.current) {
        input.crm_context = crmDataRef.current;
      }

      const res = await fetch("/api/agents/content", {
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

      advanceProgress(1);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let advancedToStep2 = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setStreamedText(fullText);

        if (!advancedToStep2 && fullText.length > 200) {
          advancedToStep2 = true;
          advanceProgress(2);
        }
      }

      completeAllProgress();
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
      const title = structured?.metadata?.title || `Content: ${getContentTypeLabel(contentType)}`;
      const res = await fetch("/api/agents/content/save-to-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: TEAM_ID,
          runId: currentRunId,
          title,
          content: streamedText,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");
      setSavedToKB(true);
    } catch {
      setError("Failed to save to knowledge base");
    } finally {
      setIsSaving(false);
    }
  }

  function handleDownload() {
    if (!structured) return;

    const ext = getFileExtension(structured.metadata?.content_type || contentType);
    const title = structured.metadata?.title || "content";
    const safeName = title.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase();
    const filename = `${safeName}${ext}`;

    const blob = new Blob([structured.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function tryParseStructured(text: string) {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        setStructured(JSON.parse(jsonMatch[1]));
        return;
      } catch {
        // fall through
      }
    }
    try {
      setStructured(JSON.parse(text));
    } catch {
      // raw text — wrap in a basic structure
      setStructured({
        metadata: {
          title: `${getContentTypeLabel(contentType)} for ${targetPersona}`,
          content_type: contentType,
          target_persona: targetPersona,
          funnel_stage: funnelStage,
          key_messages_used: [],
          word_count: text.split(/\s+/).length,
          suggested_distribution: [],
        },
        content: text,
      });
    }
  }

  // Filter runs for the content library
  const filteredRuns = runs.filter((run) => {
    if (run.status !== "completed") return false;
    const input = run.input as Record<string, string> | null;
    if (libraryFilter.type && input?.content_type !== libraryFilter.type) return false;
    if (libraryFilter.persona && !input?.target_persona?.toLowerCase().includes(libraryFilter.persona.toLowerCase())) return false;
    if (libraryFilter.stage && input?.funnel_stage !== libraryFilter.stage) return false;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: ACCENT }}
            />
            <h1 className="text-2xl font-bold text-text-heading font-display">
              Content & Collateral Agent
            </h1>
          </div>
          <p className="text-text-secondary text-sm">
            Generate sales decks, battle cards, blog posts, case studies, and
            more.
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex gap-1 bg-white/[0.04] rounded-lg p-1">
          <button
            onClick={() => setActiveView("create")}
            className={`px-4 py-1.5 text-xs rounded-md transition-colors ${
              activeView === "create"
                ? "text-white"
                : "text-text-secondary hover:text-text-body"
            }`}
            style={{
              backgroundColor:
                activeView === "create" ? ACCENT : "transparent",
            }}
          >
            Create
          </button>
          <button
            onClick={() => setActiveView("library")}
            className={`px-4 py-1.5 text-xs rounded-md transition-colors ${
              activeView === "library"
                ? "text-white"
                : "text-text-secondary hover:text-text-body"
            }`}
            style={{
              backgroundColor:
                activeView === "library" ? ACCENT : "transparent",
            }}
          >
            Library ({runs.filter((r) => r.status === "completed").length})
          </button>
        </div>
      </div>

      {activeView === "create" ? (
        <>
          {/* Input Form */}
          <div className="bg-card-bg border border-border-default rounded-card p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">
                  Content Type
                </label>
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#F59E0B]/40 transition-colors"
                >
                  {CONTENT_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>
                      {ct.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">
                  Target Persona
                </label>
                <input
                  type="text"
                  value={targetPersona}
                  onChange={(e) => setTargetPersona(e.target.value)}
                  placeholder="e.g., VP Marketing, Product Manager"
                  className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#F59E0B]/40 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">
                  Funnel Stage
                </label>
                <select
                  value={funnelStage}
                  onChange={(e) => setFunnelStage(e.target.value)}
                  className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#F59E0B]/40 transition-colors"
                >
                  {FUNNEL_STAGES.map((fs) => (
                    <option key={fs.value} value={fs.value}>
                      {fs.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">
                Additional Context
              </label>
              <textarea
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="Any specific angles, data points, customer stories, or requirements for this content piece..."
                rows={3}
                className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#F59E0B]/40 transition-colors resize-none"
              />
            </div>

            {/* Context Toggles */}
            <div className="flex gap-3 flex-wrap">
              <div className="max-w-md flex-1">
                <button
                  onClick={() =>
                    positioningAvailable &&
                    setIncludePositioning(!includePositioning)
                  }
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                    !positioningAvailable
                      ? "border-border-default text-text-dim cursor-not-allowed"
                      : includePositioning
                        ? "border-[#F59E0B]/40 text-text-heading"
                        : "border-border-default text-text-secondary hover:border-[#F59E0B]/20"
                  }`}
                >
                  <div
                    className={`w-8 h-5 rounded-full relative transition-colors shrink-0 ${
                      includePositioning && positioningAvailable
                        ? "bg-[#F59E0B]"
                        : "bg-white/[0.08]"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        includePositioning && positioningAvailable
                          ? "translate-x-3.5"
                          : "translate-x-0.5"
                      }`}
                    />
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
                <button
                  onClick={() => crmAvailable && setIncludeCrmContext(!includeCrmContext)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                    !crmAvailable
                      ? "border-border-default text-text-dim cursor-not-allowed"
                      : includeCrmContext
                        ? "border-[#F97316]/40 text-text-heading"
                        : "border-border-default text-text-secondary hover:border-[#F97316]/20"
                  }`}
                >
                  <div
                    className={`w-8 h-5 rounded-full relative transition-colors shrink-0 ${
                      includeCrmContext && crmAvailable
                        ? "bg-[#F97316]"
                        : "bg-white/[0.08]"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        includeCrmContext && crmAvailable
                          ? "translate-x-3.5"
                          : "translate-x-0.5"
                      }`}
                    />
                  </div>
                  <div>
                    <span className="block">CRM Context</span>
                    <span className="text-[10px] text-text-dim">
                      {crmAvailable ? crmSummary : "No CRM data synced yet"}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <button
              onClick={handleRun}
              disabled={isRunning || (!targetPersona.trim() && !additionalContext.trim())}
              className="px-6 py-2.5 text-white font-medium text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: ACCENT }}
            >
              {isRunning
                ? "Generating Content..."
                : `Generate ${getContentTypeLabel(contentType)}`}
            </button>
          </div>

          {/* Error with Retry */}
          {error && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-card p-4 flex items-center justify-between">
              <div>
                <p className="text-[#EF4444] text-sm font-medium">
                  Generation Failed
                </p>
                <p className="text-[#EF4444]/70 text-xs mt-1">{error}</p>
              </div>
              <button
                onClick={handleRun}
                disabled={isRunning}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors disabled:opacity-50"
              >
                Retry
              </button>
            </div>
          )}

          {/* Progress Indicator */}
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
                      <div
                        className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                        style={{ borderColor: `${ACCENT} transparent ${ACCENT} ${ACCENT}` }}
                      />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-border-default" />
                    )}
                    <span
                      className={`text-xs ${
                        step.status === "active"
                          ? "text-text-heading font-medium"
                          : step.status === "done"
                            ? "text-[#10B981]"
                            : "text-text-dim"
                      }`}
                    >
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
                {isRunning ? "Writing Content..." : "Raw Output"}
              </h3>
              <div
                ref={outputRef}
                className="max-h-96 overflow-y-auto font-mono text-sm text-text-body whitespace-pre-wrap leading-relaxed"
              >
                {streamedText}
                {isRunning && (
                  <span
                    className="inline-block w-2 h-4 ml-1 animate-pulse"
                    style={{ backgroundColor: ACCENT }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Structured Content Result */}
          {structured && (
            <>
              <ContentPreview data={structured} />

              {/* Action buttons */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleDownload}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg text-white transition-colors"
                  style={{ backgroundColor: ACCENT }}
                >
                  Download as {getFileExtension(structured.metadata?.content_type || contentType).toUpperCase().replace(".", "")}
                </button>

                <button
                  onClick={handleSaveToKnowledge}
                  disabled={isSaving || savedToKB}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    borderColor: savedToKB ? "#10B981" : `${ACCENT}40`,
                    color: savedToKB ? "#10B981" : ACCENT,
                    backgroundColor: savedToKB ? "rgba(16,185,129,0.1)" : "transparent",
                  }}
                >
                  {savedToKB
                    ? "Saved to Knowledge Base"
                    : isSaving
                      ? "Saving..."
                      : "Save to Knowledge Base"}
                </button>
                {savedToKB && (
                  <span className="text-xs text-[#10B981]">
                    Other agents can now reference this content.
                  </span>
                )}
              </div>
            </>
          )}

          {/* Sources Used */}
          {sources.length > 0 && <SourcesSection sources={sources} />}
        </>
      ) : (
        /* Content Library View */
        <ContentLibrary
          runs={filteredRuns}
          allRuns={runs}
          filter={libraryFilter}
          setFilter={setLibraryFilter}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content Preview
// ---------------------------------------------------------------------------
function ContentPreview({ data }: { data: StructuredOutput }) {
  return (
    <div className="space-y-4">
      {/* Metadata Card */}
      {data.metadata && (
        <div
          className="bg-card-bg border rounded-card p-6"
          style={{ borderColor: `${ACCENT}30` }}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-text-heading font-display">
                {data.metadata.title}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-mono"
                  style={{ backgroundColor: `${ACCENT}15`, color: ACCENT }}
                >
                  {getContentTypeLabel(data.metadata.content_type)}
                </span>
                {data.metadata.target_persona && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-text-muted">
                    {data.metadata.target_persona}
                  </span>
                )}
                {data.metadata.funnel_stage && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-text-muted">
                    {getFunnelStageLabel(data.metadata.funnel_stage)}
                  </span>
                )}
                {data.metadata.word_count > 0 && (
                  <span className="text-[10px] text-text-dim">
                    {data.metadata.word_count} words
                  </span>
                )}
              </div>
            </div>
          </div>

          {data.metadata.key_messages_used?.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">
                Key Messages Used
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.metadata.key_messages_used.map((msg, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-border-default text-text-secondary"
                  >
                    {typeof msg === "string" ? msg : String(msg)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.metadata.suggested_distribution?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">
                Suggested Distribution
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.metadata.suggested_distribution.map((ch, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-text-muted"
                  >
                    {typeof ch === "string" ? ch : String(ch)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content Body */}
      {data.content && (
        <div className="bg-card-bg border border-border-default rounded-card p-6">
          <h3
            className="text-[10px] uppercase tracking-[2px] mb-4"
            style={{ color: ACCENT }}
          >
            Content Preview
          </h3>
          <div className="prose prose-sm prose-invert max-w-none text-text-body leading-relaxed whitespace-pre-wrap">
            {data.content}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content Library
// ---------------------------------------------------------------------------
function ContentLibrary({
  runs,
  allRuns,
  filter,
  setFilter,
}: {
  runs: RunHistory[];
  allRuns: RunHistory[];
  filter: { type: string; persona: string; stage: string };
  setFilter: (f: { type: string; persona: string; stage: string }) => void;
}) {
  // Get unique personas from all runs
  const personas = Array.from(
    new Set(
      allRuns
        .filter((r) => r.status === "completed")
        .map((r) => (r.input as Record<string, string> | null)?.target_persona)
        .filter(Boolean)
    )
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-card-bg border border-border-default rounded-card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={filter.type}
            onChange={(e) => setFilter({ ...filter, type: e.target.value })}
            className="bg-background border border-border-default rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none"
          >
            <option value="">All Types</option>
            {CONTENT_TYPES.map((ct) => (
              <option key={ct.value} value={ct.value}>
                {ct.label}
              </option>
            ))}
          </select>

          <select
            value={filter.stage}
            onChange={(e) => setFilter({ ...filter, stage: e.target.value })}
            className="bg-background border border-border-default rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none"
          >
            <option value="">All Stages</option>
            {FUNNEL_STAGES.map((fs) => (
              <option key={fs.value} value={fs.value}>
                {fs.label}
              </option>
            ))}
          </select>

          {personas.length > 0 && (
            <select
              value={filter.persona}
              onChange={(e) => setFilter({ ...filter, persona: e.target.value })}
              className="bg-background border border-border-default rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none"
            >
              <option value="">All Personas</option>
              {personas.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}

          <span className="text-xs text-text-muted ml-auto">
            {runs.length} item{runs.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Content Cards Grid */}
      {runs.length === 0 ? (
        <div className="bg-card-bg border border-border-default rounded-card p-12 text-center">
          <p className="text-text-muted text-sm">
            No content generated yet. Switch to Create to start.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {runs.map((run) => {
            const input = run.input as Record<string, string> | null;
            const output = run.output as { text?: string } | null;

            // Try to extract title from output
            let title = `${getContentTypeLabel(input?.content_type || "")}`;
            let preview = "";
            if (output?.text) {
              const jsonMatch = output.text.match(/```json\s*([\s\S]*?)```/);
              if (jsonMatch) {
                try {
                  const parsed = JSON.parse(jsonMatch[1]);
                  title = parsed.metadata?.title || title;
                  preview = parsed.content?.slice(0, 120) || "";
                } catch {
                  preview = output.text.slice(0, 120);
                }
              } else {
                preview = output.text.slice(0, 120);
              }
            }

            return (
              <div
                key={run.id}
                className="bg-card-bg border border-border-default rounded-card p-4 hover:border-[#F59E0B]/20 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <span
                    className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-mono"
                    style={{ backgroundColor: `${ACCENT}15`, color: ACCENT }}
                  >
                    {getContentTypeLabel(input?.content_type || "")}
                  </span>
                  <span className="text-[10px] text-text-dim">
                    {run.startedAt
                      ? new Date(run.startedAt).toLocaleDateString()
                      : ""}
                  </span>
                </div>
                <h4 className="text-sm font-medium text-text-heading mb-1 line-clamp-1">
                  {title}
                </h4>
                <p className="text-xs text-text-secondary line-clamp-2 mb-2">
                  {preview}...
                </p>
                <div className="flex items-center gap-2">
                  {input?.target_persona && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-text-muted">
                      {input.target_persona}
                    </span>
                  )}
                  {input?.funnel_stage && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-text-muted">
                      {getFunnelStageLabel(input.funnel_stage)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
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
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/[0.01] transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span className="text-[10px] uppercase tracking-[2px] text-text-muted">
            Sources Used
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-mono"
            style={{ backgroundColor: `${ACCENT}20`, color: ACCENT }}
          >
            {sources.length}
          </span>
        </div>
        <svg
          className="w-4 h-4 text-text-muted transition-transform duration-200"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 space-y-2">
          {sources.map((source) => (
            <div
              key={source.id}
              className="border border-border-default rounded-lg p-3"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-text-heading">
                  {source.sourceDocument}
                </span>
                {source.sourceUrl && (
                  <span className="text-[10px] text-text-dim truncate max-w-xs">
                    {source.sourceUrl}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-secondary line-clamp-2">
                {source.content.slice(0, 200)}
                {source.content.length > 200 ? "..." : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
