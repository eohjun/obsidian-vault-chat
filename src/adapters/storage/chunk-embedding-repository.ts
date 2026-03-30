import { Plugin, normalizePath } from 'obsidian';
import type { ChunkEmbedding, ChunkIndex } from '../../core/domain/entities/chunk-embedding';
import { createEmptyChunkIndex } from '../../core/domain/entities/chunk-embedding';
import type { IChunkRepository } from '../../core/domain/interfaces/i-chunk-repository';

const CHUNKS_FOLDER = 'chunks';
const INDEX_FILE = 'index.json';

export class ChunkEmbeddingRepository implements IChunkRepository {
  private readonly basePath: string;

  constructor(private readonly plugin: Plugin) {
    // Store in plugin's data folder: .obsidian/plugins/vault-chat/chunks/
    const pluginDir = (this.plugin.manifest as any).dir ?? `${this.plugin.app.vault.configDir}/plugins/${this.plugin.manifest.id}`;
    this.basePath = normalizePath(`${pluginDir}/${CHUNKS_FOLDER}`);
  }

  async initialize(): Promise<void> {
    const adapter = this.plugin.app.vault.adapter;
    if (!(await adapter.exists(this.basePath))) {
      await adapter.mkdir(this.basePath);
    }
    // Ensure index exists
    const indexPath = normalizePath(`${this.basePath}/${INDEX_FILE}`);
    if (!(await adapter.exists(indexPath))) {
      await adapter.write(indexPath, JSON.stringify(createEmptyChunkIndex(), null, 2));
    }
  }

  async save(chunk: ChunkEmbedding): Promise<void> {
    const filePath = this.chunkPath(chunk.chunkId);
    await this.plugin.app.vault.adapter.write(
      filePath,
      JSON.stringify(chunk)
    );
  }

  async saveBatch(chunks: ChunkEmbedding[]): Promise<void> {
    for (const chunk of chunks) {
      await this.save(chunk);
    }
  }

  async findByChunkId(chunkId: string): Promise<ChunkEmbedding | null> {
    const filePath = this.chunkPath(chunkId);
    const adapter = this.plugin.app.vault.adapter;
    if (!(await adapter.exists(filePath))) return null;
    const content = await adapter.read(filePath);
    return JSON.parse(content) as ChunkEmbedding;
  }

  async findByNoteId(noteId: string): Promise<ChunkEmbedding[]> {
    const index = await this.getIndex();
    const entry = index.notes[noteId];
    if (!entry) return [];

    const results: ChunkEmbedding[] = [];
    for (const chunkId of entry.chunkIds) {
      const chunk = await this.findByChunkId(chunkId);
      if (chunk) results.push(chunk);
    }
    return results;
  }

  async findAll(): Promise<ChunkEmbedding[]> {
    const index = await this.getIndex();
    const results: ChunkEmbedding[] = [];

    for (const entry of Object.values(index.notes)) {
      for (const chunkId of entry.chunkIds) {
        const chunk = await this.findByChunkId(chunkId);
        if (chunk) results.push(chunk);
      }
    }

    return results;
  }

  async delete(chunkId: string): Promise<void> {
    const filePath = this.chunkPath(chunkId);
    const adapter = this.plugin.app.vault.adapter;
    if (await adapter.exists(filePath)) {
      await adapter.remove(filePath);
    }
  }

  async deleteByNoteId(noteId: string): Promise<void> {
    const index = await this.getIndex();
    const entry = index.notes[noteId];
    if (!entry) return;

    for (const chunkId of entry.chunkIds) {
      await this.delete(chunkId);
    }

    delete index.notes[noteId];
    index.totalChunks = Object.values(index.notes).reduce(
      (sum, n) => sum + n.chunkIds.length,
      0
    );
    await this.updateIndex(index);
  }

  async getIndex(): Promise<ChunkIndex> {
    const indexPath = normalizePath(`${this.basePath}/${INDEX_FILE}`);
    const adapter = this.plugin.app.vault.adapter;

    if (!(await adapter.exists(indexPath))) {
      return createEmptyChunkIndex();
    }

    const content = await adapter.read(indexPath);
    return JSON.parse(content) as ChunkIndex;
  }

  async updateIndex(index: ChunkIndex): Promise<void> {
    const indexPath = normalizePath(`${this.basePath}/${INDEX_FILE}`);
    await this.plugin.app.vault.adapter.write(
      indexPath,
      JSON.stringify(index, null, 2)
    );
  }

  async clear(): Promise<void> {
    const index = await this.getIndex();
    for (const entry of Object.values(index.notes)) {
      for (const chunkId of entry.chunkIds) {
        await this.delete(chunkId);
      }
    }
    await this.updateIndex(createEmptyChunkIndex());
  }

  async count(): Promise<number> {
    const index = await this.getIndex();
    return index.totalChunks;
  }

  private chunkPath(chunkId: string): string {
    return normalizePath(`${this.basePath}/${chunkId}.json`);
  }
}
