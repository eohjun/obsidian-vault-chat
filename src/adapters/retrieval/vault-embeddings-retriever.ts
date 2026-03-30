import { App } from 'obsidian';
import { SourceNote } from '../../core/domain/entities/chat-message';
import {
  IRetrievalService,
  RetrievalOptions,
} from '../../core/domain/interfaces/i-retrieval-service';
import { VaultEmbeddingsUnavailableError } from '../../core/domain/errors/ai-errors';

interface VaultEmbeddingsPlugin {
  isConfigured(): boolean;
  searchSimilar(
    query: string,
    options?: {
      limit?: number;
      threshold?: number;
      excludeFolders?: string[];
    }
  ): Promise<
    Array<{
      noteId: string;
      notePath: string;
      title: string;
      similarity: number;
    }>
  >;
  embedQuery(text: string): Promise<number[]>;
  getProviderInfo(): { provider: string; model: string; dimensions: number } | null;
}

export class VaultEmbeddingsRetriever implements IRetrievalService {
  constructor(private readonly app: App) {}

  private getPlugin(): VaultEmbeddingsPlugin | null {
    const plugin = (this.app as any).plugins?.getPlugin?.('vault-embeddings');
    return plugin ?? null;
  }

  isAvailable(): boolean {
    const plugin = this.getPlugin();
    return plugin !== null && plugin.isConfigured();
  }

  async search(
    query: string,
    options: RetrievalOptions
  ): Promise<SourceNote[]> {
    const plugin = this.getPlugin();
    if (!plugin || !plugin.isConfigured()) {
      throw new VaultEmbeddingsUnavailableError();
    }

    // Build exclude list: all folders EXCEPT targetFolder
    const allFolders = this.app.vault
      .getAllLoadedFiles()
      .filter((f) => (f as any).children !== undefined)
      .map((f) => f.path);

    const excludeFolders = allFolders.filter(
      (folder) => !folder.startsWith(options.targetFolder)
    );

    const results = await plugin.searchSimilar(query, {
      limit: options.limit,
      threshold: options.threshold,
      excludeFolders,
    });

    return results.map((r) => ({
      notePath: r.notePath,
      title: r.title,
      similarity: r.similarity,
    }));
  }
}
