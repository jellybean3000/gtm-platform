import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, knowledgeChunks } from "@/lib/db/schema";
import { chunkText } from "@/lib/knowledge/chunk";
import { generateEmbeddings } from "@/lib/knowledge/embed";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { teamId, runId, title, content } = body;

  if (!teamId || !content) {
    return NextResponse.json(
      { error: "teamId and content are required" },
      { status: 400 }
    );
  }

  try {
    // 1. Create a document record for the agent output
    const [doc] = await db
      .insert(documents)
      .values({
        teamId,
        filename: title || `Market Research - ${new Date().toLocaleDateString()}`,
        fileType: "agent-output",
        status: "processing",
        uploadType: "integration",
        metadata: { source: "market-research-agent", runId },
      })
      .returning({ id: documents.id });

    // 2. Chunk the content
    const chunks = chunkText(content);

    // 3. Generate embeddings
    const embeddings = await generateEmbeddings(chunks);

    // 4. Save chunks
    const chunkValues = chunks.map((text, index) => ({
      documentId: doc.id,
      teamId,
      content: text,
      embedding: embeddings[index],
      chunkIndex: index,
      classification: { type: "competitive_intel", source: "agent-output" },
    }));

    for (let i = 0; i < chunkValues.length; i += 50) {
      const batch = chunkValues.slice(i, i + 50);
      await db.insert(knowledgeChunks).values(batch);
    }

    // 5. Update document status
    await db
      .update(documents)
      .set({ status: "analyzed", updatedAt: new Date() })
      .where(eq(documents.id, doc.id));

    return NextResponse.json({
      success: true,
      documentId: doc.id,
      chunksCreated: chunks.length,
    });
  } catch (error) {
    console.error("Save to knowledge error:", error);
    return NextResponse.json(
      { error: "Failed to save to knowledge base" },
      { status: 500 }
    );
  }
}
