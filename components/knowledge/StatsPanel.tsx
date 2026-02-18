"use client";

import { useEffect, useState } from "react";

interface Stats {
  documents: number;
  knowledgeChunks: number;
  webSources: number;
}

const cards = [
  { key: "documents" as const, label: "Documents", icon: "📄" },
  { key: "knowledgeChunks" as const, label: "Knowledge Chunks", icon: "🧩" },
  { key: "webSources" as const, label: "Web Sources", icon: "🌐" },
];

export function StatsPanel({ teamId }: { teamId: string }) {
  const [stats, setStats] = useState<Stats>({
    documents: 0,
    knowledgeChunks: 0,
    webSources: 0,
  });

  useEffect(() => {
    fetchStats();
  }, [teamId]);

  async function fetchStats() {
    const res = await fetch(`/api/knowledge/stats?teamId=${teamId}`);
    if (res.ok) {
      setStats(await res.json());
    }
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.key}
          className="bg-card-bg border border-border-default rounded-card p-6"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-[2px] text-text-muted">
              {card.label}
            </span>
            <span className="text-lg">{card.icon}</span>
          </div>
          <p className="text-3xl font-bold text-foreground font-mono">
            {stats[card.key].toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
