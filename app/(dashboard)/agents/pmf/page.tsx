"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const TEAM_ID = "00000000-0000-0000-0000-000000000001";
const ACCENT = "#14B8A6";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PMFDimension {
  name: string;
  score: number;
  max: number;
  signals: string[];
  recommendation: string;
}

interface PMFScorecard {
  overall_score: number;
  dimensions: PMFDimension[];
  summary: string;
}

interface InterviewQuestion {
  question: string;
  purpose: string;
  follow_ups: string[];
}

interface InterviewScript {
  name: string;
  objective: string;
  target_persona: string;
  questions: InterviewQuestion[];
  duration_minutes: number;
}

interface SurveyQuestion {
  question: string;
  type: string;
  options?: string[];
  category: string;
  purpose: string;
}

interface FeatureValueItem {
  feature: string;
  customer_value: string;
  target_segment: string;
  importance: string;
  satisfaction: string;
}

interface InsightReport {
  key_themes: string[];
  patterns: string[];
  gaps: string[];
  recommendations: {
    action: string;
    priority: string;
    rationale: string;
  }[];
}

interface StructuredOutput {
  pmf_scorecard: PMFScorecard;
  interview_scripts: InterviewScript[];
  survey_questions: SurveyQuestion[];
  feature_value_map: FeatureValueItem[];
  insight_report: InsightReport;
}

