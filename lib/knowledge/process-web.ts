import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, knowledgeChunks, webSources } from "@/lib/db/schema";
import {
  crawlSinglePage,
  crawlSite,
  crawlSitemap,
  crawlRss,
  computeContentHash,
  CrawlResult,
} from "./crawl";
import { chunkText } from "./chunk";
import { generateEmbeddings } from "./embed";

/**
 * Process a web source through the full pipeline:
 * crawl → create documents → chunk → embed → save to knowledge_chunks.
 *
 * Updates web_source status and lastCrawledAt on completion.
 */
export async function processWebSource(webSourceId: string): Promise<void> {
  try {
    // 1. Fetch the web source record
    const [source] = await db
      .select()
      .from(webSources)
      .where(eq(webSources.id, webSourceId))
      .limit(1);

    if (!source) {
      console.error(`Web source not found: ${webSourceId}`);
      return;
    }

    console.log(
      `Crawling web source: ${source.url} (mode: ${source.crawlMode})`
    );

    // 2. Crawl based on mode
    let pages: CrawlResult[];
    switch (source.crawlMode) {
      case "single":
      case "scheduled": {
        const result = await crawlSinglePage(source.url);
        pages = [result];
        break;
      }
      case "site":
        pages = await crawlSite(source.url, 20);
        break;
      case "sitemap":
        pages = await crawlSitemap(source.url);
        break;
      case "rss":
        pages = await crawlRss(source.url);
        break;
      default:
        pages = [await crawlSinglePage(source.url)];
    }

    if (pages.length === 0) {
      console.warn(`No content crawled from: ${source.url}`);
      await updateWebSourceStatus(webSourceId, "error");
      return;
    }

    console.log(`Crawled ${pages.length} page(s) from ${source.url}`);

    // 3. Compute combined content hash for change detection
    const combinedText = pages.map((p) => p.text).join("\n");
    const newHash = computeContentHash(combinedText);

    // 4. Process each crawled page
    for (const page of pages) {
      if (!page.text.trim()) continue;

      // Create a document record for this web page
      const [doc] = await db
        .insert(documents)
        .values({
          teamId: source.teamId,
          filename: page.title.slice(0, 500) || new URL(page.url).hostname,
          fileType: "html",
          sourceUrl: page.url,
          uploadType: "web",
          status: "processing",
          metadata: { webSourceId, crawledAt: new Date().toISOString() },
        })
        .returning();

      try {
        // Chunk the text
        const text = page.text.replace(/\0/g, "");
        const chunks = chunkText(text);
        console.log(
          `${page.url}: ${chunks.length} chunks (${text.length} chars)`
        );

        if (chunks.length === 0) {
          await updateDocStatus(doc.id, "analyzed");
          continue;
        }

        // Generate embeddings
        const embeddings = await generateEmbeddings(chunks);

        // Save chunks
        const chunkValues = chunks.map((content, index) => ({
          documentId: doc.id,
          teamId: source.teamId,
          content,
          embedding: embeddings[index],
          chunkIndex: index,
        }));

        for (let i = 0; i < chunkValues.length; i += 50) {
          const batch = chunkValues.slice(i, i + 50);
          await db.insert(knowledgeChunks).values(batch);
        }

        await updateDocStatus(doc.id, "analyzed");
      } catch (err) {
        console.error(`Failed to process page ${page.url}:`, err);
        await updateDocStatus(doc.id, "error");
      }
    }

    // 5. Update web source record
    await db
      .update(webSources)
      .set({
        lastCrawledAt: new Date(),
        contentHash: newHash,
        status: "active",
      })
      .where(eq(webSources.id, webSourceId));

    console.log(
      `Web source ${webSourceId} processed: ${pages.length} pages crawled`
    );
  } catch (error) {
    console.error(`Web crawl error for source ${webSourceId}:`, error);
    await updateWebSourceStatus(webSourceId, "error").catch(console.error);
  }
}

/**
 * Recrawl a web source and only re-process if content has changed.
 * Returns true if changes were detected.
 */
export async function recrawlWebSource(
  webSourceId: string
): Promise<boolean> {
  const [source] = await db
    .select()
    .from(webSources)
    .where(eq(webSources.id, webSourceId))
    .limit(1);

  if (!source) {
    console.error(`Web source not found: ${webSourceId}`);
    return false;
  }

  // Crawl the page(s)
  let pages: CrawlResult[];
  switch (source.crawlMode) {
    case "single":
    case "scheduled": {
      const result = await crawlSinglePage(source.url);
      pages = [result];
      break;
    }
    case "site":
      pages = await crawlSite(source.url, 20);
      break;
    case "sitemap":
      pages = await crawlSitemap(source.url);
      break;
    case "rss":
      pages = await crawlRss(source.url);
      break;
    default:
      pages = [await crawlSinglePage(source.url)];
  }

  const combinedText = pages.map((p) => p.text).join("\n");
  const newHash = computeContentHash(combinedText);

  if (newHash === source.contentHash) {
    // No changes — just update lastCrawledAt
    await db
      .update(webSources)
      .set({ lastCrawledAt: new Date() })
      .where(eq(webSources.id, webSourceId));
    console.log(`No changes detected for web source: ${source.url}`);
    return false;
  }

  // Content changed — delete old documents/chunks and re-process
  console.log(`Changes detected for web source: ${source.url}`);

  // Delete existing documents for this web source (cascade deletes chunks)
  const existingDocs = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.sourceUrl, source.url));

  for (const doc of existingDocs) {
    await db.delete(knowledgeChunks).where(eq(knowledgeChunks.documentId, doc.id));
    await db.delete(documents).where(eq(documents.id, doc.id));
  }

  // Re-process
  await processWebSource(webSourceId);

  // Increment changes detected counter
  await db
    .update(webSources)
    .set({
      changesDetected: (source.changesDetected || 0) + 1,
      contentHash: newHash,
    })
    .where(eq(webSources.id, webSourceId));

  return true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function updateDocStatus(
  documentId: string,
  status: "uploading" | "processing" | "analyzed" | "error"
) {
  await db
    .update(documents)
    .set({ status, updatedAt: new Date() })
    .where(eq(documents.id, documentId));
}

async function updateWebSourceStatus(
  webSourceId: string,
  status: "active" | "paused" | "error"
) {
  await db
    .update(webSources)
    .set({ status })
    .where(eq(webSources.id, webSourceId));
}
