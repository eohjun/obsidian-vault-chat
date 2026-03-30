import { requestUrl } from 'obsidian';
import {
  AIProviderType,
  AIProviderConfig,
  AI_PROVIDERS,
  LLMMessage,
  LLMCompletionResponse,
} from 'obsidian-llm-shared';
import { IAIProvider, AIRequestOptions, StreamCallback } from '../../core/domain/interfaces/i-ai-provider';

export type { AIRequestOptions, StreamCallback } from '../../core/domain/interfaces/i-ai-provider';

export abstract class BaseProvider implements IAIProvider {
  abstract readonly id: AIProviderType;

  get config(): AIProviderConfig {
    return AI_PROVIDERS[this.id];
  }

  protected async makeRequest<T>(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string
  ): Promise<T> {
    const opts: any = { url, method, headers, throw: false };
    if (body) opts.body = body;
    const response = await requestUrl(opts);

    // requestUrl with throw:false returns response even on error status
    if (response.status >= 400) {
      const errorBody = response.json?.error?.message || response.text || `status ${response.status}`;
      throw new Error(`API error (${response.status}): ${errorBody}`);
    }

    return response.json as T;
  }

  /**
   * Stream SSE response using fetch(). Returns collected full text.
   * Each provider calls this with its own SSE line parser.
   */
  protected async streamSSE(
    url: string,
    headers: Record<string, string>,
    body: string,
    onToken: StreamCallback,
    parseLine: (line: string) => string | null
  ): Promise<string> {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        const token = parseLine(trimmed.slice(6));
        if (token) {
          fullText += token;
          onToken(token);
        }
      }
    }

    return fullText;
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
  abstract streamText(
    messages: LLMMessage[],
    apiKey: string,
    onToken: StreamCallback,
    options?: AIRequestOptions
  ): Promise<LLMCompletionResponse>;
}
