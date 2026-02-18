# GTM Multi-Agent Platform

## Project Overview
A multi-agent Go-To-Market platform where 9 specialized AI agents are coordinated by a central GTM Engineer orchestrator. The platform ingests institutional knowledge (files, web links, integrations) through a Knowledge Intelligence Engine that grounds all agent work in the company's actual data, voice, and learnings. A CRM Integration Agent connects the platform to HubSpot (free CRM), creating a live bridge between GTM strategy and actual deal activity.

## Architecture (5 Layers)

### Layer 1 — Source Layer
All knowledge inputs — files, web links, and integrations.
- **File Uploads**: .pptx, .pdf, .docx, .csv, .xlsx, .mp3, .mp4, .md
- **Web Links**: URLs with 5 crawl modes (single page, site crawl, sitemap import, RSS monitor, scheduled recrawl)
- **Integrations**: HubSpot CRM (primary — free tier), Google Drive, Notion, Confluence, Gong, Slack
- **Live Monitoring**: Scheduled recrawls with change detection (content hash comparison)

### Layer 2 — Knowledge Intelligence Engine
Transforms raw sources into structured intelligence via a 4-stage pipeline:
1. **Ingest**: Upload → format detection → text extraction (OCR, slide parsing, transcription) → metadata capture
2. **Process**: Semantic chunking (~500 tokens) → entity extraction → classification (type, topic, persona, funnel stage) → embedding generation
3. **Analyze**: Theme extraction → consistency analysis (flag contradictions) → gap detection → performance correlation
4. **Index**: Knowledge graph (entities + relationships) → vector store (pgvector) → freshness tracking → access control

Produces 9 intelligence outputs:
- Brand Voice Model → powers Positioning, Content, Demand Gen, Sales Enablement
- Proof Point Library → powers Content, Sales Enablement, Positioning
- Competitive Intel DB → powers Market Research, Positioning, Sales Enablement, CRM Integration
- Customer Voice Corpus → powers PMF, Positioning, Content, Demand Gen
- Feature-Value Map → powers PMF, Content, Sales Enablement
- Messaging Heritage → powers Positioning, Content
- Performance Benchmarks → powers Analytics, Demand Gen, Launch Planning
- Objection Knowledge Base → powers Sales Enablement, Positioning, CRM Integration
- Live Pipeline Intelligence → powers Analytics, Sales Enablement, CRM Integration, Demand Gen (sourced from HubSpot CRM sync)

### Layer 3 — Specialist Agent Layer
9 domain-specific agents. Each agent has: a system prompt, input/output schemas, core functions, tools (including knowledge base queries), and a dedicated visualization surface.

**Agent Dependency Graph (execution order):**
- Foundation (parallel): Market Research Agent + PMF Agent
- Strategy (after foundation): Positioning Agent + Analytics Agent
- Execution (after strategy, parallel): Content Agent + Sales Enablement Agent + Demand Gen Agent
- Orchestration (after execution): Launch Planning Agent
- Always-on (runs independently, bidirectional data flow): CRM Integration Agent

### Layer 4 — Orchestration Layer
The GTM Engineer orchestrator that:
- Parses natural language business requests into structured intent
- Builds a DAG of agent tasks with correct sequencing
- Dispatches structured briefs to agents with upstream context
- Resolves conflicts between agent outputs
- Synthesizes all outputs into a unified GTM strategy
- Tracks progress across all agents in real time

### Layer 5 — User Layer
Chat-based interface where the GTM leader makes requests and receives unified strategies.

---

## Tech Stack

### Frontend
- **Next.js 14+ (App Router)** — app/ directory structure
- **Tailwind CSS** — utility-first styling
- **shadcn/ui** — accessible component primitives
- **Zustand** — lightweight state management for agent status, upload queues
- **Recharts** — analytics dashboards, funnel visualizations, KPI charts
- **TipTap** — rich text editor for content agent outputs

