import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/crm/hubspot-client";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state"); // teamId

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/agents/crm?error=missing_params", request.url)
    );
  }

  try {
    await exchangeCode(code, state);
    return NextResponse.redirect(
      new URL("/agents/crm?connected=true", request.url)
    );
  } catch (error) {
    console.error("HubSpot OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/agents/crm?error=oauth_failed", request.url)
    );
  }
}
