import {
  AIProviderType,
  LLMMessage,
  LLMCompletionResponse,
  buildOpenAIBody,
  parseOpenAIResponse,
  getOpenAIHeaders,
} from 'obsidian-llm-shared';
import { BaseProvider, AIRequestOptions } from './base-provider';

export class OpenAIProvider extends BaseProvider {
  readonly id: AIProviderType = 'openai';

  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const model = this.config.defaultModel;
      const headers = getOpenAIHeaders(apiKey);
      const body = buildOpenAIBody(
        [{ role: 'user', content: 'Hello' }],
        model,
        { maxTokens: 10 }
      );
      await this.makeRequest(
        `${this.config.endpoint}/chat/completions`,
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
    const headers = getOpenAIHeaders(apiKey);
    const body = buildOpenAIBody(messages, model, {
      maxTokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature,
    });

    try {
      const raw = await this.makeRequest<unknown>(
        `${this.config.endpoint}/chat/completions`,
        'POST',
        headers,
        JSON.stringify(body)
      );
      return parseOpenAIResponse(raw);
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
