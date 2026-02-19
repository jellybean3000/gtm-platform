import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getConnectionStatus,
  getContacts,
  getDeals,
  getCompanies,
} from "@/lib/crm/hubspot-client";

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

  const status = await getConnectionStatus(teamId);

  if (!status.connected) {
    return NextResponse.json(status);
  }

  // Fetch preview data
  try {
    const [contacts, deals, companies] = await Promise.all([
      getContacts(teamId, 5),
      getDeals(teamId, 5),
      getCompanies(teamId, 5),
    ]);

    return NextResponse.json({
      ...status,
      counts: {
        contacts: contacts.length,
        deals: deals.length,
        companies: companies.length,
      },
      preview: { contacts, deals, companies },
    });
  } catch (error) {
    console.error("HubSpot data fetch error:", error);
    return NextResponse.json({
      ...status,
      dataError: "Could not fetch preview data. Token may need refresh.",
    });
  }
}
