export interface SourceNote {
  notePath: string;
  title: string;
  similarity: number;
  sectionHeading?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: SourceNote[];
  timestamp: string;
}

export function createChatMessage(
  role: 'user' | 'assistant',
  content: string,
  sources: SourceNote[] = []
): ChatMessage {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    role,
    content,
    sources,
    timestamp: new Date().toISOString(),
  };
}
