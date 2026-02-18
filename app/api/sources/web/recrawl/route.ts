import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { recrawlWebSource } from "@/lib/knowledge/process-web";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { webSourceId } = await request.json();

  if (!webSourceId) {
    return NextResponse.json(
      { error: "webSourceId is required" },
      { status: 400 }
    );
  }

  // Fire-and-forget recrawl
  recrawlWebSource(webSourceId).catch((err) =>
    console.error(`Recrawl failed for source ${webSourceId}:`, err)
  );

  return NextResponse.json({ message: "Recrawl started" });
}
