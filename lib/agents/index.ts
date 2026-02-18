import { BaseAgent, AgentConfig } from "./base-agent";
import { MarketResearchAgent } from "./market-research";
import { PMFAgent } from "./pmf";

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
    default:
      return new BaseAgent(config);
  }
}
