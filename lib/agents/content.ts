import { BaseAgent, AgentConfig } from "./base-agent";

const STRUCTURED_OUTPUT_INSTRUCTIONS = `

IMPORTANT: You must return your output as valid JSON wrapped in a markdown code block. Use this exact structure:

\`\`\`json
{
  "metadata": {
    "title": "The content piece title",
    "content_type": "blog_post | one_pager | battle_card | case_study | sales_deck | press_release",
    "target_persona": "Who this is written for",
    "funnel_stage": "awareness | consideration | decision | retention",
    "key_messages_used": ["Key message 1", "Key message 2"],
    "word_count": 500,
    "suggested_distribution": ["Channel 1", "Channel 2"]
  },
  "content": "The FULL content piece written in markdown format. This should be complete, publication-ready content — not an outline or summary. Include proper headings, paragraphs, bullet points, bold text, and any other formatting appropriate for the content type. For sales decks, structure as slides with --- separators. For battle cards, use clear comparison sections. For blog posts, write the complete article. For press releases, follow AP style. Make it compelling, specific, and grounded in the knowledge context provided."
}
\`\`\``;

export class ContentAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({
      ...config,
      systemPrompt: config.systemPrompt + STRUCTURED_OUTPUT_INSTRUCTIONS,
    });
  }

  protected buildKnowledgeQuery(input: Record<string, unknown>): string {
    const parts: string[] = [];

    if (input.content_type) {
      parts.push(`content type: ${input.content_type}`);
    }
    if (input.target_persona) {
      parts.push(`persona: ${input.target_persona}`);
    }
    if (input.additional_context) {
      parts.push(String(input.additional_context).slice(0, 300));
    }

    // Always retrieve brand voice and proof points
    parts.push("proof points customer quotes brand voice case study testimonial");

    return parts.join(". ").slice(0, 1000);
  }
}
