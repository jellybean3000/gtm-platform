import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { crmDeals, crmContacts, crmActivities } from "@/lib/db/schema";
import { dealHealthScore, icpMatchScore } from "@/lib/crm/scoring";
import { recommendNextSteps } from "@/lib/crm/actions";

const TEAM_ID = "00000000-0000-0000-0000-000000000001";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { dealId } = await params;

  // Fetch the deal
  const [deal] = await db
    .select()
    .from(crmDeals)
    .where(
      and(
        eq(crmDeals.teamId, TEAM_ID),
        eq(crmDeals.hubspotDealId, dealId)
      )
    )
    .limit(1);

  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  // Fetch activities linked to this deal
  const activities = await db
    .select()
    .from(crmActivities)
    .where(
      and(
        eq(crmActivities.teamId, TEAM_ID),
        eq(crmActivities.dealHubspotId, dealId)
      )
    );

  // Fetch all contacts for the team (for ICP scoring)
  const contacts = await db
    .select()
    .from(crmContacts)
    .where(eq(crmContacts.teamId, TEAM_ID));

  // Compute deal health score
  const health = dealHealthScore(
    {
      hubspotDealId: deal.hubspotDealId,
      dealName: deal.dealName,
      amount: deal.amount,
      stage: deal.stage,
      daysInStage: deal.daysInStage,
      closeDate: deal.closeDate,
    },
    activities.map((a) => ({
      type: a.type,
      dealHubspotId: a.dealHubspotId,
      contactHubspotId: a.contactHubspotId,
      occurredAt: a.occurredAt,
    }))
  );

  // Compute ICP match for the first contact (if any)
  let icpMatch = null;
  if (contacts.length > 0) {
    const primaryContact = contacts[0];
    icpMatch = await icpMatchScore(
      {
        firstName: primaryContact.firstName,
        lastName: primaryContact.lastName,
        company: primaryContact.company,
        title: primaryContact.title,
        lifecycleStage: primaryContact.lifecycleStage,
      },
      TEAM_ID
    );
  }

  // Get AI-powered next step recommendations
  const nextSteps = await recommendNextSteps(
    {
      hubspotDealId: deal.hubspotDealId,
      dealName: deal.dealName,
      amount: deal.amount,
      stage: deal.stage,
      daysInStage: deal.daysInStage,
      closeDate: deal.closeDate,
    },
    activities.map((a) => ({
      type: a.type,
      dealHubspotId: a.dealHubspotId,
      contactHubspotId: a.contactHubspotId,
      occurredAt: a.occurredAt,
    })),
    contacts.map((c) => ({
      firstName: c.firstName,
      lastName: c.lastName,
      title: c.title,
      company: c.company,
      email: c.email,
      lifecycleStage: c.lifecycleStage,
    })),
    health,
    TEAM_ID
  );

  return NextResponse.json({
    deal: {
      id: deal.id,
      hubspotDealId: deal.hubspotDealId,
      dealName: deal.dealName,
      amount: deal.amount,
      stage: deal.stage,
      daysInStage: deal.daysInStage,
      closeDate: deal.closeDate,
    },
    healthScore: health,
    icpMatch,
    recommendations: nextSteps.recommendations,
    knowledgeSourcesUsed: nextSteps.knowledgeSourcesUsed,
  });
}
