"use client";

import { useState } from "react";

type Format = "md" | "json" | "txt" | "csv";

interface DownloadButtonProps {
  content: string;
  filename: string;
  formats?: Format[];
  accentColor?: string;
}

const FORMAT_LABELS: Record<Format, string> = {
  md: "Markdown",
  json: "JSON",
  txt: "Text",
  csv: "CSV",
};

const MIME_TYPES: Record<Format, string> = {
  md: "text/markdown",
  json: "application/json",
  txt: "text/plain",
  csv: "text/csv",
};

export function DownloadButton({
  content,
  filename,
  formats = ["md", "json"],
  accentColor = "#71717A",
}: DownloadButtonProps) {
  const [open, setOpen] = useState(false);

  const download = (format: Format) => {
    const blob = new Blob([content], { type: MIME_TYPES[format] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  if (formats.length === 1) {
    return (
      <button
        onClick={() => download(formats[0])}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border-default text-text-dim hover:text-text-body hover:border-opacity-30 transition-all"
      >
        <DownloadIcon />
        Download {FORMAT_LABELS[formats[0]]}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border-default text-text-dim hover:text-text-body transition-all"
      >
        <DownloadIcon />
        Download
        <ChevronIcon open={open} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-[#18181B] border border-border-default rounded-lg overflow-hidden z-20 min-w-[120px] shadow-lg">
            {formats.map((format) => (
              <button
                key={format}
                onClick={() => download(format)}
                className="w-full text-left px-3 py-2 text-xs text-text-body hover:bg-white/[0.04] transition-colors flex items-center gap-2"
              >
                <span
                  className="w-1 h-1 rounded-full"
                  style={{ background: accentColor }}
                />
                {FORMAT_LABELS[format]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className="opacity-60"
    >
      <path
        d="M6 1.5v7M3 6.5l3 3 3-3M2 10.5h8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M2.5 3.75L5 6.25L7.5 3.75"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
