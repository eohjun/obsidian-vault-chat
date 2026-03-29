import { ChatMessage } from '../../domain/entities/chat-message';
import { ChatService } from '../services/chat-service';

export class SendMessageUseCase {
  constructor(private readonly chatService: ChatService) {}

  async execute(query: string): Promise<ChatMessage> {
    return this.chatService.sendMessage(query);
  }
}
