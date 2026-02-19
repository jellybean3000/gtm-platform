import { BaseAgent, AgentConfig } from "./base-agent";

const STRUCTURED_OUTPUT_INSTRUCTIONS = `

IMPORTANT: You must return your output as valid JSON wrapped in a markdown code block. Use this exact structure:

\`\`\`json
{
  "objection_playbook": [
    {
      "objection": "What the prospect says",
      "category": "price | timing | competition | need | authority | trust",
      "what_they_mean": "The underlying concern behind this objection",
      "response": "How to respond effectively",
      "evidence": ["Proof point or data to share", "Customer quote or case study"],
      "follow_up": "What to say next to advance the conversation"
    }
  ],
  "email_sequences": [
    {
      "name": "Sequence name (e.g., Cold Outbound - VP Marketing)",
      "target_persona": "Who this targets",
      "emails": [
        {
          "step": 1,
          "subject": "Email subject line",
          "body": "Full email body text",
          "send_timing": "Day 1 / Day 3 / etc.",
          "purpose": "What this email aims to achieve"
        }
      ]
    }
  ],
  "demo_script": {
    "title": "Demo script title",
    "duration_minutes": 30,
    "steps": [
      {
        "step": 1,
        "name": "Step name (e.g., Discovery Questions)",
        "duration": "5 min",
        "talking_points": ["Point 1", "Point 2"],
        "demo_actions": ["What to show/click"],
        "transition": "How to move to the next step",
        "if_objection": "What to do if prospect objects here"
      }
    ]
  },
  "qualification_framework": {
    "name": "Framework name (e.g., MEDDPICC adapted)",
    "criteria": [
      {
        "criterion": "Criterion name",
        "questions": ["Discovery question 1", "Discovery question 2"],
        "green_flags": ["Strong signal"],
        "red_flags": ["Warning signal"],
        "scoring": "How to score 1-5"
      }
    ]
  },
  "roi_calculator": {
    "title": "ROI Calculator",
    "inputs": [
      {
        "name": "Input name (e.g., Number of reps)",
        "type": "number",
        "default_value": 10,
        "description": "What this measures"
      }
    ],
    "calculations": [
      {
        "name": "Metric name (e.g., Time saved per week)",
        "formula": "Description of how to calculate",
        "unit": "hours | $ | %"
      }
    ],
    "assumptions": ["Assumption 1", "Assumption 2"]
  },
  "talk_tracks": [
    {
      "scenario": "Scenario name (e.g., First call with CTO)",
      "opening": "How to open the conversation",
      "key_questions": ["Question 1", "Question 2"],
      "value_statements": ["Value statement 1"],
      "closing": "How to close / next steps"
    }
  ]
}
\`\`\``;

export class SalesEnablementAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({
      ...config,
      systemPrompt: config.systemPrompt + STRUCTURED_OUTPUT_INSTRUCTIONS,
    });
  }

  protected buildKnowledgeQuery(input: Record<string, unknown>): string {
    const parts: string[] = [];

    if (input.target_persona) {
      parts.push(`sales persona: ${input.target_persona}`);
    }
    if (input.known_objections) {
      parts.push(`objections: ${String(input.known_objections).slice(0, 200)}`);
    }
    if (input.sales_process) {
      parts.push(`sales process: ${String(input.sales_process).slice(0, 200)}`);
    }
    if (input.output_type) {
      parts.push(`output type: ${input.output_type}`);
    }
    if (input.crm_context) {
      parts.push("CRM real objections deal activity call notes email responses pipeline");
    }

    parts.push("objection handling competitive intel proof points customer quotes pricing");

    return parts.join(". ").slice(0, 1000);
  }
}
