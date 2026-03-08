import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  jsonb,
  integer,
  real,
  pgEnum,
  index,
  customType,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Custom type: pgvector vector column
// ---------------------------------------------------------------------------
const vector = customType<{ data: number[]; driverParam: string }>({
  dataType() {
    return "vector(3072)";
  },
  toDriver(value: number[]) {
    return JSON.stringify(value);
  },
  fromDriver(value: unknown) {
    return JSON.parse(value as string) as number[];
  },
});

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const documentStatusEnum = pgEnum("document_status", [
  "uploading",
  "processing",
  "analyzed",
  "error",
]);

export const uploadTypeEnum = pgEnum("upload_type", [
  "file",
  "web",
  "integration",
]);

export const crawlModeEnum = pgEnum("crawl_mode", [
  "single",
  "site",
  "sitemap",
  "rss",
  "scheduled",
]);

export const webSourceStatusEnum = pgEnum("web_source_status", [
  "active",
  "paused",
  "error",
]);

export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);

export const orchestrationStatusEnum = pgEnum("orchestration_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const intelligenceTypeEnum = pgEnum("intelligence_type", [
  "brand_voice",
  "proof_points",
  "competitive_intel",
  "customer_voice",
  "feature_value_map",
  "messaging_heritage",
  "performance_benchmarks",
  "objection_knowledge_base",
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  teamId: uuid("team_id").references(() => teams.id),
  role: varchar("role", { length: 50 }).notNull().default("member"),
  clerkId: varchar("clerk_id", { length: 255 }).unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  plan: varchar("plan", { length: 50 }).notNull().default("free"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id),
  filename: varchar("filename", { length: 512 }).notNull(),
  fileType: varchar("file_type", { length: 50 }).notNull(),
  fileUrl: text("file_url"),
  status: documentStatusEnum("status").notNull().default("uploading"),
  uploadType: uploadTypeEnum("upload_type").notNull().default("file"),
  sourceUrl: text("source_url"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    content: text("content").notNull(),
    embedding: vector("embedding"),
    chunkIndex: integer("chunk_index").notNull(),
    classification: jsonb("classification"),
    entityTags: text("entity_tags").array(),
    confidenceScore: real("confidence_score"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("knowledge_chunks_team_id_idx").on(table.teamId),
    index("knowledge_chunks_document_id_idx").on(table.documentId),
  ]
);

export const webSources = pgTable("web_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id),
  url: text("url").notNull(),
  crawlMode: crawlModeEnum("crawl_mode").notNull().default("single"),
  crawlFrequency: varchar("crawl_frequency", { length: 50 }),
  lastCrawledAt: timestamp("last_crawled_at"),
  contentHash: varchar("content_hash", { length: 64 }),
  status: webSourceStatusEnum("status").notNull().default("active"),
  changesDetected: integer("changes_detected").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  systemPrompt: text("system_prompt"),
  tools: jsonb("tools"),
  inputSchema: jsonb("input_schema"),
  outputSchema: jsonb("output_schema"),
  dependencies: text("dependencies").array(),
});

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id),
    orchestrationId: uuid("orchestration_id").references(
      () => orchestrations.id
    ),
    status: agentRunStatusEnum("status").notNull().default("queued"),
    input: jsonb("input"),
    output: jsonb("output"),
    knowledgeSourcesUsed: text("knowledge_sources_used").array(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    tokensUsed: integer("tokens_used"),
  },
  (table) => [
    index("agent_runs_team_id_idx").on(table.teamId),
    index("agent_runs_orchestration_id_idx").on(table.orchestrationId),
  ]
);

