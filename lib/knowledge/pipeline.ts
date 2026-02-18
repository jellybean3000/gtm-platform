import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, knowledgeChunks } from "@/lib/db/schema";
import { getSupabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase/storage";
import { extractText } from "./extract";
import { chunkText } from "./chunk";
import { generateEmbeddings } from "./embed";

/**
 * Process a document through the full pipeline:
 * download → extract text → chunk → embed → save to knowledge_chunks.
 *
 * Updates document status: uploading → processing → analyzed (or error).
 */
export async function processDocument(documentId: string): Promise<void> {
  try {
    // 1. Fetch the document record
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!doc) {
      console.error(`Document not found: ${documentId}`);
      return;
    }

    const metadata = doc.metadata as {
      storagePath?: string;
      size?: number;
      mimeType?: string;
    } | null;

    const storagePath = metadata?.storagePath;
    if (!storagePath) {
      console.error(`No storagePath in metadata for document: ${documentId}`);
      await updateStatus(documentId, "error");
      return;
    }

    // 2. Update status to processing
    await updateStatus(documentId, "processing");

    // 3. Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await getSupabaseAdmin()
      .storage.from(STORAGE_BUCKET)
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error(`Failed to download file: ${downloadError?.message}`);
      await updateStatus(documentId, "error");
      return;
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    // 4. Extract text (strip null bytes — PDFs often contain them)
    console.log(`Extracting text from ${doc.filename} (${doc.fileType})`);
    const rawText = await extractText(buffer, doc.fileType);
    const text = rawText.replace(/\0/g, "");

    if (!text.trim()) {
      console.warn(`No text extracted from document: ${documentId}`);
      await updateStatus(documentId, "analyzed");
      return;
    }

    // 5. Chunk the text
    console.log(`Chunking text (${text.length} chars)`);
    const chunks = chunkText(text);
    console.log(`Created ${chunks.length} chunks`);

    // 6. Generate embeddings
    console.log(`Generating embeddings for ${chunks.length} chunks`);
    const embeddings = await generateEmbeddings(chunks);

    // 7. Save chunks to database
    console.log(`Saving ${chunks.length} chunks to database`);
    const chunkValues = chunks.map((content, index) => ({
      documentId,
      teamId: doc.teamId,
      content,
      embedding: embeddings[index],
      chunkIndex: index,
    }));

    // Insert in batches of 50 to avoid query size limits
    for (let i = 0; i < chunkValues.length; i += 50) {
      const batch = chunkValues.slice(i, i + 50);
      await db.insert(knowledgeChunks).values(batch);
    }

    // 8. Update status to analyzed
    await updateStatus(documentId, "analyzed");
    console.log(
      `Document ${documentId} processed: ${chunks.length} chunks created`
    );
  } catch (error) {
    console.error(`Pipeline error for document ${documentId}:`, error);
    await updateStatus(documentId, "error").catch(console.error);
  }
}

async function updateStatus(
  documentId: string,
  status: "uploading" | "processing" | "analyzed" | "error"
) {
  await db
    .update(documents)
    .set({ status, updatedAt: new Date() })
    .where(eq(documents.id, documentId));
}
