"use client";

import { useState } from "react";

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    category: "Getting Started",
    question: "How do I upload documents?",
    answer:
      "Go to the Knowledge Base page from the sidebar. Click 'Upload' to add files — the platform supports PDF, DOCX, PPTX, CSV, XLSX, MD, and plain text files. You can also add web sources by URL. Once uploaded, documents are automatically processed, chunked, and embedded so agents can reference them.",
  },
  {
    category: "Getting Started",
    question: "What file types are supported?",
    answer:
      "The Knowledge Engine supports: PDF, DOCX, PPTX, CSV, XLSX, MD, and TXT for file uploads. For web sources, you can add any public URL — the platform will crawl and extract the content. Audio and video transcription support is planned for a future release.",
  },
  {
    category: "Agents",
    question: "What agents are available?",
    answer:
      "There are 9 specialist agents: Market Research (competitor analysis, ICP profiles, market sizing), PMF (product-market fit assessment), Positioning (messaging frameworks, value propositions), Analytics (KPI dashboards, funnel analysis), Content (blog posts, battle cards, case studies), Sales Enablement (objection playbooks, email sequences), Demand Gen (campaign strategies, landing pages), Launch Planning (timelines, checklists, risk registers), and CRM (pipeline health, deal intelligence).",
  },
  {
    category: "Agents",
    question: "How are agent outputs grounded in my data?",
    answer:
      "Every time an agent runs, it first queries the Knowledge Engine for relevant content from your uploaded documents and web sources. This context is injected into the agent's prompt, ensuring outputs reference your actual data — your competitors, your customers, your metrics — rather than generic AI responses. You can see which knowledge sources were used in the 'Sources' section of each output.",
  },
  {
    category: "Agents",
    question: "Can I export agent outputs?",
    answer:
      "Yes. Every agent output has a Download button that lets you export in multiple formats: Markdown (.md) for text content, JSON for structured data, CSV for tabular data, and plain text. The Content agent's outputs are particularly well-suited for markdown export since they're already formatted as publication-ready content.",
  },
  {
    category: "Orchestrator",
    question: "How does the Orchestrator work?",
    answer:
      "The Orchestrator is the central brain of the platform. You describe what you need in plain English — for example, 'Prepare everything for our product launch in Germany next quarter.' It analyzes your request, determines which agents are needed, builds an execution plan respecting agent dependencies, runs them in the correct order (parallel where possible), detects any conflicts between outputs, and synthesizes everything into a unified strategy.",
  },
  {
    category: "Orchestrator",
    question: "What is conflict detection?",
    answer:
      "When multiple agents run, they might produce contradictory recommendations — for example, Market Research might identify a price-sensitive market while Positioning recommends premium positioning. The Orchestrator automatically detects these tensions and presents them as conflict cards. You can choose which direction to take, and the affected agent re-runs to align with your decision.",
  },
  {
    category: "CRM",
    question: "How do I connect HubSpot?",
    answer:
      "Go to the CRM agent page and click on the Settings tab. Enter your HubSpot Private App access token (you can create one in HubSpot under Settings → Integrations → Private Apps). Once connected, click 'Run Sync' to pull your deals, contacts, and activities. The platform syncs daily automatically and computes health scores for each deal.",
  },
  {
    category: "CRM",
    question: "What is a deal health score?",
    answer:
      "Deal health scores are computed automatically based on 5 factors: activity recency (30% weight — how recently there was engagement), stage velocity (25% — whether the deal is progressing on time), close date proximity (20% — urgency based on expected close), contact breadth (15% — number of contacts involved), and deal completeness (10% — whether key fields are filled). Scores range from 0-100: green (70+) is healthy, yellow (40-69) is at risk, and red (below 40) is critical.",
  },
  {
    category: "Best Practices",
    question: "How do I get the best results?",
    answer:
      "Three key things: (1) Upload diverse, high-quality documents — the more context agents have about your company, competitors, and customers, the better their output. (2) Be specific in prompts — instead of 'write content', tell the agent exactly what type, for whom, and about what. (3) Save valuable outputs back to the Knowledge Base — this creates a compounding effect where agents build on each other's work over time.",
  },
  {
    category: "Best Practices",
    question: "Should I run agents individually or use the Orchestrator?",
    answer:
      "Use individual agents when you have a specific, focused task — like writing a battle card or analyzing win/loss data. Use the Orchestrator when you need a multi-step strategy that requires coordination across agents — like preparing for a product launch or building a complete GTM plan for a new market.",
  },
];

const CATEGORIES = [
  "Getting Started",
  "Agents",
  "Orchestrator",
  "CRM",
  "Best Practices",
];

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());

  const toggle = (index: number) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-heading mb-2">
          Frequently Asked Questions
        </h1>
        <p className="text-sm text-text-muted">
          Common questions about using the GTM Platform.
        </p>
      </div>

      {CATEGORIES.map((category) => {
        const items = FAQ_ITEMS.filter((item) => item.category === category);
        if (items.length === 0) return null;

        return (
          <section key={category} className="mb-8">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-[2px] mb-3">
              {category}
            </h2>
            <div className="bg-card-bg border border-border-default rounded-[14px] overflow-hidden divide-y divide-border-default">
              {items.map((item) => {
                const globalIndex = FAQ_ITEMS.indexOf(item);
                const isOpen = openItems.has(globalIndex);

                return (
                  <div key={globalIndex}>
                    <button
                      onClick={() => toggle(globalIndex)}
                      className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                    >
                      <span className="text-sm text-text-heading font-medium pr-4">
                        {item.question}
                      </span>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      >
                        <path
                          d="M4 6L8 10L12 6"
                          stroke="#71717A"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4">
                        <p className="text-xs text-text-muted leading-relaxed">
                          {item.answer}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
