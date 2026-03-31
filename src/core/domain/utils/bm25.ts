/**
 * BM25 scoring for hybrid search.
 * Handles Korean and English text with simple whitespace tokenization.
 */

const K1 = 1.2;
const B = 0.75;

/** Simple tokenizer: lowercase, split on non-word chars, filter short tokens */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

export interface BM25Index {
  /** document frequency: term → number of docs containing term */
  df: Map<string, number>;
  /** total number of documents */
  N: number;
  /** average document length in tokens */
  avgdl: number;
  /** per-document: term frequencies and doc length */
  docs: Array<{
    tf: Map<string, number>;
    dl: number;
    id: number;
  }>;
}

/** Build a BM25 index from document texts */
export function buildBM25Index(documents: string[]): BM25Index {
  const df = new Map<string, number>();
  const docs: BM25Index['docs'] = [];
  let totalLength = 0;

  for (let i = 0; i < documents.length; i++) {
    const tokens = tokenize(documents[i]);
    const tf = new Map<string, number>();
    const seen = new Set<string>();

    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
      if (!seen.has(token)) {
        seen.add(token);
        df.set(token, (df.get(token) || 0) + 1);
      }
    }

    docs.push({ tf, dl: tokens.length, id: i });
    totalLength += tokens.length;
  }

  return {
    df,
    N: documents.length,
    avgdl: documents.length > 0 ? totalLength / documents.length : 0,
    docs,
  };
}

/** Score a single document against a query using BM25 */
export function scoreBM25(
  query: string,
  docIndex: number,
  index: BM25Index
): number {
  const queryTokens = tokenize(query);
  const doc = index.docs[docIndex];
  if (!doc) return 0;

  let score = 0;

  for (const term of queryTokens) {
    const termDf = index.df.get(term) || 0;
    if (termDf === 0) continue;

    const idf = Math.log((index.N - termDf + 0.5) / (termDf + 0.5) + 1);
    const termTf = doc.tf.get(term) || 0;
    const tfNorm =
      (termTf * (K1 + 1)) /
      (termTf + K1 * (1 - B + B * (doc.dl / index.avgdl)));

    score += idf * tfNorm;
  }

  return score;
}

/** Score all documents and return normalized scores (0-1) */
export function scoreAllBM25(
  query: string,
  index: BM25Index
): number[] {
  const scores: number[] = [];
  let maxScore = 0;

  for (let i = 0; i < index.docs.length; i++) {
    const s = scoreBM25(query, i, index);
    scores.push(s);
    if (s > maxScore) maxScore = s;
  }

  // Normalize to 0-1 range
  if (maxScore > 0) {
    for (let i = 0; i < scores.length; i++) {
      scores[i] /= maxScore;
    }
  }

  return scores;
}
