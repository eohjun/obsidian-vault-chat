import { getModelConfig } from '../../domain/constants/model-configs';
import { ChatMessage, SourceNote, createChatMessage } from '../../domain/entities/chat-message';
import { ChatSession, createChatSession } from '../../domain/entities/chat-session';
import { IVaultReader } from '../../domain/interfaces/i-vault-reader';
import { IRetrievalService } from '../../domain/interfaces/i-retrieval-service';
import { ISessionRepository } from '../../domain/interfaces/i-session-repository';
import type { IEmbeddingGateway } from '../../domain/interfaces/i-embedding-gateway';
import type { StreamCallback } from '../../domain/interfaces/i-ai-provider';
import { AIService } from './ai-service';
import { ContextBuilder, NoteContent } from './context-builder';
import { ChunkSearchService } from './chunk-search-service';
import { extractSectionContent } from './note-chunker';

export interface ChatServiceConfig {
  ai: { provider: string; models: Record<string, string> };
  retrieval: {
    topK: number;
    similarityThreshold: number;
    targetFolder: string;
    chunkSearch?: boolean;
    topKChunks?: number;
  };
  chat: { maxHistoryTurns: number; maxSessions: number };
}

export class ChatService {
  private currentSession: ChatSession | null = null;

  constructor(
    private readonly vaultReader: IVaultReader,
    private readonly aiService: AIService,
    private readonly retrievalService: IRetrievalService,
    private readonly sessionRepository: ISessionRepository,
    private settings: ChatServiceConfig,
    private chunkSearchService?: ChunkSearchService,
    private embeddingGateway?: IEmbeddingGateway
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

    // 2. Search relevant notes (chunk or note-level)
    const useChunkSearch =
      this.settings.retrieval.chunkSearch &&
      this.chunkSearchService &&
      this.embeddingGateway?.isAvailable();

    let sources: SourceNote[];
    let noteContents: NoteContent[];

    if (useChunkSearch) {
      const result = await this.searchByChunks(query);
      sources = result.sources;
      noteContents = result.noteContents;
    } else {
      sources = await this.retrievalService.search(query, {
        limit: this.settings.retrieval.topK,
        threshold: this.settings.retrieval.similarityThreshold,
        targetFolder: this.settings.retrieval.targetFolder,
      });
      noteContents = await this.readNoteContents(sources);
    }

    // 3. Build LLM context (auto-detects chunk mode via sectionHeading)
    const currentModel = this.settings.ai.models[this.settings.ai.provider];
    const modelConfig = getModelConfig(currentModel);
    const contextWindow = modelConfig?.contextWindow ?? 128000;
    const contextBuilder = new ContextBuilder(contextWindow);

    const { messages: llmMessages } = contextBuilder.build(
      query,
      noteContents,
      this.currentSession!.messages.slice(0, -1),
      this.settings.chat.maxHistoryTurns
    );

    // 4. Generate response
    const response = await this.aiService.generateText(llmMessages);

    // 5. Create assistant message
    const assistantMessage = createChatMessage(
      'assistant',
      response.success ? response.text : `Error: ${response.error}`,
      sources
    );

    this.currentSession!.messages.push(assistantMessage);

    // 6. Save session
    await this.sessionRepository.save(this.currentSession!);

    return assistantMessage;
  }

  /**
   * Send a message with streaming response.
   * onToken is called for each received token chunk.
   * Returns the final assistant message after stream completes.
   */
  async sendMessageStreaming(
    query: string,
    onToken: StreamCallback
  ): Promise<ChatMessage> {
    if (!this.currentSession) {
      await this.createSession();
    }

    const userMessage = createChatMessage('user', query);
    this.currentSession!.messages.push(userMessage);

    if (this.currentSession!.messages.length === 1) {
      this.currentSession!.title = query.slice(0, 50) + (query.length > 50 ? '...' : '');
    }

    // Search (same logic as sendMessage)
    const useChunkSearch =
      this.settings.retrieval.chunkSearch &&
      this.chunkSearchService &&
      this.embeddingGateway?.isAvailable();

    let sources: SourceNote[];
    let noteContents: NoteContent[];

    if (useChunkSearch) {
      const result = await this.searchByChunks(query);
      sources = result.sources;
      noteContents = result.noteContents;
    } else {
      sources = await this.retrievalService.search(query, {
        limit: this.settings.retrieval.topK,
        threshold: this.settings.retrieval.similarityThreshold,
        targetFolder: this.settings.retrieval.targetFolder,
      });
      noteContents = await this.readNoteContents(sources);
    }

    // Build context
    const currentModel = this.settings.ai.models[this.settings.ai.provider];
    const modelConfig = getModelConfig(currentModel);
    const contextWindow = modelConfig?.contextWindow ?? 128000;
    const contextBuilder = new ContextBuilder(contextWindow);

    const { messages: llmMessages } = contextBuilder.build(
      query,
      noteContents,
      this.currentSession!.messages.slice(0, -1),
      this.settings.chat.maxHistoryTurns
    );

    // Stream response
    const response = await this.aiService.streamText(llmMessages, onToken);

    const assistantMessage = createChatMessage(
      'assistant',
      response.success ? response.text : `Error: ${response.error}`,
      sources
    );

    this.currentSession!.messages.push(assistantMessage);
    await this.sessionRepository.save(this.currentSession!);

    return assistantMessage;
  }

  private async searchByChunks(
    query: string
  ): Promise<{ sources: SourceNote[]; noteContents: NoteContent[] }> {
    const queryVector = await this.embeddingGateway!.embedText(query);

    // Build exclude list: all folders EXCEPT targetFolder
    const allFolders = (this.vaultReader as any).getAllFolders?.() ?? [];
    const excludeFolders = allFolders.filter(
      (folder: string) => !folder.startsWith(this.settings.retrieval.targetFolder)
    );

    const chunkResults = await this.chunkSearchService!.search(queryVector, {
      limit: this.settings.retrieval.topKChunks ?? 15,
      threshold: this.settings.retrieval.similarityThreshold,
      excludeFolders,
    });

    // Read note contents and extract section content
    const sources: SourceNote[] = [];
    const noteContents: NoteContent[] = [];
    const seenNotes = new Set<string>();

    for (const result of chunkResults) {
      // Track unique source notes
      if (!seenNotes.has(result.notePath)) {
        seenNotes.add(result.notePath);
      }

      sources.push({
        notePath: result.notePath,
        title: result.noteTitle,
        similarity: result.similarity,
        sectionHeading: result.sectionHeading,
      });

      // Read full note and extract the matching section
      const fullContent = await this.vaultReader.readNote(result.notePath);
      if (fullContent) {
        const sectionContent = extractSectionContent(
          fullContent,
          result.sectionHeading
        );
        noteContents.push({
          title: result.noteTitle,
          path: result.notePath,
          content: sectionContent ?? fullContent,
          similarity: result.similarity,
          sectionHeading: result.sectionHeading,
          chunkId: result.chunkId,
        });
      }
    }

    return { sources, noteContents };
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
