"use client";

import { useEffect, useState } from "react";

interface WebSource {
  id: string;
  url: string;
  crawlMode: string;
  status: string;
  lastCrawledAt: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<string, { color: string; label: string }> = {
  active: { color: "#10B981", label: "Active" },
  paused: { color: "#F59E0B", label: "Paused" },
  error: { color: "#EF4444", label: "Error" },
};

const CRAWL_LABELS: Record<string, string> = {
  single: "Single Page",
  site: "Site Crawl",
  sitemap: "Sitemap",
  rss: "RSS",
  scheduled: "Scheduled",
};

export function WebSourcesList({
  teamId,
  refreshKey,
}: {
  teamId: string;
  refreshKey: number;
}) {
  const [sources, setSources] = useState<WebSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSources();
  }, [teamId, refreshKey]);

  async function fetchSources() {
    setLoading(true);
    const res = await fetch(`/api/sources/web?teamId=${teamId}`);
    if (res.ok) {
      const data = await res.json();
      setSources(data.webSources);
    }
    setLoading(false);
  }

  return (
    <div className="bg-card-bg border border-border-default rounded-card p-6">
      <h3 className="text-text-heading font-display font-semibold mb-4">
        Web Sources
      </h3>

      {loading ? (
        <p className="text-text-secondary text-sm">Loading...</p>
      ) : sources.length === 0 ? (
        <p className="text-text-secondary text-sm">
          No web sources added yet. Add a URL above to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {sources.map((source) => {
            const status =
              STATUS_STYLES[source.status] ?? STATUS_STYLES.error;
            return (
              <div
                key={source.id}
                className="flex items-center gap-4 px-4 py-3 bg-background/50 border border-border-default rounded-lg"
              >
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-text-secondary">
                  {CRAWL_LABELS[source.crawlMode] ?? source.crawlMode}
                </span>
                <span className="text-sm text-text-body truncate flex-1">
                  {source.url}
                </span>
                <span
                  className="flex items-center gap-1.5 text-xs font-mono"
                  style={{ color: status.color }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: status.color }}
                  />
                  {status.label}
                </span>
                <span className="text-xs text-text-dim">
                  {source.lastCrawledAt
                    ? new Date(source.lastCrawledAt).toLocaleDateString()
                    : "Not crawled"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
