import {
  AIProviderType,
  LLMMessage,
  LLMCompletionResponse,
  buildGeminiBody,
  parseGeminiResponse,
  getGeminiGenerateUrl,
} from 'obsidian-llm-shared';
import { BaseProvider, AIRequestOptions } from './base-provider';

export class GeminiProvider extends BaseProvider {
  readonly id: AIProviderType = 'gemini';

  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const model = this.config.defaultModel;
      const url = getGeminiGenerateUrl(model, apiKey);
      const body = buildGeminiBody(
        [{ role: 'user', content: 'Hello' }],
        model,
        { maxTokens: 10 }
      );
      await this.makeRequest(
        url,
        'POST',
        { 'Content-Type': 'application/json' },
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
    const url = getGeminiGenerateUrl(model, apiKey);
    const body = buildGeminiBody(messages, model, {
      maxTokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature,
    });

    try {
      const raw = await this.makeRequest<unknown>(
        url,
        'POST',
        { 'Content-Type': 'application/json' },
        JSON.stringify(body)
      );
      return parseGeminiResponse(raw);
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
