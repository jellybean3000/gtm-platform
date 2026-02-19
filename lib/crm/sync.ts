import { db } from "@/lib/db";
import {
  crmDeals,
  crmContacts,
  crmActivities,
  crmSyncLog,
  documents,
  knowledgeChunks,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getAllDeals,
  getAllContacts,
  getEngagements,
} from "./hubspot-client";
import { dealsToText, contactsToText, activitiesToText } from "./transform";
import { chunkText } from "@/lib/knowledge/chunk";
import { generateEmbeddings } from "@/lib/knowledge/embed";
import { dealHealthScore } from "./scoring";

// ---------------------------------------------------------------------------
// Sync Deals
// ---------------------------------------------------------------------------
export async function syncDeals(teamId: string): Promise<number> {
  const hubspotDeals = await getAllDeals();
  let count = 0;

  for (const deal of hubspotDeals) {
    const p = deal.properties;

    // Calculate days in current stage
    let daysInStage: number | null = null;
    const stageEntryKeys = Object.keys(p).filter((k) =>
      k.startsWith("hs_date_entered_")
    );
    const latestEntry = stageEntryKeys
      .map((k) => ({ key: k, date: p[k] ? new Date(p[k]!) : null }))
      .filter((e) => e.date)
      .sort((a, b) => (b.date!.getTime() - a.date!.getTime()));

    if (latestEntry.length > 0 && latestEntry[0].date) {
      daysInStage = Math.floor(
        (Date.now() - latestEntry[0].date.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    const values = {
      teamId,
      hubspotDealId: deal.id,
      dealName: p.dealname || "Untitled Deal",
      amount: p.amount || null,
      stage: p.dealstage || null,
      pipeline: p.pipeline || null,
      closeDate: p.closedate ? new Date(p.closedate) : null,
      ownerName: null as string | null,
      ownerEmail: null as string | null,
      daysInStage,
      properties: p,
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    };

    // Upsert: check if deal exists for this team
    const existing = await db
      .select({ id: crmDeals.id })
      .from(crmDeals)
      .where(
        and(
          eq(crmDeals.teamId, teamId),
          eq(crmDeals.hubspotDealId, deal.id)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(crmDeals)
        .set(values)
        .where(eq(crmDeals.id, existing[0].id));
    } else {
      await db.insert(crmDeals).values(values);
    }
    count++;
  }

  return count;
}

// ---------------------------------------------------------------------------
// Sync Contacts
// ---------------------------------------------------------------------------
export async function syncContacts(teamId: string): Promise<number> {
  const hubspotContacts = await getAllContacts();
  let count = 0;

  for (const contact of hubspotContacts) {
    const p = contact.properties;

    const values = {
      teamId,
      hubspotContactId: contact.id,
      email: p.email || null,
      firstName: p.firstname || null,
      lastName: p.lastname || null,
      company: p.company || null,
      title: p.jobtitle || null,
      lifecycleStage: p.lifecyclestage || null,
      properties: p,
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    };

    const existing = await db
      .select({ id: crmContacts.id })
      .from(crmContacts)
      .where(
        and(
          eq(crmContacts.teamId, teamId),
          eq(crmContacts.hubspotContactId, contact.id)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(crmContacts)
        .set(values)
        .where(eq(crmContacts.id, existing[0].id));
    } else {
      await db.insert(crmContacts).values(values);
    }
    count++;
  }

  return count;
}

// ---------------------------------------------------------------------------
// Sync Activities
// ---------------------------------------------------------------------------
export async function syncActivities(teamId: string): Promise<number> {
  const engagements = await getEngagements(200);
  let count = 0;

  for (const eng of engagements) {
    const p = eng.properties;

    let subject: string | null = null;
    let body: string | null = null;

    switch (eng.type) {
      case "email":
        subject = p.hs_email_subject || null;
        body = p.hs_email_text || null;
        break;
      case "note":
        subject = "Note";
        body = p.hs_note_body || null;
        break;
      case "call":
        subject = p.hs_call_title || null;
        body = p.hs_call_body || null;
        break;
      case "meeting":
        subject = p.hs_meeting_title || null;
        body = p.hs_meeting_body || null;
        break;
    }

    const values = {
      teamId,
      hubspotActivityId: eng.id,
      type: eng.type,
      dealHubspotId: eng.associations?.dealIds?.[0] || null,
      contactHubspotId: eng.associations?.contactIds?.[0] || null,
      subject,
      body,
      occurredAt: p.hs_timestamp ? new Date(p.hs_timestamp) : null,
      properties: p,
    };

    const existing = await db
      .select({ id: crmActivities.id })
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.teamId, teamId),
          eq(crmActivities.hubspotActivityId, eng.id)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(crmActivities)
        .set(values)
        .where(eq(crmActivities.id, existing[0].id));
    } else {
      await db.insert(crmActivities).values(values);
    }
    count++;
  }

  return count;
}

// ---------------------------------------------------------------------------
// Compute and store health scores for all deals
// ---------------------------------------------------------------------------
async function computeAndStoreHealthScores(teamId: string): Promise<number> {
  const deals = await db
    .select()
    .from(crmDeals)
    .where(eq(crmDeals.teamId, teamId));

  const activities = await db
    .select()
    .from(crmActivities)
    .where(eq(crmActivities.teamId, teamId));

  let scored = 0;
  for (const deal of deals) {
    const dealActs = activities.filter(
      (a) => a.dealHubspotId === deal.hubspotDealId
    );
    const result = dealHealthScore(
      {
        hubspotDealId: deal.hubspotDealId,
        dealName: deal.dealName,
        amount: deal.amount,
        stage: deal.stage,
        daysInStage: deal.daysInStage,
        closeDate: deal.closeDate,
      },
      dealActs.map((a) => ({
        type: a.type,
        dealHubspotId: a.dealHubspotId,
        contactHubspotId: a.contactHubspotId,
        occurredAt: a.occurredAt,
      }))
    );

    await db
      .update(crmDeals)
      .set({ healthScore: result.score })
      .where(eq(crmDeals.id, deal.id));

    scored++;
  }

  return scored;
}

// ---------------------------------------------------------------------------
// Feed CRM data into Knowledge Engine
// ---------------------------------------------------------------------------
async function feedToKnowledge(teamId: string): Promise<void> {
  // Get synced CRM data
  const deals = await db
    .select()
    .from(crmDeals)
    .where(eq(crmDeals.teamId, teamId));
  const contacts = await db
    .select()
    .from(crmContacts)
    .where(eq(crmContacts.teamId, teamId));
  const activities = await db
    .select()
    .from(crmActivities)
    .where(eq(crmActivities.teamId, teamId));

  // Convert to text
  const dealsText = dealsToText(deals);
  const contactsText = contactsToText(contacts);
  const activitiesText = activitiesToText(activities);
  const fullText = [dealsText, contactsText, activitiesText]
    .filter(Boolean)
    .join("\n\n---\n\n");

  if (!fullText.trim()) return;

  // Find or create the integration document
  const [existingDoc] = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.teamId, teamId),
        eq(documents.sourceUrl, "hubspot://sync")
      )
    )
    .limit(1);

  let documentId: string;

  if (existingDoc) {
    documentId = existingDoc.id;
    // Delete old chunks
    await db
      .delete(knowledgeChunks)
      .where(eq(knowledgeChunks.documentId, documentId));
    // Update document
    await db
      .update(documents)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(documents.id, documentId));
  } else {
    const [doc] = await db
      .insert(documents)
      .values({
        teamId,
        filename: "HubSpot CRM Sync",
        fileType: "text/plain",
        uploadType: "integration",
        sourceUrl: "hubspot://sync",
        status: "processing",
      })
      .returning({ id: documents.id });
    documentId = doc.id;
  }

  // Chunk the text
  const chunks = chunkText(fullText);

  // Generate embeddings
  const embeddings = await generateEmbeddings(chunks);

  // Save chunks
  const chunkValues = chunks.map((content, index) => ({
    documentId,
    teamId,
    content,
    embedding: embeddings[index],
    chunkIndex: index,
    classification: { type: "crm_data", source: "hubspot" },
  }));

  for (let i = 0; i < chunkValues.length; i += 50) {
    await db.insert(knowledgeChunks).values(chunkValues.slice(i, i + 50));
  }

  // Mark document as analyzed
  await db
    .update(documents)
    .set({ status: "analyzed", updatedAt: new Date() })
    .where(eq(documents.id, documentId));
}

