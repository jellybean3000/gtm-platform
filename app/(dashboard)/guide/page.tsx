"use client";

import Link from "next/link";

const AGENTS = [
  {
    name: "Market Research",
    slug: "market-research",
    color: "#0EA5E9",
    description:
      "Analyzes competitors, builds ICP profiles, sizes markets (TAM/SAM/SOM), gathers pricing intel, and identifies trends.",
    when: "Starting a new market entry, evaluating competitors, or validating target segments.",
  },
  {
    name: "PMF",
    slug: "pmf",
    color: "#14B8A6",
    description:
      "Assesses product-market fit through interview scripts, survey instruments, hypothesis validation, and feature-value mapping.",
    when: "Validating product-market fit, building customer research instruments, or scoring PMF.",
  },
  {
    name: "Positioning",
    slug: "positioning",
    color: "#8B5CF6",
    description:
      "Crafts positioning statements, value propositions, messaging matrices, elevator pitches, and competitive narratives.",
    when: "Defining or refining your positioning, creating messaging frameworks, or preparing competitive narratives.",
  },
  {
    name: "Analytics",
    slug: "analytics",
    color: "#6366F1",
    description:
      "Analyzes KPI dashboards, funnel performance, win/loss data, churn patterns, and generates actionable recommendations.",
    when: "Reviewing performance metrics, diagnosing funnel issues, or building data-driven recommendations.",
  },
  {
    name: "Content",
    slug: "content",
    color: "#F59E0B",
    description:
      "Creates blog posts, battle cards, case studies, one-pagers, sales decks, and press releases grounded in your data.",
    when: "Creating any marketing content that needs to be grounded in your company's actual data and voice.",
  },
  {
    name: "Sales Enablement",
    slug: "sales-enablement",
    color: "#10B981",
    description:
      "Builds objection playbooks, email sequences, demo scripts, qualification frameworks, ROI calculators, and talk tracks.",
    when: "Equipping your sales team with data-driven materials, handling objections, or designing outreach sequences.",
  },
  {
    name: "Demand Gen",
    slug: "demand-gen",
    color: "#EC4899",
    description:
      "Designs campaign strategies, landing pages, ad creative, event plans, partner programs, and funnel projections.",
    when: "Planning campaigns, designing landing pages, or building demand generation strategies.",
  },
  {
    name: "Launch Planning",
    slug: "launch",
    color: "#EF4444",
    description:
      "Creates comprehensive launch timelines, channel strategies, checklists, enablement plans, and risk registers.",
    when: "Planning a product launch that needs coordination across content, sales, and demand gen.",
  },
  {
    name: "CRM",
    slug: "crm",
    color: "#F97316",
    description:
      "Analyzes your HubSpot pipeline, scores deal health, matches ICP profiles, and recommends next steps for at-risk deals.",
    when: "Understanding pipeline health, identifying at-risk deals, or getting AI-powered deal recommendations.",
  },
];

const STEPS = [
  {
    number: "1",
    title: "Upload Your Knowledge",
    description:
      "Go to the Knowledge Base and upload your company documents — pitch decks, case studies, competitor analyses, product docs, blog posts. The more context the agents have, the better their output.",
    link: "/knowledge",
    linkText: "Go to Knowledge Base",
  },
  {
    number: "2",
    title: "Run Individual Agents",
    description:
      "Start with Market Research or PMF to establish a foundation. Each agent has a form where you describe what you need, and it generates structured output grounded in your uploaded knowledge.",
    link: "/agents/market-research",
    linkText: "Try Market Research",
  },
  {
    number: "3",
    title: "Use the Orchestrator",
    description:
      "For complex strategies, use the Orchestrator. Describe what you need in plain English — it figures out which agents to run and in what order, then synthesizes everything into a unified strategy.",
    link: "/orchestrator",
    linkText: "Open Orchestrator",
  },
  {
    number: "4",
    title: "Connect Your CRM",
    description:
      "Link your HubSpot account to bring live pipeline data into the platform. Agents can then reference real deal data, objections from calls, and pipeline health in their outputs.",
    link: "/agents/crm",
    linkText: "Connect HubSpot",
  },
];

