import { BaseAgent, AgentConfig } from "./base-agent";

const STRUCTURED_OUTPUT_INSTRUCTIONS = `

IMPORTANT: You must return your analysis as valid JSON wrapped in a markdown code block. Use this exact structure:

\`\`\`json
{
  "positioning_statement": {
    "statement": "For [target customer] who [need/opportunity], [product] is a [category] that [key benefit]. Unlike [alternatives], we [key differentiator].",
    "target_customer": "Who this is for",
    "category": "Market category",
    "key_benefit": "Primary benefit",
    "key_differentiator": "What makes this unique"
  },
  "value_propositions": [
    {
      "persona": "Persona name (e.g., VP Marketing)",
      "headline": "One-line value prop",
      "supporting_points": ["Point 1", "Point 2", "Point 3"],
      "proof_points": ["Evidence 1", "Evidence 2"],
      "emotional_appeal": "The emotional driver for this persona"
    }
  ],
  "messaging_matrix": [
    {
      "persona": "Persona name",
      "awareness": "Message for awareness stage",
      "consideration": "Message for consideration stage",
      "decision": "Message for decision stage",
      "retention": "Message for retention/expansion stage"
    }
  ],
  "elevator_pitches": {
    "10s": "The 10-second pitch (one sentence)",
    "30s": "The 30-second pitch (2-3 sentences)",
    "60s": "The 60-second pitch (full paragraph with proof points)"
  },
  "competitive_narratives": [
    {
      "competitor": "Competitor name",
      "their_positioning": "How they position themselves",
      "our_advantage": "Where we win",
      "counter_narrative": "How to reframe the conversation when this competitor comes up",
      "when_they_win": "Scenarios where they may be a better fit (honesty builds trust)",
      "talk_track": "Suggested talk track for sales conversations"
    }
  ]
}
\`\`\``;

export class PositioningAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({
      ...config,
      systemPrompt: config.systemPrompt + STRUCTURED_OUTPUT_INSTRUCTIONS,
    });
  }

  protected buildKnowledgeQuery(input: Record<string, unknown>): string {
    const parts: string[] = [];

    if (input.product_capabilities) {
      parts.push(String(input.product_capabilities).slice(0, 300));
    }
    if (input.brand_guidelines) {
      parts.push(`brand guidelines: ${String(input.brand_guidelines).slice(0, 200)}`);
    }
    if (input.differentiation_focus) {
      parts.push(`differentiation: ${input.differentiation_focus}`);
    }

    // Always include brand voice and messaging heritage keywords
    parts.push("brand voice messaging positioning competitive narrative value proposition");

    return parts.join(". ").slice(0, 1000);
  }
}
