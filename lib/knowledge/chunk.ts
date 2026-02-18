const TARGET_TOKENS = 500;
const OVERLAP_TOKENS = 50;
// Rough estimate: 1 word ≈ 1.3 tokens
const TOKENS_PER_WORD = 1.3;

function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).length * TOKENS_PER_WORD);
}

/**
 * Split text into semantic chunks of approximately `maxTokens` tokens each,
 * with `overlapTokens` of overlap between consecutive chunks.
 */
export function chunkText(
  text: string,
  maxTokens: number = TARGET_TOKENS,
  overlapTokens: number = OVERLAP_TOKENS
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // If the entire text fits in one chunk, return it as-is
  if (estimateTokens(trimmed) <= maxTokens) {
    return [trimmed];
  }

  // Split into paragraphs first
  const paragraphs = trimmed.split(/\n\s*\n/).filter((p) => p.trim());

  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);

    // If a single paragraph exceeds max tokens, split it by sentences
    if (paragraphTokens > maxTokens) {
      // Flush current chunk first
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = getOverlapText(currentChunk, overlapTokens);
      }

      const sentenceChunks = splitBySentences(paragraph, maxTokens, overlapTokens);
      chunks.push(...sentenceChunks);
      currentChunk = getOverlapText(
        sentenceChunks[sentenceChunks.length - 1] ?? "",
        overlapTokens
      );
      continue;
    }

    const combined = currentChunk
      ? currentChunk + "\n\n" + paragraph
      : paragraph;

    if (estimateTokens(combined) > maxTokens) {
      // Flush and start new chunk with overlap
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      const overlap = getOverlapText(currentChunk, overlapTokens);
      currentChunk = overlap ? overlap + "\n\n" + paragraph : paragraph;
    } else {
      currentChunk = combined;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

function splitBySentences(
  text: string,
  maxTokens: number,
  overlapTokens: number
): string[] {
  // Split on sentence boundaries
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) ?? [text];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const combined = currentChunk ? currentChunk + sentence : sentence;

    if (estimateTokens(combined) > maxTokens && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      const overlap = getOverlapText(currentChunk, overlapTokens);
      currentChunk = overlap + sentence;
    } else {
      currentChunk = combined;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Get the last N tokens worth of text for chunk overlap.
 */
function getOverlapText(text: string, overlapTokens: number): string {
  if (!text.trim() || overlapTokens <= 0) return "";
  const words = text.trim().split(/\s+/);
  const overlapWords = Math.ceil(overlapTokens / TOKENS_PER_WORD);
  if (words.length <= overlapWords) return text.trim();
  return words.slice(-overlapWords).join(" ");
}
