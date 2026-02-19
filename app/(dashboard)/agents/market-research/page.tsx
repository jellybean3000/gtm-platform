"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { DownloadButton } from "@/components/shared/DownloadButton";

const TEAM_ID = "00000000-0000-0000-0000-000000000001";
const ACCENT = "#0EA5E9";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ICPProfile {
  name: string;
  description: string;
  firmographics: {
    industry: string;
    company_size: string;
    revenue_range: string;
    geography: string;
  };
  pain_points: string[];
  buying_triggers: string[];
  decision_makers: string[];
  estimated_market_size: string;
}

interface Competitor {
  name: string;
  positioning: string;
  strengths: string[];
  weaknesses: string[];
  pricing: string;
  market_share: string;
  key_differentiator: string;
}

interface MarketSizing {
  tam: { value: string; description: string };
  sam: { value: string; description: string };
  som: { value: string; description: string };
  methodology: string;
}

interface PricingIntel {
  competitor: string;
  model: string;
  entry_price: string;
  mid_tier: string;
  enterprise: string;
  notes: string;
}

interface TrendItem {
  trend: string;
  impact: string;
  description: string;
  timeframe: string;
}

interface StructuredOutput {
  icp_profiles: ICPProfile[];
  competitor_matrix: Competitor[];
  market_sizing: MarketSizing;
  pricing_intel: PricingIntel[];
  trend_analysis: TrendItem[];
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
export default function MarketResearchPage() {
  const [productDescription, setProductDescription] = useState("");
  const [targetMarket, setTargetMarket] = useState("");
  const [knownCompetitors, setKnownCompetitors] = useState("");
  const [researchDepth, setResearchDepth] = useState("standard");

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

  // Fetch run history
  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/agents/market-research/runs?teamId=${TEAM_ID}`
      );
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

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [streamedText]);

  // Fetch sources after run completes
  async function fetchSources(runId: string) {
    try {
      const res = await fetch(`/api/agents/market-research/runs/${runId}`);
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
      { label: "Analyzing market & competitors", status: "pending" },
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
      const res = await fetch("/api/agents/market-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: {
            product_description: productDescription,
            target_market: targetMarket,
            known_competitors: knownCompetitors,
            research_depth: researchDepth,
          },
          teamId: TEAM_ID,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.error || `Agent returned ${res.status}`
        );
      }

      if (!res.body) {
        throw new Error("No response body");
      }

      // Capture runId from header
      const runId = res.headers.get("X-Run-Id");
      if (runId) setCurrentRunId(runId);

      // Knowledge base queried before streaming starts — mark step 1 done
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

        // Advance to step 3 when we see the JSON output starting
        if (!advancedToStep2 && fullText.length > 200) {
          advancedToStep2 = true;
          advanceProgress(2);
        }
      }

      completeAllProgress();

      // Try to parse structured JSON from the response
      tryParseStructured(fullText);
      fetchRuns();

      // Fetch knowledge sources used
      if (runId) {
        fetchSources(runId);
      }
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
      const res = await fetch("/api/agents/market-research/save-to-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: TEAM_ID,
          runId: currentRunId,
          title: `Market Research: ${productDescription.slice(0, 60)}`,
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
      // No structured output — raw text will be shown
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
            Market Research Agent
          </h1>
        </div>
        <p className="text-text-secondary text-sm">
          Analyze markets, competitors, customer segments, and pricing
          intelligence.
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
            placeholder="Describe your product, its key features, and value proposition..."
            rows={3}
            className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#0EA5E9]/40 transition-colors resize-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">
              Target Market
            </label>
            <input
              type="text"
              value={targetMarket}
              onChange={(e) => setTargetMarket(e.target.value)}
              placeholder="e.g., B2B SaaS, mid-market"
              className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#0EA5E9]/40 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">
              Known Competitors
            </label>
            <input
              type="text"
              value={knownCompetitors}
              onChange={(e) => setKnownCompetitors(e.target.value)}
              placeholder="e.g., Competitor A, Competitor B"
              className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#0EA5E9]/40 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">
              Research Depth
            </label>
            <select
              value={researchDepth}
              onChange={(e) => setResearchDepth(e.target.value)}
              className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#0EA5E9]/40 transition-colors"
            >
              <option value="quick">Quick</option>
              <option value="standard">Standard</option>
              <option value="deep">Deep</option>
            </select>
          </div>
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
            <DownloadButton
              content={JSON.stringify(structured, null, 2)}
              filename="market-research"
              formats={["json", "md"]}
              accentColor={ACCENT}
            />
            {savedToKB && (
              <span className="text-xs text-[#10B981]">
                Other agents can now reference this research.
              </span>
            )}
          </div>
        </>
      )}

      {/* Sources Used */}
      {sources.length > 0 && (
        <SourcesSection sources={sources} />
      )}

      {/* Run History */}
      <RunHistorySection runs={runs} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible Section Wrapper
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
// Structured Results (with collapsible sections)
// ---------------------------------------------------------------------------
function StructuredResults({ data }: { data: StructuredOutput }) {
  return (
    <div className="space-y-4">
      {/* Market Sizing */}
      {data.market_sizing && (
        <CollapsibleSection title="Market Sizing">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {(["tam", "sam", "som"] as const).map((key) => (
              <div
                key={key}
                className="border border-border-default rounded-lg p-4"
              >
                <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">
                  {key.toUpperCase()}
                </p>
                <p
                  className="text-2xl font-bold font-display"
                  style={{ color: ACCENT }}
                >
                  {data.market_sizing[key].value}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  {data.market_sizing[key].description}
                </p>
              </div>
            ))}
          </div>
          {data.market_sizing.methodology && (
            <p className="text-xs text-text-muted">
              Methodology: {data.market_sizing.methodology}
            </p>
          )}
        </CollapsibleSection>
      )}

      {/* ICP Profiles */}
      {data.icp_profiles?.length > 0 && (
        <CollapsibleSection title="Ideal Customer Profiles">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.icp_profiles.map((icp, i) => (
              <div
                key={i}
                className="border border-border-default rounded-lg p-4 space-y-3"
              >
                <div>
                  <h4 className="text-sm font-semibold text-text-heading">
                    {icp.name}
                  </h4>
                  <p className="text-xs text-text-secondary mt-1">
                    {icp.description}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-text-muted">Industry:</span>{" "}
                    <span className="text-text-body">
                      {icp.firmographics?.industry}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">Size:</span>{" "}
                    <span className="text-text-body">
                      {icp.firmographics?.company_size}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">Revenue:</span>{" "}
                    <span className="text-text-body">
                      {icp.firmographics?.revenue_range}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">Geo:</span>{" "}
                    <span className="text-text-body">
                      {icp.firmographics?.geography}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">
                    Pain Points
                  </p>
                  <ul className="text-xs text-text-body space-y-0.5">
                    {icp.pain_points?.map((p, j) => (
                      <li key={j}>- {p}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">
                    Buying Triggers
                  </p>
                  <ul className="text-xs text-text-body space-y-0.5">
                    {icp.buying_triggers?.map((t, j) => (
                      <li key={j}>- {t}</li>
                    ))}
                  </ul>
                </div>
                {icp.estimated_market_size && (
                  <p className="text-xs text-text-muted">
                    Est. market: {icp.estimated_market_size}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Competitor Matrix */}
      {data.competitor_matrix?.length > 0 && (
        <CollapsibleSection title="Competitor Matrix">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="text-left py-2 px-3 text-text-muted font-normal uppercase tracking-wider">
                    Competitor
                  </th>
                  <th className="text-left py-2 px-3 text-text-muted font-normal uppercase tracking-wider">
                    Positioning
                  </th>
                  <th className="text-left py-2 px-3 text-text-muted font-normal uppercase tracking-wider">
                    Strengths
                  </th>
                  <th className="text-left py-2 px-3 text-text-muted font-normal uppercase tracking-wider">
                    Weaknesses
                  </th>
                  <th className="text-left py-2 px-3 text-text-muted font-normal uppercase tracking-wider">
                    Pricing
                  </th>
                  <th className="text-left py-2 px-3 text-text-muted font-normal uppercase tracking-wider">
                    Share
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.competitor_matrix.map((c, i) => (
                  <tr
                    key={i}
                    className="border-b border-border-default last:border-0"
                  >
                    <td className="py-2 px-3 text-text-heading font-medium">
                      {c.name}
                    </td>
                    <td className="py-2 px-3 text-text-body">
                      {c.positioning}
                    </td>
                    <td className="py-2 px-3 text-text-body">
                      {c.strengths?.join(", ")}
                    </td>
                    <td className="py-2 px-3 text-text-body">
                      {c.weaknesses?.join(", ")}
                    </td>
                    <td className="py-2 px-3 text-text-body">{c.pricing}</td>
                    <td className="py-2 px-3 text-text-body">
                      {c.market_share}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {/* Pricing Intel */}
      {data.pricing_intel?.length > 0 && (
        <CollapsibleSection title="Pricing Intelligence">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="text-left py-2 px-3 text-text-muted font-normal uppercase tracking-wider">
                    Competitor
                  </th>
                  <th className="text-left py-2 px-3 text-text-muted font-normal uppercase tracking-wider">
                    Model
                  </th>
                  <th className="text-left py-2 px-3 text-text-muted font-normal uppercase tracking-wider">
                    Entry
                  </th>
                  <th className="text-left py-2 px-3 text-text-muted font-normal uppercase tracking-wider">
                    Mid-Tier
                  </th>
                  <th className="text-left py-2 px-3 text-text-muted font-normal uppercase tracking-wider">
                    Enterprise
                  </th>
                  <th className="text-left py-2 px-3 text-text-muted font-normal uppercase tracking-wider">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.pricing_intel.map((p, i) => (
                  <tr
                    key={i}
                    className="border-b border-border-default last:border-0"
                  >
                    <td className="py-2 px-3 text-text-heading font-medium">
                      {p.competitor}
                    </td>
                    <td className="py-2 px-3 text-text-body">{p.model}</td>
                    <td className="py-2 px-3 text-text-body">
                      {p.entry_price}
                    </td>
                    <td className="py-2 px-3 text-text-body">{p.mid_tier}</td>
                    <td className="py-2 px-3 text-text-body">
                      {p.enterprise}
                    </td>
                    <td className="py-2 px-3 text-text-secondary">
                      {p.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {/* Trend Analysis */}
      {data.trend_analysis?.length > 0 && (
        <CollapsibleSection title="Trend Analysis">
          <div className="space-y-3">
            {data.trend_analysis.map((t, i) => (
              <div
                key={i}
                className="border border-border-default rounded-lg p-3 flex items-start gap-3"
              >
                <span
                  className={`px-2 py-0.5 text-[10px] uppercase tracking-wider rounded font-mono ${
                    t.impact === "high"
                      ? "bg-[#EF4444]/10 text-[#EF4444]"
                      : t.impact === "medium"
                        ? "bg-[#F59E0B]/10 text-[#F59E0B]"
                        : "bg-[#10B981]/10 text-[#10B981]"
                  }`}
                >
                  {t.impact}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-text-heading font-medium">
                    {t.trend}
                  </p>
                  <p className="text-xs text-text-secondary mt-1">
                    {t.description}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    {t.timeframe}
                  </p>
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
