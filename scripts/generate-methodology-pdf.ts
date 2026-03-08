import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const OUTPUT_PATH = path.join(
  process.env.HOME || "/Users/jonathanbrown",
  "Desktop",
  "Fundraising_Pipeline_Probability_Methodology.pdf"
);

const doc = new PDFDocument({
  size: "letter",
  margins: { top: 60, bottom: 60, left: 60, right: 60 },
});

doc.pipe(fs.createWriteStream(OUTPUT_PATH));

const PURPLE = "#8B5CF6";
const DARK = "#1a1a2e";
const GRAY = "#555555";

// ---------------------------------------------------------------------------
// Title Page
// ---------------------------------------------------------------------------
doc.fontSize(28).fillColor(DARK).font("Helvetica-Bold");
doc.text("Fundraising Pipeline", { align: "center" });
doc.text("Probability Methodology", { align: "center" });
doc.moveDown(1);
doc.fontSize(14).fillColor(GRAY).font("Helvetica");
doc.text("Board Presentation Framework", { align: "center" });
doc.moveDown(0.5);
doc.fontSize(11).text(`Prepared: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, { align: "center" });
doc.moveDown(3);

// Divider
doc.moveTo(60, doc.y).lineTo(552, doc.y).strokeColor(PURPLE).lineWidth(2).stroke();
doc.moveDown(2);

// ---------------------------------------------------------------------------
// Section 1 — Overview
// ---------------------------------------------------------------------------
function sectionHeader(text: string) {
  doc.moveDown(0.5);
  doc.fontSize(16).fillColor(DARK).font("Helvetica-Bold").text(text);
  doc.moveDown(0.3);
  doc.moveTo(60, doc.y).lineTo(250, doc.y).strokeColor(PURPLE).lineWidth(1).stroke();
  doc.moveDown(0.5);
}

function body(text: string) {
  doc.fontSize(10.5).fillColor("#333333").font("Helvetica").text(text, { lineGap: 3 });
  doc.moveDown(0.4);
}

sectionHeader("1. Overview");
body(
  "This methodology assigns a probability of close to each investor based on their current pipeline stage. " +
  "The model enables weighted pipeline calculations, coverage ratio analysis, and funnel velocity tracking — " +
  "all critical inputs for board-level fundraising discussions."
);
body(
  "Probabilities are calibrated using industry benchmarks for institutional fundraising and adjusted " +
  "based on our pipeline's historical conversion patterns. The framework is designed to present a " +
  "realistic, defensible view of capital formation progress."
);

// ---------------------------------------------------------------------------
// Section 2 — Probability Matrix
// ---------------------------------------------------------------------------
sectionHeader("2. Stage-Based Probability Matrix");
body(
  "Each investor in the pipeline is assigned a probability based on their furthest-reached stage:"
);
doc.moveDown(0.3);

const stages = [
  ["Identified", "5%", "Firm identified as potential fit; no outreach yet"],
  ["Researching", "8%", "Actively researching thesis fit, portfolio, partners"],
  ["Outreach", "12%", "Initial contact made via email, intro, or LinkedIn"],
  ["First Meeting", "20%", "Introductory meeting completed; mutual interest expressed"],
  ["Partner Meeting", "35%", "Meeting with decision-making partner(s)"],
  ["Due Diligence", "55%", "Active DD underway: data room access, reference calls"],
  ["Term Sheet", "80%", "Term sheet issued or under negotiation"],
  ["Closed / Committed", "100%", "Capital committed; legal docs in process or complete"],
  ["Passed", "0%", "Investor has declined or gone silent"],
];

// Table header
const colX = [60, 200, 270];
const colW = [140, 70, 222];
doc.fontSize(9).font("Helvetica-Bold").fillColor("#FFFFFF");
doc.rect(60, doc.y, 492, 20).fill(PURPLE);
const headerY = doc.y + 5;
doc.text("Stage", colX[0] + 8, headerY, { width: colW[0] });
doc.text("Prob.", colX[1] + 8, headerY, { width: colW[1] });
doc.text("Description", colX[2] + 8, headerY, { width: colW[2] });
doc.y = headerY + 15;

// Table rows
for (let i = 0; i < stages.length; i++) {
  const [stage, prob, desc] = stages[i];
  const rowY = doc.y + 2;
  const bg = i % 2 === 0 ? "#F5F3FF" : "#FFFFFF";
  doc.rect(60, rowY - 2, 492, 18).fill(bg);

  doc.fontSize(9).font("Helvetica-Bold").fillColor(DARK);
  doc.text(stage, colX[0] + 8, rowY, { width: colW[0] });
  doc.font("Helvetica").fillColor(PURPLE);
  doc.text(prob, colX[1] + 8, rowY, { width: colW[1] });
  doc.fillColor(GRAY).font("Helvetica");
  doc.text(desc, colX[2] + 8, rowY, { width: colW[2] });
  doc.y = rowY + 16;
}
doc.moveDown(1);

// ---------------------------------------------------------------------------
// Section 3 — Weighted Pipeline
// ---------------------------------------------------------------------------
sectionHeader("3. Weighted Pipeline Calculation");
body(
  "The weighted pipeline represents the probability-adjusted value of all active investors:"
);
doc.moveDown(0.2);
doc.fontSize(11).font("Helvetica-Bold").fillColor(DARK);
doc.text("Weighted Pipeline = Σ (Investor Check Size × Stage Probability)", { align: "center" });
doc.moveDown(0.5);
body(
  "Example: An investor with a $2M check size at the Partner Meeting stage (35%) " +
  "contributes $700K to the weighted pipeline. This is the number presented to the board " +
  "as the \"probability-adjusted pipeline value.\""
);
body(
  "For investors without a confirmed check size, use the midpoint of their stated range " +
  "(checkSizeMin + checkSizeMax) / 2, or the maximum if only one bound is known."
);

// ---------------------------------------------------------------------------
// Section 4 — Coverage Ratio
// ---------------------------------------------------------------------------
sectionHeader("4. Coverage Ratio");
body(
  "The coverage ratio measures whether the pipeline is large enough to hit the target raise, " +
  "accounting for expected attrition at each stage:"
);
doc.moveDown(0.2);
doc.fontSize(11).font("Helvetica-Bold").fillColor(DARK);
doc.text("Coverage Ratio = Total Pipeline Value / Target Raise", { align: "center" });
doc.moveDown(0.5);

const coverages = [
  ["< 2.0x", "Red — Insufficient pipeline. Unlikely to close the round."],
  ["2.0x – 3.0x", "Yellow — Moderate coverage. Achievable but at risk."],
  ["3.0x – 4.0x", "Green — Healthy pipeline. On track with typical attrition."],
  ["> 4.0x", "Strong — Oversubscribed territory. Selective closing possible."],
];

for (const [ratio, desc] of coverages) {
  doc.fontSize(10).font("Helvetica-Bold").fillColor(DARK).text(ratio, { continued: true });
  doc.font("Helvetica").fillColor(GRAY).text(`  ${desc}`);
  doc.moveDown(0.2);
}
doc.moveDown(0.3);
body(
  "Industry standard for fundraising is a 3x coverage ratio — meaning you need $30M in total " +
  "pipeline to confidently close a $10M round."
);

// ---------------------------------------------------------------------------
// Section 5 — Funnel Velocity
// ---------------------------------------------------------------------------
doc.addPage();
sectionHeader("5. Funnel Velocity Metrics");
body("Track these metrics monthly to report pipeline health to the board:");
doc.moveDown(0.3);

const metrics = [
  ["Stage Conversion Rate", "% of investors moving from one stage to the next (e.g., First Meeting → Partner Meeting: 40%)"],
  ["Average Days in Stage", "How long investors sit at each stage before advancing or passing. Flags stalled conversations."],
  ["Funnel Velocity", "Average number of days from Identified to Closed/Committed for successful closes."],
  ["Top-of-Funnel Activity", "New investors added per week/month. Leading indicator of future pipeline health."],
  ["Pass Rate by Stage", "Where investors drop off most. Identifies messaging or process gaps."],
  ["Win Rate", "% of investors reaching First Meeting that ultimately commit. Benchmark: 15-25%."],
];

for (const [metric, desc] of metrics) {
  doc.fontSize(10).font("Helvetica-Bold").fillColor(DARK).text(`• ${metric}`);
  doc.fontSize(9.5).font("Helvetica").fillColor(GRAY).text(`  ${desc}`, { indent: 12 });
  doc.moveDown(0.3);
}

// ---------------------------------------------------------------------------
// Section 6 — Board KPIs
// ---------------------------------------------------------------------------
sectionHeader("6. Recommended Board KPIs");
body("Present these 6 metrics at each board meeting:");
doc.moveDown(0.3);

const kpis = [
  ["Target Raise", "The total capital being raised in this round"],
  ["Weighted Pipeline", "Probability-adjusted total value (Section 3)"],
  ["Coverage Ratio", "Pipeline / Target with RAG status (Section 4)"],
  ["Committed Capital", "Funds with signed term sheets or verbal commits at 80%+"],
  ["Active Conversations", "Investors in stages First Meeting through Term Sheet"],
  ["Funnel Velocity", "Avg days from first meeting to close; trend over time"],
];

for (let i = 0; i < kpis.length; i++) {
  const [kpi, desc] = kpis[i];
  doc.fontSize(10).font("Helvetica-Bold").fillColor(DARK).text(`${i + 1}. ${kpi}`, { continued: true });
  doc.font("Helvetica").fillColor(GRAY).text(` — ${desc}`);
  doc.moveDown(0.2);
}

// ---------------------------------------------------------------------------
// Section 7 — Probability Adjustments
// ---------------------------------------------------------------------------
doc.moveDown(0.5);
sectionHeader("7. Probability Adjustments");
body(
  "While stage-based probabilities provide the baseline, adjust individual investor probabilities " +
  "based on these qualitative factors:"
);
doc.moveDown(0.3);

const adjustments = [
  ["+5-10%", "Strong thesis fit (investor's portfolio aligns with our space)"],
  ["+5-10%", "Warm introduction from portfolio company founder or mutual connection"],
  ["+5%", "Investor has led rounds in our sector in the past 12 months"],
  ["-5-10%", "Investor is slow to respond (>2 weeks between touchpoints)"],
  ["-10-15%", "Investor is in active fundraising for their own fund"],
  ["-5%", "Competitive deal in their portfolio (potential conflict)"],
];

for (const [adj, desc] of adjustments) {
  const color = adj.startsWith("+") ? "#10B981" : "#EF4444";
  doc.fontSize(10).font("Helvetica-Bold").fillColor(color).text(adj, { continued: true });
  doc.font("Helvetica").fillColor(GRAY).text(`  ${desc}`);
  doc.moveDown(0.2);
}

// ---------------------------------------------------------------------------
// Section 8 — Presentation Format
// ---------------------------------------------------------------------------
doc.moveDown(0.5);
sectionHeader("8. Board Presentation Format");
body(
  "When presenting to the board, structure the fundraising update as follows:"
);
doc.moveDown(0.3);

const format = [
  "1. State the target raise amount and timeline",
  "2. Show the weighted pipeline value and coverage ratio (with RAG indicator)",
  "3. Present the pipeline waterfall: how many investors at each stage",
  "4. Highlight top 3-5 most advanced conversations with next steps",
  "5. Show funnel velocity trends (improving/declining month-over-month)",
  "6. Call out risks: stalled conversations, competitive dynamics, timeline pressure",
  "7. State specific asks of board members: intros, references, strategic guidance",
];

for (const line of format) {
  doc.fontSize(10).font("Helvetica").fillColor(DARK).text(line);
  doc.moveDown(0.15);
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------
doc.moveDown(2);
doc.moveTo(60, doc.y).lineTo(552, doc.y).strokeColor(PURPLE).lineWidth(1).stroke();
doc.moveDown(0.5);
doc.fontSize(9).fillColor(GRAY).font("Helvetica-Oblique");
doc.text(
  "This methodology is generated by the GTM Platform CRM Intelligence module. " +
  "Probabilities should be reviewed quarterly and calibrated against actual conversion data.",
  { align: "center" }
);

doc.end();

console.log(`PDF saved to: ${OUTPUT_PATH}`);
