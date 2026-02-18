import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { createAgent } from "@/lib/agents";

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { slug } = params;

  // Look up agent definition
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.slug, slug))
    .limit(1);

  if (!agent) {
    return new Response(JSON.stringify({ error: `Agent not found: ${slug}` }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const { input, teamId, orchestrationId } = body;

  if (!input || !teamId) {
    return new Response(
      JSON.stringify({ error: "input and teamId are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const agentInstance = createAgent(agent.slug, {
      agentId: agent.id,
      slug: agent.slug,
      name: agent.name,
      systemPrompt:
        agent.systemPrompt ||
        `You are the ${agent.name} Agent, a specialist in the GTM (Go-To-Market) platform. Analyze the input provided and generate a comprehensive, actionable response grounded in the knowledge context provided. Structure your output clearly with sections and bullet points.`,
      teamId,
    });

    const { stream, runId } = await agentInstance.streamRun(input, orchestrationId);

    const response = stream.toTextStreamResponse();
    response.headers.set("X-Run-Id", runId);
    return response;
  } catch (error) {
    console.error(`Agent ${slug} error:`, error);
    return new Response(
      JSON.stringify({ error: "Agent execution failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
