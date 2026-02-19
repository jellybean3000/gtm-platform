import crypto from "crypto";
import { Client } from "@hubspot/api-client";
import { db } from "@/lib/db";
import { hubspotConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------
const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID!;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET!;
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI!;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32-byte hex

const SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.deals.read",
  "crm.objects.companies.read",
];

// ---------------------------------------------------------------------------
// AES-256-GCM encryption helpers
// ---------------------------------------------------------------------------
function encrypt(plaintext: string): string {
  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // iv:tag:ciphertext (all hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(encoded: string): string {
  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const [ivHex, tagHex, ciphertextHex] = encoded.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
}

// ---------------------------------------------------------------------------
// OAuth helpers
// ---------------------------------------------------------------------------
export function getAuthUrl(teamId: string): string {
  const params = new URLSearchParams({
    client_id: HUBSPOT_CLIENT_ID,
    redirect_uri: HUBSPOT_REDIRECT_URI,
    scope: SCOPES.join(" "),
    state: teamId,
  });
  return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeCode(code: string, teamId: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: HUBSPOT_CLIENT_ID,
    client_secret: HUBSPOT_CLIENT_SECRET,
    redirect_uri: HUBSPOT_REDIRECT_URI,
    code,
  });

  const res = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot token exchange failed: ${text}`);
  }

  const data = await res.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  // Get portal info
  const client = new Client({ accessToken: data.access_token });
  let portalId = "";
  let hubName = "";
  try {
    const info = await client.apiRequest({
      method: "GET",
      path: "/account-info/v3/details",
    });
    const infoData = await info.json();
    portalId = String(infoData.portalId || "");
    hubName = infoData.accountType || infoData.uiDomain || "";
  } catch {
    // Non-critical — continue without portal info
  }

  // Upsert connection (one per team)
  const encAccessToken = encrypt(data.access_token);
  const encRefreshToken = encrypt(data.refresh_token);

  const existing = await db
    .select({ id: hubspotConnections.id })
    .from(hubspotConnections)
    .where(eq(hubspotConnections.teamId, teamId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(hubspotConnections)
      .set({
        accessToken: encAccessToken,
        refreshToken: encRefreshToken,
        expiresAt,
        portalId,
        hubName,
        scopes: SCOPES,
        updatedAt: new Date(),
      })
      .where(eq(hubspotConnections.teamId, teamId));
  } else {
    await db.insert(hubspotConnections).values({
      teamId,
      accessToken: encAccessToken,
      refreshToken: encRefreshToken,
      expiresAt,
      portalId,
      hubName,
      scopes: SCOPES,
    });
  }

  return { portalId, hubName };
}

export async function disconnect(teamId: string) {
  await db
    .delete(hubspotConnections)
    .where(eq(hubspotConnections.teamId, teamId));
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------
async function refreshAccessToken(teamId: string): Promise<string> {
  const [conn] = await db
    .select()
    .from(hubspotConnections)
    .where(eq(hubspotConnections.teamId, teamId))
    .limit(1);

  if (!conn) throw new Error("No HubSpot connection found");

  const refreshToken = decrypt(conn.refreshToken);

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: HUBSPOT_CLIENT_ID,
    client_secret: HUBSPOT_CLIENT_SECRET,
    refresh_token: refreshToken,
  });

  const res = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error("Failed to refresh HubSpot token");
  }

  const data = await res.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await db
    .update(hubspotConnections)
    .set({
      accessToken: encrypt(data.access_token),
      refreshToken: encrypt(data.refresh_token),
      expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(hubspotConnections.teamId, teamId));

  return data.access_token;
}

// ---------------------------------------------------------------------------
// Get authenticated HubSpot client
// ---------------------------------------------------------------------------
async function getClient(teamId: string): Promise<Client> {
  const [conn] = await db
    .select()
    .from(hubspotConnections)
    .where(eq(hubspotConnections.teamId, teamId))
    .limit(1);

  if (!conn) throw new Error("No HubSpot connection found");

  let accessToken: string;
  if (conn.expiresAt < new Date()) {
    accessToken = await refreshAccessToken(teamId);
  } else {
    accessToken = decrypt(conn.accessToken);
  }

  return new Client({ accessToken });
}

// ---------------------------------------------------------------------------
// Data methods
// ---------------------------------------------------------------------------
export async function getContacts(teamId: string, limit = 10) {
  const client = await getClient(teamId);
  const res = await client.crm.contacts.basicApi.getPage(limit, undefined, [
    "email",
    "firstname",
    "lastname",
    "company",
    "lifecyclestage",
  ]);
  return res.results.map((c) => ({
    id: c.id,
    email: c.properties.email || "",
    firstName: c.properties.firstname || "",
    lastName: c.properties.lastname || "",
    company: c.properties.company || "",
    lifecycleStage: c.properties.lifecyclestage || "",
  }));
}

export async function getDeals(teamId: string, limit = 10) {
  const client = await getClient(teamId);
  const res = await client.crm.deals.basicApi.getPage(limit, undefined, [
    "dealname",
    "amount",
    "dealstage",
    "closedate",
    "pipeline",
  ]);
  return res.results.map((d) => ({
    id: d.id,
    name: d.properties.dealname || "",
    amount: d.properties.amount || "",
    stage: d.properties.dealstage || "",
    closeDate: d.properties.closedate || "",
    pipeline: d.properties.pipeline || "",
  }));
}

export async function getCompanies(teamId: string, limit = 10) {
  const client = await getClient(teamId);
  const res = await client.crm.companies.basicApi.getPage(limit, undefined, [
    "name",
    "domain",
    "industry",
    "annualrevenue",
  ]);
  return res.results.map((c) => ({
    id: c.id,
    name: c.properties.name || "",
    domain: c.properties.domain || "",
    industry: c.properties.industry || "",
    annualRevenue: c.properties.annualrevenue || "",
  }));
}

export async function getConnectionStatus(teamId: string) {
  const [conn] = await db
    .select({
      portalId: hubspotConnections.portalId,
      hubName: hubspotConnections.hubName,
      expiresAt: hubspotConnections.expiresAt,
      updatedAt: hubspotConnections.updatedAt,
    })
    .from(hubspotConnections)
    .where(eq(hubspotConnections.teamId, teamId))
    .limit(1);

  if (!conn) {
    return { connected: false };
  }

  return {
    connected: true,
    portalId: conn.portalId,
    hubName: conn.hubName,
    lastUpdated: conn.updatedAt,
  };
}
