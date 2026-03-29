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
      const headers = getOpenAIHeaders(apiKey);
      // /v1/models only requires valid auth, no model dependency
      await this.makeRequest(
        `${this.config.endpoint}/models`,
        'GET',
        headers
      );
      return true;
    } catch (error) {
      if (error instanceof Error) {
        const msg = error.message;
        if (msg.includes('401') || msg.includes('403') || msg.includes('invalid')) {
          return false;
        }
      }
      // Non-auth errors mean the key itself is valid
      return true;
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
