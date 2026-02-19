// ---------------------------------------------------------------------------
// Transform CRM records into text for the knowledge engine
// ---------------------------------------------------------------------------

interface DealRecord {
  dealName: string;
  amount: string | null;
  stage: string | null;
  pipeline: string | null;
  closeDate: Date | null;
  ownerName: string | null;
  daysInStage: number | null;
}

interface ContactRecord {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  title: string | null;
  lifecycleStage: string | null;
  associatedDealIds: string[] | null;
}

interface ActivityRecord {
  type: string;
  subject: string | null;
  body: string | null;
  occurredAt: Date | null;
  dealHubspotId: string | null;
}

export function dealsToText(deals: DealRecord[]): string {
  if (deals.length === 0) return "";

  const lines = [
    "# HubSpot CRM — Active Deals",
    `Last synced: ${new Date().toISOString()}`,
    `Total deals: ${deals.length}`,
    "",
  ];

  for (const deal of deals) {
    const amount = deal.amount
      ? `$${Number(deal.amount).toLocaleString()}`
      : "No amount";
    const close = deal.closeDate
      ? new Date(deal.closeDate).toLocaleDateString()
      : "No close date";
    const stage = deal.stage || "Unknown stage";
    const days = deal.daysInStage != null ? `${deal.daysInStage} days` : "N/A";

    lines.push(
      `## Deal: ${deal.dealName}`,
      `- Amount: ${amount}`,
      `- Stage: ${stage} (${days} in current stage)`,
      `- Pipeline: ${deal.pipeline || "Default"}`,
      `- Close Date: ${close}`,
      `- Owner: ${deal.ownerName || "Unassigned"}`,
      ""
    );
  }

  return lines.join("\n");
}

export function contactsToText(contacts: ContactRecord[]): string {
  if (contacts.length === 0) return "";

  const lines = [
    "# HubSpot CRM — Contacts",
    `Last synced: ${new Date().toISOString()}`,
    `Total contacts: ${contacts.length}`,
    "",
  ];

  for (const c of contacts) {
    const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown";
    const dealCount = c.associatedDealIds?.length || 0;

    lines.push(
      `## Contact: ${name}`,
      `- Email: ${c.email || "N/A"}`,
      `- Company: ${c.company || "N/A"}`,
      `- Title: ${c.title || "N/A"}`,
      `- Lifecycle Stage: ${c.lifecycleStage || "N/A"}`,
      `- Associated Deals: ${dealCount}`,
      ""
    );
  }

  return lines.join("\n");
}

export function activitiesToText(activities: ActivityRecord[]): string {
  if (activities.length === 0) return "";

  const lines = [
    "# HubSpot CRM — Recent Activities",
    `Last synced: ${new Date().toISOString()}`,
    `Total activities: ${activities.length}`,
    "",
  ];

  for (const a of activities) {
    const date = a.occurredAt
      ? new Date(a.occurredAt).toLocaleDateString()
      : "Unknown date";
    const subject = a.subject || `${a.type} activity`;
    const bodyPreview = a.body
      ? a.body.substring(0, 200).replace(/\n/g, " ")
      : "";

    lines.push(
      `### ${a.type.toUpperCase()}: ${subject} (${date})`,
      bodyPreview ? `${bodyPreview}...` : "",
      ""
    );
  }

  return lines.join("\n");
}
