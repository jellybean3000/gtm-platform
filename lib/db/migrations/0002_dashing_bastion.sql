CREATE TYPE "public"."crm_sync_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "crm_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"hubspot_activity_id" varchar(50) NOT NULL,
	"type" varchar(50) NOT NULL,
	"deal_hubspot_id" varchar(50),
	"contact_hubspot_id" varchar(50),
	"subject" text,
	"body" text,
	"occurred_at" timestamp,
	"properties" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"hubspot_contact_id" varchar(50) NOT NULL,
	"email" varchar(255),
	"first_name" varchar(255),
	"last_name" varchar(255),
	"company" varchar(255),
	"title" varchar(255),
	"lifecycle_stage" varchar(100),
	"associated_deal_ids" text[],
	"properties" jsonb,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"hubspot_deal_id" varchar(50) NOT NULL,
	"deal_name" varchar(512) NOT NULL,
	"amount" varchar(50),
	"stage" varchar(255),
	"pipeline" varchar(255),
	"close_date" timestamp,
	"owner_name" varchar(255),
	"owner_email" varchar(255),
	"days_in_stage" integer,
	"health_score" integer,
	"properties" jsonb,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"sync_type" varchar(50) NOT NULL,
	"status" "crm_sync_status" DEFAULT 'running' NOT NULL,
	"deals_count" integer,
	"contacts_count" integer,
	"activities_count" integer,
	"error" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sync_log" ADD CONSTRAINT "crm_sync_log_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_activities_team_id_idx" ON "crm_activities" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "crm_activities_deal_idx" ON "crm_activities" USING btree ("team_id","deal_hubspot_id");--> statement-breakpoint
CREATE INDEX "crm_contacts_team_id_idx" ON "crm_contacts" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "crm_contacts_hubspot_id_idx" ON "crm_contacts" USING btree ("team_id","hubspot_contact_id");--> statement-breakpoint
CREATE INDEX "crm_deals_team_id_idx" ON "crm_deals" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "crm_deals_hubspot_id_idx" ON "crm_deals" USING btree ("team_id","hubspot_deal_id");--> statement-breakpoint
CREATE INDEX "crm_sync_log_team_id_idx" ON "crm_sync_log" USING btree ("team_id");