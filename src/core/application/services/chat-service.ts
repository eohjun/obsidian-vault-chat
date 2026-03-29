import { getModelConfig } from '../../domain/constants/model-configs';
import { ChatMessage, SourceNote, createChatMessage } from '../../domain/entities/chat-message';
import { ChatSession, createChatSession } from '../../domain/entities/chat-session';
import { IVaultReader } from '../../domain/interfaces/i-vault-reader';
import { IRetrievalService } from '../../domain/interfaces/i-retrieval-service';
import { ISessionRepository } from '../../domain/interfaces/i-session-repository';
import { AIService } from './ai-service';
import { ContextBuilder, NoteContent } from './context-builder';

export interface ChatServiceConfig {
  ai: { provider: string; models: Record<string, string> };
  retrieval: { topK: number; similarityThreshold: number; targetFolder: string };
  chat: { maxHistoryTurns: number; maxSessions: number };
}

export class ChatService {
  private currentSession: ChatSession | null = null;

  constructor(
    private readonly vaultReader: IVaultReader,
    private readonly aiService: AIService,
    private readonly retrievalService: IRetrievalService,
    private readonly sessionRepository: ISessionRepository,
    private settings: ChatServiceConfig
  ) {}

  updateSettings(settings: ChatServiceConfig): void {
    this.settings = settings;
  }

  getCurrentSession(): ChatSession | null {
    return this.currentSession;
  }

  async createSession(): Promise<ChatSession> {
    const session = createChatSession();
    this.currentSession = session;

    // Enforce max sessions
    await this.sessionRepository.deleteOldest(this.settings.chat.maxSessions - 1);
    await this.sessionRepository.save(session);
    return session;
  }

  async loadSession(sessionId: string): Promise<ChatSession | null> {
    const session = await this.sessionRepository.load(sessionId);
    if (session) {
      this.currentSession = session;
    }
    return session;
  }

  async listSessions(): Promise<ChatSession[]> {
    return this.sessionRepository.list();
  }

  async sendMessage(query: string): Promise<ChatMessage> {
    if (!this.currentSession) {
      await this.createSession();
    }

    // 1. Add user message
    const userMessage = createChatMessage('user', query);
    this.currentSession!.messages.push(userMessage);

    // Update session title from first question
    if (this.currentSession!.messages.length === 1) {
      this.currentSession!.title = query.slice(0, 50) + (query.length > 50 ? '...' : '');
    }

    // 2. Search relevant notes
    const sources = await this.retrievalService.search(query, {
      limit: this.settings.retrieval.topK,
      threshold: this.settings.retrieval.similarityThreshold,
      targetFolder: this.settings.retrieval.targetFolder,
    });

    // 3. Read note contents
    const noteContents = await this.readNoteContents(sources);

    // 4. Build LLM context
    const currentModel = this.settings.ai.models[this.settings.ai.provider];
    const modelConfig = getModelConfig(currentModel);
    const contextWindow = modelConfig?.contextWindow ?? 128000;
    const contextBuilder = new ContextBuilder(contextWindow);

    const { messages: llmMessages } = contextBuilder.build(
      query,
      noteContents,
      this.currentSession!.messages.slice(0, -1), // exclude current user msg
      this.settings.chat.maxHistoryTurns
    );

    // 5. Generate response
    const response = await this.aiService.generateText(llmMessages);

    // 6. Create assistant message
    const assistantMessage = createChatMessage(
      'assistant',
      response.success ? response.text : `Error: ${response.error}`,
      sources
    );

    this.currentSession!.messages.push(assistantMessage);

    // 7. Save session
    await this.sessionRepository.save(this.currentSession!);

    return assistantMessage;
  }

  private async readNoteContents(sources: SourceNote[]): Promise<NoteContent[]> {
    const contents: NoteContent[] = [];

    for (const source of sources) {
      const content = await this.vaultReader.readNote(source.notePath);
      if (content !== null) {
        contents.push({
          title: source.title,
          path: source.notePath,
          content,
          similarity: source.similarity,
        });
      }
    }

    return contents;
  }
}