interface RunHistory {
  id: string;
  status: string;
  input: Record<string, unknown>;
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

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function PMFPage() {
  const [productDescription, setProductDescription] = useState("");
  const [hypotheses, setHypotheses] = useState("");
  const [researchType, setResearchType] = useState("pmf_scoring");

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

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/pmf/runs?teamId=${TEAM_ID}`);
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [streamedText]);

  async function fetchSources(runId: string) {
    try {
      const res = await fetch(`/api/agents/pmf/runs/${runId}`);
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
      { label: "Analyzing product-market fit", status: "pending" },
      { label: "Generating structured report", status: "pending" },
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
    if (!productDescription.trim()) return;

    setIsRunning(true);
    setStreamedText("");
    setStructured(null);
    setError(null);
    setCurrentRunId(null);
    setSources([]);
    setSavedToKB(false);
    initProgressSteps();

    try {
      const res = await fetch("/api/agents/pmf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: {
            product_description: productDescription,
            hypotheses,
            research_type: researchType,
          },
          teamId: TEAM_ID,
        }),
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
      const res = await fetch("/api/agents/pmf/save-to-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: TEAM_ID,
          runId: currentRunId,
          title: `PMF Analysis: ${productDescription.slice(0, 60)}`,
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

  function tryParseStructured(text: string) {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        setStructured(parsed);
        return;
      } catch {
        // fall through
      }
    }

    try {
      const parsed = JSON.parse(text);
      setStructured(parsed);
    } catch {
      // No structured output
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: ACCENT }}
          />
          <h1 className="text-2xl font-bold text-text-heading font-display">
            PMF Agent
          </h1>
        </div>
        <p className="text-text-secondary text-sm">
          Validate product-market fit through interview guides, surveys, feedback
          analysis, and PMF scoring.
        </p>
      </div>

      {/* Input Form */}
      <div className="bg-card-bg border border-border-default rounded-card p-6 space-y-4">
        <div>
          <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">
            Product Description
          </label>
          <textarea
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            placeholder="Describe your product, its key features, and the problem it solves..."
            rows={3}
            className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#14B8A6]/40 transition-colors resize-none"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">
            Hypotheses to Validate
          </label>
          <textarea
            value={hypotheses}
            onChange={(e) => setHypotheses(e.target.value)}
            placeholder="e.g., Mid-market teams will pay $500/mo to replace manual reporting. Product managers value AI summaries over raw dashboards..."
            rows={2}
            className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#14B8A6]/40 transition-colors resize-none"
          />
        </div>

        <div className="max-w-xs">
          <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">
            Research Type
          </label>
          <select
            value={researchType}
            onChange={(e) => setResearchType(e.target.value)}
            className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#14B8A6]/40 transition-colors"
          >
            <option value="pmf_scoring">PMF Scoring</option>
            <option value="interview_scripts">Interview Scripts</option>
            <option value="survey_design">Survey Design</option>
            <option value="feedback_analysis">Feedback Analysis</option>
          </select>
        </div>

        <button
          onClick={handleRun}
          disabled={isRunning || !productDescription.trim()}
          className="px-6 py-2.5 text-white font-medium text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ backgroundColor: ACCENT }}
        >
          {isRunning ? "Running Analysis..." : "Run Analysis"}
        </button>
      </div>

      {/* Error with Retry */}
      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[#EF4444] text-sm font-medium">Analysis Failed</p>
            <p className="text-[#EF4444]/70 text-xs mt-1">{error}</p>
          </div>
          <button
            onClick={handleRun}
            disabled={isRunning || !productDescription.trim()}
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
            {isRunning ? "Generating Analysis..." : "Raw Output"}
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

      {/* Structured Results */}
      {structured && (
        <>
          <StructuredResults data={structured} />

          {/* Save to Knowledge Base */}
          <div className="flex items-center gap-3">
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
                Other agents can now reference this analysis.
              </span>
            )}
          </div>
        </>
      )}

      {/* Sources Used */}
      {sources.length > 0 && <SourcesSection sources={sources} />}

      {/* Run History */}
      <RunHistorySection runs={runs} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible Section
// ---------------------------------------------------------------------------
function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-card-bg border border-border-default rounded-card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 pb-0 hover:bg-white/[0.01] transition-colors"
        style={{ paddingBottom: isOpen ? 0 : "1.5rem" }}
      >
        <h3
          className="text-[10px] uppercase tracking-[2px]"
          style={{ color: ACCENT }}
        >
          {title}
        </h3>
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
      {/* PMF Scorecard */}
      {data.pmf_scorecard && (
        <CollapsibleSection title="PMF Scorecard">
          {/* Overall Score */}
          <div className="mb-6">
            <div className="flex items-end gap-3 mb-2">
              <span
                className="text-4xl font-bold font-display"
                style={{ color: ACCENT }}
              >
                {data.pmf_scorecard.overall_score}
              </span>
              <span className="text-text-muted text-sm mb-1">/ 10</span>
            </div>
            {/* Overall gauge bar */}
            <div className="w-full h-3 bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(data.pmf_scorecard.overall_score / 10) * 100}%`,
                  backgroundColor: scoreColor(data.pmf_scorecard.overall_score),
                }}
              />
            </div>
            {data.pmf_scorecard.summary && (
              <p className="text-xs text-text-secondary mt-2">
                {data.pmf_scorecard.summary}
              </p>
            )}
          </div>

          {/* Dimension scores */}
          <div className="space-y-3">
            {data.pmf_scorecard.dimensions?.map((dim, i) => (
              <div key={i} className="border border-border-default rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-text-heading">
                    {dim.name}
                  </span>
                  <span
                    className="text-sm font-bold font-mono"
                    style={{ color: scoreColor(dim.score) }}
                  >
                    {dim.score}/{dim.max || 10}
                  </span>
                </div>
                <div className="w-full h-2 bg-white/[0.04] rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(dim.score / (dim.max || 10)) * 100}%`,
                      backgroundColor: scoreColor(dim.score),
                    }}
                  />
                </div>
                {dim.signals?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {dim.signals.map((s, j) => (
                      <span
                        key={j}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-text-secondary"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {dim.recommendation && (
                  <p className="text-xs text-text-muted">
                    {dim.recommendation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Interview Scripts */}
      {data.interview_scripts?.length > 0 && (
        <CollapsibleSection title="Interview Scripts">
          <div className="space-y-4">
            {data.interview_scripts.map((script, i) => (
              <div
                key={i}
                className="border border-border-default rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-text-heading">
                    {script.name}
                  </h4>
                  {script.duration_minutes && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-text-muted">
                      ~{script.duration_minutes} min
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-secondary">{script.objective}</p>
                {script.target_persona && (
                  <p className="text-[10px] uppercase tracking-[2px] text-text-muted">
                    Target: {script.target_persona}
                  </p>
                )}
                <div className="space-y-2">
                  {script.questions?.map((q, j) => (
                    <div key={j} className="pl-3 border-l-2 border-border-default">
                      <p className="text-sm text-text-body">
                        <span className="text-text-muted font-mono text-xs mr-2">
                          Q{j + 1}
                        </span>
                        {q.question}
                      </p>
                      {q.purpose && (
                        <p className="text-[10px] text-text-dim mt-0.5 italic">
                          Purpose: {q.purpose}
                        </p>
                      )}
                      {q.follow_ups?.length > 0 && (
                        <div className="mt-1 pl-4 space-y-0.5">
                          {q.follow_ups.map((f, k) => (
                            <p key={k} className="text-xs text-text-secondary">
                              ↳ {f}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Survey Questions */}
      {data.survey_questions?.length > 0 && (
        <CollapsibleSection title="Survey Questions">
          <div className="space-y-3">
            {data.survey_questions.map((sq, i) => (
              <div
                key={i}
                className="border border-border-default rounded-lg p-4"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-mono shrink-0"
                    style={{
                      backgroundColor: `${ACCENT}15`,
                      color: ACCENT,
                    }}
                  >
                    {sq.type?.replace("_", " ") || "question"}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-text-heading font-medium">
                      {sq.question}
                    </p>
                    {sq.options && sq.options.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {sq.options.map((opt, j) => (
                          <div key={j} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full border border-border-default" />
                            <span className="text-xs text-text-body">
                              {opt}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      {sq.category && (
                        <span className="text-[10px] text-text-dim">
                          {sq.category}
                        </span>
                      )}
                      {sq.purpose && (
                        <span className="text-[10px] text-text-dim italic">
                          {sq.purpose}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Feature-Value Map */}
      {data.feature_value_map?.length > 0 && (
        <CollapsibleSection title="Feature-Value Map">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="text-left py-2 px-3 text-text-muted font-normal uppercase tracking-wider">
                    Feature
                  </th>
                  <th className="text-left py-2 px-3 text-text-muted font-normal uppercase tracking-wider">
                    Customer Value
                  </th>
                  <th className="text-left py-2 px-3 text-text-muted font-normal uppercase tracking-wider">
                    Target Segment
                  </th>
                  <th className="text-left py-2 px-3 text-text-muted font-normal uppercase tracking-wider">
                    Importance
                  </th>
                  <th className="text-left py-2 px-3 text-text-muted font-normal uppercase tracking-wider">
                    Satisfaction
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.feature_value_map.map((item, i) => (
                  <tr
                    key={i}
                    className="border-b border-border-default last:border-0"
                  >
                    <td className="py-2 px-3 text-text-heading font-medium">
                      {item.feature}
                    </td>
                    <td className="py-2 px-3 text-text-body">
                      {item.customer_value}
                    </td>
                    <td className="py-2 px-3 text-text-body">
                      {item.target_segment}
                    </td>
                    <td className="py-2 px-3">
                      <LevelBadge level={item.importance} />
                    </td>
                    <td className="py-2 px-3">
                      <LevelBadge level={item.satisfaction} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {/* Insight Report */}
      {data.insight_report && (
        <CollapsibleSection title="Insight Report">
          <div className="space-y-4">
            {data.insight_report.key_themes?.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-2">
                  Key Themes
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.insight_report.key_themes.map((t, i) => (
                    <span
                      key={i}
                      className="text-xs px-3 py-1 rounded-full border border-border-default text-text-body"
                    >
                      {typeof t === "string" ? t : String((t as Record<string, unknown>).theme || (t as Record<string, unknown>).name || JSON.stringify(t))}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {data.insight_report.patterns?.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-2">
                  Patterns
                </p>
                <ul className="space-y-1">
                  {data.insight_report.patterns.map((p, i) => (
                    <li key={i} className="text-xs text-text-body">
                      - {typeof p === "string" ? p : String((p as Record<string, unknown>).pattern || (p as Record<string, unknown>).description || JSON.stringify(p))}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.insight_report.gaps?.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-2">
                  Gaps Identified
                </p>
                <ul className="space-y-1">
                  {data.insight_report.gaps.map((g, i) => (
                    <li key={i} className="text-xs text-[#F59E0B]">
                      - {typeof g === "string" ? g : String((g as Record<string, unknown>).gap || (g as Record<string, unknown>).description || JSON.stringify(g))}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.insight_report.recommendations?.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-2">
                  Recommendations
                </p>
                <div className="space-y-2">
                  {data.insight_report.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="border border-border-default rounded-lg p-3 flex items-start gap-3"
                    >
                      <span
                        className={`px-2 py-0.5 text-[10px] uppercase tracking-wider rounded font-mono shrink-0 ${
                          rec.priority === "high"
                            ? "bg-[#EF4444]/10 text-[#EF4444]"
                            : rec.priority === "medium"
                              ? "bg-[#F59E0B]/10 text-[#F59E0B]"
                              : "bg-[#10B981]/10 text-[#10B981]"
                        }`}
                      >
                        {rec.priority}
                      </span>
                      <div>
                        <p className="text-sm text-text-heading font-medium">
                          {rec.action}
                        </p>
                        <p className="text-xs text-text-secondary mt-1">
                          {rec.rationale}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper Components
// ---------------------------------------------------------------------------
function scoreColor(score: number): string {
  if (score >= 8) return "#10B981";
  if (score >= 6) return "#14B8A6";
  if (score >= 4) return "#F59E0B";
  return "#EF4444";
}

function LevelBadge({ level }: { level: string }) {
  const normalized = level?.toLowerCase() || "medium";
  const colorClass =
    normalized === "high"
      ? "bg-[#10B981]/10 text-[#10B981]"
      : normalized === "medium"
        ? "bg-[#F59E0B]/10 text-[#F59E0B]"
        : "bg-[#71717A]/10 text-[#71717A]";

  return (
    <span
      className={`px-2 py-0.5 text-[10px] uppercase tracking-wider rounded font-mono ${colorClass}`}
    >
      {level}
    </span>
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

// ---------------------------------------------------------------------------
// Run History
// ---------------------------------------------------------------------------
function RunHistorySection({ runs }: { runs: RunHistory[] }) {
  if (runs.length === 0) return null;

  return (
    <div className="bg-card-bg border border-border-default rounded-card p-6">
      <h3
        className="text-[10px] uppercase tracking-[2px] mb-4"
        style={{ color: ACCENT }}
      >
        Run History
      </h3>
      <div className="space-y-2">
        {runs.map((run) => {
          const input = run.input as Record<string, string> | null;
          return (
            <div
              key={run.id}
              className="flex items-center justify-between border border-border-default rounded-lg px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-2 h-2 rounded-full ${
                    run.status === "completed"
                      ? "bg-[#10B981]"
                      : run.status === "failed"
                        ? "bg-[#EF4444]"
                        : "bg-[#F59E0B]"
                  }`}
                />
                <span className="text-sm text-text-body truncate max-w-md">
                  {input?.product_description?.slice(0, 80) || "Agent run"}
                  {(input?.product_description?.length ?? 0) > 80 ? "..." : ""}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-text-muted">
                {run.tokensUsed && (
                  <span>{run.tokensUsed.toLocaleString()} tokens</span>
                )}
                <span>
                  {run.startedAt
                    ? new Date(run.startedAt).toLocaleDateString()
                    : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
