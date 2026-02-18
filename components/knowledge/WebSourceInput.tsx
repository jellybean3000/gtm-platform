"use client";

import { useState } from "react";

const CRAWL_MODES = [
  { value: "single", label: "Single Page" },
  { value: "site", label: "Site Crawl" },
  { value: "sitemap", label: "Sitemap Import" },
  { value: "rss", label: "RSS Monitor" },
  { value: "scheduled", label: "Scheduled Recrawl" },
] as const;

export function WebSourceInput({
  teamId,
  onSourceAdded,
}: {
  teamId: string;
  onSourceAdded: () => void;
}) {
  const [url, setUrl] = useState("");
  const [crawlMode, setCrawlMode] = useState<string>("single");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!url.trim()) return;

    setError(null);
    setIsAdding(true);

    try {
      const res = await fetch("/api/sources/web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), crawlMode, teamId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add source");
      }

      setUrl("");
      onSourceAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add source");
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="bg-card-bg border border-border-default rounded-card p-6">
      <h3 className="text-text-heading font-display font-semibold mb-4">
        Add Web Source
      </h3>

      <div className="flex gap-3 mb-4">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="https://example.com/page"
          className="flex-1 bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#F59E0B]/40 transition-colors"
        />
        <button
          onClick={handleAdd}
          disabled={isAdding || !url.trim()}
          className="px-5 py-2.5 bg-[#F59E0B] text-background font-medium text-sm rounded-lg hover:bg-[#F59E0B]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isAdding ? "Adding..." : "Add"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {CRAWL_MODES.map((mode) => (
          <button
            key={mode.value}
            onClick={() => setCrawlMode(mode.value)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              crawlMode === mode.value
                ? "border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#F59E0B]"
                : "border-border-default text-text-secondary hover:border-text-muted hover:text-text-body"
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-3 text-[#EF4444] text-sm">{error}</p>
      )}
    </div>
  );
}
