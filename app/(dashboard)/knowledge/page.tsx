"use client";

import { useCallback, useState } from "react";
import { StatsPanel } from "@/components/knowledge/StatsPanel";
import { FileUploadZone } from "@/components/knowledge/FileUploadZone";
import { WebSourceInput } from "@/components/knowledge/WebSourceInput";
import { RecentUploads } from "@/components/knowledge/RecentUploads";
import { WebSourcesList } from "@/components/knowledge/WebSourcesList";
import { TestQuery } from "@/components/knowledge/TestQuery";

// Temporary hardcoded team ID until team management is built
const TEMP_TEAM_ID = "00000000-0000-0000-0000-000000000001";

export default function KnowledgePage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-heading font-display mb-1">
          Knowledge Base
        </h1>
        <p className="text-text-secondary text-sm">
          Upload documents and add web sources to build your intelligence
          engine.
        </p>
      </div>

      <StatsPanel teamId={TEMP_TEAM_ID} key={`stats-${refreshKey}`} />

      <FileUploadZone
        teamId={TEMP_TEAM_ID}
        onUploadComplete={triggerRefresh}
      />

      <WebSourceInput
        teamId={TEMP_TEAM_ID}
        onSourceAdded={triggerRefresh}
      />

      <TestQuery teamId={TEMP_TEAM_ID} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentUploads teamId={TEMP_TEAM_ID} refreshKey={refreshKey} />
        <WebSourcesList teamId={TEMP_TEAM_ID} refreshKey={refreshKey} />
      </div>
    </div>
  );
}