### Backend
- **Next.js API Routes + Server Actions** — co-located with frontend
- **PostgreSQL via Supabase or Neon** — primary database
- **Drizzle ORM** — type-safe database queries and migrations
- **pgvector** — vector store for semantic search over document embeddings
- **Redis (Upstash)** — job queues, caching, rate limiting
- **S3 / Cloudflare R2** — file storage for uploads and generated artifacts
- **Inngest** — background job orchestration for agent pipelines, crawl scheduling

### AI / LLM
- **Anthropic Claude API (claude-sonnet-4-5-20250929)** — primary LLM for ALL agents
- **Claude Tool Use / Function Calling** — agents use tools to query knowledge base, generate files, fetch data
- **Vercel AI SDK** — streaming, prompt management, multi-step agent chains
- **Google Gemini text-embedding-004** — embedding generation for document chunks (free tier, Anthropic-compatible)
- **Unstructured.io or LlamaParse** — document parsing (PDF, PPTX, DOCX, images)
- **Firecrawl** — web crawling with JS rendering, rate limiting, structured extraction

### Infrastructure
- **Vercel** — hosting and deployment
- **Clerk** — authentication, user management, team workspaces
- **Resend** — transactional email for alerts and notifications
- **PostHog** — error tracking, usage analytics, feature flags

---

## Database Schema (Core Tables)

```
users — id, email, name, team_id, role, created_at
teams — id, name, plan, created_at
documents — id, team_id, filename, file_type, file_url, status (uploading/processing/analyzed/error), upload_type (file/web/integration), source_url, metadata, created_at, updated_at
knowledge_chunks — id, document_id, team_id, content, embedding (vector), chunk_index, classification (json: type, topic, persona, funnel_stage), entity_tags[], confidence_score, created_at
web_sources — id, team_id, url, crawl_mode (single/site/sitemap/rss/scheduled), crawl_frequency, last_crawled_at, content_hash, status (active/paused/error), changes_detected, created_at
agents — id, name, slug, system_prompt, tools (json), input_schema (json), output_schema (json), dependencies (agent slugs[])
agent_runs — id, team_id, agent_id, orchestration_id, status (queued/running/completed/failed), input (json), output (json), knowledge_sources_used (chunk_ids[]), started_at, completed_at, tokens_used
orchestrations — id, team_id, user_request, parsed_intent (json), execution_dag (json), status, conflicts (json), final_synthesis (json), created_at
intelligence_products — id, team_id, type (brand_voice/proof_points/competitive_intel/pipeline_intel/etc), data (json), source_chunk_ids[], freshness_score, last_updated

# CRM Integration Tables
hubspot_connections — id, team_id, access_token (encrypted), refresh_token (encrypted), hub_id, scopes[], connected_at, last_synced_at, sync_status
crm_contacts — id, team_id, hubspot_id, email, name, company, title, lifecycle_stage, lead_score, icp_match_score, enrichment_data (json), last_synced_at
crm_deals — id, team_id, hubspot_id, name, stage, amount, close_date, contact_ids[], company, pipeline, days_in_stage, health_score, risk_factors (json), recommended_actions (json), last_synced_at
crm_activities — id, team_id, hubspot_id, deal_id, contact_id, type (email/call/meeting/note), summary, sentiment, next_steps, created_at
crm_sync_log — id, team_id, direction (pull/push), entity_type, entity_id, action (create/update/sync), status, error_message, synced_at
```

---

## Agent Specifications

### 1. Market Research Agent
- **Slug**: `market-research`
- **Dependencies**: None (foundation layer)
- **Tools**: `query_knowledge_base`, `web_search`
- **Input**: product_description, target_market, known_competitors, existing_customers, research_depth
- **Output**: icp_profiles[], competitor_matrix, market_sizing (TAM/SAM/SOM), pricing_intel, trend_analysis
- **Visualization**: Dashboard with competitor positioning map, segment heatmap, TAM waterfall chart, pricing table

### 2. PMF Agent
- **Slug**: `pmf`
- **Dependencies**: None (foundation layer)
- **Tools**: `query_knowledge_base`
- **Input**: product, hypotheses, existing_feedback, customer_segments, research_type
- **Output**: interview_scripts[], survey_instruments[], insight_report, feature_value_map, pmf_scorecard
- **Visualization**: PMF score gauge, hypothesis validation board, theme frequency chart, feature-value heatmap

