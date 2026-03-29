import { ChatSession } from '../../domain/entities/chat-session';
import { ChatService } from '../services/chat-service';

export class CreateSessionUseCase {
  constructor(private readonly chatService: ChatService) {}

  async execute(): Promise<ChatSession> {
    return this.chatService.createSession();
  }
}
