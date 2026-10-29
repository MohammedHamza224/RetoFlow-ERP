/**
 * RestoFlow RAG & Text Embedding Utilities
 * Pure functions for text chunking, local vectorization, and cosine similarity.
 */

/**
 * Splits document content into clean chunks with overlapping sliding window
 */
export function chunkText(
  content: string,
  chunkSize: number = 320,
  chunkOverlap: number = 50
): string[] {
  const cleaned = content
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];
  if (cleaned.length <= chunkSize) return [cleaned];

  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = start + chunkSize;

    if (end < cleaned.length) {
      const breakChars = ['. ', '.\n', '\n', '? ', '! ', '، ', ' '];
      let foundBreak = -1;

      for (const char of breakChars) {
        const idx = cleaned.lastIndexOf(char, end);
        if (idx > start + chunkSize * 0.6) {
          foundBreak = idx + char.length;
          break;
        }
      }

      if (foundBreak !== -1) {
        end = foundBreak;
      }
    } else {
      end = cleaned.length;
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    if (end >= cleaned.length) {
      break;
    }

    const nextStart = end - chunkOverlap;
    start = nextStart > start ? nextStart : end;
  }

  return chunks.length > 0 ? chunks : [cleaned];
}

/**
 * Generates a normalized 768-dimensional vector embedding from text.
 * Uses deterministic term hashing and n-gram frequency distribution.
 */
export function generateLocalEmbedding(text: string, dimensions: number = 768): number[] {
  const normalized = text.toLowerCase().trim();
  const vector = new Array(dimensions).fill(0);
  const tokens = normalized.split(/\s+|[.,!?;:()\[\]]/).filter(t => t.length > 1);

  if (tokens.length === 0) return vector;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    let hash = 0;
    for (let j = 0; j < token.length; j++) {
      hash = (hash << 5) - hash + token.charCodeAt(j);
      hash |= 0;
    }

    const idx1 = Math.abs(hash) % dimensions;
    const idx2 = Math.abs((hash * 31) ^ (i * 17)) % dimensions;
    const weight = 1.0 / Math.sqrt(tokens.length);

    vector[idx1] += weight;
    vector[idx2] += weight * 0.5;
  }

  // L2 Normalization
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] /= norm;
    }
  }

  return vector;
}

/**
 * Computes cosine similarity between two normalized vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  return Math.max(0, Math.min(1, dotProduct));
}
