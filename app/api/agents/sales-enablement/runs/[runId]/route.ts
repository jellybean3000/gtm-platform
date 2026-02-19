import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentRuns, knowledgeChunks, documents } from "@/lib/db/schema";

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { runId } = params;

  const [run] = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.id, runId))
    .limit(1);

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  let sources: { id: string; content: string; sourceDocument: string; sourceUrl: string | null }[] = [];

  if (run.knowledgeSourcesUsed && run.knowledgeSourcesUsed.length > 0) {
    sources = await db
      .select({
        id: knowledgeChunks.id,
        content: knowledgeChunks.content,
        sourceDocument: documents.filename,
        sourceUrl: documents.sourceUrl,
      })
      .from(knowledgeChunks)
      .innerJoin(documents, eq(knowledgeChunks.documentId, documents.id))
      .where(inArray(knowledgeChunks.id, run.knowledgeSourcesUsed));
  }

  return NextResponse.json({
    run: {
      id: run.id, status: run.status, input: run.input, output: run.output,
      tokensUsed: run.tokensUsed, startedAt: run.startedAt, completedAt: run.completedAt,
    },
    sources,
  });
}
