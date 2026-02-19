import { BaseAgent, AgentConfig } from "./base-agent";

const STRUCTURED_OUTPUT_INSTRUCTIONS = `

IMPORTANT: You must return your output as valid JSON wrapped in a markdown code block. Use this exact structure:

\`\`\`json
{
  "kpi_dashboard": [
    {
      "name": "KPI name (e.g., Monthly Recurring Revenue)",
      "current_value": "Current value as string (e.g., $125,000)",
      "previous_value": "Previous period value",
      "change_percent": 12.5,
      "trend": "up | down | flat",
      "status": "on_track | at_risk | behind",
      "insight": "Brief insight about this KPI"
    }
  ],
  "funnel_analysis": {
    "stages": [
      {
        "name": "Stage name",
        "volume": 5000,
        "conversion_rate": "15%",
        "drop_off_reasons": ["Reason 1", "Reason 2"],
        "optimization_suggestions": ["Suggestion 1"]
      }
    ],
    "overall_conversion": "2.1%",
    "biggest_bottleneck": "Where the biggest drop-off occurs"
  },
  "win_loss_summary": {
    "win_rate": "35%",
    "total_deals": 120,
    "wins": 42,
    "losses": 78,
    "top_win_reasons": ["Reason 1", "Reason 2"],
    "top_loss_reasons": ["Reason 1", "Reason 2"],
    "avg_deal_size_won": "$45,000",
    "avg_deal_size_lost": "$38,000",
    "competitive_losses": [
      { "competitor": "Competitor name", "losses": 15, "common_reason": "Why we lose to them" }
    ]
  },
  "churn_analysis": {
    "churn_rate": "5.2%",
    "churn_trend": "increasing | decreasing | stable",
    "at_risk_segments": ["Segment 1", "Segment 2"],
    "top_churn_reasons": ["Reason 1", "Reason 2"],
    "retention_recommendations": ["Recommendation 1", "Recommendation 2"]
  },
  "recommendations": [
    {
      "title": "Recommendation title",
      "priority": "high | medium | low",
      "impact": "Expected impact description",
      "effort": "high | medium | low",
      "category": "growth | retention | efficiency | conversion",
      "action_items": ["Action 1", "Action 2"]
    }
  ]
}
\`\`\``;

export class AnalyticsAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({
      ...config,
      systemPrompt: config.systemPrompt + STRUCTURED_OUTPUT_INSTRUCTIONS,
    });
  }

  protected buildKnowledgeQuery(input: Record<string, unknown>): string {
    const parts: string[] = [];

    if (input.analysis_type) {
      parts.push(`analysis type: ${input.analysis_type}`);
    }
    if (input.data_description) {
      parts.push(`data: ${String(input.data_description).slice(0, 200)}`);
    }
    if (input.segments) {
      parts.push(`segments: ${String(input.segments).slice(0, 200)}`);
    }

    parts.push("performance benchmarks metrics analytics conversion funnel revenue");

    return parts.join(". ").slice(0, 1000);
  }
}
