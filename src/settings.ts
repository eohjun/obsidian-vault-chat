import {
  AIProviderType,
  AI_PROVIDERS,
} from 'obsidian-llm-shared';

export interface VaultChatSettings {
  ai: {
    provider: AIProviderType;
    models: Record<string, string>;
    apiKeys: Record<string, string>;
    temperature: number;
  };
  retrieval: {
    topK: number;
    similarityThreshold: number;
    targetFolder: string;
    chunkSearch: boolean;
    topKChunks: number;
    maxChunkTokens: number;
  };
  chat: {
    maxHistoryTurns: number;
    maxSessions: number;
    examplePrompts: string[];
  };
  export: {
    outputFolder: string;
  };
}

export const DEFAULT_SETTINGS: VaultChatSettings = {
  ai: {
    provider: 'openai',
    models: {
      claude: AI_PROVIDERS.claude.defaultModel,
      openai: AI_PROVIDERS.openai.defaultModel,
      gemini: AI_PROVIDERS.gemini.defaultModel,
    },
    apiKeys: {},
    temperature: 0.7,
  },
  retrieval: {
    topK: 10,
    similarityThreshold: 0.3,
    targetFolder: '04_Zettelkasten',
    chunkSearch: false,
    topKChunks: 15,
    maxChunkTokens: 1500,
  },
  chat: {
    maxHistoryTurns: 10,
    maxSessions: 5,
    examplePrompts: [
      'What are the key themes across my recent notes?',
      'Summarize what I know about...',
      'Find connections between my notes on...',
      'What have I written about that relates to...',
    ],
  },
  export: {
    outputFolder: '03_Resources/Literature_Notes',
  },
};
