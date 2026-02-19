import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { createAgent } from "@/lib/agents";

const MODEL = "claude-sonnet-4-5-20250929";

// ---------------------------------------------------------------------------
// Agent dependency graph (mirrors seed.ts)
// ---------------------------------------------------------------------------
const AGENT_DEPENDENCIES: Record<string, string[]> = {
  "market-research": [],
  pmf: [],
  positioning: ["market-research", "pmf"],
  analytics: ["market-research"],
  content: ["positioning"],
  "sales-enablement": ["positioning"],
  "demand-gen": ["positioning"],
  launch: ["content", "sales-enablement", "demand-gen"],
  crm: [],
};

export const AGENT_DISPLAY_NAMES: Record<string, string> = {
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

export const AGENT_COLORS: Record<string, string> = {
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

// ---------------------------------------------------------------------------
// Upstream context key mapping — how agent outputs flow downstream
// ---------------------------------------------------------------------------
const UPSTREAM_CONTEXT_KEYS: Record<string, Record<string, string>> = {
  positioning: {
    "market-research": "market_research_context",
    pmf: "pmf_context",
  },
  analytics: {
    "market-research": "market_research_context",
  },
  content: {
    positioning: "positioning_context",
  },
  "sales-enablement": {
    positioning: "positioning_context",
  },
  "demand-gen": {
    positioning: "positioning_context",
  },
  launch: {
    content: "content_context",
    "sales-enablement": "sales_enablement_context",
    "demand-gen": "demand_gen_context",
    positioning: "positioning_context",
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ParsedIntent {
  requiredAgents: string[];
  agentInputs: Record<string, Record<string, unknown>>;
  goalSummary: string;
  reasoning: string;
}

export interface ConflictItem {
  id: string;
  agents: [string, string];
  topic: string;
  agentA: { slug: string; claim: string };
  agentB: { slug: string; claim: string };
  suggestedResolution: string;
  severity: "high" | "medium" | "low";
}

export interface AgentOutput {
  runId: string;
  output: string;
  tokensUsed: number;
}

export type AgentOutputMap = Record<string, AgentOutput>;

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------
const INTENT_PARSING_PROMPT = `You are the GTM Engineer Orchestrator. You analyze natural language GTM requests and determine which specialist agents to run and what inputs to give them.

Available agents:
- market-research: Analyzes competitors, ICPs, TAM/SAM/SOM, pricing intel, trends. Input fields: product_description, target_market, known_competitors, research_depth
- pmf: Assesses product-market fit, builds interview scripts and surveys. Input fields: product_description, hypotheses, customer_segments, research_type
- positioning: Crafts positioning statements, value propositions, messaging matrix. Input fields: product_capabilities, brand_guidelines, differentiation_focus. REQUIRES: market-research, pmf
- analytics: Analyzes performance data, funnels, win/loss. Input fields: analysis_type, data_description, time_period, segments. REQUIRES: market-research
- content: Creates marketing content (blog posts, battle cards, case studies, etc). Input fields: content_type, target_persona, funnel_stage, additional_context. REQUIRES: positioning
- sales-enablement: Builds objection playbooks, email sequences, demo scripts, talk tracks. Input fields: target_persona, sales_process, known_objections, output_type. REQUIRES: positioning
- demand-gen: Designs campaigns, landing pages, ad creative, funnel projections. Input fields: campaign_goals, budget, timeline, existing_channels. REQUIRES: positioning
- launch: Creates comprehensive launch plans synthesizing all upstream work. Input fields: product_name, launch_date, launch_type, channels. REQUIRES: content, sales-enablement, demand-gen
- crm: Analyzes CRM pipeline, deal health, and provides deal-level recommendations. Input fields: analysis_focus, deal_name, deal_stage

Rules:
1. Only include agents relevant to the request
2. Always include required upstream dependencies (e.g. if positioning is needed, include market-research and pmf)
3. Extract as much detail as possible from the user request for agent inputs
4. For missing fields, use reasonable defaults based on context
5. If the request is about deals, pipeline, or CRM data, include the crm agent

Return ONLY valid JSON (no markdown, no code fences):
{
  "requiredAgents": ["slug1", "slug2"],
  "agentInputs": {
    "slug1": { "field1": "value" }
  },
  "goalSummary": "One sentence describing the goal",
  "reasoning": "Why these agents were selected"
}`;

const CONFLICT_DETECTION_PROMPT = `You are reviewing outputs from multiple GTM specialist agents that ran as part of a coordinated strategy. Identify contradictions or tensions between their recommendations.

Look for conflicts in:
1. Target market definitions (one says SMB, another says enterprise)
2. Pricing positioning (premium vs value vs PLG)
3. Competitive claims (contradictory statements about the same competitor)
4. Timeline recommendations (conflicting urgency levels)
5. Channel prioritization (different primary channels recommended)
6. Messaging tone/voice inconsistencies
7. Resource allocation conflicts

Return ONLY valid JSON (no markdown, no code fences). Return an array of conflicts:
[{
  "id": "conflict-1",
  "agents": ["slug1", "slug2"],
  "topic": "What they conflict on",
  "agentA": { "slug": "slug1", "claim": "What this agent says" },
  "agentB": { "slug": "slug2", "claim": "What this agent says" },
  "suggestedResolution": "How to resolve this",
  "severity": "high|medium|low"
}]

If no conflicts found, return: []`;

const SYNTHESIS_PROMPT = `You are a senior GTM strategist synthesizing outputs from multiple specialist agents into a unified, actionable strategy.

Create an executive summary that includes:
1. **Strategic Overview** — The core strategy in 2-3 sentences
2. **Key Decisions** — The most important strategic choices made
3. **Priority Actions** — Top 5 immediate next steps, ordered by impact
4. **Risk Factors** — Key risks and mitigation strategies
5. **Timeline** — Recommended sequence and milestones

Write in clear, executive-friendly language. Be specific and actionable — reference actual data, numbers, and recommendations from the agent outputs. Use markdown formatting.`;

// ---------------------------------------------------------------------------
// OrchestratorEngine
// ---------------------------------------------------------------------------
export class OrchestratorEngine {
  private teamId: string;

  constructor(teamId: string) {
    this.teamId = teamId;
  }

  /**
   * Parse user request into structured intent using Claude.
   */
  async parseIntent(userRequest: string): Promise<ParsedIntent> {
    const result = await generateText({
      model: anthropic(MODEL),
      system: INTENT_PARSING_PROMPT,
      messages: [{ role: "user", content: userRequest }],
    });

    try {
      const parsed = JSON.parse(result.text);
      return parsed as ParsedIntent;
    } catch {
      // Try extracting JSON from markdown code block
      const jsonMatch = result.text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]) as ParsedIntent;
      }
      throw new Error("Failed to parse intent from Claude response");
    }
  }

  /**
   * Build execution DAG from required agents using topological sort.
   * Returns waves — each wave is a list of agents that can run in parallel.
   */
  buildDAG(requiredAgents: string[]): string[][] {
    // Filter dependency map to only required agents
    const filtered: Record<string, string[]> = {};
    for (const slug of requiredAgents) {
      filtered[slug] = (AGENT_DEPENDENCIES[slug] || []).filter((dep) =>
        requiredAgents.includes(dep)
      );
    }

    // Kahn's algorithm
    const waves: string[][] = [];
    const inDegree: Record<string, number> = {};

    for (const slug of requiredAgents) {
      inDegree[slug] = filtered[slug].length;
    }

    while (Object.keys(inDegree).length > 0) {
      const wave = Object.keys(inDegree).filter((s) => inDegree[s] === 0);
      if (wave.length === 0) break; // cycle guard

      waves.push(wave);

      for (const slug of wave) {
        delete inDegree[slug];
        for (const remaining of Object.keys(inDegree)) {
          if (filtered[remaining].includes(slug)) {
            inDegree[remaining]--;
          }
        }
      }
    }

    return waves;
  }

  /**
   * Execute a single agent with upstream context injection.
   */
  async executeSingleAgent(
    slug: string,
    orchestrationId: string,
    agentInputs: Record<string, Record<string, unknown>>,
    collectedOutputs: AgentOutputMap
  ): Promise<AgentOutput> {
    // Look up agent from DB
    const [agentRow] = await db
      .select()
      .from(agents)
      .where(eq(agents.slug, slug))
      .limit(1);

    if (!agentRow) {
      throw new Error(`Agent not found in DB: ${slug}`);
    }

    // Build input with upstream context
    const baseInput = agentInputs[slug] || {};
    const enrichedInput = this.injectUpstreamContext(
      slug,
      baseInput,
      collectedOutputs
    );

    // Create and run the agent
    const agentInstance = createAgent(slug, {
      agentId: agentRow.id,
      slug: agentRow.slug,
      name: agentRow.name,
      systemPrompt:
        agentRow.systemPrompt ||
        `You are the ${agentRow.name} Agent, a specialist in the GTM platform. Analyze the input and generate a comprehensive, actionable response.`,
      teamId: this.teamId,
    });

    const result = await agentInstance.run(enrichedInput, orchestrationId);

    return {
      runId: result.runId,
      output: result.output,
      tokensUsed: result.tokensUsed,
    };
  }

  /**
   * Detect conflicts between agent outputs.
   */
  async detectConflicts(outputs: AgentOutputMap): Promise<ConflictItem[]> {
    const slugs = Object.keys(outputs);
    if (slugs.length < 2) return [];

    // Build a summary of each agent's output (truncated)
    const outputSummary = slugs
      .map((slug) => {
        const truncated = outputs[slug].output.slice(0, 2000);
        return `=== ${AGENT_DISPLAY_NAMES[slug] || slug} (${slug}) ===\n${truncated}`;
      })
      .join("\n\n");

    const result = await generateText({
      model: anthropic(MODEL),
      system: CONFLICT_DETECTION_PROMPT,
      messages: [
        {
          role: "user",
          content: `Review these agent outputs for conflicts:\n\n${outputSummary}`,
        },
      ],
    });

    try {
      const parsed = JSON.parse(result.text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      const jsonMatch = result.text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        return Array.isArray(parsed) ? parsed : [];
      }
      return [];
    }
  }

  /**
   * Synthesize all agent outputs into a unified GTM strategy.
   */
  async synthesize(
    userRequest: string,
    parsedIntent: ParsedIntent,
    outputs: AgentOutputMap,
    conflicts: ConflictItem[]
  ): Promise<string> {
    const outputSummary = Object.entries(outputs)
      .map(
        ([slug, o]) =>
          `=== ${AGENT_DISPLAY_NAMES[slug] || slug} ===\n${o.output.slice(0, 3000)}`
      )
      .join("\n\n");

    const conflictNote =
      conflicts.length > 0
        ? `\n\nNOTE: The following conflicts were detected between agents:\n${conflicts
            .map(
              (c) =>
                `- ${c.topic}: ${c.agentA.slug} says "${c.agentA.claim}" vs ${c.agentB.slug} says "${c.agentB.claim}"`
            )
            .join("\n")}\nAddress these tensions in your synthesis.`
        : "";

    const result = await generateText({
      model: anthropic(MODEL),
      system: SYNTHESIS_PROMPT,
      messages: [
        {
          role: "user",
          content: `Original request: ${userRequest}\n\nGoal: ${parsedIntent.goalSummary}\n\nAgent outputs:\n\n${outputSummary}${conflictNote}`,
        },
      ],
    });

    return result.text;
  }

  /**
   * Inject upstream agent outputs into an agent's input.
   */
  private injectUpstreamContext(
    slug: string,
    baseInput: Record<string, unknown>,
    collectedOutputs: AgentOutputMap
  ): Record<string, unknown> {
    const keyMap = UPSTREAM_CONTEXT_KEYS[slug] || {};
    const enriched = { ...baseInput };

    for (const [upstreamSlug, contextKey] of Object.entries(keyMap)) {
      if (collectedOutputs[upstreamSlug]) {
        enriched[contextKey] = collectedOutputs[upstreamSlug].output;
      }
    }

    return enriched;
  }
}
