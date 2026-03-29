import {
  AIProviderType,
  LLMMessage,
  LLMCompletionResponse,
} from 'obsidian-llm-shared';
import { AIProvider, AIRequestOptions } from '../../../adapters/llm/base-provider';
import { ClaudeProvider } from '../../../adapters/llm/claude-provider';
import { OpenAIProvider } from '../../../adapters/llm/openai-provider';
import { GeminiProvider } from '../../../adapters/llm/gemini-provider';
import { executeWithRetry } from './retry-service';

export interface AIServiceSettings {
  provider: AIProviderType;
  apiKeys: Record<string, string>;
  models: Record<string, string>;
  temperature: number;
}

export class AIService {
  private providers: Map<AIProviderType, AIProvider> = new Map();
  private settings: AIServiceSettings;

  constructor(settings: AIServiceSettings) {
    this.settings = settings;
    this.providers.set('claude', new ClaudeProvider());
    this.providers.set('openai', new OpenAIProvider());
    this.providers.set('gemini', new GeminiProvider());
  }

  updateSettings(settings: AIServiceSettings): void {
    this.settings = settings;
  }

  getCurrentProvider(): AIProvider | undefined {
    return this.providers.get(this.settings.provider);
  }

  getProvider(providerId: AIProviderType): AIProvider | undefined {
    return this.providers.get(providerId);
  }

  async testApiKey(providerId: AIProviderType): Promise<boolean> {
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
}
