import { streamText, generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentRuns } from "@/lib/db/schema";
import {
  queryKnowledge,
  KnowledgeChunkResult,
} from "@/lib/knowledge/retrieve";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface AgentConfig {
  agentId: string;
  slug: string;
  name: string;
  systemPrompt: string;
  teamId: string;
}

export interface AgentRunResult {
  runId: string;
  output: string;
  knowledgeSourcesUsed: string[];
  tokensUsed: number;
}

const MODEL = "claude-sonnet-4-5-20250929";

// ---------------------------------------------------------------------------
// BaseAgent — foundation for all specialist agents
// ---------------------------------------------------------------------------
export class BaseAgent {
  protected config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * Build a knowledge-grounded search query from the agent input.
   * Subclasses can override to customize how knowledge is retrieved.
   */
  protected buildKnowledgeQuery(input: Record<string, unknown>): string {
    // Use agent name + key input values to form a search query
    const inputSummary = Object.entries(input)
      .filter(([, v]) => typeof v === "string" && (v as string).length < 500)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");

    return `${this.config.name}: ${inputSummary}`.slice(0, 1000);
  }

  /**
   * Format retrieved knowledge chunks into a context block for the system prompt.
   */
  protected formatKnowledgeContext(chunks: KnowledgeChunkResult[]): string {
    if (chunks.length === 0) {
      return "\n<knowledge_context>\nNo relevant knowledge found in the knowledge base.\n</knowledge_context>";
    }

    const formatted = chunks
      .map(
        (c, i) =>
          `[Source ${i + 1}: ${c.sourceDocument}${c.sourceUrl ? ` (${c.sourceUrl})` : ""} | Relevance: ${(c.similarity * 100).toFixed(0)}%]\n${c.content}`
      )
      .join("\n\n");

    return `\n<knowledge_context>\nThe following knowledge was retrieved from the company's knowledge base. Ground your response in this context. Always cite sources when using specific facts or data.\n\n${formatted}\n</knowledge_context>`;
  }

  /**
   * Create an agent_runs record and return its ID.
   */
  private async createRun(
    input: Record<string, unknown>,
    orchestrationId?: string
  ): Promise<string> {
    const [run] = await db
      .insert(agentRuns)
      .values({
        teamId: this.config.teamId,
        agentId: this.config.agentId,
        orchestrationId: orchestrationId || null,
        status: "queued",
        input,
      })
      .returning({ id: agentRuns.id });

    return run.id;
  }

  /**
   * Update an agent_runs record.
   */
  private async updateRun(
    runId: string,
    updates: {
      status?: "queued" | "running" | "completed" | "failed";
      output?: unknown;
      knowledgeSourcesUsed?: string[];
      tokensUsed?: number;
      startedAt?: Date;
      completedAt?: Date;
    }
  ) {
    await db
      .update(agentRuns)
      .set(updates)
      .where(eq(agentRuns.id, runId));
  }

  /**
   * Non-streaming execution. Returns the full result once complete.
   * Used by the orchestrator when downstream agents need the full output.
   */
  async run(
    input: Record<string, unknown>,
    orchestrationId?: string
  ): Promise<AgentRunResult> {
    const runId = await this.createRun(input, orchestrationId);

    try {
      await this.updateRun(runId, {
        status: "running",
        startedAt: new Date(),
      });

      // 1. Retrieve knowledge context
      const knowledgeQuery = this.buildKnowledgeQuery(input);
      const knowledge = await queryKnowledge({
        teamId: this.config.teamId,
        query: knowledgeQuery,
        topK: 10,
      });

      const knowledgeContext = this.formatKnowledgeContext(knowledge.chunks);
      const chunkIds = knowledge.chunks.map((c) => c.id);

      // 2. Build the full system prompt
      const fullSystemPrompt =
        this.config.systemPrompt + knowledgeContext;

      // 3. Call Claude (non-streaming)
      const result = await generateText({
        model: anthropic(MODEL),
        system: fullSystemPrompt,
        messages: [
          {
            role: "user",
            content: JSON.stringify(input, null, 2),
          },
        ],
      });

      const output = result.text;
      const tokensUsed =
        (result.usage?.inputTokens ?? 0) +
        (result.usage?.outputTokens ?? 0);

      // 4. Save results
      await this.updateRun(runId, {
        status: "completed",
        output: { text: output },
        knowledgeSourcesUsed: chunkIds,
        tokensUsed,
        completedAt: new Date(),
      });

      return {
        runId,
        output,
        knowledgeSourcesUsed: chunkIds,
        tokensUsed,
      };
    } catch (error) {
      console.error(`Agent ${this.config.slug} run failed:`, error);
      await this.updateRun(runId, { status: "failed" });
      throw error;
    }
  }

  /**
   * Streaming execution. Returns a Vercel AI SDK result that can be
   * piped to a Response for real-time streaming to the frontend.
   */
  async streamRun(
    input: Record<string, unknown>,
    orchestrationId?: string
  ): Promise<{
    stream: ReturnType<typeof streamText>;
    runId: string;
  }> {
    const runId = await this.createRun(input, orchestrationId);

    await this.updateRun(runId, {
      status: "running",
      startedAt: new Date(),
    });

    // 1. Retrieve knowledge context
    const knowledgeQuery = this.buildKnowledgeQuery(input);
    const knowledge = await queryKnowledge({
      teamId: this.config.teamId,
      query: knowledgeQuery,
      topK: 10,
    });

    const knowledgeContext = this.formatKnowledgeContext(knowledge.chunks);
    const chunkIds = knowledge.chunks.map((c) => c.id);

    // 2. Build the full system prompt
    const fullSystemPrompt = this.config.systemPrompt + knowledgeContext;

    // 3. Call Claude (streaming)
    const result = streamText({
      model: anthropic(MODEL),
      system: fullSystemPrompt,
      messages: [
        {
          role: "user",
          content: JSON.stringify(input, null, 2),
        },
      ],
      onFinish: async (completion) => {
        const tokensUsed =
          (completion.usage?.inputTokens ?? 0) +
          (completion.usage?.outputTokens ?? 0);

        await this.updateRun(runId, {
          status: "completed",
          output: { text: completion.text },
          knowledgeSourcesUsed: chunkIds,
          tokensUsed,
          completedAt: new Date(),
        }).catch((err) =>
          console.error(`Failed to update run ${runId}:`, err)
        );
      },
    });

    return { stream: result, runId };
  }
}
