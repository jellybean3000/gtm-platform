import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { queryKnowledge } from "@/lib/knowledge/retrieve";
import { DealForScoring, ActivityForScoring, DealHealthResult } from "./scoring";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface NextStepRecommendation {
  action: string;
  reasoning: string;
  supportingMaterial: string;
  urgency: "immediate" | "this_week" | "this_month";
}

export interface RecommendNextStepsResult {
  recommendations: NextStepRecommendation[];
  knowledgeSourcesUsed: string[];
}

interface ContactForActions {
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  company: string | null;
  email: string | null;
  lifecycleStage: string | null;
}

// ---------------------------------------------------------------------------
// System prompt for next-step recommendations
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a CRM Intelligence Agent specializing in B2B sales deal analysis.

You analyze deal context, activity history, and sales knowledge to recommend 2-3 specific, concrete next steps to advance a deal.

Each recommendation must be:
- Actionable: a specific thing the rep can do today
- Data-grounded: tied to signals from the deal data
- Material-linked: reference specific sales materials when available (battle cards, email sequences, ROI calculators, case studies)

IMPORTANT: Return valid JSON only, no markdown wrapper, no extra text. Use this exact structure:
{"recommendations": [{"action": "What to do", "reasoning": "Why, based on deal signals", "supportingMaterial": "Reference to relevant sales material or knowledge", "urgency": "immediate | this_week | this_month"}]}`;

// ---------------------------------------------------------------------------
// Build a compact deal context narrative
// ---------------------------------------------------------------------------
function buildDealContext(
  deal: DealForScoring,
  activities: ActivityForScoring[],
  contacts: ContactForActions[],
  healthScore: DealHealthResult
): string {
  const lines: string[] = [];

  lines.push(`Deal: ${deal.dealName}`);
  lines.push(`Stage: ${deal.stage || "Unknown"}`);
  if (deal.daysInStage !== null) {
    lines.push(`Days in current stage: ${deal.daysInStage}`);
  }
  if (deal.amount) {
    lines.push(`Amount: $${deal.amount}`);
  }
  if (deal.closeDate) {
    lines.push(`Close date: ${deal.closeDate.toISOString().split("T")[0]}`);
  }

  lines.push(
    `Health Score: ${healthScore.score}/100 (${healthScore.color}) — ${healthScore.label}`
  );
  if (healthScore.riskFactors.length > 0) {
    lines.push(`Risk Factors: ${healthScore.riskFactors.join("; ")}`);
  }

  // Recent activities (last 5)
  const dealActs = activities
    .filter((a) => a.occurredAt)
    .sort((a, b) => b.occurredAt!.getTime() - a.occurredAt!.getTime())
    .slice(0, 5);

  if (dealActs.length > 0) {
    lines.push("\nRecent Activities:");
    for (const a of dealActs) {
      lines.push(
        `- ${a.type} on ${a.occurredAt!.toISOString().split("T")[0]}`
      );
    }
  } else {
    lines.push("\nNo recent activities recorded.");
  }

  // Contacts
  if (contacts.length > 0) {
    lines.push("\nContacts Engaged:");
    for (const c of contacts.slice(0, 5)) {
      const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown";
      lines.push(`- ${name}${c.title ? `, ${c.title}` : ""}${c.company ? ` at ${c.company}` : ""}`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Recommend Next Steps — Claude-powered, on-demand only
// ---------------------------------------------------------------------------
export async function recommendNextSteps(
  deal: DealForScoring,
  activities: ActivityForScoring[],
  contacts: ContactForActions[],
  healthScore: DealHealthResult,
  teamId: string
): Promise<RecommendNextStepsResult> {
  // Parallel knowledge queries for relevant sales context
  const [objectionKnowledge, salesProcessKnowledge] = await Promise.all([
    queryKnowledge({
      teamId,
      query:
        "objection handling sales playbook competitive battle card response techniques",
      topK: 5,
    }).catch(() => ({ chunks: [] })),
    queryKnowledge({
      teamId,
      query:
        "deal stage next steps closing techniques sales process email sequence follow-up",
      topK: 5,
    }).catch(() => ({ chunks: [] })),
  ]);

  // Build knowledge context block
  const allChunks = [
    ...objectionKnowledge.chunks,
    ...salesProcessKnowledge.chunks,
  ];
  const chunkIds = allChunks.map((c) => c.id);

  let knowledgeContext = "";
  if (allChunks.length > 0) {
    const formatted = allChunks
      .map(
        (c, i) =>
          `[Source ${i + 1}: ${c.sourceDocument}${c.sourceUrl ? ` (${c.sourceUrl})` : ""} | Relevance: ${(c.similarity * 100).toFixed(0)}%]\n${c.content}`
      )
      .join("\n\n");
    knowledgeContext = `\n<knowledge_context>\nThe following sales materials and knowledge are available. Reference specific materials in your recommendations when relevant.\n\n${formatted}\n</knowledge_context>`;
  }

  // Build the deal context
  const dealContext = buildDealContext(deal, activities, contacts, healthScore);

  // Call Claude
  const result = await generateText({
    model: anthropic("claude-sonnet-4-5-20250929"),
    system: SYSTEM_PROMPT + knowledgeContext,
    messages: [
      {
        role: "user",
        content: `Analyze this deal and recommend 2-3 specific next steps:\n\n${dealContext}`,
      },
    ],
  });

  // Parse JSON response
  try {
    const parsed = JSON.parse(result.text);
    const recommendations: NextStepRecommendation[] = (
      parsed.recommendations || []
    ).map((r: Record<string, string>) => ({
      action: r.action || "Follow up with the prospect",
      reasoning: r.reasoning || "Based on deal activity patterns",
      supportingMaterial: r.supportingMaterial || "No specific materials found",
      urgency: (["immediate", "this_week", "this_month"].includes(r.urgency)
        ? r.urgency
        : "this_week") as NextStepRecommendation["urgency"],
    }));

    return { recommendations, knowledgeSourcesUsed: chunkIds };
  } catch {
    // Fallback if Claude doesn't return valid JSON
    return {
      recommendations: [
        {
          action: "Review deal activity and follow up with the primary contact",
          reasoning: `Deal health score is ${healthScore.score}/100 (${healthScore.label}). ${healthScore.riskFactors.join(". ")}`,
          supportingMaterial:
            "Check sales enablement materials for relevant battle cards and email templates",
          urgency: healthScore.score < 40 ? "immediate" : "this_week",
        },
      ],
      knowledgeSourcesUsed: chunkIds,
    };
  }
}
