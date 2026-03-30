import { Plugin, WorkspaceLeaf, Notice, TFolder } from 'obsidian';
import { VaultChatSettings, DEFAULT_SETTINGS } from './settings';
import { AIService } from './core/application/services/ai-service';
import { ChatService } from './core/application/services/chat-service';
import { NoteExportService } from './core/application/services/note-export-service';
import { ChunkEmbeddingService, INoteFileProvider, NoteFile } from './core/application/services/chunk-embedding-service';
import { ChunkSearchService } from './core/application/services/chunk-search-service';
import { VaultEmbeddingsRetriever } from './adapters/retrieval/vault-embeddings-retriever';
import { VaultEmbeddingsGateway } from './adapters/embedding/vault-embeddings-gateway';
import { SessionRepository } from './adapters/storage/session-repository';
import { ChunkEmbeddingRepository } from './adapters/storage/chunk-embedding-repository';
import { VaultReader } from './adapters/vault/vault-reader';
import { NoteWriter } from './adapters/vault/note-writer';
import { ChatView, VIEW_TYPE_VAULT_CHAT } from './ui/chat-view';
import { VaultChatSettingTab } from './ui/settings-tab';
import { ClaudeProvider } from './adapters/llm/claude-provider';
import { OpenAIProvider } from './adapters/llm/openai-provider';
import { GeminiProvider } from './adapters/llm/gemini-provider';

class ObsidianNoteFileProvider implements INoteFileProvider {
  constructor(private readonly app: import('obsidian').App) {}

  getNotesInFolder(targetFolder: string, excludeFolders: string[]): NoteFile[] {
    return this.app.vault
      .getMarkdownFiles()
      .filter((f) => {
        if (!f.path.startsWith(targetFolder + '/')) return false;
        return !excludeFolders.some((ex) => f.path.startsWith(ex + '/'));
      })
      .map((f) => ({ path: f.path, basename: f.basename }));
  }
}

export default class VaultChatPlugin extends Plugin {
  settings!: VaultChatSettings;
  aiService!: AIService;
  private chatService!: ChatService;
  private noteExportService!: NoteExportService;
  private retrievalService!: VaultEmbeddingsRetriever;
  private chunkEmbeddingService?: ChunkEmbeddingService;
  private chunkSearchService?: ChunkSearchService;
  private embeddingGateway?: VaultEmbeddingsGateway;
  private chunkRepository?: ChunkEmbeddingRepository;

  async onload(): Promise<void> {
    // 1. Settings
    await this.loadSettings();

    // 2. Services
    const providers = new Map();
    providers.set('claude', new ClaudeProvider());
    providers.set('openai', new OpenAIProvider());
    providers.set('gemini', new GeminiProvider());
    this.aiService = new AIService(this.settings.ai, providers);
    this.retrievalService = new VaultEmbeddingsRetriever(this.app);
    const sessionRepository = new SessionRepository(this);

    const vaultReader = new VaultReader(this.app);
    const noteWriter = new NoteWriter(this.app);

    // 3. Chunk search services
    this.embeddingGateway = new VaultEmbeddingsGateway(this.app);
    this.chunkRepository = new ChunkEmbeddingRepository(this);
    await this.chunkRepository.initialize();

    this.chunkSearchService = new ChunkSearchService(this.chunkRepository);
    this.chunkEmbeddingService = new ChunkEmbeddingService(
      this.chunkRepository,
      this.embeddingGateway,
      vaultReader,
      new ObsidianNoteFileProvider(this.app)
    );

    // 4. Chat service (with optional chunk search)
    this.chatService = new ChatService(
      vaultReader,
      this.aiService,
      this.retrievalService,
      sessionRepository,
      this.settings,
      this.chunkSearchService,
      this.embeddingGateway
    );
    this.noteExportService = new NoteExportService(
      noteWriter,
      this.aiService,
      this.settings.export
    );

    // 5. View
    this.registerView(VIEW_TYPE_VAULT_CHAT, (leaf) =>
      new ChatView(leaf, this.chatService, this.noteExportService, this.retrievalService)
    );

    // 6. Commands
    this.addCommand({
      id: 'open-vault-chat',
      name: 'Open Vault Chat',
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: 'build-chunk-index',
      name: 'Build Chunk Index',
      callback: () => this.buildChunkIndex(),
    });

    this.addCommand({
      id: 'update-stale-chunks',
      name: 'Update Stale Chunks',
      callback: () => this.buildChunkIndex(),
    });

    this.addCommand({
      id: 'clear-chunk-index',
      name: 'Clear Chunk Index',
      callback: () => this.clearChunkIndex(),
    });

    // 7. Ribbon
    this.addRibbonIcon('message-circle', 'Vault Chat', () =>
      this.activateView()
    );

    // 8. Settings tab
    this.addSettingTab(new VaultChatSettingTab(this.app, this));
  }

  onunload(): void {
    this.aiService.abort();
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.aiService.updateSettings(this.settings.ai);
    this.chatService.updateSettings(this.settings);
    this.noteExportService.updateSettings(this.settings.export);
  }

  async buildChunkIndex(): Promise<void> {
    if (!this.chunkEmbeddingService) {
      new Notice('Chunk embedding service not initialized');
      return;
    }

    new Notice('Building chunk index...');

    try {
      const result = await this.chunkEmbeddingService.buildIndex(
        this.settings.retrieval.targetFolder,
        [],
        (progress) => {
          if (progress.completed % 50 === 0) {
            new Notice(
              `Chunk index: ${progress.completed}/${progress.total} notes processed`
            );
          }
        }
      );

      new Notice(
        `Chunk index complete: ${result.embedded} chunks, ${result.skipped} skipped, ${result.failed} failed`
      );
    } catch (e) {
      new Notice(`Failed to build chunk index: ${e}`);
    }
  }

  async clearChunkIndex(): Promise<void> {
    if (!this.chunkEmbeddingService) return;
    await this.chunkEmbeddingService.clearIndex();
    new Notice('Chunk index cleared');
  }

  private async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_VAULT_CHAT)[0];
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: VIEW_TYPE_VAULT_CHAT,
          active: true,
        });
        leaf = rightLeaf;
      }
    }
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
}