### 3. Positioning & Messaging Agent
- **Slug**: `positioning`
- **Dependencies**: `market-research`, `pmf`
- **Tools**: `query_knowledge_base` (brand voice model, messaging heritage, customer voice)
- **Input**: market_research output, product_capabilities, brand_guidelines, differentiation_focus
- **Output**: positioning_statement, value_propositions[], messaging_matrix, elevator_pitches, competitive_narratives[]
- **Visualization**: Messaging canvas with persona tabs, pitch length variants, competitive narrative cards

### 4. Analytics Agent
- **Slug**: `analytics`
- **Dependencies**: `market-research`
- **Tools**: `query_knowledge_base` (performance benchmarks)
- **Input**: data_sources, time_period, segments, analysis_type, benchmarks
- **Output**: kpi_dashboard, funnel_analysis, win_loss_summary, churn_analysis, recommendations[]
- **Visualization**: KPI scorecards, funnel waterfall, cohort retention curves, recommendation priority matrix

### 5. Content & Collateral Agent
- **Slug**: `content`
- **Dependencies**: `positioning`
- **Tools**: `query_knowledge_base` (proof points, customer quotes, brand voice), `generate_document`
- **Input**: messaging_framework, content_type, target_persona, funnel_stage, customer_data, format_spec
- **Output**: document (file), metadata, key_messages_used[], suggested_distribution
- **Visualization**: Content library with document previews, filtering by persona/stage/type, creation wizard

### 6. Sales Enablement Agent
- **Slug**: `sales-enablement`
- **Dependencies**: `positioning`
- **Tools**: `query_knowledge_base` (objection knowledge base, competitive intel, proof points)
- **Input**: messaging_framework, icp_profiles, pricing_model, sales_process, common_objections, win_loss_data
- **Output**: objection_playbook, demo_scripts[], email_sequences[], qualification_framework, roi_calculator, talk_tracks[]
- **Visualization**: Searchable objection library, sequence builder, demo flow visualizer, ROI calculator

### 7. Demand Generation Agent
- **Slug**: `demand-gen`
- **Dependencies**: `positioning`
- **Tools**: `query_knowledge_base` (performance benchmarks, brand voice, customer voice)
- **Input**: messaging_framework, icp_profiles, budget, goals, existing_channels, timeline
- **Output**: campaign_strategy, landing_pages[], ad_creative[], event_plans[], partner_programs[], funnel_projections
- **Visualization**: Campaign planner, channel mix chart, landing page preview, funnel projection waterfall

### 8. Launch Planning Agent
- **Slug**: `launch`
- **Dependencies**: `content`, `sales-enablement`, `demand-gen`
- **Tools**: `query_knowledge_base`, reads outputs from all upstream agents
- **Input**: product, launch_date, launch_type, channels, team_resources, agent_outputs
- **Output**: timeline (Gantt), channel_strategy, launch_checklist, enablement_plan, readiness_gates[], risk_register
- **Visualization**: Gantt timeline, checklist tracker, readiness gate dashboard, risk heatmap

### 9. CRM Integration Agent (HubSpot)
- **Slug**: `crm`
- **Dependencies**: None (always-on, bidirectional — both consumes and feeds other agents)
- **Tools**: `query_knowledge_base`, `hubspot_api` (contacts, deals, activities, pipelines), `enrich_contact`, `push_to_hubspot`
- **CRM Platform**: HubSpot Free CRM (primary). Architecture supports adding Salesforce/Pipedrive later.
- **Color**: `#FF7A59` (HubSpot orange)

#### CRM Agent — Core Functions

