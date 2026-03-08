CREATE TYPE "public"."investor_firm_type" AS ENUM('vc', 'angel', 'pe', 'corporate', 'family_office', 'other');--> statement-breakpoint
CREATE TYPE "public"."investor_interest" AS ENUM('high', 'medium', 'low', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."investor_stage" AS ENUM('identified', 'researching', 'outreach', 'first_meeting', 'partner_meeting', 'due_diligence', 'term_sheet', 'closed_committed', 'passed');--> statement-breakpoint
CREATE TABLE "investor_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investor_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"meeting_date" timestamp NOT NULL,
	"meeting_type" varchar(50) NOT NULL,
	"attendees" text,
	"notes" text,
	"next_steps" text,
	"sentiment" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"firm_name" varchar(255) NOT NULL,
	"firm_type" "investor_firm_type" DEFAULT 'vc' NOT NULL,
	"check_size_min" integer,
	"check_size_max" integer,
	"stage" "investor_stage" DEFAULT 'identified' NOT NULL,
	"lead_partner" varchar(255),
	"lead_partner_email" varchar(255),
	"interest_level" "investor_interest" DEFAULT 'unknown' NOT NULL,
	"committed_amount" integer,
	"thesis_fit" text,
	"portfolio_companies" text[],
	"website" text,
	"notes" text,
	"next_steps" text,
	"last_contact_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "investor_meetings" ADD CONSTRAINT "investor_meetings_investor_id_investors_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investor_meetings" ADD CONSTRAINT "investor_meetings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investors" ADD CONSTRAINT "investors_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "investor_meetings_investor_id_idx" ON "investor_meetings" USING btree ("investor_id");--> statement-breakpoint
CREATE INDEX "investor_meetings_team_id_idx" ON "investor_meetings" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "investors_team_id_idx" ON "investors" USING btree ("team_id");