import { BaseAgent, AgentConfig } from "./base-agent";

const STRUCTURED_OUTPUT_INSTRUCTIONS = `

IMPORTANT: You must return your analysis as valid JSON wrapped in a markdown code block. Use this exact structure:

\`\`\`json
{
  "icp_profiles": [
    {
      "name": "Profile name",
      "description": "Brief description",
      "firmographics": { "industry": "", "company_size": "", "revenue_range": "", "geography": "" },
      "pain_points": ["pain 1", "pain 2"],
      "buying_triggers": ["trigger 1", "trigger 2"],
      "decision_makers": ["title 1", "title 2"],
      "estimated_market_size": "X,XXX companies"
    }
  ],
  "competitor_matrix": [
    {
      "name": "Competitor name",
      "positioning": "Their positioning",
      "strengths": ["strength 1"],
      "weaknesses": ["weakness 1"],
      "pricing": "Their pricing model/range",
      "market_share": "Estimated %",
      "key_differentiator": "What makes them unique"
    }
  ],
  "market_sizing": {
    "tam": { "value": "$X.XB", "description": "Total addressable market definition" },
    "sam": { "value": "$X.XB", "description": "Serviceable addressable market definition" },
    "som": { "value": "$XXM", "description": "Serviceable obtainable market definition" },
    "methodology": "Brief explanation of sizing approach"
  },
  "pricing_intel": [
    {
      "competitor": "Name",
      "model": "Pricing model (per seat, usage-based, etc.)",
      "entry_price": "$X/mo",
      "mid_tier": "$X/mo",
      "enterprise": "Custom/Contact sales",
      "notes": "Any notable pricing strategies"
    }
  ],
  "trend_analysis": [
    {
      "trend": "Trend name",
      "impact": "high/medium/low",
      "description": "What it means for the market",
      "timeframe": "Current / 6-12 months / 1-3 years"
    }
  ]
}
\`\`\``;

export class MarketResearchAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({
      ...config,
      systemPrompt: config.systemPrompt + STRUCTURED_OUTPUT_INSTRUCTIONS,
    });
  }

  /**
   * Build a knowledge query focused on market research topics.
   */
  protected buildKnowledgeQuery(input: Record<string, unknown>): string {
    const parts: string[] = [];

    if (input.product_description) {
      parts.push(String(input.product_description).slice(0, 300));
    }
    if (input.target_market) {
      parts.push(`target market: ${input.target_market}`);
    }
    if (input.known_competitors) {
      parts.push(`competitors: ${input.known_competitors}`);
    }

    return (
      parts.join(". ") ||
      "market research competitive analysis industry trends"
    );
  }
}
