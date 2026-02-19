import { BaseAgent, AgentConfig } from "./base-agent";

const STRUCTURED_OUTPUT_INSTRUCTIONS = `

IMPORTANT: You must return your output as valid JSON wrapped in a markdown code block. Use this exact structure:

\`\`\`json
{
  "analysis_type": "pipeline_review | deal_health_check | stalled_deals | next_step_recommendations",
  "summary": "Executive summary of findings (2-3 sentences)",
  "deals": [
    {
      "deal_name": "Deal name",
      "company": "Company name",
      "amount": "$X,XXX",
      "stage": "Current stage",
      "days_in_stage": 14,
      "health_score": 72,
      "color": "green | yellow | red",
      "risk_factors": ["Risk factor 1", "Risk factor 2"],
      "recommended_actions": ["Specific action 1", "Specific action 2"],
      "priority": "high | medium | low"
    }
  ],
  "pipeline_insights": {
    "total_pipeline_value": "$X,XXX",
    "deals_at_risk": 3,
    "at_risk_value": "$X,XXX",
    "avg_health_score": 62,
    "avg_days_in_stage": 18,
    "stage_distribution": {
      "stage_name": 5
    },
    "top_risks": ["Pipeline risk 1", "Pipeline risk 2"]
  },
  "recommendations": [
    {
      "action": "What to do",
      "reasoning": "Why, grounded in specific data points",
      "urgency": "immediate | this_week | this_month",
      "affected_deals": ["Deal name 1", "Deal name 2"]
    }
  ]
}
\`\`\``;

export class CRMAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({
      ...config,
      systemPrompt: config.systemPrompt + STRUCTURED_OUTPUT_INSTRUCTIONS,
    });
  }

  protected buildKnowledgeQuery(input: Record<string, unknown>): string {
    const parts: string[] = [];

    if (input.analysis_type) {
      parts.push(`CRM analysis: ${input.analysis_type}`);
    }
    if (input.deal_name) {
      parts.push(`deal: ${String(input.deal_name).slice(0, 100)}`);
    }
    if (input.deal_stage) {
      parts.push(`deal stage: ${input.deal_stage}`);
    }
    if (input.competitor) {
      parts.push(`competitor: ${input.competitor}`);
    }

    // Always include relevant sales context
    parts.push(
      "objection playbook sales process ICP profile qualification criteria deal closing pipeline management"
    );

    return parts.join(". ").slice(0, 1000);
  }
}
