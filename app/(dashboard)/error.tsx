"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8">
      <div className="bg-card-bg border border-[#EF4444]/20 rounded-[14px] p-8 max-w-md text-center">
        <div className="w-10 h-10 rounded-full bg-[#EF4444]/10 flex items-center justify-center mx-auto mb-4">
          <span className="text-[#EF4444] text-lg">!</span>
        </div>
        <h2 className="text-lg font-semibold text-text-heading mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-text-muted mb-4">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-border-default text-text-body hover:bg-white/[0.04] transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
