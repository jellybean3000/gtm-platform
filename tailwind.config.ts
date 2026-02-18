import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#09090B",
        "background-deep": "#060609",
        foreground: "#FAFAFA",
        "text-heading": "#E4E4E7",
        "text-body": "#A1A1AA",
        "text-secondary": "#71717A",
        "text-muted": "#52525B",
        "text-dim": "#3F3F46",
        "border-default": "rgba(255,255,255,0.06)",
        "card-bg": "rgba(255,255,255,0.02)",
        agent: {
          "market-research": "#0EA5E9",
          positioning: "#8B5CF6",
          content: "#F59E0B",
          "sales-enablement": "#10B981",
          launch: "#EF4444",
          "demand-gen": "#EC4899",
          analytics: "#6366F1",
          pmf: "#14B8A6",
          orchestrator: "#10B981",
          knowledge: "#F59E0B",
        },
      },
      fontFamily: {
        mono: ["IBM Plex Mono", "JetBrains Mono", "monospace"],
        display: ["Outfit", "DM Sans", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};
export default config;
