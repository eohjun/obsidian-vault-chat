import {
  AIProviderType,
  LLMMessage,
  LLMCompletionResponse,
  buildAnthropicBody,
  parseAnthropicResponse,
  getAnthropicHeaders,
} from 'obsidian-llm-shared';
import { BaseProvider, AIRequestOptions } from './base-provider';

export class ClaudeProvider extends BaseProvider {
  readonly id: AIProviderType = 'claude';

  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const model = this.config.defaultModel;
      const headers = getAnthropicHeaders(apiKey);
      const body = buildAnthropicBody(
        [{ role: 'user', content: 'Hello' }],
        model,
        { maxTokens: 10 }
      );
      await this.makeRequest(
        `${this.config.endpoint}/messages`,
        'POST',
        headers,
        JSON.stringify(body)
      );
      return true;
    } catch {
      return false;
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
}
