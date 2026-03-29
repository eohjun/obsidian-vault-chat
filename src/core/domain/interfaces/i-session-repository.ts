import { ChatSession } from '../entities/chat-session';

export interface ISessionRepository {
  save(session: ChatSession): Promise<void>;
  load(sessionId: string): Promise<ChatSession | null>;
  list(): Promise<ChatSession[]>;
  delete(sessionId: string): Promise<void>;
  deleteOldest(keepCount: number): Promise<void>;
}
