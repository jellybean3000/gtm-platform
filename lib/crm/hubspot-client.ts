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
// Data methods
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
