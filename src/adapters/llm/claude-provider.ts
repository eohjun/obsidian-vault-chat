import {
  AIProviderType,
  LLMMessage,
  LLMCompletionResponse,
  buildAnthropicBody,
  parseAnthropicResponse,
  getAnthropicHeaders,
} from 'obsidian-llm-shared';
import { BaseProvider, AIRequestOptions, StreamCallback } from './base-provider';

export class ClaudeProvider extends BaseProvider {
  readonly id: AIProviderType = 'claude';

  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const headers = getAnthropicHeaders(apiKey);
      const body = buildAnthropicBody(
        [{ role: 'user', content: 'Hi' }],
        'claude-haiku-4-5',
        { maxTokens: 1 }
      );
      await this.makeRequest(
        `${this.config.endpoint}/messages`,
        'POST',
        headers,
        JSON.stringify(body)
      );
      return true;
    } catch (error) {
      if (error instanceof Error) {
        const msg = error.message;
        if (msg.includes('401') || msg.includes('403') || msg.includes('authentication') || msg.includes('invalid')) {
          return false;
        }
      }
      return true;
    }
  }

  async generateText(
    messages: LLMMessage[],
    apiKey: string,
    options?: AIRequestOptions
  ): Promise<LLMCompletionResponse> {
    const model = options?.model || this.config.defaultModel;
    const headers = getAnthropicHeaders(apiKey);
    const body = buildAnthropicBody(messages, model, {
      maxTokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature,
    });

    try {
      const raw = await this.makeRequest<unknown>(
        `${this.config.endpoint}/messages`,
        'POST',
        headers,
        JSON.stringify(body)
      );
      return parseAnthropicResponse(raw);
    } catch (error) {
      const normalized = this.normalizeError(error);
      return {
        success: false,
        text: '',
        model,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        error: normalized.message,
      };
    }
  }

  async streamText(
    messages: LLMMessage[],
    apiKey: string,
    onToken: StreamCallback,
    options?: AIRequestOptions
  ): Promise<LLMCompletionResponse> {
    const model = options?.model || this.config.defaultModel;
    const headers = getAnthropicHeaders(apiKey);
    const body = buildAnthropicBody(messages, model, {
      maxTokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature,
    });

    (body as any).stream = true;

    try {
      const fullText = await this.streamSSE(
        `${this.config.endpoint}/messages`,
        headers,
        JSON.stringify(body),
        onToken,
        (json) => {
          try {
            const data = JSON.parse(json);
            if (data.type === 'content_block_delta') {
              return data.delta?.text ?? null;
            }
            return null;
          } catch {
            return null;
          }
        }
      );

      return {
        success: true,
        text: fullText,
        model,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      };
    } catch (error) {
      const normalized = this.normalizeError(error);
      return {
        success: false,
        text: '',
        model,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        error: normalized.message,
      };
    }
  }
}
