import { BaseAgent, AgentConfig } from "./base-agent";
import { MarketResearchAgent } from "./market-research";
import { PMFAgent } from "./pmf";
import { PositioningAgent } from "./positioning";
import { ContentAgent } from "./content";
import { SalesEnablementAgent } from "./sales-enablement";
import { DemandGenAgent } from "./demand-gen";
import { AnalyticsAgent } from "./analytics";
import { LaunchAgent } from "./launch";
import { CRMAgent } from "./crm";

/**
 * Factory function that returns the correct agent subclass based on slug.
 * Falls back to BaseAgent for agents that don't have a custom subclass yet.
 */
export function createAgent(slug: string, config: AgentConfig): BaseAgent {
  switch (slug) {
    case "market-research":
      return new MarketResearchAgent(config);
    case "pmf":
      return new PMFAgent(config);
    case "positioning":
      return new PositioningAgent(config);
    case "content":
      return new ContentAgent(config);
    case "sales-enablement":
      return new SalesEnablementAgent(config);
    case "demand-gen":
      return new DemandGenAgent(config);
    case "analytics":
      return new AnalyticsAgent(config);
    case "launch":
      return new LaunchAgent(config);
    case "crm":
      return new CRMAgent(config);
    default:
      return new BaseAgent(config);
  }
}
