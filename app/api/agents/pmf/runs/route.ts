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

  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.slug, "pmf"))
    .limit(1);

  if (!agent) {
    return NextResponse.json({ runs: [] });
  }

  const runs = await db
    .select({
      id: agentRuns.id,
      status: agentRuns.status,
      input: agentRuns.input,
      output: agentRuns.output,
      tokensUsed: agentRuns.tokensUsed,
      startedAt: agentRuns.startedAt,
      completedAt: agentRuns.completedAt,
    })
    .from(agentRuns)
    .where(
      and(
        eq(agentRuns.teamId, teamId),
        eq(agentRuns.agentId, agent.id)
      )
    )
    .orderBy(desc(agentRuns.startedAt))
    .limit(10);

  return NextResponse.json({ runs });
}
