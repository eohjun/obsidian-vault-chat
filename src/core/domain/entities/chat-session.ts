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
    id: crypto.randomUUID(),
    title: title || 'New Chat',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}
