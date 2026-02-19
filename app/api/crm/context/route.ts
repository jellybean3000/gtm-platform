import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { crmDeals, crmContacts, crmActivities } from "@/lib/db/schema";

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

  if (deals.length === 0) {
    return NextResponse.json({ available: false });
  }

  const contacts = await db
    .select()
    .from(crmContacts)
    .where(eq(crmContacts.teamId, TEAM_ID));

  const activities = await db
    .select()
    .from(crmActivities)
    .where(eq(crmActivities.teamId, TEAM_ID));

  // Pipeline stats
  const totalValue = deals.reduce((sum, d) => {
    const amt = d.amount ? parseFloat(d.amount) : 0;
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);
  const healthScores = deals
    .map((d) => d.healthScore)
    .filter((s): s is number => s !== null);
  const dealsAtRisk = healthScores.filter((s) => s < 40).length;

  // Summary string
  const summary = `${deals.length} deals, $${totalValue >= 1000 ? `${(totalValue / 1000).toFixed(0)}k` : totalValue.toLocaleString()} pipeline, ${dealsAtRisk} at risk`;

  // Deals summary for agent context
  const dealsSummary = deals
    .map((d) => {
      const parts = [`${d.dealName} — Stage: ${d.stage || "unknown"}`];
      if (d.amount) parts.push(`$${Number(d.amount).toLocaleString()}`);
      if (d.healthScore !== null) parts.push(`Health: ${d.healthScore}/100`);
      if (d.daysInStage !== null) parts.push(`${d.daysInStage}d in stage`);
      if (d.closeDate) parts.push(`Close: ${new Date(d.closeDate).toISOString().split("T")[0]}`);
      return parts.join(" | ");
    })
    .join("\n");

  // Activities summary — extract themes from recent activities
  const recentActivities = activities
    .filter((a) => a.occurredAt)
    .sort((a, b) => b.occurredAt!.getTime() - a.occurredAt!.getTime())
    .slice(0, 50);

  const activitiesSummary = recentActivities
    .map((a) => {
      const date = a.occurredAt
        ? new Date(a.occurredAt).toISOString().split("T")[0]
        : "unknown";
      const subj = a.subject || a.type;
      const bodySnippet = a.body ? a.body.slice(0, 150) : "";
      return `[${a.type}] ${date}: ${subj}${bodySnippet ? ` — ${bodySnippet}` : ""}`;
    })
    .join("\n");

  return NextResponse.json({
    available: true,
    summary,
    dealsSummary,
    activitiesSummary,
    contactsCount: contacts.length,
    dealsAtRisk,
  });
}
