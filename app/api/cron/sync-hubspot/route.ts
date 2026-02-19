import { NextRequest, NextResponse } from "next/server";
import { runFullSync } from "@/lib/crm/sync";
import { isConfigured } from "@/lib/crm/hubspot-client";

const TEAM_ID = "00000000-0000-0000-0000-000000000001";

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isConfigured()) {
    return NextResponse.json({ message: "HubSpot not configured, skipping" });
  }

  const result = await runFullSync(TEAM_ID);
  return NextResponse.json(result);
}
