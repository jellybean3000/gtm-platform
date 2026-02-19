import { Client } from "@hubspot/api-client";

// ---------------------------------------------------------------------------
// Private App access token (no OAuth needed)
// ---------------------------------------------------------------------------
function getClient(): Client {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) throw new Error("HUBSPOT_ACCESS_TOKEN is not configured");
  return new Client({ accessToken: token });
}

export function isConfigured(): boolean {
  return !!process.env.HUBSPOT_ACCESS_TOKEN;
}

// ---------------------------------------------------------------------------
// Preview methods (small result sets for CRM page)
// ---------------------------------------------------------------------------
export async function getContacts(limit = 10) {
  const client = getClient();
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

export async function getDeals(limit = 10) {
  const client = getClient();
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

export async function getCompanies(limit = 10) {
  const client = getClient();
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

// ---------------------------------------------------------------------------
// Full sync methods (paginated, for sync engine)
// ---------------------------------------------------------------------------
const DEAL_PROPERTIES = [
  "dealname",
  "amount",
  "dealstage",
  "pipeline",
  "closedate",
  "hubspot_owner_id",
  "hs_lastmodifieddate",
  "createdate",
  "hs_date_entered_appointmentscheduled",
  "hs_date_entered_qualifiedtobuy",
  "hs_date_entered_presentationscheduled",
  "hs_date_entered_decisionmakerboughtin",
  "hs_date_entered_contractsent",
  "hs_date_entered_closedwon",
  "hs_date_entered_closedlost",
];

const CONTACT_PROPERTIES = [
  "email",
  "firstname",
  "lastname",
  "company",
  "jobtitle",
  "lifecyclestage",
  "hs_lastmodifieddate",
  "createdate",
];

export interface HubSpotDeal {
  id: string;
  properties: Record<string, string | null>;
}

export interface HubSpotContact {
  id: string;
  properties: Record<string, string | null>;
}

export interface HubSpotEngagement {
  id: string;
  type: string;
  properties: Record<string, string | null>;
  associations?: { dealIds: string[]; contactIds: string[] };
}

export async function getAllDeals(): Promise<HubSpotDeal[]> {
  const client = getClient();
  const allDeals: HubSpotDeal[] = [];
  let after: string | undefined;

  do {
    const res = await client.crm.deals.basicApi.getPage(
      100,
      after,
      DEAL_PROPERTIES
    );
    allDeals.push(
      ...res.results.map((d) => ({ id: d.id, properties: d.properties }))
    );
    after = res.paging?.next?.after;
  } while (after);

  return allDeals;
}

export async function getAllContacts(): Promise<HubSpotContact[]> {
  const client = getClient();
  const allContacts: HubSpotContact[] = [];
  let after: string | undefined;

  do {
    const res = await client.crm.contacts.basicApi.getPage(
      100,
      after,
      CONTACT_PROPERTIES
    );
    allContacts.push(
      ...res.results.map((c) => ({ id: c.id, properties: c.properties }))
    );
    after = res.paging?.next?.after;
  } while (after);

  return allContacts;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAssociations(record: any): { dealIds: string[]; contactIds: string[] } {
  const assoc = record.associations || {};
  const dealIds = (assoc.deals?.results || []).map((r: { id: string }) => r.id);
  const contactIds = (assoc.contacts?.results || []).map((r: { id: string }) => r.id);
  return { dealIds, contactIds };
}

export async function getEngagements(
  limit = 200
): Promise<HubSpotEngagement[]> {
  const client = getClient();
  const engagements: HubSpotEngagement[] = [];

  // Fetch recent notes
  try {
    const notes = await client.crm.objects.notes.basicApi.getPage(
      Math.min(limit, 100),
      undefined,
      ["hs_note_body", "hs_timestamp", "hs_lastmodifieddate"],
      undefined,
      ["deals", "contacts"]
    );
    for (const n of notes.results) {
      engagements.push({
        id: n.id,
        type: "note",
        properties: n.properties,
        associations: extractAssociations(n),
      });
    }
  } catch {
    // Notes API may not be available
  }

  // Fetch recent emails
  try {
    const emails = await client.crm.objects.emails.basicApi.getPage(
      Math.min(limit, 100),
      undefined,
      ["hs_email_subject", "hs_email_text", "hs_timestamp"],
      undefined,
      ["deals", "contacts"]
    );
    for (const e of emails.results) {
      engagements.push({
        id: e.id,
        type: "email",
        properties: e.properties,
        associations: extractAssociations(e),
      });
    }
  } catch {
    // Emails API may not be available
  }

  // Fetch recent calls
  try {
    const calls = await client.crm.objects.calls.basicApi.getPage(
      Math.min(limit, 100),
      undefined,
      ["hs_call_title", "hs_call_body", "hs_timestamp", "hs_call_duration"],
      undefined,
      ["deals", "contacts"]
    );
    for (const c of calls.results) {
      engagements.push({
        id: c.id,
        type: "call",
        properties: c.properties,
        associations: extractAssociations(c),
      });
    }
  } catch {
    // Calls API may not be available
  }

  // Fetch recent meetings
  try {
    const meetings = await client.crm.objects.meetings.basicApi.getPage(
      Math.min(limit, 100),
      undefined,
      ["hs_meeting_title", "hs_meeting_body", "hs_timestamp"],
      undefined,
      ["deals", "contacts"]
    );
    for (const m of meetings.results) {
      engagements.push({
        id: m.id,
        type: "meeting",
        properties: m.properties,
        associations: extractAssociations(m),
      });
    }
  } catch {
    // Meetings API may not be available
  }

  return engagements;
}
