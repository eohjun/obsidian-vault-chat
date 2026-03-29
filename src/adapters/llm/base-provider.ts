import { requestUrl } from 'obsidian';
import {
  AIProviderType,
  AIProviderConfig,
  AI_PROVIDERS,
  LLMMessage,
  LLMCompletionResponse,
} from 'obsidian-llm-shared';
import { IAIProvider, AIRequestOptions } from '../../core/domain/interfaces/i-ai-provider';

export type { AIRequestOptions } from '../../core/domain/interfaces/i-ai-provider';

export abstract class BaseProvider implements IAIProvider {
  abstract readonly id: AIProviderType;

  get config(): AIProviderConfig {
    return AI_PROVIDERS[this.id];
  }

  protected async makeRequest<T>(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: string
  ): Promise<T> {
    const response = await requestUrl({ url, method, headers, body });
    return response.json as T;
  }

  protected normalizeError(error: unknown): { message: string; code: string } {
    if (error instanceof Error) {
      const msg = error.message;
      if (msg.includes('429') || msg.includes('rate')) {
        return { message: 'Rate limit exceeded. Please try again later.', code: 'RATE_LIMIT' };
      }
      if (msg.includes('401') || msg.includes('403')) {
        return { message: 'Invalid API key or unauthorized access.', code: 'AUTH_ERROR' };
      }
      if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
        return { message: 'Request timed out.', code: 'TIMEOUT' };
      }
      return { message: msg, code: 'UNKNOWN' };
    }
    return { message: 'An unknown error occurred', code: 'UNKNOWN' };
  }

  abstract testApiKey(apiKey: string): Promise<boolean>;
  abstract generateText(
    messages: LLMMessage[],
    apiKey: string,
    options?: AIRequestOptions
  ): Promise<LLMCompletionResponse>;
}