**PULL from HubSpot (inbound data):**
- **sync_pipeline()**: Pulls all active deals with stage, amount, close date, contact info. Runs on schedule (every 15 min) and on-demand. Stores in crm_deals table. Feeds Analytics agent with live pipeline data instead of uploaded spreadsheets.
- **sync_contacts()**: Pulls contacts with lifecycle stage, company, title, activity history. Stores in crm_contacts. Used for ICP matching and lead scoring.
- **sync_activities()**: Pulls recent emails, calls, meetings, notes per deal. Stores in crm_activities. Used for deal health scoring and next-step recommendations.
- **feed_knowledge_engine()**: Converts CRM data into knowledge chunks — deal outcomes become win/loss data, activity patterns become selling behavior insights, contact titles become persona validation data.

**INTELLIGENCE (analysis & recommendations):**
- **score_deal_health()**: For each active deal, calculates a health score (0-100) based on: days in current stage, activity recency, contact engagement, deal size vs. average, and ICP fit. Flags at-risk deals.
- **match_icp()**: Compares each contact/company against ICP profiles from Market Research agent. Scores fit and identifies gaps. Surfaces "best fit" leads that aren't being worked.
- **recommend_next_steps()**: For stalled or at-risk deals, uses knowledge base (objection playbook, competitive intel, talk tracks) to suggest specific next actions: "Send the ROI calculator", "Use the Acme competitive narrative", "Schedule a technical deep-dive."
- **analyze_pipeline()**: Real-time pipeline analytics: velocity by stage, conversion rates, average deal size, forecast accuracy. Replaces the Analytics agent's need for uploaded CSVs.
- **detect_patterns()**: Identifies winning and losing patterns across deals — which personas convert fastest, which stages have the biggest drop-off, which competitors appear in lost deals.

**PUSH to HubSpot (outbound actions):**
- **push_sequences()**: Takes email sequences from Sales Enablement agent and enrolls contacts in HubSpot sequences. Maps template variables to contact properties.
- **push_collateral()**: Attaches battle cards, one-pagers, and case studies from Content agent to deal records as notes/attachments so reps have them in context.
- **create_tasks()**: When recommend_next_steps() identifies an action, creates a HubSpot task assigned to the deal owner with the recommendation and supporting materials.
- **enrich_contacts()**: Takes ICP match scores, enrichment data, and agent intelligence and writes it back to custom HubSpot contact properties so reps see it in their CRM.
- **log_agent_activity()**: Logs agent recommendations and actions as CRM notes so there's a full audit trail of what the platform suggested.

#### CRM Agent — Input/Output

- **Input (for on-demand analysis)**: deal_id or contact_id (specific), pipeline_name (broad), analysis_type (health_check, icp_match, next_steps, pipeline_review, pattern_analysis)
- **Output**: deal_health_cards[], icp_match_scores[], recommended_actions[], pipeline_dashboard, pattern_insights

#### CRM Agent — Bidirectional Flow with Other Agents

| Agent | CRM Pulls From It | CRM Pushes To It |
|-------|-------------------|-------------------|
| Market Research | ICP profiles for contact matching | Real deal data validates ICP accuracy |
| Sales Enablement | Sequences, playbooks, talk tracks | Stalled deal triggers sequence creation |
| Content | Battle cards, case studies, one-pagers | Deal context triggers content needs |
| Analytics | — | Live pipeline data replaces uploaded CSVs |
| Positioning | Competitive narratives | Win/loss patterns validate positioning |
| Demand Gen | — | Lead source attribution, campaign ROI |
| PMF | — | Customer satisfaction signals from deal outcomes |

#### CRM Agent — Visualization Surface
- **Pipeline Board**: Kanban-style deal view with health score badges (green/yellow/red), days-in-stage counters, and AI recommendation chips
- **Deal Detail Panel**: Expanded view of a deal showing: health score breakdown, recommended next steps with supporting materials, activity timeline, ICP fit analysis
- **Contact Intelligence Card**: Contact profile with ICP match score, engagement history, enrichment data, and suggested approach
- **Pipeline Analytics**: Recharts dashboard with: velocity by stage, conversion funnel, forecast vs. actual, win/loss trends
- **Sync Status**: Connection health, last sync time, sync log with push/pull activity

---

## Knowledge Engine Retrieval API

