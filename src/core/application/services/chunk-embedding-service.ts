import type {
  ChunkEmbedding,
  ChunkIndex,
} from '../../domain/entities/chunk-embedding';
import {
  createChunkId,
  createEmptyChunkIndex,
} from '../../domain/entities/chunk-embedding';
import type { IChunkRepository } from '../../domain/interfaces/i-chunk-repository';
import type { IEmbeddingGateway } from '../../domain/interfaces/i-embedding-gateway';
import type { IVaultReader } from '../../domain/interfaces/i-vault-reader';
import { generateNoteId } from '../../domain/utils/note-id';
import { chunkNote, NoteChunk } from './note-chunker';

export interface ChunkBuildProgress {
  total: number;
  completed: number;
  skipped: number;
  failed: number;
  currentNote: string | null;
}

export type ProgressCallback = (progress: ChunkBuildProgress) => void;

export interface NoteFile {
  path: string;
  basename: string;
}

export interface INoteFileProvider {
  getNotesInFolder(
    targetFolder: string,
    excludeFolders: string[]
  ): NoteFile[];
}

export class ChunkEmbeddingService {
  constructor(
    private readonly chunkRepository: IChunkRepository,
    private readonly embeddingGateway: IEmbeddingGateway,
    private readonly vaultReader: IVaultReader,
    private readonly noteFileProvider: INoteFileProvider
  ) {}

  async buildIndex(
    targetFolder: string,
    excludeFolders: string[],
    onProgress?: ProgressCallback
  ): Promise<{ embedded: number; skipped: number; failed: number }> {
    if (!this.embeddingGateway.isAvailable()) {
      throw new Error('Vault Embeddings plugin is not available');
    }

    const providerInfo = this.embeddingGateway.getProviderInfo();
    if (!providerInfo) {
      throw new Error('Cannot get embedding provider info');
    }

    const notes = this.noteFileProvider.getNotesInFolder(
      targetFolder,
      excludeFolders
    );

    const index = await this.chunkRepository.getIndex();
    const progress: ChunkBuildProgress = {
      total: notes.length,
      completed: 0,
      skipped: 0,
      failed: 0,
      currentNote: null,
    };

    let embedded = 0;

    for (const note of notes) {
      progress.currentNote = note.basename;
      onProgress?.(progress);

      try {
        const content = await this.vaultReader.readNote(note.path);
        if (!content) {
          progress.skipped++;
          progress.completed++;
          continue;
        }

        const noteId = generateNoteId(note.path);
        const contentHash = await hashContent(content);

        // Staleness check: skip if note unchanged
        const existingEntry = index.notes[noteId];
        if (
          existingEntry &&
          existingEntry.noteContentHash === contentHash
        ) {
          progress.skipped++;
          progress.completed++;
          continue;
        }

        // Delete old chunks for this note
        await this.chunkRepository.deleteByNoteId(noteId);

        // Chunk the note
        const chunks = chunkNote(content, note.basename);
        if (chunks.length === 0) {
          progress.skipped++;
          progress.completed++;
          continue;
        }

        // Embed each chunk
        const chunkEmbeddings = await this.embedChunks(
          chunks,
          noteId,
          note.path,
          note.basename,
          providerInfo.dimensions
        );

        // Save
        await this.chunkRepository.saveBatch(chunkEmbeddings);

        // Update index entry
        index.notes[noteId] = {
          path: note.path,
          noteContentHash: contentHash,
          chunkIds: chunkEmbeddings.map((c) => c.chunkId),
          updatedAt: new Date().toISOString(),
        };

        embedded += chunkEmbeddings.length;
      } catch (err) {
        console.error(`Failed to embed chunks for ${note.path}:`, err);
        progress.failed++;
      }

      progress.completed++;
      onProgress?.(progress);
    }

    // Persist index
    index.totalChunks = Object.values(index.notes).reduce(
      (sum, n) => sum + n.chunkIds.length,
      0
    );
    index.lastUpdated = new Date().toISOString();
    index.dimensions = providerInfo.dimensions;
    await this.chunkRepository.updateIndex(index);

    return { embedded, skipped: progress.skipped, failed: progress.failed };
  }

