import {
  AIProviderType,
  LLMMessage,
  LLMCompletionResponse,
  buildOpenAIBody,
  parseOpenAIResponse,
  getOpenAIHeaders,
} from 'obsidian-llm-shared';
import { BaseProvider, AIRequestOptions, StreamCallback } from './base-provider';

export class OpenAIProvider extends BaseProvider {
  readonly id: AIProviderType = 'openai';

  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const headers = getOpenAIHeaders(apiKey);
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

  async streamText(
    messages: LLMMessage[],
    apiKey: string,
    onToken: StreamCallback,
    options?: AIRequestOptions
  ): Promise<LLMCompletionResponse> {
    const model = options?.model || this.config.defaultModel;
    const headers = getOpenAIHeaders(apiKey);
    const body = buildOpenAIBody(messages, model, {
      maxTokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature,
    });

    if (body.reasoning && (body.reasoning as any).effort === 'none') {
      delete body.reasoning;
    }

    body.stream = true;

    try {
      const fullText = await this.streamSSE(
        `${this.config.endpoint}/chat/completions`,
        headers,
        JSON.stringify(body),
        onToken,
        (json) => {
          try {
            const data = JSON.parse(json);
            return data.choices?.[0]?.delta?.content ?? null;
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
