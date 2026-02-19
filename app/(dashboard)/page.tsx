"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const CRM_ACCENT = "#F97316";

interface PipelineStats {
  totalDeals: number;
  totalValue: number;
  avgHealthScore: number;
  dealsAtRisk: number;
  avgDaysInStage: number;
}

interface Deal {
  healthScore: number | null;
}

export default function Home() {
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [healthDist, setHealthDist] = useState({ green: 0, yellow: 0, red: 0 });

  const fetchPipeline = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/deals");
      if (!res.ok) return;
      const data = await res.json();
      setStats(data.stats);

      // Compute health distribution
      const deals = (data.deals || []) as Deal[];
      let green = 0, yellow = 0, red = 0;
      for (const d of deals) {
        if (d.healthScore === null) { yellow++; continue; }
        if (d.healthScore >= 70) green++;
        else if (d.healthScore >= 40) yellow++;
        else red++;
      }
      setHealthDist({ green, yellow, red });
    } catch {
      // CRM not available
    }
  }, []);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  return (
    <div className="flex flex-col items-center justify-center h-full px-8">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-text-heading mb-4">
          Welcome to GTM Platform
        </h1>
        <p className="text-text-body text-lg">
          Multi-Agent Go-To-Market Intelligence
        </p>
      </div>

      {/* Pipeline Health Card */}
      {stats && stats.totalDeals > 0 && (
        <Link href="/agents/crm" className="w-full max-w-md no-underline">
          <div className="bg-card-bg border border-border-default rounded-card p-6 hover:border-[#F97316]/30 transition-colors cursor-pointer">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: CRM_ACCENT }} />
              <span
                className="text-[10px] uppercase tracking-[2px] font-semibold"
                style={{ color: CRM_ACCENT }}
              >
                Pipeline Health
              </span>
            </div>

            <div className="flex items-end justify-between mb-4">
              <div>
                <div className="text-2xl font-bold font-mono text-foreground">
                  ${stats.totalValue >= 1000
                    ? `${(stats.totalValue / 1000).toFixed(0)}k`
                    : stats.totalValue.toLocaleString()}
                </div>
                <div className="text-[10px] uppercase tracking-[2px] text-text-muted mt-1">
                  Pipeline Value
                </div>
              </div>
              <div className="text-right">
                <div
                  className="text-2xl font-bold font-mono"
                  style={{ color: stats.dealsAtRisk > 0 ? "#EF4444" : "#10B981" }}
                >
                  {stats.dealsAtRisk}
                </div>
                <div className="text-[10px] uppercase tracking-[2px] text-text-muted mt-1">
                  At Risk
                </div>
              </div>
            </div>

            {/* Health distribution bar */}
            {(healthDist.green + healthDist.yellow + healthDist.red) > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] text-text-dim">{stats.totalDeals} deals</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden flex bg-background">
                  {healthDist.green > 0 && (
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${(healthDist.green / stats.totalDeals) * 100}%`,
                        background: "#10B981",
                      }}
                    />
                  )}
                  {healthDist.yellow > 0 && (
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${(healthDist.yellow / stats.totalDeals) * 100}%`,
                        background: "#FBBF24",
                      }}
                    />
                  )}
                  {healthDist.red > 0 && (
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${(healthDist.red / stats.totalDeals) * 100}%`,
                        background: "#EF4444",
                      }}
                    />
                  )}
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1 text-[10px] text-text-dim">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                    {healthDist.green} healthy
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-text-dim">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]" />
                    {healthDist.yellow} at risk
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-text-dim">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                    {healthDist.red} critical
                  </span>
                </div>
              </div>
            )}
          </div>
        </Link>
      )}
    </div>
  );
}
