import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  isConfigured,
  getContacts,
  getDeals,
  getCompanies,
} from "@/lib/crm/hubspot-client";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isConfigured()) {
    return NextResponse.json({ connected: false });
  }

  try {
    const [contacts, deals, companies] = await Promise.all([
      getContacts(5),
      getDeals(5),
      getCompanies(5),
    ]);

    return NextResponse.json({
      connected: true,
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
      connected: true,
      dataError: "Could not fetch data. Check your access token.",
    });
  }
}
