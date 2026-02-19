import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { orchestrations, agentRuns } from "@/lib/db/schema";
import {
  OrchestratorEngine,
  AGENT_DISPLAY_NAMES,
  AgentOutputMap,
} from "@/lib/agents/orchestrator";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST — Start an orchestration (SSE streaming)
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { userRequest, teamId } = await request.json();

  if (!userRequest || !teamId) {
    return new Response(
      JSON.stringify({ error: "userRequest and teamId are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Create orchestration record
  const [orch] = await db
    .insert(orchestrations)
    .values({
      teamId,
      userRequest,
      status: "running",
    })
    .returning({ id: orchestrations.id });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      try {
        const engine = new OrchestratorEngine(teamId);

        // Step 1: Parse intent
        send("status", { message: "Analyzing your request..." });
        const parsedIntent = await engine.parseIntent(userRequest);

        // Update DB
        await db
          .update(orchestrations)
          .set({ parsedIntent })
          .where(eq(orchestrations.id, orch.id));

        // Step 2: Build DAG
        const waves = engine.buildDAG(parsedIntent.requiredAgents);

        await db
          .update(orchestrations)
          .set({ executionDag: { waves, requiredAgents: parsedIntent.requiredAgents } })
          .where(eq(orchestrations.id, orch.id));

        send("plan", {
          orchestrationId: orch.id,
          parsedIntent,
          waves,
        });

        // Initialize all agents as queued
        for (const wave of waves) {
          for (const slug of wave) {
            send("agent_queued", {
              slug,
              name: AGENT_DISPLAY_NAMES[slug] || slug,
            });
          }
        }

        // Step 3: Execute waves in order
        const allOutputs: AgentOutputMap = {};

        for (const wave of waves) {
          // Mark agents in this wave as starting
          for (const slug of wave) {
            send("agent_start", {
              slug,
              name: AGENT_DISPLAY_NAMES[slug] || slug,
            });
          }

          // Run all agents in the wave in parallel
          const results = await Promise.allSettled(
            wave.map(async (slug) => {
              try {
                const result = await engine.executeSingleAgent(
                  slug,
                  orch.id,
                  parsedIntent.agentInputs,
                  allOutputs
                );
                allOutputs[slug] = result;
                send("agent_complete", {
                  slug,
                  name: AGENT_DISPLAY_NAMES[slug] || slug,
                  runId: result.runId,
                  tokensUsed: result.tokensUsed,
                  outputPreview: result.output.slice(0, 500),
                });
                return result;
              } catch (err) {
                send("agent_error", {
                  slug,
                  name: AGENT_DISPLAY_NAMES[slug] || slug,
                  error:
                    err instanceof Error ? err.message : "Unknown error",
                });
                throw err;
              }
            })
          );

          // Log any failures but continue
          for (const r of results) {
            if (r.status === "rejected") {
              console.error("Agent failed in wave:", r.reason);
            }
          }
        }

        // Step 4: Detect conflicts
        send("status", { message: "Checking for conflicts..." });
        const conflicts = await engine.detectConflicts(allOutputs);

        await db
          .update(orchestrations)
          .set({ conflicts })
          .where(eq(orchestrations.id, orch.id));

        if (conflicts.length > 0) {
          send("conflicts", { conflicts });
        }

        // Step 5: Synthesize
        send("status", { message: "Synthesizing unified strategy..." });
        const synthesis = await engine.synthesize(
          userRequest,
          parsedIntent,
          allOutputs,
          conflicts
        );

        await db
          .update(orchestrations)
          .set({
            finalSynthesis: { text: synthesis },
            status: "completed",
          })
          .where(eq(orchestrations.id, orch.id));

        send("synthesis", { text: synthesis });
        send("done", { orchestrationId: orch.id });
      } catch (error) {
        console.error("Orchestration failed:", error);
        await db
          .update(orchestrations)
          .set({ status: "failed" })
          .where(eq(orchestrations.id, orch.id));
        send("error", {
          message:
            error instanceof Error ? error.message : "Orchestration failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Orchestration-Id": orch.id,
    },
  });
}

// ---------------------------------------------------------------------------
// GET — Fetch a past orchestration by ID
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const id = request.nextUrl.searchParams.get("id");
  const teamId = request.nextUrl.searchParams.get("teamId");

  if (!id || !teamId) {
    return new Response(
      JSON.stringify({ error: "id and teamId are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const [orch] = await db
    .select()
    .from(orchestrations)
    .where(
      and(eq(orchestrations.id, id), eq(orchestrations.teamId, teamId))
    )
    .limit(1);

  if (!orch) {
    return Response.json({ error: "Orchestration not found" }, { status: 404 });
  }

  // Get associated agent runs
  const runs = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.orchestrationId, id))
    .orderBy(desc(agentRuns.startedAt));

  return Response.json({ orchestration: orch, agentRuns: runs });
}
