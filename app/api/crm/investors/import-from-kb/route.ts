import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, investors } from "@/lib/db/schema";
import { getSupabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase/storage";
import * as XLSX from "xlsx";

const TEAM_ID = "00000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Column mapping (mirrors client-side Hitlab format)
// ---------------------------------------------------------------------------
const COLUMN_MAP: Record<string, string> = {
  firm: "firmName", "firm name": "firmName", fund: "firmName",
  "fund name": "firmName", investor: "firmName", "investor name": "firmName",
  name: "firmName", company: "firmName", "company name": "firmName",
  "company (link to site)": "firmName", "fund/firm": "firmName",
  type: "firmType", "firm type": "firmType", "fund type": "firmType",
  "investor type": "firmType",
  "check size min": "checkSizeMin", "min check": "checkSizeMin",
  "check size max": "checkSizeMax", "max check": "checkSizeMax",
  "check size": "checkSizeMax",
  stage: "stage", status: "stage", "pipeline stage": "stage",
  "lead partner": "leadPartner", partner: "leadPartner",
  "contact name": "leadPartner", lead: "leadPartner",
  "li contact #1 name": "leadPartner", "contact #1 name": "leadPartner",
  "primary contact": "leadPartner",
  email: "leadPartnerEmail", "partner email": "leadPartnerEmail",
  "contact email": "leadPartnerEmail",
  "li contact #1 email": "leadPartnerEmail", "contact #1 email": "leadPartnerEmail",
  "li contact #2 name": "_contact2Name", "contact #2 name": "_contact2Name",
  "li contact #2 email": "_contact2Email", "contact #2 email": "_contact2Email",
  interest: "interestLevel", "interest level": "interestLevel",
  committed: "committedAmount", "committed amount": "committedAmount",
  "thesis fit": "thesisFit", thesis: "thesisFit",
  description: "thesisFit", "fund description": "thesisFit",
  focus: "_focus", "investment focus": "_focus", sector: "_focus",
  portfolio: "portfolioCompanies", "portfolio companies": "portfolioCompanies",
  website: "website", url: "website", site: "website",
  notes: "notes", note: "notes", comments: "notes",
  "next steps": "nextSteps", "next step": "nextSteps",
  city: "_city", location: "_city",
  state: "_state", country: "_country", msa: "_msa", csa: "_csa",
  total_investments: "_totalInvestments", "total investments": "_totalInvestments",
  total_rounds: "_totalRounds", "total rounds": "_totalRounds",
  "emailed-1?": "_skip", "emailed-2?": "_skip",
};

const TYPE_ALIASES: Record<string, string> = {
  vc: "vc", venture: "vc", "venture capital": "vc",
  angel: "angel", angels: "angel",
  pe: "pe", "private equity": "pe",
  corporate: "corporate", cvc: "corporate", strategic: "corporate",
  "family office": "family_office", family_office: "family_office",
  accelerator: "other", incubator: "other", government: "other",
  grant: "other", other: "other",
};

const STAGE_ALIASES: Record<string, string> = {
  identified: "identified", new: "identified", prospect: "identified",
  researching: "researching", research: "researching",
  outreach: "outreach", contacted: "outreach",
  "first meeting": "first_meeting", first_meeting: "first_meeting",
  intro: "first_meeting",
  "partner meeting": "partner_meeting", partner_meeting: "partner_meeting",
  "due diligence": "due_diligence", due_diligence: "due_diligence",
  dd: "due_diligence",
  "term sheet": "term_sheet", term_sheet: "term_sheet",
  closed: "closed_committed", committed: "closed_committed",
  closed_committed: "closed_committed",
  passed: "passed", pass: "passed", declined: "passed",
};

const INTEREST_ALIASES: Record<string, string> = {
  high: "high", "very interested": "high", strong: "high",
  medium: "medium", moderate: "medium", warm: "medium",
  low: "low", cold: "low",
  unknown: "unknown", "": "unknown", tbd: "unknown",
};

const HEADER_KEYWORDS = [
  "company", "firm", "fund", "investor", "name", "email", "partner",
  "contact", "stage", "status", "notes", "check size",
  "amount", "website", "city", "interest", "type",
];

function isHeaderRow(values: string[]): boolean {
  const normalized = values.map((v) => String(v).toLowerCase().trim());
  let matches = 0;
  for (const kw of HEADER_KEYWORDS) {
    if (normalized.some((v) => v.includes(kw))) matches++;
  }
  return matches >= 2;
}

function parseNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const str = String(val).replace(/[$,\s]/g, "");
  const num = Number(str);
  return isNaN(num) ? null : Math.round(num);
}

