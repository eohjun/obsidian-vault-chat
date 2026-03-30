import type { ChunkEmbedding, ChunkIndex } from '../entities/chunk-embedding';

export interface IChunkRepository {
  initialize(): Promise<void>;
  save(chunk: ChunkEmbedding): Promise<void>;
  saveBatch(chunks: ChunkEmbedding[]): Promise<void>;
  findByChunkId(chunkId: string): Promise<ChunkEmbedding | null>;
  findByNoteId(noteId: string): Promise<ChunkEmbedding[]>;
  findAll(): Promise<ChunkEmbedding[]>;
  delete(chunkId: string): Promise<void>;
  deleteByNoteId(noteId: string): Promise<void>;
  getIndex(): Promise<ChunkIndex>;
  updateIndex(index: ChunkIndex): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}
