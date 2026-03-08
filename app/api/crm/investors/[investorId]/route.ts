import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { investors } from "@/lib/db/schema";

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

  const [investor] = await db
    .select()
    .from(investors)
    .where(
      and(eq(investors.id, investorId), eq(investors.teamId, TEAM_ID))
    );

  if (!investor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ investor });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ investorId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { investorId } = await params;
  const body = await request.json();

  // Build update object from provided fields
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const allowedFields = [
    "firmName",
    "firmType",
    "checkSizeMin",
    "checkSizeMax",
    "stage",
    "leadPartner",
    "leadPartnerEmail",
    "interestLevel",
    "committedAmount",
    "thesisFit",
    "portfolioCompanies",
    "website",
    "notes",
    "nextSteps",
  ];

  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (body.lastContactDate !== undefined) {
    updates.lastContactDate = body.lastContactDate
      ? new Date(body.lastContactDate)
      : null;
  }

  const [updated] = await db
    .update(investors)
    .set(updates)
    .where(
      and(eq(investors.id, investorId), eq(investors.teamId, TEAM_ID))
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ investor: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ investorId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { investorId } = await params;

  const [deleted] = await db
    .delete(investors)
    .where(
      and(eq(investors.id, investorId), eq(investors.teamId, TEAM_ID))
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
