import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { webSources } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { processWebSource } from "@/lib/knowledge/process-web";

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

  const sources = await db
    .select()
    .from(webSources)
    .where(eq(webSources.teamId, teamId))
    .orderBy(desc(webSources.createdAt));

  return NextResponse.json({ webSources: sources });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { url, crawlMode, teamId } = body;

  if (!url || !teamId) {
    return NextResponse.json(
      { error: "url and teamId are required" },
      { status: 400 }
    );
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const validModes = ["single", "site", "sitemap", "rss", "scheduled"] as const;
  const mode = validModes.includes(crawlMode) ? crawlMode : "single";

  const [source] = await db
    .insert(webSources)
    .values({
      teamId,
      url,
      crawlMode: mode,
    })
    .returning();

  // Fire-and-forget: start crawling the source
  processWebSource(source.id).catch((err) =>
    console.error(`Web crawl failed for source ${source.id}:`, err)
  );

  return NextResponse.json({ webSource: source });
}
