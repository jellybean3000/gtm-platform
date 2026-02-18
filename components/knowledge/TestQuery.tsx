"use client";

import { useState } from "react";

interface ChunkResult {
  id: string;
  content: string;
  similarity: number;
  sourceDocument: string;
  sourceUrl: string | null;
  fileType: string;
}

export function TestQuery({ teamId }: { teamId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChunkResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!query.trim()) return;

    setError(null);
    setIsSearching(true);
    setResults(null);

    try {
      const res = await fetch("/api/knowledge/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), teamId, topK: 5 }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Query failed");
      }

      const data = await res.json();
      setResults(data.chunks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="bg-card-bg border border-border-default rounded-card p-6">
      <h3 className="text-text-heading font-display font-semibold mb-4">
        Test Query
      </h3>

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Ask a question to search your knowledge base..."
          className="flex-1 bg-background border border-border-default rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:outline-none focus:border-[#F59E0B]/40 transition-colors"
        />
        <button
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
          className="px-5 py-2.5 bg-[#6366F1] text-white font-medium text-sm rounded-lg hover:bg-[#6366F1]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSearching ? "Searching..." : "Search"}
        </button>
      </div>

      {error && <p className="text-[#EF4444] text-sm mb-4">{error}</p>}

      {results && results.length === 0 && (
        <p className="text-text-secondary text-sm">
          No matching chunks found. Try a different query.
        </p>
      )}

      {results && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-text-muted text-xs uppercase tracking-widest">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </p>
          {results.map((chunk) => (
            <div
              key={chunk.id}
              className="border border-border-default rounded-lg p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider bg-[#6366F1]/10 text-[#6366F1] rounded font-mono">
                    {chunk.fileType}
                  </span>
                  <span className="text-sm text-text-body truncate">
                    {chunk.sourceDocument}
                  </span>
                </div>
                <span className="text-xs text-text-muted font-mono whitespace-nowrap">
                  {(chunk.similarity * 100).toFixed(1)}% match
                </span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed line-clamp-4">
                {chunk.content}
              </p>
              {chunk.sourceUrl && (
                <a
                  href={chunk.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#0EA5E9] hover:underline"
                >
                  {chunk.sourceUrl}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
