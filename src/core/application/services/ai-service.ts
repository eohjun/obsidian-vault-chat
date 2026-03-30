import {
  AIProviderType,
  LLMMessage,
  LLMCompletionResponse,
} from 'obsidian-llm-shared';
import { IAIProvider, AIRequestOptions, StreamCallback } from '../../domain/interfaces/i-ai-provider';
import { executeWithRetry } from './retry-service';

export interface AIServiceSettings {
  provider: AIProviderType;
  apiKeys: Record<string, string>;
  models: Record<string, string>;
  temperature: number;
}

export class AIService {
  private settings: AIServiceSettings;
  private aborted = false;

  constructor(
    settings: AIServiceSettings,
    private readonly providers: Map<string, IAIProvider>
  ) {
    this.settings = settings;
  }

  /** Call on plugin unload to cancel any in-flight LLM requests. */
  abort(): void {
    this.aborted = true;
  }

  updateSettings(settings: AIServiceSettings): void {
    this.settings = settings;
  }

  getCurrentProvider(): IAIProvider | undefined {
    return this.providers.get(this.settings.provider);
  }

  getProvider(providerId: string): IAIProvider | undefined {
    return this.providers.get(providerId);
  }

  async testApiKey(providerId: string): Promise<boolean> {
    const provider = this.providers.get(providerId);
    const apiKey = this.settings.apiKeys[providerId];
    if (!provider || !apiKey) return false;
    return provider.testApiKey(apiKey);
  }

  async generateText(
    messages: LLMMessage[],
    options?: AIRequestOptions
  ): Promise<LLMCompletionResponse> {
    const provider = this.getCurrentProvider();
    const apiKey = this.settings.apiKeys[this.settings.provider];

    if (this.aborted) {
      return { success: false, text: '', model: '', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, error: 'Plugin is unloading' };
    }
    if (!provider) {
      return { success: false, text: '', model: '', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, error: 'No provider selected' };
    }
    if (!apiKey) {
      return { success: false, text: '', model: '', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, error: 'No API key configured' };
    }

    const mergedOptions: AIRequestOptions = {
      model: this.settings.models[this.settings.provider],
      temperature: this.settings.temperature,
      ...options,
    };

    return executeWithRetry(
      () => provider.generateText(messages, apiKey, mergedOptions),
      (error) => {
        if (error instanceof Error) {
          return error.message.includes('RATE_LIMIT') || error.message.includes('TIMEOUT');
        }
        return false;
      }
    );
  }

  async streamText(
    messages: LLMMessage[],
    onToken: StreamCallback,
    options?: AIRequestOptions
  ): Promise<LLMCompletionResponse> {
    const provider = this.getCurrentProvider();
    const apiKey = this.settings.apiKeys[this.settings.provider];
    const fail = (error: string): LLMCompletionResponse => ({
      success: false, text: '', model: '',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, error,
    });

    if (this.aborted) return fail('Plugin is unloading');
    if (!provider) return fail('No provider selected');
    if (!apiKey) return fail('No API key configured');

    const mergedOptions: AIRequestOptions = {
      model: this.settings.models[this.settings.provider],
      temperature: this.settings.temperature,
      ...options,
    };

    return provider.streamText(messages, apiKey, onToken, mergedOptions);
  }
}
