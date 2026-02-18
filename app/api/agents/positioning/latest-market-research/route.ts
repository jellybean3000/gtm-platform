import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentRuns, agents } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teamId = request.nextUrl.searchParams.get("teamId");
  if (!teamId) {
    return NextResponse.json(
      { error: "teamId is required" },
      { status: 400 }
    );
  }

  // Find the market-research agent
  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.slug, "market-research"))
    .limit(1);

  if (!agent) {
    return NextResponse.json({ run: null });
  }

  // Get the most recent completed run
  const [latestRun] = await db
    .select({
      id: agentRuns.id,
      output: agentRuns.output,
      input: agentRuns.input,
      completedAt: agentRuns.completedAt,
    })
    .from(agentRuns)
    .where(
      and(
        eq(agentRuns.teamId, teamId),
        eq(agentRuns.agentId, agent.id),
        eq(agentRuns.status, "completed")
      )
    )
    .orderBy(desc(agentRuns.completedAt))
    .limit(1);

  return NextResponse.json({ run: latestRun || null });
}
