"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const TEAM_ID = "00000000-0000-0000-0000-000000000001";
const ACCENT = "#8B5CF6";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PositioningStatement {
  statement: string;
  target_customer: string;
  category: string;
  key_benefit: string;
  key_differentiator: string;
}

interface ValueProp {
  persona: string;
  headline: string;
  supporting_points: string[];
  proof_points: string[];
  emotional_appeal: string;
}

interface MessagingRow {
  persona: string;
  awareness: string;
  consideration: string;
  decision: string;
  retention: string;
}

interface ElevatorPitches {
  "10s": string;
  "30s": string;
  "60s": string;
}

interface CompetitiveNarrative {
  competitor: string;
  their_positioning: string;
  our_advantage: string;
  counter_narrative: string;
  when_they_win: string;
  talk_track: string;
}

interface StructuredOutput {
  positioning_statement: PositioningStatement;
  value_propositions: ValueProp[];
  messaging_matrix: MessagingRow[];
  elevator_pitches: ElevatorPitches;
  competitive_narratives: CompetitiveNarrative[];
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
export default function PositioningPage() {
  const [productCapabilities, setProductCapabilities] = useState("");
  const [brandGuidelines, setBrandGuidelines] = useState("");
  const [differentiationFocus, setDifferentiationFocus] = useState("product");
  const [includeMarketResearch, setIncludeMarketResearch] = useState(true);
  const [marketResearchAvailable, setMarketResearchAvailable] = useState(false);
  const [marketResearchSummary, setMarketResearchSummary] = useState("");

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

  // Track latest market research output for inclusion
  const marketResearchOutputRef = useRef<string | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/positioning/runs?teamId=${TEAM_ID}`);
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch {
      // ignore
    }
  }, []);

  // Check for latest market research run
  const checkMarketResearch = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/agents/positioning/latest-market-research?teamId=${TEAM_ID}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.run) {
          setMarketResearchAvailable(true);
          const output = data.run.output as { text?: string } | null;
          const input = data.run.input as Record<string, string> | null;
          marketResearchOutputRef.current = output?.text || null;
          setMarketResearchSummary(
            input?.product_description?.slice(0, 60) || "Market research available"
          );
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchRuns();
    checkMarketResearch();
  }, [fetchRuns, checkMarketResearch]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [streamedText]);

  async function fetchSources(runId: string) {
    try {
      const res = await fetch(`/api/agents/positioning/runs/${runId}`);
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
      { label: "Crafting positioning & messaging", status: "pending" },
      { label: "Generating structured output", status: "pending" },
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
    if (!productCapabilities.trim()) return;

    setIsRunning(true);
    setStreamedText("");
    setStructured(null);
    setError(null);
    setCurrentRunId(null);
    setSources([]);
    setSavedToKB(false);
    initProgressSteps();

    try {
      // Build input, optionally including market research context
      const input: Record<string, unknown> = {
        product_capabilities: productCapabilities,
        brand_guidelines: brandGuidelines,
        differentiation_focus: differentiationFocus,
      };

      if (includeMarketResearch && marketResearchOutputRef.current) {
        input.market_research_context = marketResearchOutputRef.current;
      }

      const res = await fetch("/api/agents/positioning", {
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
      const res = await fetch("/api/agents/positioning/save-to-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: TEAM_ID,
          runId: currentRunId,
          title: `Positioning: ${productCapabilities.slice(0, 60)}`,
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
        setStructured(JSON.parse(jsonMatch[1]));
        return;
      } catch {
        // fall through
      }
    }
    try {
      setStructured(JSON.parse(text));
    } catch {
      // raw text
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
            Positioning & Messaging Agent
          </h1>
        </div>
        <p className="text-text-secondary text-sm">
          Craft positioning statements, value propositions, messaging matrices,
          elevator pitches, and competitive narratives.
        </p>
      </div>

      {/* Input Form */}
      <div className="bg-card-bg border border-border-default rounded-card p-6 space-y-4">
        <div>
          <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">
            Product Capabilities
          </label>
          <textarea
            value={productCapabilities}
            onChange={(e) => setProductCapabilities(e.target.value)}
            placeholder="Describe your product capabilities, key features, and what makes it unique..."
            rows={3}
            className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#8B5CF6]/40 transition-colors resize-none"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">
            Brand Guidelines
          </label>
          <textarea
            value={brandGuidelines}
            onChange={(e) => setBrandGuidelines(e.target.value)}
            placeholder="Tone of voice, brand personality, words to use/avoid, style preferences..."
            rows={2}
            className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#8B5CF6]/40 transition-colors resize-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">
              Differentiation Focus
            </label>
            <select
              value={differentiationFocus}
              onChange={(e) => setDifferentiationFocus(e.target.value)}
              className="w-full bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#8B5CF6]/40 transition-colors"
            >
              <option value="product">Product</option>
              <option value="service">Service</option>
              <option value="price">Price</option>
              <option value="experience">Experience</option>
            </select>
          </div>

          {/* Market Research Toggle */}
          <div>
            <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-2">
              Upstream Context
            </label>
            <button
              onClick={() =>
                marketResearchAvailable &&
                setIncludeMarketResearch(!includeMarketResearch)
              }
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                !marketResearchAvailable
                  ? "border-border-default text-text-dim cursor-not-allowed"
                  : includeMarketResearch
                    ? "border-[#8B5CF6]/40 text-text-heading"
                    : "border-border-default text-text-secondary hover:border-[#8B5CF6]/20"
              }`}
            >
              <div
                className={`w-8 h-5 rounded-full relative transition-colors ${
                  includeMarketResearch && marketResearchAvailable
                    ? "bg-[#8B5CF6]"
                    : "bg-white/[0.08]"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    includeMarketResearch && marketResearchAvailable
                      ? "translate-x-3.5"
                      : "translate-x-0.5"
                  }`}
                />
              </div>
              <div>
                <span className="block">Include Market Research</span>
                {marketResearchAvailable ? (
                  <span className="text-[10px] text-text-dim">
                    {marketResearchSummary}...
                  </span>
                ) : (
                  <span className="text-[10px] text-text-dim">
                    No market research runs yet
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>

        <button
          onClick={handleRun}
          disabled={isRunning || !productCapabilities.trim()}
          className="px-6 py-2.5 text-white font-medium text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ backgroundColor: ACCENT }}
        >
          {isRunning ? "Crafting Positioning..." : "Generate Positioning"}
        </button>
      </div>

      {/* Error with Retry */}
      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[#EF4444] text-sm font-medium">
              Analysis Failed
            </p>
            <p className="text-[#EF4444]/70 text-xs mt-1">{error}</p>
          </div>
          <button
            onClick={handleRun}
            disabled={isRunning || !productCapabilities.trim()}
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
                  <svg
                    className="w-4 h-4 text-[#10B981]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : step.status === "active" ? (
                  <div
                    className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                    style={{
                      borderColor: `${ACCENT} transparent ${ACCENT} ${ACCENT}`,
                    }}
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
            {isRunning ? "Crafting Positioning..." : "Raw Output"}
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

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveToKnowledge}
              disabled={isSaving || savedToKB}
              className="px-5 py-2.5 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderColor: savedToKB ? "#10B981" : `${ACCENT}40`,
                color: savedToKB ? "#10B981" : ACCENT,
                backgroundColor: savedToKB
                  ? "rgba(16,185,129,0.1)"
                  : "transparent",
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
                Other agents can now reference this positioning.
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
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
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
      {/* Positioning Statement */}
      {data.positioning_statement && (
        <div
          className="bg-card-bg border rounded-card p-6"
          style={{ borderColor: `${ACCENT}30` }}
        >
          <h3
            className="text-[10px] uppercase tracking-[2px] mb-4"
            style={{ color: ACCENT }}
          >
            Positioning Statement
          </h3>
          <blockquote
            className="text-lg text-text-heading font-display leading-relaxed border-l-4 pl-4"
            style={{ borderColor: ACCENT }}
          >
            {data.positioning_statement.statement}
          </blockquote>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {[
              {
                label: "Target",
                value: data.positioning_statement.target_customer,
              },
              {
                label: "Category",
                value: data.positioning_statement.category,
              },
              {
                label: "Key Benefit",
                value: data.positioning_statement.key_benefit,
              },
              {
                label: "Differentiator",
                value: data.positioning_statement.key_differentiator,
              },
            ].map((item, i) => (
              <div key={i}>
                <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">
                  {item.label}
                </p>
                <p className="text-xs text-text-body">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Value Propositions (persona tabs) */}
      {data.value_propositions?.length > 0 && (
        <CollapsibleSection title="Value Propositions">
          <ValuePropTabs props={data.value_propositions} />
        </CollapsibleSection>
      )}

      {/* Messaging Matrix */}
      {data.messaging_matrix?.length > 0 && (
        <CollapsibleSection title="Messaging Matrix">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="text-left py-2 px-3 text-text-muted font-normal uppercase tracking-wider">
                    Persona
                  </th>
                  <th className="text-left py-2 px-3 text-text-muted font-normal uppercase tracking-wider">
                    Awareness
                  </th>
                  <th className="text-left py-2 px-3 text-text-muted font-normal uppercase tracking-wider">
                    Consideration
                  </th>
                  <th className="text-left py-2 px-3 text-text-muted font-normal uppercase tracking-wider">
                    Decision
                  </th>
                  <th className="text-left py-2 px-3 text-text-muted font-normal uppercase tracking-wider">
                    Retention
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.messaging_matrix.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-border-default last:border-0"
                  >
                    <td className="py-2 px-3 text-text-heading font-medium whitespace-nowrap">
                      {row.persona}
                    </td>
                    <td className="py-2 px-3 text-text-body">{row.awareness}</td>
                    <td className="py-2 px-3 text-text-body">
                      {row.consideration}
                    </td>
                    <td className="py-2 px-3 text-text-body">{row.decision}</td>
                    <td className="py-2 px-3 text-text-body">{row.retention}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {/* Elevator Pitches */}
      {data.elevator_pitches && (
        <CollapsibleSection title="Elevator Pitches">
          <ElevatorPitchCards pitches={data.elevator_pitches} />
        </CollapsibleSection>
      )}

      {/* Competitive Narratives */}
      {data.competitive_narratives?.length > 0 && (
        <CollapsibleSection title="Competitive Narratives">
          <div className="space-y-3">
            {data.competitive_narratives.map((cn, i) => (
              <CompetitiveNarrativeCard key={i} narrative={cn} />
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Value Prop Tabs
// ---------------------------------------------------------------------------
function ValuePropTabs({ props }: { props: ValueProp[] }) {
  const [activeTab, setActiveTab] = useState(0);
  const active = props[activeTab];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {props.map((vp, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-colors ${
              i === activeTab
                ? "text-white"
                : "text-text-secondary hover:text-text-body"
            }`}
            style={{
              backgroundColor: i === activeTab ? ACCENT : "rgba(255,255,255,0.04)",
            }}
          >
            {vp.persona}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      {active && (
        <div className="border border-border-default rounded-lg p-4 space-y-3">
          <h4 className="text-base font-semibold text-text-heading">
            {active.headline}
          </h4>

          {active.supporting_points?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">
                Supporting Points
              </p>
              <ul className="space-y-1">
                {active.supporting_points.map((sp, i) => (
                  <li key={i} className="text-xs text-text-body">
                    - {sp}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {active.proof_points?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">
                Proof Points
              </p>
              <ul className="space-y-1">
                {active.proof_points.map((pp, i) => (
                  <li key={i} className="text-xs text-text-body">
                    - {pp}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {active.emotional_appeal && (
            <div>
              <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">
                Emotional Appeal
              </p>
              <p className="text-xs text-text-body italic">
                {active.emotional_appeal}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Elevator Pitch Cards
// ---------------------------------------------------------------------------
function ElevatorPitchCards({ pitches }: { pitches: ElevatorPitches }) {
  const [activeLength, setActiveLength] = useState<"10s" | "30s" | "60s">(
    "30s"
  );

  const lengths: ("10s" | "30s" | "60s")[] = ["10s", "30s", "60s"];

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {lengths.map((len) => (
          <button
            key={len}
            onClick={() => setActiveLength(len)}
            className={`px-4 py-2 text-xs font-mono rounded-lg transition-colors ${
              len === activeLength
                ? "text-white"
                : "text-text-secondary hover:text-text-body"
            }`}
            style={{
              backgroundColor:
                len === activeLength ? ACCENT : "rgba(255,255,255,0.04)",
            }}
          >
            {len}
          </button>
        ))}
      </div>
      <div className="border border-border-default rounded-lg p-4">
        <p className="text-sm text-text-heading leading-relaxed">
          {pitches[activeLength]}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Competitive Narrative Card
// ---------------------------------------------------------------------------
function CompetitiveNarrativeCard({
  narrative,
}: {
  narrative: CompetitiveNarrative;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-border-default rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/[0.01] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-text-heading">
            vs {narrative.competitor}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-text-muted">
            {narrative.their_positioning?.slice(0, 40)}
            {(narrative.their_positioning?.length ?? 0) > 40 ? "..." : ""}
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
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">
                Our Advantage
              </p>
              <p className="text-xs text-text-body">{narrative.our_advantage}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">
                When They Win
              </p>
              <p className="text-xs text-text-body">{narrative.when_they_win}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">
              Counter Narrative
            </p>
            <p className="text-xs text-text-body">{narrative.counter_narrative}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[2px] text-text-muted mb-1">
              Talk Track
            </p>
            <p className="text-xs text-text-body italic">
              &quot;{narrative.talk_track}&quot;
            </p>
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
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/[0.01] transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
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
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
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
                  {input?.product_capabilities?.slice(0, 80) || "Agent run"}
                  {(input?.product_capabilities?.length ?? 0) > 80 ? "..." : ""}
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
