import {
  AIProviderType,
  LLMMessage,
  LLMCompletionResponse,
  buildGeminiBody,
  parseGeminiResponse,
  getGeminiGenerateUrl,
} from 'obsidian-llm-shared';
import { BaseProvider, AIRequestOptions, StreamCallback } from './base-provider';

export class GeminiProvider extends BaseProvider {
  readonly id: AIProviderType = 'gemini';

  async testApiKey(apiKey: string): Promise<boolean> {
    try {
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

  async streamText(
    messages: LLMMessage[],
    apiKey: string,
    onToken: StreamCallback,
    options?: AIRequestOptions
  ): Promise<LLMCompletionResponse> {
    const model = options?.model || this.config.defaultModel;
    const body = buildGeminiBody(messages, model, {
      maxTokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature,
    });

    // Gemini streaming uses streamGenerateContent with alt=sse
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    try {
      const fullText = await this.streamSSE(
        url,
        { 'Content-Type': 'application/json' },
        JSON.stringify(body),
        onToken,
        (json) => {
          try {
            const data = JSON.parse(json);
            return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
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