// ---------------------------------------------------------------------------
// Full Sync Orchestrator
// ---------------------------------------------------------------------------
export interface SyncResult {
  dealsCount: number;
  contactsCount: number;
  activitiesCount: number;
  knowledgeUpdated: boolean;
  error?: string;
}

export async function runFullSync(teamId: string): Promise<SyncResult> {
  // Create sync log entry
  const [logEntry] = await db
    .insert(crmSyncLog)
    .values({ teamId, syncType: "full", status: "running" })
    .returning({ id: crmSyncLog.id });

  try {
    console.log(`[CRM Sync] Starting full sync for team ${teamId}`);

    const dealsCount = await syncDeals(teamId);
    console.log(`[CRM Sync] Synced ${dealsCount} deals`);

    const contactsCount = await syncContacts(teamId);
    console.log(`[CRM Sync] Synced ${contactsCount} contacts`);

    const activitiesCount = await syncActivities(teamId);
    console.log(`[CRM Sync] Synced ${activitiesCount} activities`);

    // Compute health scores for all deals
    const healthScoresComputed = await computeAndStoreHealthScores(teamId);
    console.log(`[CRM Sync] Computed health scores for ${healthScoresComputed} deals`);

    // Feed into knowledge engine
    let knowledgeUpdated = false;
    try {
      await feedToKnowledge(teamId);
      knowledgeUpdated = true;
      console.log("[CRM Sync] Knowledge engine updated");
    } catch (err) {
      console.error("[CRM Sync] Knowledge feed error:", err);
    }

    // Update sync log
    await db
      .update(crmSyncLog)
      .set({
        status: "completed",
        dealsCount,
        contactsCount,
        activitiesCount,
        completedAt: new Date(),
      })
      .where(eq(crmSyncLog.id, logEntry.id));

    return { dealsCount, contactsCount, activitiesCount, knowledgeUpdated };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown sync error";
    console.error("[CRM Sync] Error:", message);

    await db
      .update(crmSyncLog)
      .set({
        status: "failed",
        error: message,
        completedAt: new Date(),
      })
      .where(eq(crmSyncLog.id, logEntry.id));

    return {
      dealsCount: 0,
      contactsCount: 0,
      activitiesCount: 0,
      knowledgeUpdated: false,
      error: message,
    };
  }
}
