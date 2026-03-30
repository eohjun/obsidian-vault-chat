import { App } from 'obsidian';
import type {
  IEmbeddingGateway,
  EmbeddingProviderInfo,
} from '../../core/domain/interfaces/i-embedding-gateway';

interface VaultEmbeddingsPluginAPI {
  isConfigured(): boolean;
  embedQuery(text: string): Promise<number[]>;
  getProviderInfo(): { provider: string; model: string; dimensions: number } | null;
}

export class VaultEmbeddingsGateway implements IEmbeddingGateway {
  constructor(private readonly app: App) {}

  private getPlugin(): VaultEmbeddingsPluginAPI | null {
    const plugin = (this.app as any).plugins?.getPlugin?.('vault-embeddings');
    return plugin ?? null;
  }

  isAvailable(): boolean {
    const plugin = this.getPlugin();
    return plugin !== null && plugin.isConfigured();
  }

  async embedText(text: string): Promise<number[]> {
    const plugin = this.getPlugin();
    if (!plugin || !plugin.isConfigured()) {
      throw new Error('Vault Embeddings plugin is not available');
    }
    return plugin.embedQuery(text);
  }

  getProviderInfo(): EmbeddingProviderInfo | null {
    const plugin = this.getPlugin();
    if (!plugin) return null;
    return plugin.getProviderInfo();
  }
}
