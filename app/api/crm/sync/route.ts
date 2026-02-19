import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { crmSyncLog } from "@/lib/db/schema";
import { runFullSync } from "@/lib/crm/sync";
import { isConfigured } from "@/lib/crm/hubspot-client";

const TEAM_ID = "00000000-0000-0000-0000-000000000001";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isConfigured()) {
    return NextResponse.json(
      { error: "HubSpot is not configured" },
      { status: 400 }
    );
  }

  const result = await runFullSync(TEAM_ID);
  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teamId =
    request.nextUrl.searchParams.get("teamId") || TEAM_ID;

  // Get recent sync logs
  const logs = await db
    .select()
    .from(crmSyncLog)
    .where(eq(crmSyncLog.teamId, teamId))
    .orderBy(desc(crmSyncLog.startedAt))
    .limit(10);

  return NextResponse.json({ logs });
}
