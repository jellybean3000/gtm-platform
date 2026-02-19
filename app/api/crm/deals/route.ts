import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { crmDeals, crmActivities } from "@/lib/db/schema";

const TEAM_ID = "00000000-0000-0000-0000-000000000001";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deals = await db
    .select()
    .from(crmDeals)
    .where(eq(crmDeals.teamId, TEAM_ID));

  const activities = await db
    .select()
    .from(crmActivities)
    .where(eq(crmActivities.teamId, TEAM_ID));

  // Compute activity counts per deal
  const activityCountsByDeal: Record<string, number> = {};
  for (const a of activities) {
    if (a.dealHubspotId) {
      activityCountsByDeal[a.dealHubspotId] =
        (activityCountsByDeal[a.dealHubspotId] || 0) + 1;
    }
  }

  // Map deals with activity counts
  const dealsWithMeta = deals.map((d) => ({
    id: d.id,
    hubspotDealId: d.hubspotDealId,
    dealName: d.dealName,
    amount: d.amount,
    stage: d.stage,
    pipeline: d.pipeline,
    closeDate: d.closeDate,
    ownerName: d.ownerName,
    ownerEmail: d.ownerEmail,
    daysInStage: d.daysInStage,
    healthScore: d.healthScore,
    activityCount: activityCountsByDeal[d.hubspotDealId] || 0,
    lastSyncedAt: d.lastSyncedAt,
  }));

  // Compute pipeline stats
  const totalDeals = deals.length;
  const totalValue = deals.reduce((sum, d) => {
    const amt = d.amount ? parseFloat(d.amount) : 0;
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);
  const healthScores = deals
    .map((d) => d.healthScore)
    .filter((s): s is number => s !== null);
  const avgHealthScore =
    healthScores.length > 0
      ? Math.round(
          healthScores.reduce((a, b) => a + b, 0) / healthScores.length
        )
      : 0;
  const dealsAtRisk = healthScores.filter((s) => s < 40).length;
  const daysInStages = deals
    .map((d) => d.daysInStage)
    .filter((d): d is number => d !== null);
  const avgDaysInStage =
    daysInStages.length > 0
      ? Math.round(
          daysInStages.reduce((a, b) => a + b, 0) / daysInStages.length
        )
      : 0;

  return NextResponse.json({
    deals: dealsWithMeta,
    stats: {
      totalDeals,
      totalValue,
      avgHealthScore,
      dealsAtRisk,
      avgDaysInStage,
    },
  });
}
