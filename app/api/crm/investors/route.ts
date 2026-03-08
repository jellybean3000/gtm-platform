import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { investors, investorMeetings } from "@/lib/db/schema";

const TEAM_ID = "00000000-0000-0000-0000-000000000001";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allInvestors = await db
    .select()
    .from(investors)
    .where(eq(investors.teamId, TEAM_ID));

  // Compute stats
  const totalInvestors = allInvestors.length;
  const committedCapital = allInvestors.reduce(
    (sum, inv) => sum + (inv.committedAmount || 0),
    0
  );
  const targetRaise = allInvestors.reduce((sum, inv) => {
    const max = inv.checkSizeMax || inv.checkSizeMin || 0;
    return sum + max;
  }, 0);

  // Meetings this week
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const meetings = await db
    .select()
    .from(investorMeetings)
    .where(eq(investorMeetings.teamId, TEAM_ID));

  const meetingsThisWeek = meetings.filter((m) => {
    const d = new Date(m.meetingDate);
    return d >= weekStart && d < weekEnd;
  }).length;

  // Avg days in stage (based on updatedAt)
  const daysInStages = allInvestors
    .filter((inv) => inv.stage !== "closed_committed" && inv.stage !== "passed")
    .map((inv) => {
      const updated = new Date(inv.updatedAt);
      return Math.floor(
        (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24)
      );
    });
  const avgDaysInStage =
    daysInStages.length > 0
      ? Math.round(
          daysInStages.reduce((a, b) => a + b, 0) / daysInStages.length
        )
      : 0;

  return NextResponse.json({
    investors: allInvestors.map((inv) => ({
      ...inv,
      daysInStage: Math.floor(
        (now.getTime() - new Date(inv.updatedAt).getTime()) /
          (1000 * 60 * 60 * 24)
      ),
    })),
    stats: {
      totalInvestors,
      targetRaise,
      committedCapital,
      meetingsThisWeek,
      avgDaysInStage,
    },
  });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const [created] = await db
    .insert(investors)
    .values({
      teamId: TEAM_ID,
      firmName: body.firmName,
      firmType: body.firmType || "vc",
      checkSizeMin: body.checkSizeMin || null,
      checkSizeMax: body.checkSizeMax || null,
      stage: body.stage || "identified",
      leadPartner: body.leadPartner || null,
      leadPartnerEmail: body.leadPartnerEmail || null,
      interestLevel: body.interestLevel || "unknown",
      committedAmount: body.committedAmount || null,
      thesisFit: body.thesisFit || null,
      portfolioCompanies: body.portfolioCompanies || [],
      website: body.website || null,
      notes: body.notes || null,
      nextSteps: body.nextSteps || null,
      lastContactDate: body.lastContactDate
        ? new Date(body.lastContactDate)
        : null,
    })
    .returning();

  return NextResponse.json({ investor: created }, { status: 201 });
}
