const MODEL = "gemini-embedding-001";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Generate embeddings for an array of text strings using Google Gemini's
 * gemini-embedding-001 model (3072 dimensions).
 *
 * Processes one at a time since batchEmbedContent is async-only on this model.
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey = process.env.GEMINI_API_KEY!;
  const allEmbeddings: number[][] = [];

  for (const text of texts) {
    const response = await fetch(
      `${API_BASE}/models/${MODEL}:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${MODEL}`,
          content: { parts: [{ text }] },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini embedding error (${response.status}): ${error}`);
    }

    const data = await response.json();
    allEmbeddings.push(data.embedding.values);
  }

  return allEmbeddings;
}
