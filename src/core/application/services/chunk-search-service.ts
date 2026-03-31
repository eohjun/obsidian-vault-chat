import type { ChunkEmbedding } from '../../domain/entities/chunk-embedding';
import type { IChunkRepository } from '../../domain/interfaces/i-chunk-repository';
import { buildBM25Index, scoreAllBM25 } from '../../domain/utils/bm25';

export interface ChunkSearchResult {
  chunkId: string;
  noteId: string;
  notePath: string;
  noteTitle: string;
  sectionHeading: string;
  sectionIndex: number;
  similarity: number;
}

export interface ChunkSearchOptions {
  limit: number;
  threshold: number;
  excludeFolders?: string[];
  /** Enable hybrid search (vector + BM25). Requires chunks to have content field. */
  hybridSearch?: boolean;
  /** Weight for vector similarity in hybrid mode (0-1). Default: 0.7 */
  hybridAlpha?: number;
  /** Original query text, required for hybrid search */
  queryText?: string;
}

export class ChunkSearchService {
  constructor(private readonly chunkRepository: IChunkRepository) {}

  async search(
    queryVector: number[],
    options: ChunkSearchOptions
  ): Promise<ChunkSearchResult[]> {
    const allChunks = await this.chunkRepository.findAll();

    // Filter excluded folders
    const chunks = allChunks.filter(
      (chunk) =>
        !options.excludeFolders?.some((folder) =>
          chunk.notePath.startsWith(folder + '/')
        )
    );

    // Compute vector similarities
    const vectorScores = chunks.map((chunk) =>
      cosineSimilarity(queryVector, chunk.vector)
    );

    // Compute BM25 scores if hybrid mode enabled
    let finalScores: number[];

    if (
      options.hybridSearch &&
      options.queryText &&
      chunks.some((c) => c.content)
    ) {
      const alpha = options.hybridAlpha ?? 0.7;
      const documents = chunks.map((c) => c.content || '');
      const bm25Index = buildBM25Index(documents);
      const bm25Scores = scoreAllBM25(options.queryText, bm25Index);

      finalScores = vectorScores.map(
        (vs, i) => alpha * vs + (1 - alpha) * bm25Scores[i]
      );
    } else {
      finalScores = vectorScores;
    }

    // Build results, filter by threshold, sort, and limit
    const results: ChunkSearchResult[] = [];
    for (let i = 0; i < chunks.length; i++) {
      if (finalScores[i] >= options.threshold) {
        results.push({
          chunkId: chunks[i].chunkId,
          noteId: chunks[i].noteId,
          notePath: chunks[i].notePath,
          noteTitle: chunks[i].noteTitle,
          sectionHeading: chunks[i].sectionHeading,
          sectionIndex: chunks[i].sectionIndex,
          similarity: finalScores[i],
        });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, options.limit);
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}
