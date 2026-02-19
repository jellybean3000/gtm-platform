import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { orchestrations, agentRuns, agents } from "@/lib/db/schema";
import { createAgent } from "@/lib/agents";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

const MODEL = "claude-sonnet-4-5-20250929";

export const maxDuration = 120;

interface ConflictItem {
  id: string;
  agents: [string, string];
  topic: string;
  agentA: { slug: string; claim: string };
  agentB: { slug: string; claim: string };
  suggestedResolution: string;
  severity: string;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orchestrationId, conflictId, chosenSlug, teamId } =
    await request.json();

  if (!orchestrationId || !conflictId || !chosenSlug || !teamId) {
    return Response.json(
      { error: "orchestrationId, conflictId, chosenSlug, and teamId are required" },
      { status: 400 }
    );
  }

  // Fetch orchestration
  const [orch] = await db
    .select()
    .from(orchestrations)
    .where(
      and(
        eq(orchestrations.id, orchestrationId),
        eq(orchestrations.teamId, teamId)
      )
    )
    .limit(1);

  if (!orch) {
    return Response.json({ error: "Orchestration not found" }, { status: 404 });
  }

  // Find the conflict
  const conflicts = (orch.conflicts as ConflictItem[]) || [];
  const conflict = conflicts.find((c) => c.id === conflictId);
  if (!conflict) {
    return Response.json({ error: "Conflict not found" }, { status: 404 });
  }

  // Determine which agent to re-run (the one NOT chosen)
  const agentToRerun =
    conflict.agentA.slug === chosenSlug
      ? conflict.agentB.slug
      : conflict.agentA.slug;
  const chosenClaim =
    conflict.agentA.slug === chosenSlug
      ? conflict.agentA.claim
      : conflict.agentB.claim;

  // Find the original agent run
  const allRuns = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.orchestrationId, orchestrationId));

  // Look up agent in DB to find its ID
  const [agentRow] = await db
    .select()
    .from(agents)
    .where(eq(agents.slug, agentToRerun))
    .limit(1);

  if (!agentRow) {
    return Response.json(
      { error: `Agent not found: ${agentToRerun}` },
      { status: 404 }
    );
  }

  const originalRun = allRuns.find(
    (r) => r.agentId === agentRow.id && r.status === "completed"
  );

  // Build input with resolution instruction
  const originalInput = (originalRun?.input as Record<string, unknown>) || {};
  const enrichedInput = {
    ...originalInput,
    orchestrator_resolution: `IMPORTANT: A conflict was detected regarding "${conflict.topic}". Align with the following direction: "${chosenClaim}". Revise your output to be consistent with this strategic direction.`,
  };

  try {
    // Re-run the agent
    const agentInstance = createAgent(agentToRerun, {
      agentId: agentRow.id,
      slug: agentRow.slug,
      name: agentRow.name,
      systemPrompt:
        agentRow.systemPrompt ||
        `You are the ${agentRow.name} Agent. Analyze the input and generate a comprehensive, actionable response.`,
      teamId,
    });

    await agentInstance.run(enrichedInput, orchestrationId);

    // Mark conflict as resolved in DB
    const updatedConflicts = conflicts.map((c) =>
      c.id === conflictId ? { ...c, id: `resolved-${c.id}` } : c
    );

    // Re-synthesize — gather all latest outputs
    const latestRuns = await db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.orchestrationId, orchestrationId));

    // Group by agentId, take latest completed run
    const outputsByAgent: Record<string, string> = {};
    for (const run of latestRuns) {
      if (run.status === "completed" && run.output) {
        outputsByAgent[run.agentId] = (run.output as { text: string }).text || "";
      }
    }

    const outputSummary = Object.values(outputsByAgent)
      .map((text) => text.slice(0, 2000))
      .join("\n\n---\n\n");

    const synthesisResult = await generateText({
      model: anthropic(MODEL),
      system: `You are a senior GTM strategist synthesizing outputs from multiple specialist agents into a unified strategy. Create an executive summary with: Strategic Overview, Key Decisions, Priority Actions (top 5), Risk Factors, and Timeline. Use markdown formatting.`,
      messages: [
        {
          role: "user",
          content: `Original request: ${orch.userRequest}\n\nAgent outputs:\n\n${outputSummary}\n\nNote: A conflict about "${conflict.topic}" was resolved by choosing the direction: "${chosenClaim}".`,
        },
      ],
    });

    // Update orchestration
    await db
      .update(orchestrations)
      .set({
        conflicts: updatedConflicts,
        finalSynthesis: { text: synthesisResult.text },
      })
      .where(eq(orchestrations.id, orchestrationId));

    return Response.json({
      resolvedConflictId: conflictId,
      updatedSynthesis: synthesisResult.text,
    });
  } catch (error) {
    console.error("Conflict resolution failed:", error);
    return Response.json(
      { error: "Failed to resolve conflict" },
      { status: 500 }
    );
  }
}
