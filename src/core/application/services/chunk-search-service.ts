import type { ChunkEmbedding } from '../../domain/entities/chunk-embedding';
import type { IChunkRepository } from '../../domain/interfaces/i-chunk-repository';

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
}

export class ChunkSearchService {
  constructor(private readonly chunkRepository: IChunkRepository) {}

  async search(
    queryVector: number[],
    options: ChunkSearchOptions
  ): Promise<ChunkSearchResult[]> {
    const allChunks = await this.chunkRepository.findAll();
    const results: ChunkSearchResult[] = [];

    for (const chunk of allChunks) {
      if (
        options.excludeFolders?.some((folder) =>
          chunk.notePath.startsWith(folder + '/')
        )
      ) {
        continue;
      }

      const similarity = cosineSimilarity(queryVector, chunk.vector);
      if (similarity >= options.threshold) {
        results.push({
          chunkId: chunk.chunkId,
          noteId: chunk.noteId,
          notePath: chunk.notePath,
          noteTitle: chunk.noteTitle,
          sectionHeading: chunk.sectionHeading,
          sectionIndex: chunk.sectionIndex,
          similarity,
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
