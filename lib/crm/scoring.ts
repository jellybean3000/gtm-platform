import {
  queryKnowledge,
} from "@/lib/knowledge/retrieve";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface DealForScoring {
  hubspotDealId: string;
  dealName: string;
  amount: string | null;
  stage: string | null;
  daysInStage: number | null;
  closeDate: Date | null;
}

export interface ActivityForScoring {
  type: string;
  dealHubspotId: string | null;
  contactHubspotId: string | null;
  occurredAt: Date | null;
}

export interface DealHealthResult {
  score: number;
  color: "green" | "yellow" | "red";
  label: string;
  riskFactors: string[];
}

export interface ICPMatchResult {
  score: number;
  matchingCriteria: string[];
  gaps: string[];
  icpSourcesFound: boolean;
}

// ---------------------------------------------------------------------------
// Stage benchmarks (average days expected per stage)
// ---------------------------------------------------------------------------
const STAGE_BENCHMARKS: Record<string, number> = {
  appointmentscheduled: 14,
  qualifiedtobuy: 21,
  presentationscheduled: 14,
  decisionmakerboughtin: 30,
  contractsent: 14,
  closedwon: 7,
  closedlost: 0,
};
const DEFAULT_STAGE_BENCHMARK = 21;

// ---------------------------------------------------------------------------
// Deal Health Score — deterministic, no API call
// ---------------------------------------------------------------------------
export function dealHealthScore(
  deal: DealForScoring,
  activities: ActivityForScoring[]
): DealHealthResult {
  const riskFactors: string[] = [];
  let score = 0;

  // --- Factor 1: Activity recency (max 30) ---
  const dealActivities = activities.filter(
    (a) => a.dealHubspotId === deal.hubspotDealId && a.occurredAt
  );
  const allActivities = dealActivities.length > 0 ? dealActivities : activities.filter((a) => a.occurredAt);
  const latestActivity = allActivities
    .map((a) => a.occurredAt!.getTime())
    .sort((a, b) => b - a)[0];

  if (latestActivity) {
    const daysSinceActivity = Math.floor(
      (Date.now() - latestActivity) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceActivity <= 7) {
      score += 30;
    } else if (daysSinceActivity <= 14) {
      score += 20;
    } else if (daysSinceActivity <= 30) {
      score += 10;
    } else {
      riskFactors.push(`No activity in ${daysSinceActivity} days`);
    }
  } else {
    riskFactors.push("No recorded activities");
  }

  // --- Factor 2: Stage velocity (max 25) ---
  if (deal.daysInStage !== null && deal.stage) {
    const benchmark =
      STAGE_BENCHMARKS[deal.stage.toLowerCase()] ?? DEFAULT_STAGE_BENCHMARK;
    if (deal.daysInStage <= benchmark) {
      score += 25;
    } else if (deal.daysInStage <= benchmark * 2) {
      score += 15;
    } else if (deal.daysInStage <= benchmark * 4) {
      score += 5;
    } else {
      riskFactors.push(
        `Stalled: ${deal.daysInStage} days in ${deal.stage} (expected ~${benchmark})`
      );
    }
  } else if (deal.daysInStage === null) {
    score += 12; // neutral if unknown
  }

  // --- Factor 3: Close date health (max 20) ---
  if (deal.closeDate) {
    const daysUntilClose = Math.floor(
      (deal.closeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilClose > 30) {
      score += 20;
    } else if (daysUntilClose > 14) {
      score += 15;
    } else if (daysUntilClose > 7) {
      score += 10;
    } else if (daysUntilClose < 0) {
      riskFactors.push(
        `Close date is ${Math.abs(daysUntilClose)} days overdue`
      );
    } else {
      score += 5;
    }
  } else {
    score += 10; // neutral if no close date set
  }

  // --- Factor 4: Contact breadth (max 15) ---
  const uniqueContacts = new Set(
    dealActivities
      .filter((a) => a.contactHubspotId)
      .map((a) => a.contactHubspotId)
  );
  const contactCount = uniqueContacts.size;
  if (contactCount >= 3) {
    score += 15;
  } else if (contactCount === 2) {
    score += 10;
  } else if (contactCount === 1) {
    score += 5;
    riskFactors.push("Single-threaded: only 1 contact engaged");
  } else {
    riskFactors.push("No contacts linked to deal activities");
  }

  // --- Factor 5: Deal completeness (max 10) ---
  if (deal.amount) {
    const numAmount = parseFloat(deal.amount);
    if (!isNaN(numAmount) && numAmount > 0) {
      score += 10;
    } else {
      score += 5;
    }
  } else {
    riskFactors.push("No deal amount set");
  }

  // --- Compute color and label ---
  const color: "green" | "yellow" | "red" =
    score >= 70 ? "green" : score >= 40 ? "yellow" : "red";
  const label =
    score >= 70 ? "Healthy" : score >= 40 ? "At Risk" : "Critical";

  return { score, color, label, riskFactors };
}

// ---------------------------------------------------------------------------
// ICP Match Score — knowledge retrieval + deterministic comparison
// ---------------------------------------------------------------------------

// Seniority keywords to match against ICP decision-maker profiles
const SENIORITY_KEYWORDS = [
  "vp",
  "vice president",
  "director",
  "head of",
  "chief",
  "ceo",
  "cto",
  "cfo",
  "cmo",
  "coo",
  "cro",
  "svp",
  "evp",
  "senior vice president",
  "executive",
  "founder",
  "partner",
  "president",
  "general manager",
  "managing director",
];

export async function icpMatchScore(
  contact: {
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    title: string | null;
    lifecycleStage: string | null;
  },
  teamId: string
): Promise<ICPMatchResult> {
  const matchingCriteria: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  // Query knowledge base for ICP profiles
  let icpText = "";
  let icpSourcesFound = false;

  try {
    const knowledge = await queryKnowledge({
      teamId,
      query:
        "ICP ideal customer profile target buyer persona firmographics job title industry company size decision maker",
      topK: 5,
    });

    if (knowledge.chunks.length > 0 && knowledge.chunks[0].similarity > 0.3) {
      icpSourcesFound = true;
      icpText = knowledge.chunks.map((c) => c.content).join("\n");
    }
  } catch {
    // Knowledge base query failed — return neutral score
  }

  if (!icpSourcesFound) {
    return {
      score: 50,
      matchingCriteria: [],
      gaps: ["No ICP data found in knowledge base — upload ICP documents or run Market Research agent"],
      icpSourcesFound: false,
    };
  }

  const icpLower = icpText.toLowerCase();

  // --- Factor 1: Title match (max 40) ---
  if (contact.title) {
    const titleLower = contact.title.toLowerCase();
    const hasSeniority = SENIORITY_KEYWORDS.some(
      (kw) => titleLower.includes(kw)
    );
    const titleInIcp = icpLower.includes(titleLower);

    if (titleInIcp && hasSeniority) {
      score += 40;
      matchingCriteria.push(
        `Title "${contact.title}" matches ICP decision-maker profile`
      );
    } else if (hasSeniority) {
      score += 30;
      matchingCriteria.push(
        `Title "${contact.title}" indicates senior decision-maker`
      );
    } else if (titleInIcp) {
      score += 20;
      matchingCriteria.push(`Title "${contact.title}" mentioned in ICP data`);
    } else {
      score += 5;
      gaps.push(
        `Title "${contact.title}" not found in ICP decision-maker profile`
      );
    }
  } else {
    gaps.push("No job title available");
  }

  // --- Factor 2: Company/industry match (max 30) ---
  if (contact.company) {
    const companyLower = contact.company.toLowerCase();
    if (icpLower.includes(companyLower)) {
      score += 30;
      matchingCriteria.push(`Company "${contact.company}" referenced in ICP`);
    } else {
      // Check for industry-level keywords from the company name
      const companyWords = companyLower
        .split(/\s+/)
        .filter((w) => w.length > 3);
      const industryMatch = companyWords.some((word) =>
        icpLower.includes(word)
      );
      if (industryMatch) {
        score += 15;
        matchingCriteria.push(
          `Company "${contact.company}" partially matches ICP industry signals`
        );
      } else {
        gaps.push(
          `Company "${contact.company}" not found in ICP target companies`
        );
      }
    }
  } else {
    gaps.push("No company information available");
  }

  // --- Factor 3: Lifecycle stage fit (max 20) ---
  if (contact.lifecycleStage) {
    const stage = contact.lifecycleStage.toLowerCase();
    if (stage === "opportunity" || stage === "customer") {
      score += 20;
      matchingCriteria.push(`Lifecycle stage "${contact.lifecycleStage}" indicates strong fit`);
    } else if (stage === "salesqualifiedlead" || stage === "marketingqualifiedlead") {
      score += 15;
      matchingCriteria.push(`Lifecycle stage "${contact.lifecycleStage}" indicates qualified lead`);
    } else if (stage === "lead" || stage === "subscriber") {
      score += 10;
      matchingCriteria.push(`Lifecycle stage "${contact.lifecycleStage}" — early stage`);
    } else {
      score += 5;
    }
  } else {
    score += 5; // neutral
  }

  // --- Factor 4: Data completeness (max 10) ---
  const fields = [contact.title, contact.company, contact.lifecycleStage];
  const filledCount = fields.filter(Boolean).length;
  if (filledCount === 3) {
    score += 10;
  } else if (filledCount === 2) {
    score += 7;
  } else if (filledCount === 1) {
    score += 3;
  } else {
    gaps.push("Contact profile is incomplete — missing title, company, and lifecycle stage");
  }

  return { score: Math.min(score, 100), matchingCriteria, gaps, icpSourcesFound };
}