  /**
   * Update chunks for a single note (create, modify, or re-embed).
   * Skips if content is unchanged (SHA-256 hash match).
   */
  async updateNote(
    notePath: string,
    noteBasename: string
  ): Promise<{ embedded: number; skipped: boolean }> {
    if (!this.embeddingGateway.isAvailable()) {
      return { embedded: 0, skipped: true };
    }

    const providerInfo = this.embeddingGateway.getProviderInfo();
    if (!providerInfo) return { embedded: 0, skipped: true };

    const content = await this.vaultReader.readNote(notePath);
    if (!content) return { embedded: 0, skipped: true };

    const noteId = generateNoteId(notePath);
    const contentHash = await hashContent(content);

    const index = await this.chunkRepository.getIndex();
    const existingEntry = index.notes[noteId];

    if (existingEntry && existingEntry.noteContentHash === contentHash) {
      return { embedded: 0, skipped: true };
    }

    // Delete old chunks
    await this.chunkRepository.deleteByNoteId(noteId);

    // Chunk and embed
    const chunks = chunkNote(content, noteBasename);
    if (chunks.length === 0) return { embedded: 0, skipped: true };

    const chunkEmbeddings = await this.embedChunks(
      chunks,
      noteId,
      notePath,
      noteBasename,
      providerInfo.dimensions
    );

    await this.chunkRepository.saveBatch(chunkEmbeddings);

    // Update index
    index.notes[noteId] = {
      path: notePath,
      noteContentHash: contentHash,
      chunkIds: chunkEmbeddings.map((c) => c.chunkId),
      updatedAt: new Date().toISOString(),
    };
    index.totalChunks = Object.values(index.notes).reduce(
      (sum, n) => sum + n.chunkIds.length,
      0
    );
    index.lastUpdated = new Date().toISOString();
    index.dimensions = providerInfo.dimensions;
    await this.chunkRepository.updateIndex(index);

    return { embedded: chunkEmbeddings.length, skipped: false };
  }

  /**
   * Delete all chunks for a note by path.
   */
  async deleteNote(notePath: string): Promise<void> {
    const noteId = generateNoteId(notePath);
    await this.chunkRepository.deleteByNoteId(noteId);
  }

  async updateStaleChunks(
    targetFolder: string,
    excludeFolders: string[],
    onProgress?: ProgressCallback
  ): Promise<{ embedded: number; skipped: number; failed: number }> {
    return this.buildIndex(targetFolder, excludeFolders, onProgress);
  }

  async clearIndex(): Promise<void> {
    await this.chunkRepository.clear();
    await this.chunkRepository.updateIndex(createEmptyChunkIndex());
  }

  async getStats(): Promise<{
    totalChunks: number;
    totalNotes: number;
    lastUpdated: string | null;
  }> {
    const index = await this.chunkRepository.getIndex();
    return {
      totalChunks: index.totalChunks,
      totalNotes: Object.keys(index.notes).length,
      lastUpdated: index.lastUpdated || null,
    };
  }

  private async embedChunks(
    chunks: NoteChunk[],
    noteId: string,
    notePath: string,
    noteTitle: string,
    dimensions: number
  ): Promise<ChunkEmbedding[]> {
    const now = new Date().toISOString();
    const concurrency = 5;
    const results: ChunkEmbedding[] = [];

    // Process in parallel batches of `concurrency`
    for (let i = 0; i < chunks.length; i += concurrency) {
      const batch = chunks.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async (chunk) => {
          const [vector, contentHash] = await Promise.all([
            this.embeddingGateway.embedText(chunk.content),
            hashContent(chunk.content),
          ]);
          const chunkId = createChunkId(noteId, chunk.sectionIndex);
          return {
            chunkId,
            noteId,
            notePath,
            noteTitle,
            sectionHeading: chunk.heading,
            headingLevel: chunk.headingLevel,
            sectionIndex: chunk.sectionIndex,
            contentHash,
            vector,
            dimensions,
            createdAt: now,
            updatedAt: now,
          } as ChunkEmbedding;
        })
      );
      results.push(...batchResults);
    }

    return results;
  }
}

async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