// ---------------------------------------------------------------------------
// GET — list available XLSX/CSV documents from knowledge base
// ---------------------------------------------------------------------------
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const docs = await db
    .select({
      id: documents.id,
      filename: documents.filename,
      fileType: documents.fileType,
      status: documents.status,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(
      and(
        eq(documents.teamId, TEAM_ID),
      )
    );

  const spreadsheets = docs.filter(
    (d) =>
      d.fileType === "xlsx" ||
      d.fileType === "csv" ||
      d.fileType === "xls" ||
      d.filename.endsWith(".xlsx") ||
      d.filename.endsWith(".csv") ||
      d.filename.endsWith(".xls")
  );

  return NextResponse.json({ documents: spreadsheets });
}

// ---------------------------------------------------------------------------
// POST — import a specific KB document into investor CRM
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { documentId } = body;

  if (!documentId) {
    return NextResponse.json(
      { error: "documentId is required" },
      { status: 400 }
    );
  }

  // 1. Get document record
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.teamId, TEAM_ID)));

  if (!doc) {
    return NextResponse.json(
      { error: "Document not found" },
      { status: 404 }
    );
  }

  const storagePath = (doc.metadata as Record<string, unknown>)?.storagePath as string | undefined;
  if (!storagePath) {
    return NextResponse.json(
      { error: "No storage path found for document" },
      { status: 400 }
    );
  }

  // 2. Download from Supabase storage
  const { data: fileData, error: downloadError } = await getSupabaseAdmin()
    .storage.from(STORAGE_BUCKET)
    .download(storagePath);

  if (downloadError || !fileData) {
    return NextResponse.json(
      { error: `Download failed: ${downloadError?.message}` },
      { status: 500 }
    );
  }

  // 3. Parse spreadsheet
  const buffer = Buffer.from(await fileData.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];

  const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
  });

  // Find header row
  let headerIdx = 0;
  for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
    const row = rawRows[i];
    if (Array.isArray(row) && isHeaderRow(row.map(String))) {
      headerIdx = i;
      break;
    }
  }

  const headerRow = rawRows[headerIdx].map((v) =>
    String(v).trim().replace(/:$/, "").trim()
  );

  // Build data rows
  const dataRows: Record<string, string>[] = [];
  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const raw = rawRows[i];
    if (!Array.isArray(raw)) continue;
    const hasData = raw.some((cell) => String(cell).trim() !== "");
    if (!hasData) continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headerRow.length; c++) {
      obj[headerRow[c] || `col_${c}`] = String(raw[c] ?? "").trim();
    }
    dataRows.push(obj);
  }

  // Column mapping
  const headers = headerRow.filter(Boolean);
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const normalized = header.toLowerCase().trim().replace(/:$/, "").trim();
    if (COLUMN_MAP[normalized]) {
      mapping[header] = COLUMN_MAP[normalized];
      continue;
    }
    for (const [key, field] of Object.entries(COLUMN_MAP)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        mapping[header] = field;
        break;
      }
    }
  }

  // Ensure firmName is mapped
  let firmNameCol = headers.find((h) => mapping[h] === "firmName");
  if (!firmNameCol) {
    firmNameCol = headers[0];
    mapping[firmNameCol] = "firmName";
  }

  // Filter to rows with firm name
  const filtered = dataRows.filter(
    (row) =>
      row[firmNameCol!] &&
      row[firmNameCol!] !== "—" &&
      row[firmNameCol!] !== "-"
  );

  // 4. Create investor records
  let created = 0;
  let failed = 0;
  let skipped = 0;

  // Get existing investor names to avoid duplicates
  const existingInvestors = await db
    .select({ firmName: investors.firmName })
    .from(investors)
    .where(eq(investors.teamId, TEAM_ID));
  const existingNames = new Set(
    existingInvestors.map((i) => i.firmName.toLowerCase().trim())
  );

  for (const row of filtered) {
    const firmName = String(row[firmNameCol!] || "").trim();
    if (!firmName) continue;

    // Skip duplicates
    if (existingNames.has(firmName.toLowerCase().trim())) {
      skipped++;
      continue;
    }

    const getVal = (field: string) => {
      const col = headers.find((h) => mapping[h] === field);
      return col ? String(row[col] || "").trim() : "";
    };

    const stageRaw = getVal("stage").toLowerCase();
    const interestRaw = getVal("interestLevel").toLowerCase();
    const typeRaw = getVal("firmType").toLowerCase();

    // Build notes
    const noteParts: string[] = [];
    const city = getVal("_city");
    const state = getVal("_state");
    const country = getVal("_country");
    const locationParts = [city, state, country].filter(Boolean);
    if (locationParts.length > 0)
      noteParts.push(`Location: ${locationParts.join(", ")}`);

    const focus = getVal("_focus");
    if (focus) noteParts.push(`Focus: ${focus}`);

    // Sector columns
    const sectorCols: string[] = [];
    for (const h of headers) {
      const val = String(row[h] || "").trim();
      if (!mapping[h] && val && val !== "0" && /^\d+$/.test(val)) {
        sectorCols.push(`${h} (${val})`);
      }
    }
    if (sectorCols.length > 0)
      noteParts.push(`Sectors: ${sectorCols.join(", ")}`);

    const totalInv = getVal("_totalInvestments");
    const totalRounds = getVal("_totalRounds");
    if (totalInv) noteParts.push(`Total investments: ${totalInv}`);
    if (totalRounds) noteParts.push(`Total rounds: ${totalRounds}`);

    const contact2Name = getVal("_contact2Name");
    const contact2Email = getVal("_contact2Email");
    if (contact2Name || contact2Email) {
      noteParts.push(
        `Contact #2: ${[contact2Name, contact2Email].filter(Boolean).join(" — ")}`
      );
    }

    const mappedNotes = getVal("notes");
    if (mappedNotes) noteParts.push(mappedNotes);

    // Unmapped text columns
    for (const h of headers) {
      if (
        !mapping[h] &&
        row[h] &&
        String(row[h]).trim() &&
        !/^\d+$/.test(String(row[h]).trim())
      ) {
        noteParts.push(`${h}: ${String(row[h]).trim()}`);
      }
    }

    try {
      await db.insert(investors).values({
        teamId: TEAM_ID,
        firmName,
        firmType: (TYPE_ALIASES[typeRaw] || "vc") as "vc" | "angel" | "pe" | "corporate" | "family_office" | "other",
        checkSizeMin: parseNumber(getVal("checkSizeMin")),
        checkSizeMax: parseNumber(getVal("checkSizeMax")),
        stage: (STAGE_ALIASES[stageRaw] || "identified") as "identified" | "researching" | "outreach" | "first_meeting" | "partner_meeting" | "due_diligence" | "term_sheet" | "closed_committed" | "passed",
        leadPartner: getVal("leadPartner") || null,
        leadPartnerEmail: getVal("leadPartnerEmail") || null,
        interestLevel: (INTEREST_ALIASES[interestRaw] || "unknown") as "high" | "medium" | "low" | "unknown",
        committedAmount: parseNumber(getVal("committedAmount")),
        thesisFit:
          [getVal("thesisFit"), focus ? `Focus: ${focus}` : ""]
            .filter(Boolean)
            .join(". ") || null,
        portfolioCompanies: getVal("portfolioCompanies")
          ? getVal("portfolioCompanies").split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        website: getVal("website") || null,
        notes: noteParts.length > 0 ? noteParts.join("\n") : null,
        nextSteps: getVal("nextSteps") || null,
      });
      existingNames.add(firmName.toLowerCase().trim());
      created++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    created,
    failed,
    skipped,
    total: filtered.length,
    documentName: doc.filename,
  });
}
