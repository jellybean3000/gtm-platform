import mammoth from "mammoth";
import { Readable } from "stream";
import csvParser from "csv-parser";
import JSZip from "jszip";

/**
 * Extract text content from a file buffer based on its type.
 */
export async function extractText(
  buffer: Buffer,
  fileType: string
): Promise<string> {
  switch (fileType) {
    case "pdf":
      return extractPdf(buffer);
    case "docx":
      return extractDocx(buffer);
    case "pptx":
      return extractPptx(buffer);
    case "csv":
      return extractCsv(buffer);
    case "xlsx":
      return extractXlsx(buffer);
    case "txt":
    case "md":
      return buffer.toString("utf-8");
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

async function extractPdf(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid pdf-parse trying to load test data at build time
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return data.text;
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractPptx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const texts: string[] = [];

  // PPTX slides are stored as ppt/slides/slide1.xml, slide2.xml, etc.
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] ?? "0");
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] ?? "0");
      return numA - numB;
    });

  for (const slideFile of slideFiles) {
    const xml = await zip.files[slideFile].async("text");
    // Extract text between <a:t> tags (PowerPoint text elements)
    const matches = xml.match(/<a:t>([^<]*)<\/a:t>/g);
    if (matches) {
      const slideText = matches
        .map((m) => m.replace(/<\/?a:t>/g, ""))
        .join(" ");
      texts.push(slideText);
    }
  }

  return texts.join("\n\n");
}

async function extractCsv(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const rows: string[] = [];
    const stream = Readable.from(buffer.toString("utf-8"));

    stream
      .pipe(csvParser())
      .on("data", (row: Record<string, string>) => {
        rows.push(
          Object.entries(row)
            .map(([key, val]) => `${key}: ${val}`)
            .join(", ")
        );
      })
      .on("end", () => resolve(rows.join("\n")))
      .on("error", reject);
  });
}

async function extractXlsx(buffer: Buffer): Promise<string> {
  // Basic XLSX extraction via JSZip — read shared strings and sheet data
  const zip = await JSZip.loadAsync(buffer);
  const texts: string[] = [];

  // Read shared strings (xl/sharedStrings.xml)
  const sharedStringsFile = zip.files["xl/sharedStrings.xml"];
  if (sharedStringsFile) {
    const xml = await sharedStringsFile.async("text");
    const matches = xml.match(/<t[^>]*>([^<]*)<\/t>/g);
    if (matches) {
      for (const m of matches) {
        const text = m.replace(/<\/?t[^>]*>/g, "").trim();
        if (text) texts.push(text);
      }
    }
  }

  return texts.join("\n");
}