export const orchestrations = pgTable("orchestrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id),
  userRequest: text("user_request").notNull(),
  parsedIntent: jsonb("parsed_intent"),
  executionDag: jsonb("execution_dag"),
  status: orchestrationStatusEnum("status").notNull().default("pending"),
  conflicts: jsonb("conflicts"),
  finalSynthesis: jsonb("final_synthesis"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const hubspotConnections = pgTable(
  "hubspot_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id)
      .unique(),
    portalId: varchar("portal_id", { length: 50 }),
    hubName: varchar("hub_name", { length: 255 }),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    scopes: text("scopes").array(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("hubspot_connections_team_id_idx").on(table.teamId)]
);

// ---------------------------------------------------------------------------
// CRM Sync Tables
// ---------------------------------------------------------------------------

export const crmSyncStatusEnum = pgEnum("crm_sync_status", [
  "running",
  "completed",
  "failed",
]);

export const crmDeals = pgTable(
  "crm_deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    hubspotDealId: varchar("hubspot_deal_id", { length: 50 }).notNull(),
    dealName: varchar("deal_name", { length: 512 }).notNull(),
    amount: varchar("amount", { length: 50 }),
    stage: varchar("stage", { length: 255 }),
    pipeline: varchar("pipeline", { length: 255 }),
    closeDate: timestamp("close_date"),
    ownerName: varchar("owner_name", { length: 255 }),
    ownerEmail: varchar("owner_email", { length: 255 }),
    daysInStage: integer("days_in_stage"),
    healthScore: integer("health_score"),
    properties: jsonb("properties"),
    lastSyncedAt: timestamp("last_synced_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("crm_deals_team_id_idx").on(table.teamId),
    index("crm_deals_hubspot_id_idx").on(table.teamId, table.hubspotDealId),
  ]
);

export const crmContacts = pgTable(
  "crm_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    hubspotContactId: varchar("hubspot_contact_id", { length: 50 }).notNull(),
    email: varchar("email", { length: 255 }),
    firstName: varchar("first_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    company: varchar("company", { length: 255 }),
    title: varchar("title", { length: 255 }),
    lifecycleStage: varchar("lifecycle_stage", { length: 100 }),
    associatedDealIds: text("associated_deal_ids").array(),
    properties: jsonb("properties"),
    lastSyncedAt: timestamp("last_synced_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("crm_contacts_team_id_idx").on(table.teamId),
    index("crm_contacts_hubspot_id_idx").on(
      table.teamId,
      table.hubspotContactId
    ),
  ]
);

export const crmActivities = pgTable(
  "crm_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    hubspotActivityId: varchar("hubspot_activity_id", {
      length: 50,
    }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    dealHubspotId: varchar("deal_hubspot_id", { length: 50 }),
    contactHubspotId: varchar("contact_hubspot_id", { length: 50 }),
    subject: text("subject"),
    body: text("body"),
    occurredAt: timestamp("occurred_at"),
    properties: jsonb("properties"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("crm_activities_team_id_idx").on(table.teamId),
    index("crm_activities_deal_idx").on(table.teamId, table.dealHubspotId),
  ]
);

export const crmSyncLog = pgTable(
  "crm_sync_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    syncType: varchar("sync_type", { length: 50 }).notNull(),
    status: crmSyncStatusEnum("status").notNull().default("running"),
    dealsCount: integer("deals_count"),
    contactsCount: integer("contacts_count"),
    activitiesCount: integer("activities_count"),
    error: text("error"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [index("crm_sync_log_team_id_idx").on(table.teamId)]
);

// ---------------------------------------------------------------------------
// Investor CRM Tables
// ---------------------------------------------------------------------------

export const investorFirmTypeEnum = pgEnum("investor_firm_type", [
  "vc",
  "angel",
  "pe",
  "corporate",
  "family_office",
  "other",
]);

export const investorStageEnum = pgEnum("investor_stage", [
  "identified",
  "researching",
  "outreach",
  "first_meeting",
  "partner_meeting",
  "due_diligence",
  "term_sheet",
  "closed_committed",
  "passed",
]);

export const investorInterestEnum = pgEnum("investor_interest", [
  "high",
  "medium",
  "low",
  "unknown",
]);

export const investors = pgTable(
  "investors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    firmName: varchar("firm_name", { length: 255 }).notNull(),
    firmType: investorFirmTypeEnum("firm_type").notNull().default("vc"),
    checkSizeMin: integer("check_size_min"),
    checkSizeMax: integer("check_size_max"),
    stage: investorStageEnum("stage").notNull().default("identified"),
    leadPartner: varchar("lead_partner", { length: 255 }),
    leadPartnerEmail: varchar("lead_partner_email", { length: 255 }),
    interestLevel: investorInterestEnum("interest_level")
      .notNull()
      .default("unknown"),
    committedAmount: integer("committed_amount"),
    thesisFit: text("thesis_fit"),
    portfolioCompanies: text("portfolio_companies").array(),
    website: text("website"),
    notes: text("notes"),
    nextSteps: text("next_steps"),
    lastContactDate: timestamp("last_contact_date"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("investors_team_id_idx").on(table.teamId)]
);

export const investorMeetings = pgTable(
  "investor_meetings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    investorId: uuid("investor_id")
      .notNull()
      .references(() => investors.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    meetingDate: timestamp("meeting_date").notNull(),
    meetingType: varchar("meeting_type", { length: 50 }).notNull(),
    attendees: text("attendees"),
    notes: text("notes"),
    nextSteps: text("next_steps"),
    sentiment: varchar("sentiment", { length: 20 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("investor_meetings_investor_id_idx").on(table.investorId),
    index("investor_meetings_team_id_idx").on(table.teamId),
  ]
);

export const intelligenceProducts = pgTable("intelligence_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id),
  type: intelligenceTypeEnum("type").notNull(),
  data: jsonb("data"),
  sourceChunkIds: text("source_chunk_ids").array(),
  freshnessScore: real("freshness_score"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});
