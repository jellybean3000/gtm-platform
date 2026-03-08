"use client";

export type CrmMode = "customers" | "investors";

const CUSTOMER_COLOR = "#F97316";
const INVESTOR_COLOR = "#8B5CF6";

export function ModeSwitcher({
  mode,
  onChange,
}: {
  mode: CrmMode;
  onChange: (mode: CrmMode) => void;
}) {
  return (
    <div
      className="inline-flex rounded-full p-1 gap-1"
      style={{
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <button
        onClick={() => onChange("customers")}
        className="px-5 py-1.5 rounded-full text-sm font-semibold font-display transition-all"
        style={{
          background:
            mode === "customers" ? CUSTOMER_COLOR : "transparent",
          color: mode === "customers" ? "#FFFFFF" : "#A1A1AA",
          cursor: "pointer",
          border: "none",
          boxShadow:
            mode === "customers"
              ? `0 0 12px ${CUSTOMER_COLOR}50`
              : "none",
        }}
      >
        Customers
      </button>
      <button
        onClick={() => onChange("investors")}
        className="px-5 py-1.5 rounded-full text-sm font-semibold font-display transition-all"
        style={{
          background:
            mode === "investors" ? INVESTOR_COLOR : "transparent",
          color: mode === "investors" ? "#FFFFFF" : "#A1A1AA",
          cursor: "pointer",
          border: "none",
          boxShadow:
            mode === "investors"
              ? `0 0 12px ${INVESTOR_COLOR}50`
              : "none",
        }}
      >
        Investors
      </button>
    </div>
  );
}
