import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentRuns, agents } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teamId = request.nextUrl.searchParams.get("teamId");
  if (!teamId) {
    return Response.json({ error: "teamId is required" }, { status: 400 });
  }

  const runs = await db
    .select({
      id: agentRuns.id,
      status: agentRuns.status,
      input: agentRuns.input,
      startedAt: agentRuns.startedAt,
      completedAt: agentRuns.completedAt,
      tokensUsed: agentRuns.tokensUsed,
      agentName: agents.name,
      agentSlug: agents.slug,
    })
    .from(agentRuns)
    .innerJoin(agents, eq(agentRuns.agentId, agents.id))
    .where(eq(agentRuns.teamId, teamId))
    .orderBy(desc(agentRuns.startedAt))
    .limit(5);

  return Response.json({ runs });
}
