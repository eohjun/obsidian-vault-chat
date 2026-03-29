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
      // Use models.list endpoint for auth-only validation
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      await this.makeRequest(url, 'GET', { 'Content-Type': 'application/json' });
      return true;
    } catch (error) {
      if (error instanceof Error) {
        const msg = error.message;
        if (msg.includes('400') || msg.includes('401') || msg.includes('403') || msg.includes('invalid')) {
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
