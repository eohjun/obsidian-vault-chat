import { ChatMessage } from './chat-message';

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export function createChatSession(title?: string): ChatSession {
  const now = new Date().toISOString();
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    title: title || 'New Chat',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}
