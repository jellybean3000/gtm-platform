"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

const ACCENT = "#8B5CF6";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Investor {
  id: string;
  firmName: string;
  firmType: "vc" | "angel" | "pe" | "corporate" | "family_office" | "other";
  checkSizeMin: number | null;
  checkSizeMax: number | null;
  stage: string;
  leadPartner: string | null;
  leadPartnerEmail: string | null;
  interestLevel: "high" | "medium" | "low" | "unknown";
  committedAmount: number | null;
  thesisFit: string | null;
  portfolioCompanies: string[] | null;
  website: string | null;
  notes: string | null;
  nextSteps: string | null;
  lastContactDate: string | null;
  daysInStage: number | null;
  createdAt: string;
  updatedAt: string;
}

interface InvestorStats {
  totalInvestors: number;
  targetRaise: number;
  committedCapital: number;
  meetingsThisWeek: number;
  avgDaysInStage: number;
}

interface Meeting {
  id: string;
  investorId: string;
  meetingDate: string;
  meetingType: string;
  attendees: string | null;
  notes: string | null;
  nextSteps: string | null;
  sentiment: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const INVESTOR_STAGES = [
  "identified",
  "researching",
  "outreach",
  "first_meeting",
  "partner_meeting",
  "due_diligence",
  "term_sheet",
  "closed_committed",
  "passed",
];

function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
    identified: "Identified",
    researching: "Researching",
    outreach: "Outreach",
    first_meeting: "First Meeting",
    partner_meeting: "Partner Meeting",
    due_diligence: "Due Diligence",
    term_sheet: "Term Sheet",
    closed_committed: "Closed / Committed",
    passed: "Passed",
  };
  return labels[stage] || stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function interestColor(level: string): string {
  if (level === "high") return "#10B981";
  if (level === "medium") return "#FBBF24";
  if (level === "low") return "#EF4444";
  return "#52525B";
}

function firmTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    vc: "VC",
    angel: "Angel",
    pe: "PE",
    corporate: "Corporate",
    family_office: "Family Office",
    other: "Other",
  };
  return labels[type] || type;
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}k`;
  return `$${amount.toLocaleString()}`;
}

// ---------------------------------------------------------------------------
// Empty form state
// ---------------------------------------------------------------------------
interface InvestorForm {
  firmName: string;
  firmType: Investor["firmType"];
  checkSizeMin: string;
  checkSizeMax: string;
  stage: string;
  leadPartner: string;
  leadPartnerEmail: string;
  interestLevel: Investor["interestLevel"];
  committedAmount: string;
  thesisFit: string;
  portfolioCompanies: string;
  website: string;
  notes: string;
  nextSteps: string;
}

const EMPTY_FORM: InvestorForm = {
  firmName: "",
  firmType: "vc",
  checkSizeMin: "",
  checkSizeMax: "",
  stage: "identified",
  leadPartner: "",
  leadPartnerEmail: "",
  interestLevel: "unknown",
  committedAmount: "",
  thesisFit: "",
  portfolioCompanies: "",
  website: "",
  notes: "",
  nextSteps: "",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function InvestorMode() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [stats, setStats] = useState<InvestorStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Detail panel
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------
  const fetchInvestors = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/investors");
      if (!res.ok) return;
      const data = await res.json();
      setInvestors(data.investors || []);
      setStats(data.stats || null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvestors();
  }, [fetchInvestors]);

  const fetchMeetings = async (investorId: string) => {
    setLoadingMeetings(true);
    try {
      const res = await fetch(`/api/crm/investors/${investorId}/meetings`);
      if (res.ok) {
        const data = await res.json();
        setMeetings(data.meetings || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMeetings(false);
    }
  };

  // -------------------------------------------------------------------------
  // Select investor
  // -------------------------------------------------------------------------
  const selectInvestor = (inv: Investor) => {
    setSelectedInvestor(inv);
    fetchMeetings(inv.id);
  };

  // -------------------------------------------------------------------------
  // Open add/edit modal
  // -------------------------------------------------------------------------
  const openAddModal = () => {
    setEditingInvestor(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (inv: Investor) => {
    setEditingInvestor(inv);
    setForm({
      firmName: inv.firmName,
      firmType: inv.firmType,
      checkSizeMin: inv.checkSizeMin ? String(inv.checkSizeMin) : "",
      checkSizeMax: inv.checkSizeMax ? String(inv.checkSizeMax) : "",
      stage: inv.stage,
      leadPartner: inv.leadPartner || "",
      leadPartnerEmail: inv.leadPartnerEmail || "",
      interestLevel: inv.interestLevel,
      committedAmount: inv.committedAmount ? String(inv.committedAmount) : "",
      thesisFit: inv.thesisFit || "",
      portfolioCompanies: inv.portfolioCompanies?.join(", ") || "",
      website: inv.website || "",
      notes: inv.notes || "",
      nextSteps: inv.nextSteps || "",
    });
    setShowModal(true);
  };

  // -------------------------------------------------------------------------
  // Save investor
  // -------------------------------------------------------------------------
  const handleSave = async () => {
    if (!form.firmName.trim()) return;
    setSaving(true);

    const payload = {
      firmName: form.firmName,
      firmType: form.firmType,
      checkSizeMin: form.checkSizeMin ? Number(form.checkSizeMin) : null,
      checkSizeMax: form.checkSizeMax ? Number(form.checkSizeMax) : null,
      stage: form.stage,
      leadPartner: form.leadPartner || null,
      leadPartnerEmail: form.leadPartnerEmail || null,
      interestLevel: form.interestLevel,
      committedAmount: form.committedAmount ? Number(form.committedAmount) : null,
      thesisFit: form.thesisFit || null,
      portfolioCompanies: form.portfolioCompanies
        ? form.portfolioCompanies.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      website: form.website || null,
      notes: form.notes || null,
      nextSteps: form.nextSteps || null,
    };

    try {
      if (editingInvestor) {
        const res = await fetch(`/api/crm/investors/${editingInvestor.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success("Investor updated");
          const data = await res.json();
          // Update in list
          setInvestors((prev) =>
            prev.map((inv) => (inv.id === editingInvestor.id ? { ...inv, ...data.investor, daysInStage: inv.daysInStage } : inv))
          );
          if (selectedInvestor?.id === editingInvestor.id) {
            setSelectedInvestor({ ...selectedInvestor, ...data.investor, daysInStage: selectedInvestor.daysInStage });
          }
        }
      } else {
        const res = await fetch("/api/crm/investors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success("Investor added");
        }
      }
      setShowModal(false);
      fetchInvestors();
    } catch {
      toast.error("Failed to save investor");
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Delete investor
  // -------------------------------------------------------------------------
  const handleDelete = async (investorId: string) => {
    try {
      const res = await fetch(`/api/crm/investors/${investorId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Investor removed");
        setSelectedInvestor(null);
        fetchInvestors();
      }
    } catch {
      toast.error("Failed to delete investor");
    }
  };

  // -------------------------------------------------------------------------
  // Group investors by stage for kanban
  // -------------------------------------------------------------------------
  const stageGroups: Record<string, Investor[]> = {};
  for (const inv of investors) {
    const stage = inv.stage || "identified";
    if (!stageGroups[stage]) stageGroups[stage] = [];
    stageGroups[stage].push(inv);
  }
  const orderedStages = INVESTOR_STAGES.filter((s) => stageGroups[s]?.length);
  // Also add any stages not in the standard list
  for (const s of Object.keys(stageGroups)) {
    if (!orderedStages.includes(s)) orderedStages.push(s);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="bg-card-bg border border-border-default rounded-card p-12 text-center">
        <p className="text-text-dim font-mono text-sm">Loading investor data...</p>
      </div>
    );
  }

  return (
    <>
      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        <KPICard label="Total Investors" value={String(stats?.totalInvestors || investors.length)} />
        <KPICard
          label="Target Raise"
          value={stats?.targetRaise ? formatCurrency(stats.targetRaise) : "$0"}
        />
        <KPICard
          label="Committed"
          value={stats?.committedCapital ? formatCurrency(stats.committedCapital) : "$0"}
          valueColor={stats?.committedCapital ? "#10B981" : undefined}
        />
        <KPICard label="Meetings This Week" value={String(stats?.meetingsThisWeek || 0)} />
        <KPICard label="Avg Days in Stage" value={String(stats?.avgDaysInStage || 0)} />
      </div>

      {/* Add investor button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={openAddModal}
          className="text-white rounded-lg px-4 py-2 text-sm font-semibold font-display"
          style={{ backgroundColor: ACCENT, cursor: "pointer" }}
        >
          + Add Investor
        </button>
      </div>

      {/* Kanban */}
      {investors.length === 0 ? (
        <div className="bg-card-bg border border-border-default rounded-card p-12 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 text-3xl"
            style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}30` }}
          >
            💼
          </div>
          <h2 className="text-xl font-bold text-foreground font-display mb-2">
            No Investors Yet
          </h2>
          <p className="text-text-dim text-sm max-w-md mx-auto mb-6 leading-relaxed">
            Start building your fundraising pipeline by adding investors.
          </p>
          <button
            onClick={openAddModal}
            className="text-white rounded-lg px-6 py-2.5 text-sm font-semibold font-display"
            style={{ backgroundColor: ACCENT, cursor: "pointer" }}
          >
            Add Your First Investor
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3" style={{ minWidth: orderedStages.length * 260 }}>
            {orderedStages.map((stage) => (
              <div
                key={stage}
                className="flex-shrink-0 bg-card-bg border border-border-default rounded-card p-3"
                style={{ width: 250 }}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-[10px] uppercase tracking-[2px] text-text-muted font-semibold truncate">
                    {stageLabel(stage)}
                  </span>
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{ background: `${ACCENT}20`, color: ACCENT }}
                  >
                    {stageGroups[stage]?.length || 0}
                  </span>
                </div>
                <div className="space-y-2">
                  {(stageGroups[stage] || []).map((inv) => (
                    <button
                      key={inv.id}
                      onClick={() => selectInvestor(inv)}
                      className="w-full text-left bg-background border border-border-default rounded-lg p-3 transition-all hover:-translate-y-0.5"
                      style={{
                        cursor: "pointer",
                        borderColor: selectedInvestor?.id === inv.id ? `${ACCENT}60` : undefined,
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs text-foreground font-medium leading-tight truncate">
                          {inv.firmName}
                        </span>
                        <span
                          className="flex-shrink-0 w-2.5 h-2.5 rounded-full mt-0.5"
                          style={{
                            background: interestColor(inv.interestLevel),
                            boxShadow: `0 0 6px ${interestColor(inv.interestLevel)}40`,
                          }}
                          title={`Interest: ${inv.interestLevel}`}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[11px] font-mono text-text-body">
                          {inv.checkSizeMin || inv.checkSizeMax
                            ? `${inv.checkSizeMin ? formatCurrency(inv.checkSizeMin) : "?"} – ${inv.checkSizeMax ? formatCurrency(inv.checkSizeMax) : "?"}`
                            : "—"}
                        </span>
                        <span className="text-[10px] text-text-dim">
                          {inv.daysInStage !== null ? `${inv.daysInStage}d` : ""}
                        </span>
                      </div>
                      {inv.leadPartner && (
                        <div className="text-[10px] text-text-dim mt-1 truncate">
                          {inv.leadPartner}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail Panel Slide-out */}
      {selectedInvestor && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={() => setSelectedInvestor(null)}
          />
          <div
            className="fixed top-0 right-0 z-50 h-full overflow-y-auto border-l border-border-default"
            style={{ width: 420, background: "#09090B" }}
          >
            <div className="p-6 space-y-5">
              <button
                onClick={() => setSelectedInvestor(null)}
                className="text-text-dim hover:text-foreground text-lg absolute top-4 right-4 cursor-pointer bg-transparent border-none"
              >
                ✕
              </button>

              {/* Header */}
              <div>
                <h2 className="text-lg font-bold text-foreground font-display pr-8">
                  {selectedInvestor.firmName}
                </h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded"
                    style={{ background: `${ACCENT}20`, color: ACCENT }}
                  >
                    {stageLabel(selectedInvestor.stage)}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-background border border-border-default text-text-body">
                    {firmTypeLabel(selectedInvestor.firmType)}
                  </span>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded"
                    style={{
                      background: `${interestColor(selectedInvestor.interestLevel)}20`,
                      color: interestColor(selectedInvestor.interestLevel),
                    }}
                  >
                    {selectedInvestor.interestLevel} interest
                  </span>
                </div>
              </div>

              {/* Firm Info */}
              <div className="bg-card-bg border border-border-default rounded-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: ACCENT }} />
                  <span className="text-[10px] uppercase tracking-[2px] font-semibold" style={{ color: ACCENT }}>
                    Firm Details
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  {selectedInvestor.leadPartner && (
                    <div className="flex justify-between">
                      <span className="text-text-dim">Lead Partner</span>
                      <span className="text-text-body">{selectedInvestor.leadPartner}</span>
                    </div>
                  )}
                  {selectedInvestor.leadPartnerEmail && (
                    <div className="flex justify-between">
                      <span className="text-text-dim">Email</span>
                      <span className="text-text-body font-mono">{selectedInvestor.leadPartnerEmail}</span>
                    </div>
                  )}
                  {(selectedInvestor.checkSizeMin || selectedInvestor.checkSizeMax) && (
                    <div className="flex justify-between">
                      <span className="text-text-dim">Check Size</span>
                      <span className="text-text-body font-mono">
                        {selectedInvestor.checkSizeMin ? formatCurrency(selectedInvestor.checkSizeMin) : "?"} – {selectedInvestor.checkSizeMax ? formatCurrency(selectedInvestor.checkSizeMax) : "?"}
                      </span>
                    </div>
                  )}
                  {selectedInvestor.committedAmount != null && selectedInvestor.committedAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-text-dim">Committed</span>
                      <span className="text-green-400 font-mono">{formatCurrency(selectedInvestor.committedAmount)}</span>
                    </div>
                  )}
                  {selectedInvestor.website && (
                    <div className="flex justify-between">
                      <span className="text-text-dim">Website</span>
                      <a
                        href={selectedInvestor.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono truncate max-w-[200px]"
                        style={{ color: ACCENT }}
                      >
                        {selectedInvestor.website.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  )}
                  {selectedInvestor.daysInStage !== null && (
                    <div className="flex justify-between">
                      <span className="text-text-dim">Days in Stage</span>
                      <span className="text-text-body font-mono">{selectedInvestor.daysInStage}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Thesis Fit */}
              {selectedInvestor.thesisFit && (
                <div className="bg-card-bg border border-border-default rounded-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: ACCENT }} />
                    <span className="text-[10px] uppercase tracking-[2px] font-semibold" style={{ color: ACCENT }}>
                      Thesis Fit
                    </span>
                  </div>
                  <p className="text-xs text-text-body leading-relaxed">{selectedInvestor.thesisFit}</p>
                </div>
              )}

              {/* Portfolio Companies */}
              {selectedInvestor.portfolioCompanies && selectedInvestor.portfolioCompanies.length > 0 && (
                <div className="bg-card-bg border border-border-default rounded-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: ACCENT }} />
                    <span className="text-[10px] uppercase tracking-[2px] font-semibold" style={{ color: ACCENT }}>
                      Portfolio Companies
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedInvestor.portfolioCompanies.map((co, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-background border border-border-default text-text-body">
                        {co}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Meeting History */}
              <div className="bg-card-bg border border-border-default rounded-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: ACCENT }} />
                  <span className="text-[10px] uppercase tracking-[2px] font-semibold" style={{ color: ACCENT }}>
                    Meetings
                  </span>
                </div>
                {loadingMeetings ? (
                  <p className="text-text-dim text-xs font-mono">Loading...</p>
                ) : meetings.length === 0 ? (
                  <p className="text-text-dim text-xs font-mono">No meetings recorded</p>
                ) : (
                  <div className="space-y-2">
                    {meetings.map((m) => (
                      <div key={m.id} className="bg-background border border-border-default rounded-lg p-2.5">
                        <div className="flex justify-between text-[10px]">
                          <span className="font-semibold text-text-body">{m.meetingType}</span>
                          <span className="text-text-dim font-mono">{new Date(m.meetingDate).toLocaleDateString()}</span>
                        </div>
                        {m.notes && <p className="text-[11px] text-text-body mt-1 leading-relaxed">{m.notes}</p>}
                        {m.sentiment && (
                          <span className="text-[9px] mt-1 inline-block px-1.5 py-0.5 rounded bg-background text-text-dim">
                            {m.sentiment}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedInvestor.notes && (
                <div className="bg-card-bg border border-border-default rounded-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: ACCENT }} />
                    <span className="text-[10px] uppercase tracking-[2px] font-semibold" style={{ color: ACCENT }}>
                      Notes
                    </span>
                  </div>
                  <p className="text-xs text-text-body leading-relaxed whitespace-pre-wrap">{selectedInvestor.notes}</p>
                </div>
              )}

              {/* Next Steps */}
              {selectedInvestor.nextSteps && (
                <div className="bg-card-bg border border-border-default rounded-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: ACCENT }} />
                    <span className="text-[10px] uppercase tracking-[2px] font-semibold" style={{ color: ACCENT }}>
                      Next Steps
                    </span>
                  </div>
                  <p className="text-xs text-text-body leading-relaxed">{selectedInvestor.nextSteps}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(selectedInvestor)}
                  className="flex-1 text-sm font-semibold font-display py-2 rounded-lg border cursor-pointer"
                  style={{ borderColor: `${ACCENT}40`, color: ACCENT, background: `${ACCENT}10` }}
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete ${selectedInvestor.firmName}?`)) {
                      handleDelete(selectedInvestor.id);
                    }
                  }}
                  className="px-4 text-sm font-semibold font-display py-2 rounded-lg border cursor-pointer"
                  style={{ borderColor: "rgba(239,68,68,0.3)", color: "#EF4444", background: "rgba(239,68,68,0.1)" }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <>
          <div
            className="fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => setShowModal(false)}
          />
          <div
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[85vh] overflow-y-auto border border-border-default rounded-card p-6"
            style={{ background: "#09090B" }}
          >
            <h2 className="text-lg font-bold text-foreground font-display mb-5">
              {editingInvestor ? "Edit Investor" : "Add Investor"}
            </h2>

            <div className="space-y-4">
              {/* Firm Name */}
              <div>
                <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Firm Name *</label>
                <input
                  value={form.firmName}
                  onChange={(e) => setForm({ ...form, firmName: e.target.value })}
                  className="w-full bg-background border border-border-default rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
                  style={{ borderColor: form.firmName ? undefined : "rgba(239,68,68,0.3)" }}
                />
              </div>

              {/* Firm Type + Interest */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Firm Type</label>
                  <select
                    value={form.firmType}
                    onChange={(e) => setForm({ ...form, firmType: e.target.value as typeof form.firmType })}
                    className="w-full bg-background border border-border-default rounded-lg px-3 py-2 text-sm text-foreground"
                  >
                    <option value="vc">VC</option>
                    <option value="angel">Angel</option>
                    <option value="pe">PE</option>
                    <option value="corporate">Corporate</option>
                    <option value="family_office">Family Office</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Interest Level</label>
                  <select
                    value={form.interestLevel}
                    onChange={(e) => setForm({ ...form, interestLevel: e.target.value as typeof form.interestLevel })}
                    className="w-full bg-background border border-border-default rounded-lg px-3 py-2 text-sm text-foreground"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              {/* Stage */}
              <div>
                <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Stage</label>
                <select
                  value={form.stage}
                  onChange={(e) => setForm({ ...form, stage: e.target.value })}
                  className="w-full bg-background border border-border-default rounded-lg px-3 py-2 text-sm text-foreground"
                >
                  {INVESTOR_STAGES.map((s) => (
                    <option key={s} value={s}>{stageLabel(s)}</option>
                  ))}
                </select>
              </div>

              {/* Check Size */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Check Size Min ($)</label>
                  <input
                    type="number"
                    value={form.checkSizeMin}
                    onChange={(e) => setForm({ ...form, checkSizeMin: e.target.value })}
                    className="w-full bg-background border border-border-default rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
                    placeholder="100000"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Check Size Max ($)</label>
                  <input
                    type="number"
                    value={form.checkSizeMax}
                    onChange={(e) => setForm({ ...form, checkSizeMax: e.target.value })}
                    className="w-full bg-background border border-border-default rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
                    placeholder="500000"
                  />
                </div>
              </div>

              {/* Lead Partner */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Lead Partner</label>
                  <input
                    value={form.leadPartner}
                    onChange={(e) => setForm({ ...form, leadPartner: e.target.value })}
                    className="w-full bg-background border border-border-default rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Partner Email</label>
                  <input
                    type="email"
                    value={form.leadPartnerEmail}
                    onChange={(e) => setForm({ ...form, leadPartnerEmail: e.target.value })}
                    className="w-full bg-background border border-border-default rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
                  />
                </div>
              </div>

              {/* Committed Amount */}
              <div>
                <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Committed Amount ($)</label>
                <input
                  type="number"
                  value={form.committedAmount}
                  onChange={(e) => setForm({ ...form, committedAmount: e.target.value })}
                  className="w-full bg-background border border-border-default rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
                  placeholder="0"
                />
              </div>

              {/* Thesis Fit */}
              <div>
                <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Thesis Fit</label>
                <textarea
                  value={form.thesisFit}
                  onChange={(e) => setForm({ ...form, thesisFit: e.target.value })}
                  rows={2}
                  className="w-full bg-background border border-border-default rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none resize-none"
                  placeholder="Why this investor is a good fit..."
                />
              </div>

              {/* Portfolio Companies */}
              <div>
                <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Portfolio Companies (comma-separated)</label>
                <input
                  value={form.portfolioCompanies}
                  onChange={(e) => setForm({ ...form, portfolioCompanies: e.target.value })}
                  className="w-full bg-background border border-border-default rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
                  placeholder="Stripe, Notion, Linear"
                />
              </div>

              {/* Website */}
              <div>
                <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Website</label>
                <input
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className="w-full bg-background border border-border-default rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
                  placeholder="https://..."
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-background border border-border-default rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none resize-none"
                />
              </div>

              {/* Next Steps */}
              <div>
                <label className="block text-[10px] uppercase tracking-[2px] text-text-muted mb-1">Next Steps</label>
                <input
                  value={form.nextSteps}
                  onChange={(e) => setForm({ ...form, nextSteps: e.target.value })}
                  className="w-full bg-background border border-border-default rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
                />
              </div>
            </div>

            {/* Modal actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-border-default text-text-body text-sm font-display cursor-pointer bg-transparent"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.firmName.trim()}
                className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold font-display disabled:opacity-50"
                style={{ backgroundColor: ACCENT, cursor: saving ? "not-allowed" : "pointer" }}
              >
                {saving ? "Saving..." : editingInvestor ? "Update" : "Add Investor"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KPICard({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-card-bg border border-border-default rounded-card p-4 text-center">
      <div className="text-2xl font-bold font-mono" style={{ color: valueColor || "#FAFAFA" }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-[2px] text-text-muted mt-1">{label}</div>
    </div>
  );
}
