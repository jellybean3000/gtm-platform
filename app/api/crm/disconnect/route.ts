import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { disconnect } from "@/lib/crm/hubspot-client";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teamId } = await request.json();
  if (!teamId) {
    return NextResponse.json(
      { error: "teamId is required" },
      { status: 400 }
    );
  }

  await disconnect(teamId);
  return NextResponse.json({ success: true });
}
