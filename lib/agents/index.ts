import { BaseAgent, AgentConfig } from "./base-agent";
import { MarketResearchAgent } from "./market-research";
import { PMFAgent } from "./pmf";
import { PositioningAgent } from "./positioning";
import { ContentAgent } from "./content";

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
    default:
      return new BaseAgent(config);
  }
}
