import { LLMMessage, LLMCompletionResponse } from 'obsidian-llm-shared';

export interface AIRequestOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export type StreamCallback = (token: string) => void;

export interface IAIProvider {
  readonly id: string;
  testApiKey(apiKey: string): Promise<boolean>;
  generateText(
    messages: LLMMessage[],
    apiKey: string,
    options?: AIRequestOptions
  ): Promise<LLMCompletionResponse>;
  streamText(
    messages: LLMMessage[],
    apiKey: string,
    onToken: StreamCallback,
    options?: AIRequestOptions
  ): Promise<LLMCompletionResponse>;
}
