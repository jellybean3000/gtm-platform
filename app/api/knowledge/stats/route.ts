import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { documents, knowledgeChunks, webSources } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

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

  const [docCount] = await db
    .select({ count: count() })
    .from(documents)
    .where(eq(documents.teamId, teamId));

  const [chunkCount] = await db
    .select({ count: count() })
    .from(knowledgeChunks)
    .where(eq(knowledgeChunks.teamId, teamId));

  const [webCount] = await db
    .select({ count: count() })
    .from(webSources)
    .where(eq(webSources.teamId, teamId));

  return NextResponse.json({
    documents: docCount.count,
    knowledgeChunks: chunkCount.count,
    webSources: webCount.count,
  });
}
