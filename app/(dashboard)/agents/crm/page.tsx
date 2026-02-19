"use client";

import { useState, useEffect, useCallback } from "react";

const TEAM_ID = "00000000-0000-0000-0000-000000000001";
const ACCENT = "#F97316";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Contact {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  lifecycleStage: string;
}

interface Deal {
  id: string;
  name: string;
  amount: string;
  stage: string;
  closeDate: string;
  pipeline: string;
}

interface Company {
  id: string;
  name: string;
  domain: string;
  industry: string;
  annualRevenue: string;
}

interface CRMStatus {
  connected: boolean;
  portalId?: string;
  hubName?: string;
  lastUpdated?: string;
  counts?: { contacts: number; deals: number; companies: number };
  preview?: { contacts: Contact[]; deals: Deal[]; companies: Company[] };
  dataError?: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CRMPage() {
  const [status, setStatus] = useState<CRMStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "contacts" | "deals" | "companies"
  >("contacts");

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/status?teamId=${TEAM_ID}`);
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Check for ?connected=true in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      window.history.replaceState({}, "", "/agents/crm");
      fetchStatus();
    }
  }, [fetchStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch(`/api/crm/connect?teamId=${TEAM_ID}`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/crm/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: TEAM_ID }),
      });
      setStatus({ connected: false });
    } catch {
      // ignore
    } finally {
      setDisconnecting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 28 }}>👥</span>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "#FAFAFA",
              margin: 0,
              fontFamily: "'Outfit', 'DM Sans', sans-serif",
            }}
          >
            CRM Integration
          </h1>
        </div>
        <p style={{ color: "#A1A1AA", fontSize: 14, margin: 0 }}>
          Connect your HubSpot CRM to ground agent outputs in real customer
          data, deal intelligence, and company insights.
        </p>
      </div>

      {loading ? (
        <LoadingCard />
      ) : !status?.connected ? (
        <DisconnectedCard
          connecting={connecting}
          onConnect={handleConnect}
        />
      ) : (
        <>
          <ConnectedCard
            status={status}
            disconnecting={disconnecting}
            onDisconnect={handleDisconnect}
          />

          {/* Data Preview */}
          {status.preview && (
            <div style={{ marginTop: 24 }}>
              {/* Tab bar */}
              <div
                style={{
                  display: "flex",
                  gap: 0,
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  marginBottom: 20,
                }}
              >
                {(["contacts", "deals", "companies"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: "10px 20px",
                      background: "transparent",
                      border: "none",
                      borderBottom:
                        activeTab === tab
                          ? `2px solid ${ACCENT}`
                          : "2px solid transparent",
                      color: activeTab === tab ? "#FAFAFA" : "#71717A",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      textTransform: "capitalize",
                      fontFamily: "'Outfit', 'DM Sans', sans-serif",
                      transition: "all 0.2s",
                    }}
                  >
                    {tab}{" "}
                    <span
                      style={{
                        fontSize: 11,
                        color: activeTab === tab ? ACCENT : "#52525B",
                        marginLeft: 4,
                      }}
                    >
                      ({status.counts?.[tab] ?? 0})
                    </span>
                  </button>
                ))}
              </div>

              {activeTab === "contacts" && (
                <ContactsTable contacts={status.preview.contacts} />
              )}
              {activeTab === "deals" && (
                <DealsTable deals={status.preview.deals} />
              )}
              {activeTab === "companies" && (
                <CompaniesTable companies={status.preview.companies} />
              )}
            </div>
          )}

          {status.dataError && (
            <div
              style={{
                marginTop: 16,
                padding: "12px 16px",
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 10,
                color: "#FCA5A5",
                fontSize: 13,
              }}
            >
              {status.dataError}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoadingCard() {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 14,
        padding: 48,
        textAlign: "center",
      }}
    >
      <div
        style={{
          color: "#71717A",
          fontSize: 14,
          fontFamily: "'IBM Plex Mono', monospace",
        }}
      >
        Loading CRM status...
      </div>
    </div>
  );
}

function DisconnectedCard({
  connecting,
  onConnect,
}: {
  connecting: boolean;
  onConnect: () => void;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 14,
        padding: "48px 40px",
        textAlign: "center",
      }}
    >
      {/* HubSpot logo placeholder */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: `${ACCENT}15`,
          border: `1px solid ${ACCENT}30`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
          fontSize: 32,
        }}
      >
        🔗
      </div>
      <h2
        style={{
          color: "#FAFAFA",
          fontSize: 20,
          fontWeight: 700,
          margin: "0 0 8px",
          fontFamily: "'Outfit', 'DM Sans', sans-serif",
        }}
      >
        Connect HubSpot
      </h2>
      <p
        style={{
          color: "#71717A",
          fontSize: 13,
          margin: "0 0 24px",
          maxWidth: 420,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        Link your HubSpot account to import contacts, deals, and company data.
        This data will be available to all agents for grounding their analysis.
      </p>
      <button
        onClick={onConnect}
        disabled={connecting}
        style={{
          background: ACCENT,
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "10px 28px",
          fontSize: 14,
          fontWeight: 600,
          cursor: connecting ? "not-allowed" : "pointer",
          opacity: connecting ? 0.6 : 1,
          fontFamily: "'Outfit', 'DM Sans', sans-serif",
          transition: "opacity 0.2s",
        }}
      >
        {connecting ? "Redirecting..." : "Connect HubSpot"}
      </button>
      <div
        style={{
          marginTop: 16,
          fontSize: 11,
          color: "#52525B",
          fontFamily: "'IBM Plex Mono', monospace",
        }}
      >
        Requires: contacts, deals, and companies read access
      </div>
    </div>
  );
}

function ConnectedCard({
  status,
  disconnecting,
  onDisconnect,
}: {
  status: CRMStatus;
  disconnecting: boolean;
  onDisconnect: () => void;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${ACCENT}30`,
        borderRadius: 14,
        padding: "24px 28px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Green status dot */}
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#10B981",
              boxShadow: "0 0 8px rgba(16,185,129,0.5)",
            }}
          />
          <div>
            <div
              style={{
                color: "#FAFAFA",
                fontSize: 16,
                fontWeight: 600,
                fontFamily: "'Outfit', 'DM Sans', sans-serif",
              }}
            >
              HubSpot Connected
            </div>
            <div style={{ color: "#71717A", fontSize: 12, marginTop: 2 }}>
              Portal {status.portalId || "—"}
              {status.hubName ? ` · ${status.hubName}` : ""}
              {status.lastUpdated &&
                ` · Last synced ${new Date(status.lastUpdated).toLocaleDateString()}`}
            </div>
          </div>
        </div>
        <button
          onClick={onDisconnect}
          disabled={disconnecting}
          style={{
            background: "rgba(239,68,68,0.1)",
            color: "#EF4444",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 8,
            padding: "6px 16px",
            fontSize: 12,
            fontWeight: 600,
            cursor: disconnecting ? "not-allowed" : "pointer",
            opacity: disconnecting ? 0.6 : 1,
            fontFamily: "'Outfit', 'DM Sans', sans-serif",
          }}
        >
          {disconnecting ? "Disconnecting..." : "Disconnect"}
        </button>
      </div>

      {/* Count badges */}
      {status.counts && (
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {[
            {
              label: "Contacts",
              count: status.counts.contacts,
              icon: "👤",
            },
            { label: "Deals", count: status.counts.deals, icon: "💰" },
            {
              label: "Companies",
              count: status.counts.companies,
              icon: "🏢",
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10,
                padding: "12px 16px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
              <div
                style={{
                  color: ACCENT,
                  fontSize: 20,
                  fontWeight: 700,
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
              >
                {item.count}
              </div>
              <div
                style={{
                  color: "#71717A",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  marginTop: 2,
                }}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data tables
// ---------------------------------------------------------------------------
const thStyle: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 1.5,
  color: "#52525B",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  color: "#A1A1AA",
  borderBottom: "1px solid rgba(255,255,255,0.03)",
  fontFamily: "'IBM Plex Mono', monospace",
};

function ContactsTable({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) {
    return <EmptyState label="No contacts found" />;
  }
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Email</th>
            <th style={thStyle}>Company</th>
            <th style={thStyle}>Lifecycle Stage</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => (
            <tr key={c.id}>
              <td style={{ ...tdStyle, color: "#FAFAFA" }}>
                {c.firstName} {c.lastName}
              </td>
              <td style={tdStyle}>{c.email}</td>
              <td style={tdStyle}>{c.company || "—"}</td>
              <td style={tdStyle}>
                <StageBadge stage={c.lifecycleStage} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DealsTable({ deals }: { deals: Deal[] }) {
  if (deals.length === 0) {
    return <EmptyState label="No deals found" />;
  }
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}>Deal Name</th>
            <th style={thStyle}>Amount</th>
            <th style={thStyle}>Stage</th>
            <th style={thStyle}>Close Date</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((d) => (
            <tr key={d.id}>
              <td style={{ ...tdStyle, color: "#FAFAFA" }}>{d.name}</td>
              <td style={tdStyle}>
                {d.amount ? `$${Number(d.amount).toLocaleString()}` : "—"}
              </td>
              <td style={tdStyle}>
                <StageBadge stage={d.stage} />
              </td>
              <td style={tdStyle}>
                {d.closeDate
                  ? new Date(d.closeDate).toLocaleDateString()
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompaniesTable({ companies }: { companies: Company[] }) {
  if (companies.length === 0) {
    return <EmptyState label="No companies found" />;
  }
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}>Company</th>
            <th style={thStyle}>Domain</th>
            <th style={thStyle}>Industry</th>
            <th style={thStyle}>Annual Revenue</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <tr key={c.id}>
              <td style={{ ...tdStyle, color: "#FAFAFA" }}>{c.name}</td>
              <td style={tdStyle}>{c.domain || "—"}</td>
              <td style={tdStyle}>{c.industry || "—"}</td>
              <td style={tdStyle}>
                {c.annualRevenue
                  ? `$${Number(c.annualRevenue).toLocaleString()}`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StageBadge({ stage }: { stage: string }) {
  if (!stage) return <span style={{ color: "#52525B" }}>—</span>;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        background: `${ACCENT}15`,
        color: ACCENT,
        textTransform: "capitalize",
      }}
    >
      {stage.replace(/_/g, " ")}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 14,
        padding: 32,
        textAlign: "center",
        color: "#52525B",
        fontSize: 13,
      }}
    >
      {label}
    </div>
  );
}