Agents query the knowledge engine via a standard interface:

```typescript
// POST /api/knowledge/query
interface KnowledgeQuery {
  agent: string;           // requesting agent slug
  intent: string;          // what the agent needs (e.g., "competitive_positioning")
  retrieve: {
    type: string;          // intelligence product type
    filter?: {
      persona?: string;
      competitor?: string;
      funnel_stage?: string;
      sentiment?: string;
      date_range?: { from: string; to: string };
    };
  }[];
  top_k?: number;          // max chunks to return (default 10)
  relevance_threshold?: number; // minimum similarity score (default 0.75)
}

interface KnowledgeResult {
  chunks: {
    content: string;
    source_document: string;
    source_url?: string;
    confidence: number;
    freshness: string;     // ISO date of last verification
    classification: object;
  }[];
  intelligence: {
    type: string;
    data: object;
  }[];
}
```

---

## Web Source Crawl Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| Single Page | Fetch and process one URL | Specific article, pricing page |
| Site Crawl | Recursive crawl up to N pages | Competitor's full website |
| Sitemap Import | Parse sitemap.xml, selectively ingest | Large sites, specific sections |
| RSS / Feed Monitor | Subscribe to feed, ingest new items | Blogs, news feeds |
| Scheduled Recrawl | Re-fetch URLs on interval, detect changes | Pricing pages, competitor positioning |

Change detection uses content hashing. When changes are detected:
1. Re-process the changed content through the pipeline
2. Update affected knowledge chunks and intelligence products
3. Flag stale content in downstream agent outputs
4. Notify relevant agents via the orchestrator

---

## Directory Structure

```
/app                          — Next.js pages and API routes
  /app/(dashboard)            — Main app layout with sidebar
    /page.tsx                 — Dashboard home
    /agents/[slug]/page.tsx   — Individual agent views
    /knowledge/page.tsx       — Knowledge engine dashboard
    /orchestrator/page.tsx    — Orchestrator chat interface
  /app/api
    /agents/[slug]/route.ts   — Agent execution endpoints
    /knowledge/query/route.ts — Knowledge retrieval API
    /knowledge/ingest/route.ts — Document ingestion endpoint
    /sources/upload/route.ts  — File upload handler
    /sources/web/route.ts     — Web source management
    /orchestrator/route.ts    — Orchestrator endpoint
/lib
  /agents                     — Agent definitions and logic
    /base-agent.ts            — Base agent class (shared tools, streaming, knowledge queries)
    /market-research.ts
    /positioning.ts
    /content.ts
    /sales-enablement.ts
    /launch.ts
    /demand-gen.ts
    /analytics.ts
    /pmf.ts
    /crm.ts                   — CRM Integration Agent (HubSpot)
    /orchestrator.ts
  /knowledge                  — Knowledge engine
    /ingest.ts                — Document ingestion pipeline
    /process.ts               — Chunking, classification, embedding
    /analyze.ts               — Theme extraction, consistency checks
    /retrieve.ts              — Semantic search and structured queries
    /crawl.ts                 — Web crawling and change detection
  /crm                        — CRM integration layer
    /hubspot-client.ts        — HubSpot API client (auth, contacts, deals, activities)
    /sync.ts                  — Bidirectional sync engine (pull from / push to HubSpot)
    /scoring.ts               — Deal health scoring and ICP matching logic
    /actions.ts               — Push actions (enroll sequences, create tasks, enrich contacts)
  /db
    /schema.ts                — Drizzle schema definitions
    /queries.ts               — Reusable query functions
    /migrations/              — Database migrations
  /utils
    /streaming.ts             — LLM response streaming helpers
    /files.ts                 — File generation (PPTX, PDF, DOCX)
/components
  /agents                     — Agent-specific UI components
  /knowledge                  — Knowledge engine UI components
  /dashboard                  — Dashboard and layout components
  /shared                     — Buttons, cards, modals, etc.
/docs
  /mockups                    — UI reference mockups (JSX from design phase)
  /agents                     — Agent specification documents
```

---

## Design System

