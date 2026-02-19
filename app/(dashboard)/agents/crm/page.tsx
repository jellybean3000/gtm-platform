"use client";

import { useState, useEffect, useCallback } from "react";

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
  counts?: { contacts: number; deals: number; companies: number };
  preview?: { contacts: Contact[]; deals: Deal[]; companies: Company[] };
  dataError?: string;
}

interface SyncLog {
  id: string;
  syncType: string;
  status: string;
  dealsCount: number | null;
  contactsCount: number | null;
  activitiesCount: number | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CRMPage() {
  const [status, setStatus] = useState<CRMStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "contacts" | "deals" | "companies"
  >("contacts");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    dealsCount: number;
    contactsCount: number;
    activitiesCount: number;
    error?: string;
  } | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [showSyncLog, setShowSyncLog] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSyncLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/sync");
      const data = await res.json();
      setSyncLogs(data.logs || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchSyncLogs();
  }, [fetchStatus, fetchSyncLogs]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/crm/sync", { method: "POST" });
      const data = await res.json();
      setSyncResult(data);
      fetchStatus();
      fetchSyncLogs();
    } catch {
      setSyncResult({ dealsCount: 0, contactsCount: 0, activitiesCount: 0, error: "Sync failed" });
    } finally {
      setSyncing(false);
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
        <NotConfiguredCard hasError={!!status?.dataError} />
      ) : (
        <>
          <ConnectedCard status={status} />

          {/* Sync Controls */}
          <div
            style={{
              marginTop: 16,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14,
              padding: "16px 20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    color: "#E4E4E7",
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: "'Outfit', 'DM Sans', sans-serif",
                  }}
                >
                  Data Sync
                </div>
                <div style={{ color: "#71717A", fontSize: 12, marginTop: 2 }}>
                  {syncLogs.length > 0 && syncLogs[0].completedAt
                    ? `Last synced: ${new Date(syncLogs[0].completedAt).toLocaleString()}`
                    : "Never synced"}
                  {syncLogs.length > 0 && syncLogs[0].status === "completed" &&
                    ` — ${syncLogs[0].dealsCount ?? 0} deals, ${syncLogs[0].contactsCount ?? 0} contacts, ${syncLogs[0].activitiesCount ?? 0} activities`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  onClick={() => setShowSyncLog(!showSyncLog)}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    padding: "6px 14px",
                    color: "#A1A1AA",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "'Outfit', 'DM Sans', sans-serif",
                  }}
                >
                  {showSyncLog ? "Hide Log" : "Sync Log"}
                </button>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  style={{
                    background: ACCENT,
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "6px 18px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: syncing ? "not-allowed" : "pointer",
                    opacity: syncing ? 0.6 : 1,
                    fontFamily: "'Outfit', 'DM Sans', sans-serif",
                  }}
                >
                  {syncing ? "Syncing..." : "Sync Now"}
                </button>
              </div>
            </div>

            {syncResult && (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  background: syncResult.error
                    ? "rgba(239,68,68,0.1)"
                    : "rgba(16,185,129,0.1)",
                  border: syncResult.error
                    ? "1px solid rgba(239,68,68,0.2)"
                    : "1px solid rgba(16,185,129,0.2)",
                  color: syncResult.error ? "#FCA5A5" : "#6EE7B7",
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
              >
                {syncResult.error
                  ? `Sync failed: ${syncResult.error}`
                  : `Synced ${syncResult.dealsCount} deals, ${syncResult.contactsCount} contacts, ${syncResult.activitiesCount} activities`}
              </div>
            )}

            {showSyncLog && syncLogs.length > 0 && (
              <div style={{ marginTop: 12 }}>
                {syncLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "6px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                      fontSize: 11,
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    <span style={{ color: "#71717A" }}>
                      {new Date(log.startedAt).toLocaleString()}
                    </span>
                    <span
                      style={{
                        color:
                          log.status === "completed"
                            ? "#6EE7B7"
                            : log.status === "failed"
                              ? "#FCA5A5"
                              : "#FBBF24",
                      }}
                    >
                      {log.status}
                    </span>
                    <span style={{ color: "#A1A1AA" }}>
                      {log.status === "completed"
                        ? `${log.dealsCount ?? 0}d / ${log.contactsCount ?? 0}c / ${log.activitiesCount ?? 0}a`
                        : log.error || "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

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

function NotConfiguredCard({ hasError }: { hasError: boolean }) {
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
        {hasError ? "Connection Error" : "HubSpot Not Connected"}
      </h2>
      <p
        style={{
          color: "#71717A",
          fontSize: 13,
          margin: "0 0 24px",
          maxWidth: 480,
          marginLeft: "auto",
          marginRight: "auto",
          lineHeight: 1.6,
        }}
      >
        {hasError
          ? "Could not connect to HubSpot. Please check that the HUBSPOT_ACCESS_TOKEN environment variable is set correctly."
          : "To connect HubSpot, add your Private App access token as the HUBSPOT_ACCESS_TOKEN environment variable. Create a Private App in your HubSpot Developer settings with contacts, deals, and companies read scopes."}
      </p>
      <div
        style={{
          display: "inline-block",
          padding: "10px 20px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 12,
          color: "#A1A1AA",
        }}
      >
        HUBSPOT_ACCESS_TOKEN=pat-na2-...
      </div>
    </div>
  );
}

function ConnectedCard({ status }: { status: CRMStatus }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${ACCENT}30`,
        borderRadius: 14,
        padding: "24px 28px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#10B981",
            boxShadow: "0 0 8px rgba(16,185,129,0.5)",
          }}
        />
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
            { label: "Contacts", count: status.counts.contacts, icon: "👤" },
            { label: "Deals", count: status.counts.deals, icon: "💰" },
            { label: "Companies", count: status.counts.companies, icon: "🏢" },
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
