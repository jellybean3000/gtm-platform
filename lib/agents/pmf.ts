import { BaseAgent, AgentConfig } from "./base-agent";

const STRUCTURED_OUTPUT_INSTRUCTIONS = `

IMPORTANT: You must return your analysis as valid JSON wrapped in a markdown code block. Use this exact structure:

\`\`\`json
{
  "pmf_scorecard": {
    "overall_score": 7.5,
    "dimensions": [
      {
        "name": "Problem Clarity",
        "score": 8,
        "max": 10,
        "signals": ["Clear pain point identified", "Customers actively seeking solutions"],
        "recommendation": "Sharpen problem statement for enterprise segment"
      }
    ],
    "summary": "Brief overall PMF assessment"
  },
  "interview_scripts": [
    {
      "name": "Script name (e.g., Discovery Interview)",
      "objective": "What this script aims to learn",
      "target_persona": "Who to interview",
      "questions": [
        {
          "question": "The interview question",
          "purpose": "Why we ask this",
          "follow_ups": ["Follow-up 1", "Follow-up 2"]
        }
      ],
      "duration_minutes": 30
    }
  ],
  "survey_questions": [
    {
      "question": "How would you feel if you could no longer use [product]?",
      "type": "multiple_choice",
      "options": ["Very disappointed", "Somewhat disappointed", "Not disappointed", "N/A - I no longer use it"],
      "category": "sean_ellis_test",
      "purpose": "Core PMF measurement"
    }
  ],
  "feature_value_map": [
    {
      "feature": "Feature name",
      "customer_value": "What value it provides",
      "target_segment": "Which segment values this most",
      "importance": "high/medium/low",
      "satisfaction": "high/medium/low"
    }
  ],
  "insight_report": {
    "key_themes": ["Theme 1", "Theme 2"],
    "patterns": ["Pattern 1", "Pattern 2"],
    "gaps": ["Gap 1", "Gap 2"],
    "recommendations": [
      {
        "action": "What to do",
        "priority": "high/medium/low",
        "rationale": "Why this matters"
      }
    ]
  }
}
\`\`\``;

export class PMFAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({
      ...config,
      systemPrompt: config.systemPrompt + STRUCTURED_OUTPUT_INSTRUCTIONS,
    });
  }

  protected buildKnowledgeQuery(input: Record<string, unknown>): string {
    const parts: string[] = [];

    if (input.product_description) {
      parts.push(String(input.product_description).slice(0, 300));
    }
    if (input.hypotheses) {
      parts.push(`hypotheses: ${input.hypotheses}`);
    }
    if (input.research_type) {
      parts.push(`research type: ${input.research_type}`);
    }

    return (
      parts.join(". ") ||
      "product-market fit customer feedback interview survey"
    );
  }
}
