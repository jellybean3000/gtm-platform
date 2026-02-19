export default function DashboardLoading() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="flex items-center gap-3">
        <div
          className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "#10B981 transparent #10B981 #10B981" }}
        />
        <span className="text-sm text-text-muted">Loading...</span>
      </div>
    </div>
  );
}