export default function GuidePage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-text-heading mb-2">
          Platform Guide
        </h1>
        <p className="text-sm text-text-muted">
          Everything you need to know to get the most out of your GTM Platform.
        </p>
      </div>

      {/* Overview */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-text-heading mb-3">
          What is the GTM Platform?
        </h2>
        <div className="bg-card-bg border border-border-default rounded-[14px] p-6">
          <p className="text-sm text-text-body leading-relaxed mb-3">
            The GTM Platform is a multi-agent intelligence system for Go-To-Market teams.
            It uses 9 specialized AI agents, each expert in a different GTM domain, all
            grounded in your company&apos;s actual data through a Knowledge Intelligence Engine.
          </p>
          <p className="text-sm text-text-body leading-relaxed">
            Upload your documents, connect your CRM, and the agents will generate
            strategies, content, and analysis that are specific to your company — not
            generic AI output.
          </p>
        </div>
      </section>

      {/* Getting Started */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-text-heading mb-4">
          Getting Started
        </h2>
        <div className="space-y-3">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="bg-card-bg border border-border-default rounded-[14px] p-5 flex gap-4"
            >
              <div className="w-8 h-8 rounded-full bg-[#10B981]/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-[#10B981]">
                  {step.number}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-text-heading mb-1">
                  {step.title}
                </h3>
                <p className="text-xs text-text-muted leading-relaxed mb-2">
                  {step.description}
                </p>
                <Link
                  href={step.link}
                  className="text-xs text-[#10B981] hover:underline"
                >
                  {step.linkText} →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Knowledge Engine */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-text-heading mb-3">
          How the Knowledge Engine Works
        </h2>
        <div className="bg-card-bg border border-border-default rounded-[14px] p-6">
          <div className="grid grid-cols-4 gap-4">
            {[
              {
                label: "Ingest",
                desc: "Upload files or add web sources. Supports PDF, DOCX, PPTX, CSV, MD, and more.",
              },
              {
                label: "Process",
                desc: "Documents are chunked, classified, and embedded for semantic search.",
              },
              {
                label: "Analyze",
                desc: "Themes are extracted, contradictions flagged, and knowledge gaps identified.",
              },
              {
                label: "Retrieve",
                desc: "Agents query relevant knowledge before every run, grounding output in your data.",
              },
            ].map((stage, i) => (
              <div key={stage.label}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] uppercase tracking-[2px] font-semibold text-[#F59E0B]">
                    {i + 1}. {stage.label}
                  </span>
                </div>
                <p className="text-xs text-text-dim leading-relaxed">
                  {stage.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agent Directory */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-text-heading mb-4">
          Agent Directory
        </h2>
        <div className="space-y-2">
          {AGENTS.map((agent) => (
            <Link
              key={agent.slug}
              href={`/agents/${agent.slug}`}
              className="no-underline block"
            >
              <div className="bg-card-bg border border-border-default rounded-[14px] p-4 hover:border-opacity-30 transition-all flex gap-4">
                <div
                  className="w-2 h-full rounded-full shrink-0 self-stretch"
                  style={{ background: agent.color }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-text-heading">
                      {agent.name}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed mb-1">
                    {agent.description}
                  </p>
                  <p className="text-[10px] text-text-dim">
                    <span className="font-medium">Use when:</span> {agent.when}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Tips */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-text-heading mb-3">
          Tips for Best Results
        </h2>
        <div className="bg-card-bg border border-border-default rounded-[14px] p-6">
          <ul className="space-y-3">
            {[
              "Upload diverse documents — pitch decks, case studies, competitor analyses, and customer feedback all improve agent output quality.",
              "Be specific in your prompts — instead of \"write a blog post\", try \"write a blog post targeting VP of Marketing about our analytics capabilities vs Competitor X\".",
              "Use the Orchestrator for multi-step strategies — it handles agent dependencies and context passing automatically.",
              "Save valuable outputs to the Knowledge Base — this creates a compounding effect where agents learn from each other's work.",
              "Connect HubSpot early — real CRM data dramatically improves sales enablement and content outputs.",
            ].map((tip, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[#10B981] shrink-0">-</span>
                <span className="text-xs text-text-body leading-relaxed">
                  {tip}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
