import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { orchestrations } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const teamId = request.nextUrl.searchParams.get("teamId");

  if (!teamId) {
    return Response.json(
      { error: "teamId is required" },
      { status: 400 }
    );
  }

  const rows = await db
    .select({
      id: orchestrations.id,
      userRequest: orchestrations.userRequest,
      parsedIntent: orchestrations.parsedIntent,
      status: orchestrations.status,
      createdAt: orchestrations.createdAt,
    })
    .from(orchestrations)
    .where(eq(orchestrations.teamId, teamId))
    .orderBy(desc(orchestrations.createdAt))
    .limit(20);

  return Response.json({ orchestrations: rows });
}
