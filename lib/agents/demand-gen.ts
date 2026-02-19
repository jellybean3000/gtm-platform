import { BaseAgent, AgentConfig } from "./base-agent";

const STRUCTURED_OUTPUT_INSTRUCTIONS = `

IMPORTANT: You must return your output as valid JSON wrapped in a markdown code block. Use this exact structure:

\`\`\`json
{
  "campaign_strategy": {
    "name": "Campaign name",
    "objective": "Primary campaign objective",
    "target_audience": "Who this targets",
    "channels": ["Channel 1", "Channel 2"],
    "budget_allocation": [
      { "channel": "Channel name", "percentage": 40, "rationale": "Why this allocation" }
    ],
    "timeline": "Campaign duration and phases",
    "kpis": ["KPI 1", "KPI 2"]
  },
  "landing_pages": [
    {
      "name": "Landing page name",
      "url_slug": "/suggested-slug",
      "headline": "Main headline",
      "subheadline": "Supporting text",
      "hero_cta": "CTA button text",
      "sections": [
        { "type": "hero | features | social_proof | pricing | faq", "content": "Section content description" }
      ],
      "target_persona": "Who this page targets"
    }
  ],
  "ad_creative": [
    {
      "platform": "Google Ads | LinkedIn | Facebook | Twitter",
      "format": "Search | Display | Video | Carousel",
      "headline": "Ad headline",
      "body": "Ad body copy",
      "cta": "Call to action",
      "targeting": "Targeting criteria",
      "variations": ["Variation A headline", "Variation B headline"]
    }
  ],
  "event_plans": [
    {
      "name": "Event name",
      "type": "webinar | conference | workshop | meetup",
      "description": "Event description",
      "target_attendance": 100,
      "promotion_plan": "How to promote",
      "content_outline": ["Topic 1", "Topic 2"],
      "follow_up": "Post-event follow-up plan"
    }
  ],
  "funnel_projections": {
    "stages": [
      {
        "name": "Stage name (e.g., Impressions, Clicks, MQLs, SQLs, Opportunities, Closed Won)",
        "volume": 10000,
        "conversion_rate": "2.5%",
        "assumptions": "What drives this estimate"
      }
    ],
    "projected_roi": "Expected ROI description",
    "time_to_impact": "When results are expected"
  }
}
\`\`\``;

export class DemandGenAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({
      ...config,
      systemPrompt: config.systemPrompt + STRUCTURED_OUTPUT_INSTRUCTIONS,
    });
  }

  protected buildKnowledgeQuery(input: Record<string, unknown>): string {
    const parts: string[] = [];

    if (input.campaign_goals) {
      parts.push(`campaign goals: ${String(input.campaign_goals).slice(0, 200)}`);
    }
    if (input.target_personas) {
      parts.push(`target personas: ${String(input.target_personas).slice(0, 200)}`);
    }
    if (input.existing_channels) {
      parts.push(`channels: ${String(input.existing_channels).slice(0, 200)}`);
    }

    parts.push("performance benchmarks brand voice customer voice demand generation campaign");

    return parts.join(". ").slice(0, 1000);
  }
}
