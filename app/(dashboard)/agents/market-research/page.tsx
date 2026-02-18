"use client";

import { useState, useRef, useEffect, useCallback } from "react";

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

  async function handleRun() {
    if (!productDescription.trim()) return;

    setIsRunning(true);
    setStreamedText("");
    setStructured(null);
    setError(null);

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

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setStreamedText(fullText);
      }

      // Try to parse structured JSON from the response
      tryParseStructured(fullText);
      fetchRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent failed");
    } finally {
      setIsRunning(false);
    }
  }

  function tryParseStructured(text: string) {
    // Look for JSON code block
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

    // Try parsing the whole text as JSON
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

      {/* Error */}
      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-card p-4">
          <p className="text-[#EF4444] text-sm">{error}</p>
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
      {structured && <StructuredResults data={structured} />}

      {/* Run History */}
      <RunHistorySection runs={runs} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Structured Results
// ---------------------------------------------------------------------------
function StructuredResults({ data }: { data: StructuredOutput }) {
  return (
    <div className="space-y-6">
      {/* Market Sizing */}
      {data.market_sizing && (
        <div className="bg-card-bg border border-border-default rounded-card p-6">
          <h3
            className="text-[10px] uppercase tracking-[2px] mb-4"
            style={{ color: ACCENT }}
          >
            Market Sizing
          </h3>
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
        </div>
      )}

      {/* ICP Profiles */}
      {data.icp_profiles?.length > 0 && (
        <div className="bg-card-bg border border-border-default rounded-card p-6">
          <h3
            className="text-[10px] uppercase tracking-[2px] mb-4"
            style={{ color: ACCENT }}
          >
            Ideal Customer Profiles
          </h3>
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
        </div>
      )}

      {/* Competitor Matrix */}
      {data.competitor_matrix?.length > 0 && (
        <div className="bg-card-bg border border-border-default rounded-card p-6">
          <h3
            className="text-[10px] uppercase tracking-[2px] mb-4"
            style={{ color: ACCENT }}
          >
            Competitor Matrix
          </h3>
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
        </div>
      )}

      {/* Pricing Intel */}
      {data.pricing_intel?.length > 0 && (
        <div className="bg-card-bg border border-border-default rounded-card p-6">
          <h3
            className="text-[10px] uppercase tracking-[2px] mb-4"
            style={{ color: ACCENT }}
          >
            Pricing Intelligence
          </h3>
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
        </div>
      )}

      {/* Trend Analysis */}
      {data.trend_analysis?.length > 0 && (
        <div className="bg-card-bg border border-border-default rounded-card p-6">
          <h3
            className="text-[10px] uppercase tracking-[2px] mb-4"
            style={{ color: ACCENT }}
          >
            Trend Analysis
          </h3>
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
