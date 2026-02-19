import { BaseAgent, AgentConfig } from "./base-agent";

const STRUCTURED_OUTPUT_INSTRUCTIONS = `

IMPORTANT: You must return your output as valid JSON wrapped in a markdown code block. Use this exact structure:

\`\`\`json
{
  "timeline": [
    {
      "phase": "Phase name (e.g., Pre-Launch, Launch Week, Post-Launch)",
      "start_date": "Relative date (e.g., T-4 weeks, Launch Day, T+1 week)",
      "end_date": "Relative date",
      "tasks": [
        {
          "name": "Task name",
          "owner": "Team or role responsible",
          "due_date": "Relative date",
          "status": "not_started | in_progress | completed",
          "dependencies": ["Dependent task name"],
          "priority": "critical | high | medium | low"
        }
      ]
    }
  ],
  "channel_strategy": [
    {
      "channel": "Channel name (e.g., Email, Social, PR, Paid, Events, Product)",
      "objective": "What this channel should achieve",
      "tactics": ["Tactic 1", "Tactic 2"],
      "timing": "When to activate",
      "success_metric": "How to measure success",
      "content_needed": ["Content piece 1", "Content piece 2"]
    }
  ],
  "launch_checklist": [
    {
      "category": "Category (e.g., Product, Marketing, Sales, Support, Legal)",
      "items": [
        { "item": "Checklist item", "status": "not_started | in_progress | completed", "owner": "Who owns this", "notes": "Additional context" }
      ]
    }
  ],
  "readiness_gates": [
    {
      "gate": "Gate name (e.g., Product Ready, Sales Trained, Content Approved)",
      "criteria": ["Criterion 1", "Criterion 2"],
      "status": "not_met | partially_met | met",
      "blockers": ["Blocker if any"],
      "owner": "Who owns this gate"
    }
  ],
  "risk_register": [
    {
      "risk": "Risk description",
      "likelihood": "high | medium | low",
      "impact": "high | medium | low",
      "mitigation": "How to mitigate",
      "contingency": "Backup plan if it happens",
      "owner": "Who monitors this"
    }
  ]
}
\`\`\``;

export class LaunchAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({
      ...config,
      systemPrompt: config.systemPrompt + STRUCTURED_OUTPUT_INSTRUCTIONS,
    });
  }

  protected buildKnowledgeQuery(input: Record<string, unknown>): string {
    const parts: string[] = [];

    if (input.product_name) {
      parts.push(`product: ${input.product_name}`);
    }
    if (input.launch_type) {
      parts.push(`launch type: ${input.launch_type}`);
    }
    if (input.target_channels) {
      parts.push(`channels: ${String(input.target_channels).slice(0, 200)}`);
    }

    parts.push("launch planning timeline checklist readiness enablement risk");

    return parts.join(". ").slice(0, 1000);
  }
}
