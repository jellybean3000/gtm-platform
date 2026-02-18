import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { queryKnowledge } from "@/lib/knowledge/retrieve";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { query, teamId, filters, topK } = body;

  if (!query || !teamId) {
    return NextResponse.json(
      { error: "query and teamId are required" },
      { status: 400 }
    );
  }

  try {
    const result = await queryKnowledge({
      teamId,
      query,
      filters,
      topK: topK ?? 10,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Knowledge query error:", error);
    return NextResponse.json(
      { error: "Failed to query knowledge base" },
      { status: 500 }
    );
  }
}
