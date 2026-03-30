export interface EmbeddingProviderInfo {
  provider: string;
  model: string;
  dimensions: number;
}

export interface IEmbeddingGateway {
  embedText(text: string): Promise<number[]>;
  getProviderInfo(): EmbeddingProviderInfo | null;
  isAvailable(): boolean;
}
