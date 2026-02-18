import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { generateEmbeddings } from "./embed";

// ---------------------------------------------------------------------------
// Types (following CLAUDE.md KnowledgeQuery / KnowledgeResult interfaces)
// ---------------------------------------------------------------------------
export interface KnowledgeQueryParams {
  teamId: string;
  query: string;
  filters?: {
    persona?: string;
    competitor?: string;
    funnel_stage?: string;
    type?: string;
  };
  topK?: number;
}

export interface KnowledgeChunkResult {
  id: string;
  content: string;
  chunkIndex: number;
  similarity: number;
  classification: Record<string, unknown> | null;
  entityTags: string[] | null;
  sourceDocument: string;
  sourceUrl: string | null;
  fileType: string;
  createdAt: string;
}

export interface KnowledgeResult {
  chunks: KnowledgeChunkResult[];
  query: string;
  totalFound: number;
}

// ---------------------------------------------------------------------------
// Main retrieval function
// ---------------------------------------------------------------------------
export async function queryKnowledge(
  params: KnowledgeQueryParams
): Promise<KnowledgeResult> {
  const { teamId, query, filters, topK = 10 } = params;

  // 1. Generate embedding for the query
  const [queryEmbedding] = await generateEmbeddings([query]);
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  // 2. Build filter conditions
  const filterConditions: string[] = [];

  if (filters?.type) {
    filterConditions.push(
      `kc.classification->>'type' = '${escapeSql(filters.type)}'`
    );
  }
  if (filters?.persona) {
    filterConditions.push(
      `kc.classification->>'persona' = '${escapeSql(filters.persona)}'`
    );
  }
  if (filters?.competitor) {
    filterConditions.push(
      `kc.classification->>'competitor' = '${escapeSql(filters.competitor)}'`
    );
  }
  if (filters?.funnel_stage) {
    filterConditions.push(
      `kc.classification->>'funnel_stage' = '${escapeSql(filters.funnel_stage)}'`
    );
  }

  const filterClause =
    filterConditions.length > 0
      ? `AND ${filterConditions.join(" AND ")}`
      : "";

  // 3. Vector similarity search using cosine distance
  const results = await db.execute(sql.raw(`
    SELECT
      kc.id,
      kc.content,
      kc.chunk_index,
      kc.classification,
      kc.entity_tags,
      kc.created_at,
      d.filename AS source_document,
      d.source_url,
      d.file_type,
      1 - (kc.embedding <=> '${vectorStr}'::vector) AS similarity
    FROM knowledge_chunks kc
    JOIN documents d ON d.id = kc.document_id
    WHERE kc.team_id = '${escapeSql(teamId)}'
      AND kc.embedding IS NOT NULL
      ${filterClause}
    ORDER BY kc.embedding <=> '${vectorStr}'::vector
    LIMIT ${topK}
  `));

  const rows = (results as { rows: Record<string, unknown>[] }).rows || [];

  const chunks: KnowledgeChunkResult[] = rows.map((row) => ({
    id: row.id as string,
    content: row.content as string,
    chunkIndex: row.chunk_index as number,
    similarity: parseFloat(String(row.similarity)),
    classification: row.classification as Record<string, unknown> | null,
    entityTags: row.entity_tags as string[] | null,
    sourceDocument: row.source_document as string,
    sourceUrl: row.source_url as string | null,
    fileType: row.file_type as string,
    createdAt: String(row.created_at),
  }));

  return {
    chunks,
    query,
    totalFound: chunks.length,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}
