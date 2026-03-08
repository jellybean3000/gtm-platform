"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

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

  // Import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<Record<string, string>[] | null>(null);
  const [importing, setImporting] = useState(false);

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
  // XLSX Import
  // -------------------------------------------------------------------------
  const COLUMN_MAP: Record<string, string> = {
    // firmName
    "firm": "firmName", "firm name": "firmName", "fund": "firmName", "fund name": "firmName",
    "investor": "firmName", "investor name": "firmName", "name": "firmName", "company": "firmName",
    "company (link to site)": "firmName", "company name": "firmName", "fund/firm": "firmName",
    // firmType
    "type": "firmType", "firm type": "firmType", "fund type": "firmType", "investor type": "firmType",
    // checkSizeMin
    "check size min": "checkSizeMin", "min check": "checkSizeMin", "check min": "checkSizeMin",
    "minimum check": "checkSizeMin", "min investment": "checkSizeMin",
    // checkSizeMax
    "check size max": "checkSizeMax", "max check": "checkSizeMax", "check max": "checkSizeMax",
    "maximum check": "checkSizeMax", "max investment": "checkSizeMax", "check size": "checkSizeMax",
    // stage
    "stage": "stage", "status": "stage", "pipeline stage": "stage", "deal stage": "stage",
    // leadPartner
    "lead partner": "leadPartner", "partner": "leadPartner", "contact": "leadPartner",
    "contact name": "leadPartner", "lead": "leadPartner", "gp": "leadPartner",
    "contact name (linkedin)": "leadPartner", "contact person": "leadPartner",
    // leadPartnerEmail
    "email": "leadPartnerEmail", "partner email": "leadPartnerEmail", "contact email": "leadPartnerEmail",
    "email:": "leadPartnerEmail",
    // interestLevel
    "interest": "interestLevel", "interest level": "interestLevel",
    // committedAmount
    "committed": "committedAmount", "committed amount": "committedAmount", "amount committed": "committedAmount",
    "commitment": "committedAmount", "amount": "committedAmount",
    // thesisFit
    "thesis fit": "thesisFit", "thesis": "thesisFit", "fit": "thesisFit",
    // portfolioCompanies
    "portfolio": "portfolioCompanies", "portfolio companies": "portfolioCompanies",
    // website
    "website": "website", "url": "website", "site": "website",
    // notes
    "notes": "notes", "note": "notes", "comments": "notes", "comment": "notes", "notes:": "notes",
    // nextSteps
    "next steps": "nextSteps", "next step": "nextSteps", "action items": "nextSteps",
    "next action": "nextSteps", "next action:": "nextSteps", "action": "nextSteps",
    // city (store in notes as extra context)
    "city": "_city", "city:": "_city", "location": "_city",
  };

  const STAGE_ALIASES: Record<string, string> = {
    "identified": "identified", "new": "identified", "prospect": "identified",
    "researching": "researching", "research": "researching",
    "outreach": "outreach", "contacted": "outreach", "reaching out": "outreach",
    "first meeting": "first_meeting", "first_meeting": "first_meeting", "intro": "first_meeting", "intro meeting": "first_meeting",
    "partner meeting": "partner_meeting", "partner_meeting": "partner_meeting", "partners": "partner_meeting",
    "due diligence": "due_diligence", "due_diligence": "due_diligence", "dd": "due_diligence", "diligence": "due_diligence",
    "term sheet": "term_sheet", "term_sheet": "term_sheet", "terms": "term_sheet",
    "closed": "closed_committed", "committed": "closed_committed", "closed_committed": "closed_committed", "closed/committed": "closed_committed",
    "passed": "passed", "pass": "passed", "declined": "passed", "dead": "passed",
  };

  const INTEREST_ALIASES: Record<string, Investor["interestLevel"]> = {
    "high": "high", "very interested": "high", "strong": "high", "hot": "high",
    "medium": "medium", "moderate": "medium", "warm": "medium", "interested": "medium",
    "low": "low", "cold": "low", "not interested": "low",
    "unknown": "unknown", "": "unknown", "tbd": "unknown",
  };

  const TYPE_ALIASES: Record<string, Investor["firmType"]> = {
    "vc": "vc", "venture": "vc", "venture capital": "vc",
    "angel": "angel", "angels": "angel",
    "pe": "pe", "private equity": "pe",
    "corporate": "corporate", "cvc": "corporate", "strategic": "corporate",
    "family office": "family_office", "family_office": "family_office", "fo": "family_office",
    "other": "other",
  };

  const parseNumber = (val: unknown): number | null => {
    if (val === null || val === undefined || val === "") return null;
    const str = String(val).replace(/[$,\s]/g, "");
    const num = Number(str);
    return isNaN(num) ? null : Math.round(num);
  };

  // Keywords that indicate a real header row
  const HEADER_KEYWORDS = [
    "company", "firm", "fund", "investor", "name", "email", "partner",
    "contact", "stage", "status", "notes", "next action", "check size",
    "amount", "website", "city", "interest", "type",
  ];

  const isHeaderRow = (values: string[]): boolean => {
    const normalized = values.map((v) => String(v).toLowerCase().trim());
    let matches = 0;
    for (const kw of HEADER_KEYWORDS) {
      if (normalized.some((v) => v.includes(kw))) matches++;
    }
    return matches >= 2; // at least 2 recognizable column names
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];

        // Parse as raw array of arrays to find the real header row
        const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, {
          header: 1,
          defval: "",
        });

        // Scan for the header row (first row with 2+ recognizable column names)
        let headerIdx = 0;
        for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
          const row = rawRows[i];
          if (Array.isArray(row) && isHeaderRow(row.map(String))) {
            headerIdx = i;
            break;
          }
        }

        // Extract headers from the detected row
        const headerRow = rawRows[headerIdx].map((v) =>
          String(v).trim().replace(/:$/, "").trim()
        );

        // Build data rows from everything after the header
        const dataRows: Record<string, string>[] = [];
        for (let i = headerIdx + 1; i < rawRows.length; i++) {
          const raw = rawRows[i];
          if (!Array.isArray(raw)) continue;
          // Skip empty rows
          const hasData = raw.some((cell) => String(cell).trim() !== "");
          if (!hasData) continue;

          const obj: Record<string, string> = {};
          for (let c = 0; c < headerRow.length; c++) {
            const colName = headerRow[c] || `col_${c}`;
            obj[colName] = String(raw[c] ?? "").trim();
          }
          dataRows.push(obj);
        }

        // Filter to rows that have a non-empty value in the first column (firm name)
        const firmCol = headerRow[0];
        const filtered = dataRows.filter(
          (row) => row[firmCol] && row[firmCol] !== "—" && row[firmCol] !== "-"
        );

        if (filtered.length === 0) {
          toast.error("No investor data found in spreadsheet");
          return;
        }

        setImportPreview(filtered);
      } catch {
        toast.error("Failed to parse spreadsheet");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleImport = async () => {
    if (!importPreview || importPreview.length === 0) return;
    setImporting(true);

    // Detect column mapping from headers — try exact match then partial match
    const headers = Object.keys(importPreview[0]);
    const mapping: Record<string, string> = {};
    for (const header of headers) {
      const normalized = header.toLowerCase().trim().replace(/:$/, "").trim();
      // Exact match first
      if (COLUMN_MAP[normalized]) {
        mapping[header] = COLUMN_MAP[normalized];
        continue;
      }
      // Partial match: check if any COLUMN_MAP key is contained in the header
      for (const [key, field] of Object.entries(COLUMN_MAP)) {
        if (normalized.includes(key) || key.includes(normalized)) {
          mapping[header] = field;
          break;
        }
      }
    }

    // If no firmName mapped, use the first column
    let firmNameCol = headers.find((h) => mapping[h] === "firmName");
    if (!firmNameCol) {
      firmNameCol = headers[0];
      mapping[firmNameCol] = "firmName";
    }

    let created = 0;
    let failed = 0;

    for (const row of importPreview) {
      const firmName = String(row[firmNameCol] || "").trim();
      if (!firmName) continue;

      const getVal = (field: string) => {
        const col = headers.find((h) => mapping[h] === field);
        return col ? String(row[col] || "").trim() : "";
      };

      const stageRaw = getVal("stage").toLowerCase();
      const interestRaw = getVal("interestLevel").toLowerCase();
      const typeRaw = getVal("firmType").toLowerCase();

      // Build notes from mapped notes + city + any unmapped columns with data
      const noteParts: string[] = [];
      const city = getVal("_city");
      if (city) noteParts.push(`City: ${city}`);
      const mappedNotes = getVal("notes");
      if (mappedNotes) noteParts.push(mappedNotes);
      // Include unmapped columns with data as extra context
      for (const h of headers) {
        if (!mapping[h] && row[h] && String(row[h]).trim()) {
          noteParts.push(`${h}: ${String(row[h]).trim()}`);
        }
      }

      const payload = {
        firmName,
        firmType: TYPE_ALIASES[typeRaw] || "vc",
        checkSizeMin: parseNumber(getVal("checkSizeMin")),
        checkSizeMax: parseNumber(getVal("checkSizeMax")),
        stage: STAGE_ALIASES[stageRaw] || "identified",
        leadPartner: getVal("leadPartner") || null,
        leadPartnerEmail: getVal("leadPartnerEmail") || null,
        interestLevel: INTEREST_ALIASES[interestRaw] || "unknown",
        committedAmount: parseNumber(getVal("committedAmount")),
        thesisFit: getVal("thesisFit") || null,
        portfolioCompanies: getVal("portfolioCompanies")
          ? getVal("portfolioCompanies").split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        website: getVal("website") || null,
        notes: noteParts.length > 0 ? noteParts.join("\n") : null,
        nextSteps: getVal("nextSteps") || null,
      };

      try {
        const res = await fetch("/api/crm/investors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) created++;
        else failed++;
      } catch {
        failed++;
      }
    }

    toast.success(`Imported ${created} investors${failed > 0 ? `, ${failed} failed` : ""}`);
    setImportPreview(null);
    setImporting(false);
    fetchInvestors();
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

      {/* Action buttons */}
      <div className="flex justify-end gap-2 mb-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv,.xls"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg px-4 py-2 text-sm font-semibold font-display border"
          style={{
            borderColor: `${ACCENT}40`,
            color: ACCENT,
            background: `${ACCENT}10`,
            cursor: "pointer",
          }}
        >
          Import Spreadsheet
        </button>
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

      {/* Import Preview Modal */}
      {importPreview && (
        <>
          <div
            className="fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => setImportPreview(null)}
          />
          <div
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-border-default rounded-card p-6"
            style={{ background: "#09090B" }}
          >
            <h2 className="text-lg font-bold text-foreground font-display mb-2">
              Import Preview
            </h2>
            <p className="text-text-dim text-sm mb-4">
              Found <span className="text-foreground font-semibold">{importPreview.length}</span> rows.
              Columns detected: <span className="font-mono text-text-body">{Object.keys(importPreview[0]).join(", ")}</span>
            </p>

            {/* Preview table */}
            <div className="overflow-x-auto border border-border-default rounded-lg mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                    {Object.keys(importPreview[0]).slice(0, 6).map((col) => (
                      <th key={col} className="text-left px-3 py-2 text-text-muted font-mono font-normal whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                    {Object.keys(importPreview[0]).length > 6 && (
                      <th className="text-left px-3 py-2 text-text-dim font-mono font-normal">
                        +{Object.keys(importPreview[0]).length - 6} more
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {importPreview.slice(0, 5).map((row, i) => (
                    <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                      {Object.keys(importPreview[0]).slice(0, 6).map((col) => (
                        <td key={col} className="px-3 py-2 text-text-body whitespace-nowrap max-w-[150px] truncate">
                          {String(row[col] || "—")}
                        </td>
                      ))}
                      {Object.keys(importPreview[0]).length > 6 && (
                        <td className="px-3 py-2 text-text-dim">...</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {importPreview.length > 5 && (
                <div className="px-3 py-2 text-text-dim text-[10px] font-mono" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                  ...and {importPreview.length - 5} more rows
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setImportPreview(null)}
                className="flex-1 py-2.5 rounded-lg border border-border-default text-text-body text-sm font-display cursor-pointer bg-transparent"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold font-display disabled:opacity-50"
                style={{ backgroundColor: ACCENT, cursor: importing ? "not-allowed" : "pointer" }}
              >
                {importing ? "Importing..." : `Import ${importPreview.length} Investors`}
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
