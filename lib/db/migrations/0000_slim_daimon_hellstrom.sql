CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."agent_run_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."crawl_mode" AS ENUM('single', 'site', 'sitemap', 'rss', 'scheduled');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('uploading', 'processing', 'analyzed', 'error');--> statement-breakpoint
CREATE TYPE "public"."intelligence_type" AS ENUM('brand_voice', 'proof_points', 'competitive_intel', 'customer_voice', 'feature_value_map', 'messaging_heritage', 'performance_benchmarks', 'objection_knowledge_base');--> statement-breakpoint
CREATE TYPE "public"."orchestration_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."upload_type" AS ENUM('file', 'web', 'integration');--> statement-breakpoint
CREATE TYPE "public"."web_source_status" AS ENUM('active', 'paused', 'error');--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"orchestration_id" uuid,
	"status" "agent_run_status" DEFAULT 'queued' NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"knowledge_sources_used" text[],
	"started_at" timestamp,
	"completed_at" timestamp,
	"tokens_used" integer
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"system_prompt" text,
	"tools" jsonb,
	"input_schema" jsonb,
	"output_schema" jsonb,
	"dependencies" text[],
	CONSTRAINT "agents_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"filename" varchar(512) NOT NULL,
	"file_type" varchar(50) NOT NULL,
	"file_url" text,
	"status" "document_status" DEFAULT 'uploading' NOT NULL,
	"upload_type" "upload_type" DEFAULT 'file' NOT NULL,
	"source_url" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"type" "intelligence_type" NOT NULL,
	"data" jsonb,
	"source_chunk_ids" text[],
	"freshness_score" real,
	"last_updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"chunk_index" integer NOT NULL,
	"classification" jsonb,
	"entity_tags" text[],
	"confidence_score" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orchestrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_request" text NOT NULL,
	"parsed_intent" jsonb,
	"execution_dag" jsonb,
	"status" "orchestration_status" DEFAULT 'pending' NOT NULL,
	"conflicts" jsonb,
	"final_synthesis" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"plan" varchar(50) DEFAULT 'free' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"team_id" uuid,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"clerk_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
CREATE TABLE "web_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"url" text NOT NULL,
	"crawl_mode" "crawl_mode" DEFAULT 'single' NOT NULL,
	"crawl_frequency" varchar(50),
	"last_crawled_at" timestamp,
	"content_hash" varchar(64),
	"status" "web_source_status" DEFAULT 'active' NOT NULL,
	"changes_detected" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_orchestration_id_orchestrations_id_fk" FOREIGN KEY ("orchestration_id") REFERENCES "public"."orchestrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_products" ADD CONSTRAINT "intelligence_products_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orchestrations" ADD CONSTRAINT "orchestrations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_sources" ADD CONSTRAINT "web_sources_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_runs_team_id_idx" ON "agent_runs" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "agent_runs_orchestration_id_idx" ON "agent_runs" USING btree ("orchestration_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_team_id_idx" ON "knowledge_chunks" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_document_id_idx" ON "knowledge_chunks" USING btree ("document_id");