### Theme
- Background: `#09090B` (primary), `#060609` (deep), `rgba(255,255,255,0.02)` (cards)
- Text: `#FAFAFA` (primary), `#E4E4E7` (headings), `#A1A1AA` (body), `#71717A` (secondary), `#52525B` (muted), `#3F3F46` (dim)
- Borders: `rgba(255,255,255,0.06)` (default), agent color at 20-30% opacity (active/hover)
- Cards: `border-radius: 14px`, `border: 1px solid rgba(255,255,255,0.06)`

### Agent Colors
- Market Research: `#0EA5E9`
- Positioning: `#8B5CF6`
- Content: `#F59E0B`
- Sales Enablement: `#10B981`
- Launch Planning: `#EF4444`
- Demand Gen: `#EC4899`
- Analytics: `#6366F1`
- PMF: `#14B8A6`
- CRM Integration: `#FF7A59` (HubSpot orange)
- Orchestrator: `#10B981` (with rainbow gradient accent)
- Knowledge Engine: `#F59E0B`

### Typography
- Monospace (code, data): `'IBM Plex Mono', 'JetBrains Mono', monospace`
- Display (headings): `'Outfit', 'DM Sans', sans-serif`
- Labels: `font-size: 10px, letter-spacing: 2px, text-transform: uppercase, color: #52525B`

### Interaction Patterns
- Hover on agent cards: border shifts to agent color, subtle translateY(-2px)
- Expandable sections: click to expand with rotation animation on chevron
- Status indicators: colored dots with box-shadow glow for active states
- Streaming: agent responses stream in real-time, never block UI

---

## Key Principles

1. **Knowledge-grounded**: Every agent queries the Knowledge Engine for context before generating output. Agents never operate on generic knowledge alone.
2. **Structured communication**: All agent-to-agent data flows use typed JSON schemas. No unstructured text passing between agents.
3. **Dependency-aware**: The orchestrator respects the agent dependency graph. Market Research runs before Positioning. Positioning runs before Content.
4. **Conflict surfacing**: When agents produce contradictory recommendations, the orchestrator surfaces the tension with trade-off analysis rather than silently picking one.
5. **Source attribution**: Every piece of generated content traces back to the knowledge chunks that informed it. Users can always see "where did this come from?"
6. **Freshness tracking**: All knowledge has a timestamp. Stale data is flagged. Scheduled recrawls keep competitive intel current.
7. **Stream everything**: All LLM responses stream to the UI. Show agent progress in real-time. Never make the user wait for a loading spinner.
8. **Build incrementally**: Each agent follows the same base pattern. Build one end-to-end, then replicate. Don't build all 8 simultaneously.

---

## Naming Conventions
- Agent files: `/lib/agents/[agent-slug].ts`
- API routes: `/app/api/agents/[agent-slug]/route.ts`
- Components: PascalCase (e.g., `AgentCard.tsx`, `KnowledgeQuery.tsx`)
- Database tables: snake_case (e.g., `agent_runs`, `knowledge_chunks`)
- Agent slugs: kebab-case (e.g., `market-research`, `sales-enablement`)
- Environment variables: `NEXT_PUBLIC_` prefix for client-side, no prefix for server-side

---

## Environment Variables Needed
```
DATABASE_URL=               # PostgreSQL connection string
ANTHROPIC_API_KEY=          # Claude API key
GEMINI_API_KEY=              # Google Gemini API key (for text-embedding-004)
FIRECRAWL_API_KEY=          # Web crawling
CLERK_SECRET_KEY=           # Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
S3_BUCKET=                  # File storage
S3_ACCESS_KEY=
S3_SECRET_KEY=
UPSTASH_REDIS_URL=          # Job queues and caching
INNGEST_EVENT_KEY=          # Background job orchestration
HUBSPOT_CLIENT_ID=          # HubSpot OAuth app client ID
HUBSPOT_CLIENT_SECRET=      # HubSpot OAuth app client secret
HUBSPOT_REDIRECT_URI=       # OAuth callback URL (e.g., https://yourapp.com/api/crm/callback)
```
