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
      className="inline-flex rounded-full p-0.5"
      style={{ background: "rgba(255,255,255,0.06)" }}
    >
      <button
        onClick={() => onChange("customers")}
        className="px-5 py-1.5 rounded-full text-sm font-semibold font-display transition-all"
        style={{
          background:
            mode === "customers" ? `${CUSTOMER_COLOR}20` : "transparent",
          color: mode === "customers" ? CUSTOMER_COLOR : "#71717A",
          border:
            mode === "customers"
              ? `1px solid ${CUSTOMER_COLOR}40`
              : "1px solid transparent",
          cursor: "pointer",
        }}
      >
        Customers
      </button>
      <button
        onClick={() => onChange("investors")}
        className="px-5 py-1.5 rounded-full text-sm font-semibold font-display transition-all"
        style={{
          background:
            mode === "investors" ? `${INVESTOR_COLOR}20` : "transparent",
          color: mode === "investors" ? INVESTOR_COLOR : "#71717A",
          border:
            mode === "investors"
              ? `1px solid ${INVESTOR_COLOR}40`
              : "1px solid transparent",
          cursor: "pointer",
        }}
      >
        Investors
      </button>
    </div>
  );
}
