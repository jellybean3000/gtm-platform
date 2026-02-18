"use client";

import { useEffect, useState } from "react";

interface Document {
  id: string;
  filename: string;
  fileType: string;
  status: string;
  createdAt: string;
}

const STATUS_STYLES: Record<string, { color: string; label: string }> = {
  uploading: { color: "#F59E0B", label: "Uploading" },
  processing: { color: "#0EA5E9", label: "Processing" },
  analyzed: { color: "#10B981", label: "Analyzed" },
  error: { color: "#EF4444", label: "Error" },
};

export function RecentUploads({
  teamId,
  refreshKey,
}: {
  teamId: string;
  refreshKey: number;
}) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocs();
  }, [teamId, refreshKey]);

  async function fetchDocs() {
    setLoading(true);
    const res = await fetch(`/api/sources/documents?teamId=${teamId}`);
    if (res.ok) {
      const data = await res.json();
      setDocs(data.documents);
    }
    setLoading(false);
  }

  return (
    <div className="bg-card-bg border border-border-default rounded-card p-6">
      <h3 className="text-text-heading font-display font-semibold mb-4">
        Recent Uploads
      </h3>

      {loading ? (
        <p className="text-text-secondary text-sm">Loading...</p>
      ) : docs.length === 0 ? (
        <p className="text-text-secondary text-sm">
          No documents uploaded yet. Drop files above to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => {
            const status = STATUS_STYLES[doc.status] ?? STATUS_STYLES.error;
            return (
              <div
                key={doc.id}
                className="flex items-center gap-4 px-4 py-3 bg-background/50 border border-border-default rounded-lg"
              >
                <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-white/5 text-text-secondary">
                  {doc.fileType}
                </span>
                <span className="text-sm text-text-body truncate flex-1">
                  {doc.filename}
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
                  {new Date(doc.createdAt).toLocaleDateString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
