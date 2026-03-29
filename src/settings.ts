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
  };
  chat: {
    maxHistoryTurns: number;
    maxSessions: number;
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
  },
  chat: {
    maxHistoryTurns: 10,
    maxSessions: 5,
  },
  export: {
    outputFolder: '03_Resources/Literature_Notes',
  },
};
