import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { investorMeetings } from "@/lib/db/schema";

const TEAM_ID = "00000000-0000-0000-0000-000000000001";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ investorId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { investorId } = await params;

  const meetings = await db
    .select()
    .from(investorMeetings)
    .where(
      and(
        eq(investorMeetings.investorId, investorId),
        eq(investorMeetings.teamId, TEAM_ID)
      )
    );

  return NextResponse.json({ meetings });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ investorId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { investorId } = await params;
  const body = await request.json();

  const [created] = await db
    .insert(investorMeetings)
    .values({
      investorId,
      teamId: TEAM_ID,
      meetingDate: new Date(body.meetingDate),
      meetingType: body.meetingType || "call",
      attendees: body.attendees || null,
      notes: body.notes || null,
      nextSteps: body.nextSteps || null,
      sentiment: body.sentiment || null,
    })
    .returning();

  return NextResponse.json({ meeting: created }, { status: 201 });
}
