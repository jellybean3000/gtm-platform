"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const TEAM_ID = "00000000-0000-0000-0000-000000000001";
const ACCENT = "#10B981";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
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

const AGENT_NAMES: Record<string, string> = {
  "market-research": "Market Research",
  pmf: "PMF",
  positioning: "Positioning",
  analytics: "Analytics",
  content: "Content",
  "sales-enablement": "Sales Enablement",
  "demand-gen": "Demand Gen",
  launch: "Launch Planning",
  crm: "CRM",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type AgentStatus = "queued" | "running" | "completed" | "failed";
type Phase = "idle" | "planning" | "executing" | "conflicts" | "synthesis" | "done";

interface ParsedIntent {
  requiredAgents: string[];
  agentInputs: Record<string, Record<string, unknown>>;
  goalSummary: string;
  reasoning: string;
}

interface ConflictItem {
  id: string;
  agents: [string, string];
  topic: string;
  agentA: { slug: string; claim: string };
  agentB: { slug: string; claim: string };
  suggestedResolution: string;
  severity: "high" | "medium" | "low";
}

interface HistoryItem {
  id: string;
  userRequest: string;
  parsedIntent: ParsedIntent | null;
  status: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// SSE parser
// ---------------------------------------------------------------------------
function parseSSEBuffer(buffer: string) {
  const events: { event: string; data: unknown }[] = [];
  const blocks = buffer.split("\n\n");
  let remaining = "";

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (i === blocks.length - 1 && !buffer.endsWith("\n\n")) {
      remaining = block;
      break;
    }

    let eventName = "message";
    let dataStr = "";

    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) eventName = line.slice(7);
      else if (line.startsWith("data: ")) dataStr = line.slice(6);
    }

    if (dataStr) {
      try {
        events.push({ event: eventName, data: JSON.parse(dataStr) });
      } catch {
        /* skip */
      }
    }
  }

  return { parsed: events, remaining };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function OrchestratorPage() {
  // Chat state
  const [inputValue, setInputValue] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  // Plan state
  const [plan, setPlan] = useState<{
    parsedIntent: ParsedIntent;
    waves: string[][];
    orchestrationId: string;
  } | null>(null);

  // Agent execution state
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [agentPreviews, setAgentPreviews] = useState<Record<string, string>>({});

  // Conflict + synthesis
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);
  const [synthesis, setSynthesis] = useState("");
  const [orchestrationId, setOrchestrationId] = useState<string | null>(null);

  // History
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Past orchestration view
  const [viewingPast, setViewingPast] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [phase, agentStatuses, synthesis]);

  // Fetch history on mount
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/orchestrator/history?teamId=${TEAM_ID}`);
      if (!res.ok) return;
      const data = await res.json();
      setHistory(data.orchestrations || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ---------------------------------------------------------------------------
  // Run orchestration
  // ---------------------------------------------------------------------------
  const handleSubmit = async () => {
    const request = inputValue.trim();
    if (!request || phase !== "idle") return;

    setInputValue("");
    setPhase("planning");
    setStatusMessage("Analyzing your request...");
    setPlan(null);
    setAgentStatuses({});
    setAgentPreviews({});
    setConflicts([]);
    setSynthesis("");
    setOrchestrationId(null);
    setViewingPast(false);

    try {
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userRequest: request, teamId: TEAM_ID }),
      });

      if (!res.ok) {
        setPhase("idle");
        setStatusMessage("Failed to start orchestration.");
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { parsed, remaining } = parseSSEBuffer(buffer);
        buffer = remaining;

        for (const { event, data } of parsed) {
          const d = data as Record<string, unknown>;

          switch (event) {
            case "status":
              setStatusMessage(d.message as string);
              break;

            case "plan":
              setPlan({
                parsedIntent: d.parsedIntent as ParsedIntent,
                waves: d.waves as string[][],
                orchestrationId: d.orchestrationId as string,
              });
              setOrchestrationId(d.orchestrationId as string);
              setPhase("executing");
              setStatusMessage("Executing agents...");
              break;

            case "agent_queued":
              setAgentStatuses((prev) => ({
                ...prev,
                [d.slug as string]: "queued",
              }));
              break;

            case "agent_start":
              setAgentStatuses((prev) => ({
                ...prev,
                [d.slug as string]: "running",
              }));
              break;

            case "agent_complete":
              setAgentStatuses((prev) => ({
                ...prev,
                [d.slug as string]: "completed",
              }));
              if (d.outputPreview) {
                setAgentPreviews((prev) => ({
                  ...prev,
                  [d.slug as string]: d.outputPreview as string,
                }));
              }
              break;

            case "agent_error":
              setAgentStatuses((prev) => ({
                ...prev,
                [d.slug as string]: "failed",
              }));
              break;

            case "conflicts":
              setConflicts((d.conflicts as ConflictItem[]) || []);
              if ((d.conflicts as ConflictItem[])?.length > 0) {
                setPhase("conflicts");
              }
              break;

            case "synthesis":
              setSynthesis(d.text as string);
              setPhase("synthesis");
              setStatusMessage("");
              break;

            case "done":
              setPhase("done");
              fetchHistory();
              break;

            case "error":
              setPhase("idle");
              setStatusMessage(`Error: ${d.message}`);
              break;
          }
        }
      }
    } catch (err) {
      console.error("Orchestration error:", err);
      setPhase("idle");
      setStatusMessage("Connection failed.");
    }
  };

  // ---------------------------------------------------------------------------
  // View past orchestration
  // ---------------------------------------------------------------------------
  const loadPastOrchestration = async (id: string) => {
    try {
      const res = await fetch(
        `/api/orchestrator?id=${id}&teamId=${TEAM_ID}`
      );
      if (!res.ok) return;
      const data = await res.json();
      const orch = data.orchestration;

      setViewingPast(true);
      setOrchestrationId(orch.id);
      setPlan(
        orch.parsedIntent
          ? {
              parsedIntent: orch.parsedIntent as ParsedIntent,
              waves: (orch.executionDag as { waves: string[][] })?.waves || [],
              orchestrationId: orch.id,
            }
          : null
      );

      // Reconstruct agent statuses from runs
      const statuses: Record<string, AgentStatus> = {};
      const previews: Record<string, string> = {};
      for (const run of data.agentRuns || []) {
        // Find slug from agent name
        const slug = Object.entries(AGENT_NAMES).find(
          ([, name]) => name === run.agentName
        )?.[0];
        if (!slug) continue;
        statuses[slug] =
          run.status === "completed"
            ? "completed"
            : run.status === "failed"
              ? "failed"
              : "queued";
        if (run.output?.text) {
          previews[slug] = (run.output.text as string).slice(0, 500);
        }
      }
      setAgentStatuses(statuses);
      setAgentPreviews(previews);
      setConflicts((orch.conflicts as ConflictItem[]) || []);
      setSynthesis(
        (orch.finalSynthesis as { text: string })?.text || ""
      );
      setPhase(orch.status === "completed" ? "done" : "idle");
      setStatusMessage("");
      setInputValue("");
    } catch {
      /* ignore */
    }
  };

  // ---------------------------------------------------------------------------
  // Resolve conflict
  // ---------------------------------------------------------------------------
  const resolveConflict = async (
    conflictId: string,
    chosenSlug: string
  ) => {
    if (!orchestrationId || resolving) return;
    setResolving(conflictId);

    try {
      const res = await fetch("/api/orchestrator/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orchestrationId,
          conflictId,
          chosenSlug,
          teamId: TEAM_ID,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setConflicts((prev) =>
          prev.map((c) =>
            c.id === conflictId
              ? { ...c, id: `resolved-${c.id}` }
              : c
          )
        );
        if (data.updatedSynthesis) {
          setSynthesis(data.updatedSynthesis);
        }
      }
    } catch {
      /* ignore */
    } finally {
      setResolving(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Reset to new
  // ---------------------------------------------------------------------------
  const handleNew = () => {
    setPhase("idle");
    setPlan(null);
    setAgentStatuses({});
    setAgentPreviews({});
    setConflicts([]);
    setSynthesis("");
    setOrchestrationId(null);
    setStatusMessage("");
    setViewingPast(false);
    setInputValue("");
    inputRef.current?.focus();
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const isRunning = phase !== "idle" && phase !== "done";

  return (
    <div className="flex h-full">
      {/* History sidebar */}
      <div className="w-64 border-r border-border-default flex flex-col bg-background shrink-0">
        <div className="p-4 border-b border-border-default">
          <button
            onClick={handleNew}
            className="w-full px-3 py-2 rounded-lg text-xs font-medium transition-all border border-border-default hover:border-[#10B981]/30 text-text-body hover:text-[#10B981]"
          >
            + New Strategy
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {history.map((item) => (
            <button
              key={item.id}
              onClick={() => loadPastOrchestration(item.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs mb-1 transition-all ${
                orchestrationId === item.id
                  ? "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20"
                  : "text-text-dim hover:text-text-body hover:bg-card-bg border border-transparent"
              }`}
            >
              <div className="truncate font-medium">
                {item.userRequest.slice(0, 60)}
                {item.userRequest.length > 60 ? "..." : ""}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    item.status === "completed"
                      ? "bg-[#10B981]"
                      : item.status === "failed"
                        ? "bg-[#EF4444]"
                        : "bg-[#FBBF24]"
                  }`}
                />
                <span className="text-[10px] text-text-dim">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>
            </button>
          ))}
          {history.length === 0 && (
            <p className="text-[10px] text-text-dim text-center mt-4">
              No past orchestrations
            </p>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col h-full">
        {/* Header */}
        <div className="border-b border-border-default px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                background: `linear-gradient(135deg, #0EA5E9, #8B5CF6, #EC4899, #EF4444, #F59E0B, #10B981)`,
              }}
            />
            <div>
              <h1 className="text-lg font-semibold text-text-heading">
                GTM Orchestrator
              </h1>
              <p className="text-[10px] uppercase tracking-[2px] text-text-dim">
                Multi-Agent Strategy Engine
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable content area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
          {/* Idle state — prompt */}
          {phase === "idle" && !viewingPast && !synthesis && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div
                className="w-12 h-12 rounded-full mb-4"
                style={{
                  background: `linear-gradient(135deg, #0EA5E9, #8B5CF6, #EC4899, #EF4444, #F59E0B, #10B981)`,
                  opacity: 0.3,
                }}
              />
              <h2 className="text-xl font-semibold text-text-heading mb-2">
                What GTM strategy do you need?
              </h2>
              <p className="text-sm text-text-muted max-w-md mb-6">
                Describe your goal and the orchestrator will determine which
                agents to run, execute them in the right order, and synthesize
                a unified strategy.
              </p>
              <div className="grid grid-cols-2 gap-2 max-w-lg">
                {[
                  "We're launching our product in Germany next quarter. Prepare everything.",
                  "Write a competitive battle card against our top competitor",
                  "Which deals are at risk and what should we do?",
                  "Build a complete demand gen campaign for Q2",
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => {
                      setInputValue(example);
                      inputRef.current?.focus();
                    }}
                    className="text-left px-3 py-2 rounded-lg text-xs text-text-dim hover:text-text-body border border-border-default hover:border-[#10B981]/30 transition-all"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status message */}
          {statusMessage && isRunning && (
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: ACCENT }}
              />
              <span className="text-xs text-text-muted">
                {statusMessage}
              </span>
            </div>
          )}

          {/* Plan card */}
          {plan && (
            <div className="mb-6">
              <div className="bg-card-bg border border-border-default rounded-[14px] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      background: `linear-gradient(135deg, #0EA5E9, #8B5CF6, #EC4899, #10B981)`,
                    }}
                  />
                  <span
                    className="text-[10px] uppercase tracking-[2px] font-semibold"
                    style={{ color: ACCENT }}
                  >
                    Execution Plan
                  </span>
                </div>

                <p className="text-sm text-text-body mb-1">
                  {plan.parsedIntent.goalSummary}
                </p>
                <p className="text-xs text-text-dim mb-4">
                  {plan.parsedIntent.reasoning}
                </p>

                {/* Wave visualization */}
                <div className="flex items-start gap-2 overflow-x-auto pb-2">
                  {plan.waves.map((wave, wi) => (
                    <div key={wi} className="flex items-start gap-2">
                      {wi > 0 && (
                        <div className="flex items-center self-center text-text-dim text-lg px-1">
                          →
                        </div>
                      )}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] uppercase tracking-[1.5px] text-text-dim mb-0.5">
                          Wave {wi + 1}
                        </span>
                        {wave.map((slug) => (
                          <AgentCard
                            key={slug}
                            slug={slug}
                            status={agentStatuses[slug] || "queued"}
                            preview={agentPreviews[slug]}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Conflicts */}
          {conflicts.length > 0 && (
            <div className="mb-6 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[2px] font-semibold text-[#FBBF24]">
                  Conflicts Detected
                </span>
                <span className="text-[10px] text-text-dim">
                  ({conflicts.filter((c) => !c.id.startsWith("resolved-")).length} unresolved)
                </span>
              </div>

              {conflicts.map((conflict) => {
                const isResolved = conflict.id.startsWith("resolved-");
                return (
                  <div
                    key={conflict.id}
                    className={`border rounded-[14px] p-4 ${
                      isResolved
                        ? "border-border-default bg-card-bg opacity-60"
                        : "border-[#FBBF24]/20 bg-[#FBBF24]/5"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm">⚠️</span>
                      <span className="text-xs font-medium text-text-heading">
                        {conflict.topic}
                      </span>
                      <span
                        className={`text-[9px] uppercase tracking-[1px] px-1.5 py-0.5 rounded ${
                          conflict.severity === "high"
                            ? "bg-[#EF4444]/10 text-[#EF4444]"
                            : conflict.severity === "medium"
                              ? "bg-[#FBBF24]/10 text-[#FBBF24]"
                              : "bg-[#6366F1]/10 text-[#6366F1]"
                        }`}
                      >
                        {conflict.severity}
                      </span>
                      {isResolved && (
                        <span className="text-[9px] uppercase tracking-[1px] px-1.5 py-0.5 rounded bg-[#10B981]/10 text-[#10B981]">
                          Resolved
                        </span>
                      )}
                    </div>

                    {!isResolved && (
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="border border-border-default rounded-lg p-3">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{
                                background:
                                  AGENT_COLORS[conflict.agentA.slug] || "#71717A",
                              }}
                            />
                            <span className="text-[10px] font-medium text-text-muted">
                              {AGENT_NAMES[conflict.agentA.slug] ||
                                conflict.agentA.slug}
                            </span>
                          </div>
                          <p className="text-xs text-text-body mb-2">
                            {conflict.agentA.claim}
                          </p>
                          <button
                            onClick={() =>
                              resolveConflict(
                                conflict.id,
                                conflict.agentA.slug
                              )
                            }
                            disabled={resolving === conflict.id}
                            className="text-[10px] px-2 py-1 rounded border border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/10 transition-all disabled:opacity-40"
                          >
                            Choose this direction
                          </button>
                        </div>
                        <div className="border border-border-default rounded-lg p-3">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{
                                background:
                                  AGENT_COLORS[conflict.agentB.slug] || "#71717A",
                              }}
                            />
                            <span className="text-[10px] font-medium text-text-muted">
                              {AGENT_NAMES[conflict.agentB.slug] ||
                                conflict.agentB.slug}
                            </span>
                          </div>
                          <p className="text-xs text-text-body mb-2">
                            {conflict.agentB.claim}
                          </p>
                          <button
                            onClick={() =>
                              resolveConflict(
                                conflict.id,
                                conflict.agentB.slug
                              )
                            }
                            disabled={resolving === conflict.id}
                            className="text-[10px] px-2 py-1 rounded border border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/10 transition-all disabled:opacity-40"
                          >
                            Choose this direction
                          </button>
                        </div>
                      </div>
                    )}

                    <p className="text-[10px] text-text-dim">
                      💡 {conflict.suggestedResolution}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Synthesis */}
          {synthesis && (
            <div className="mb-6">
              <div className="bg-card-bg border border-[#10B981]/20 rounded-[14px] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      background: `linear-gradient(135deg, #0EA5E9, #8B5CF6, #EC4899, #10B981)`,
                    }}
                  />
                  <span
                    className="text-[10px] uppercase tracking-[2px] font-semibold"
                    style={{ color: ACCENT }}
                  >
                    Unified Strategy
                  </span>
                </div>
                <div className="prose prose-invert prose-sm max-w-none text-text-body">
                  <SynthesisMarkdown text={synthesis} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-border-default px-6 py-4">
          <div className="flex gap-3">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Describe your GTM strategy needs..."
              disabled={isRunning}
              rows={1}
              className="flex-1 bg-card-bg border border-border-default rounded-lg px-4 py-3 text-sm text-text-body placeholder-text-dim focus:outline-none focus:border-[#10B981]/30 resize-none disabled:opacity-40"
            />
            <button
              onClick={handleSubmit}
              disabled={isRunning || !inputValue.trim()}
              className="px-4 py-3 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
              style={{
                background: inputValue.trim() && !isRunning ? ACCENT : "transparent",
                color: inputValue.trim() && !isRunning ? "#fff" : "#52525B",
                border: `1px solid ${inputValue.trim() && !isRunning ? ACCENT : "rgba(255,255,255,0.06)"}`,
              }}
            >
              Run
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent status card
// ---------------------------------------------------------------------------
function AgentCard({
  slug,
  status,
  preview,
}: {
  slug: string;
  status: AgentStatus;
  preview?: string;
}) {
  const color = AGENT_COLORS[slug] || "#71717A";
  const name = AGENT_NAMES[slug] || slug;
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="border rounded-lg p-2.5 min-w-[140px] transition-all cursor-pointer"
      style={{
        borderColor:
          status === "completed"
            ? `${color}40`
            : status === "running"
              ? `${color}60`
              : "rgba(255,255,255,0.06)",
        backgroundColor:
          status === "completed" ? `${color}08` : "rgba(255,255,255,0.02)",
      }}
      onClick={() => preview && setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        {status === "running" && (
          <div
            className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin shrink-0"
            style={{
              borderColor: `${color} transparent ${color} ${color}`,
            }}
          />
        )}
        {status === "completed" && (
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
        )}
        {status === "failed" && (
          <div className="w-3 h-3 rounded-full bg-[#EF4444] shrink-0" />
        )}
        {status === "queued" && (
          <div className="w-3 h-3 rounded-full border border-[#3F3F46] shrink-0" />
        )}
        <span className="text-xs font-medium text-text-heading truncate">
          {name}
        </span>
      </div>
      <div className="mt-1">
        <span
          className="text-[9px] uppercase tracking-[1.5px]"
          style={{
            color:
              status === "completed" || status === "running"
                ? color
                : status === "failed"
                  ? "#EF4444"
                  : "#52525B",
          }}
        >
          {status}
        </span>
      </div>
      {expanded && preview && (
        <div className="mt-2 pt-2 border-t border-border-default">
          <p className="text-[10px] text-text-dim whitespace-pre-wrap line-clamp-6">
            {preview}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simple markdown renderer for synthesis
// ---------------------------------------------------------------------------
function SynthesisMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (line.startsWith("# ")) {
          return (
            <h1
              key={i}
              className="text-xl font-bold text-text-heading mt-4 mb-2"
            >
              {line.slice(2)}
            </h1>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h2
              key={i}
              className="text-lg font-semibold text-text-heading mt-4 mb-1"
            >
              {line.slice(3)}
            </h2>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h3
              key={i}
              className="text-sm font-semibold text-text-heading mt-3 mb-1"
            >
              {line.slice(4)}
            </h3>
          );
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          return (
            <p key={i} className="text-sm font-semibold text-text-heading mt-3">
              {line.slice(2, -2)}
            </p>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={i} className="flex gap-2 ml-2">
              <span className="text-text-dim">•</span>
              <span className="text-xs text-text-body">
                <InlineMarkdown text={line.slice(2)} />
              </span>
            </div>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          const match = line.match(/^(\d+)\.\s(.*)$/);
          if (match) {
            return (
              <div key={i} className="flex gap-2 ml-2">
                <span className="text-text-dim text-xs">{match[1]}.</span>
                <span className="text-xs text-text-body">
                  <InlineMarkdown text={match[2]} />
                </span>
              </div>
            );
          }
        }
        if (line.trim() === "") {
          return <div key={i} className="h-2" />;
        }
        return (
          <p key={i} className="text-xs text-text-body">
            <InlineMarkdown text={line} />
          </p>
        );
      })}
    </div>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  // Handle bold (**text**)
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-text-heading">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
