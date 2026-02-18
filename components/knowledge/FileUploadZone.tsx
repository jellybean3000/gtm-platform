"use client";

import { useCallback, useRef, useState } from "react";

interface UploadingFile {
  name: string;
  status: "uploading" | "done" | "error";
  error?: string;
}

const ACCEPTED_EXTENSIONS = [".pdf", ".pptx", ".docx", ".csv", ".xlsx", ".md", ".txt"];

export function FileUploadZone({
  teamId,
  onUploadComplete,
}: {
  teamId: string;
  onUploadComplete: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      const newUploads: UploadingFile[] = fileArray.map((f) => ({
        name: f.name,
        status: "uploading" as const,
      }));
      setUploads((prev) => [...newUploads, ...prev]);

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");

        if (!ACCEPTED_EXTENSIONS.includes(ext)) {
          setUploads((prev) =>
            prev.map((u) =>
              u.name === file.name
                ? { ...u, status: "error", error: "Unsupported file type" }
                : u
            )
          );
          continue;
        }

        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("teamId", teamId);

          const res = await fetch("/api/sources/upload", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Upload failed");
          }

          setUploads((prev) =>
            prev.map((u) =>
              u.name === file.name ? { ...u, status: "done" } : u
            )
          );
        } catch (err) {
          setUploads((prev) =>
            prev.map((u) =>
              u.name === file.name
                ? {
                    ...u,
                    status: "error",
                    error: err instanceof Error ? err.message : "Upload failed",
                  }
                : u
            )
          );
        }
      }

      onUploadComplete();

      // Clear completed uploads after 3 seconds
      setTimeout(() => {
        setUploads((prev) => prev.filter((u) => u.status === "uploading"));
      }, 3000);
    },
    [teamId, onUploadComplete]
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-card p-10 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-[#F59E0B] bg-[#F59E0B]/5"
            : "border-border-default hover:border-text-muted"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFiles(e.target.files);
              e.target.value = "";
            }
          }}
        />
        <div className="text-4xl mb-3">📁</div>
        <p className="text-text-heading font-medium mb-1">
          Drop files here or click to browse
        </p>
        <p className="text-text-secondary text-sm">
          Supports {ACCEPTED_EXTENSIONS.join(", ")} — Max 50MB per file
        </p>
      </div>

      {uploads.length > 0 && (
        <div className="mt-3 space-y-2">
          {uploads.map((upload, i) => (
            <div
              key={`${upload.name}-${i}`}
              className="flex items-center gap-3 text-sm px-4 py-2 bg-card-bg border border-border-default rounded-lg"
            >
              <span className="text-text-body truncate flex-1">
                {upload.name}
              </span>
              {upload.status === "uploading" && (
                <span className="text-[#F59E0B] text-xs font-mono">
                  Uploading...
                </span>
              )}
              {upload.status === "done" && (
                <span className="text-[#10B981] text-xs font-mono">Done</span>
              )}
              {upload.status === "error" && (
                <span className="text-[#EF4444] text-xs font-mono">
                  {upload.error}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
