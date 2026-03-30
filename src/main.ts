import { Plugin, WorkspaceLeaf, Notice, TFile, TAbstractFile, debounce } from 'obsidian';
import { ProgressModal } from './ui/progress-modal';
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

    // 9. Vault events for incremental chunk updates
    this.registerVaultEvents();
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

    const modal = new ProgressModal(this.app, 'Building Chunk Index');
    modal.open();

    try {
      const result = await this.chunkEmbeddingService.buildIndex(
        this.settings.retrieval.targetFolder,
        [],
        (progress) => {
          const pct = progress.total > 0
            ? (progress.completed / progress.total) * 100
            : 0;
          modal.updateProgress({
            current: progress.completed,
            total: progress.total,
            message: progress.currentNote
              ? `Processing: ${progress.currentNote}`
              : 'Preparing...',
            percentage: pct,
          });
        }
      );

      modal.setComplete(
        `Complete: ${result.embedded} chunks embedded, ${result.skipped} skipped, ${result.failed} failed`
      );
    } catch (e) {
      modal.setError(`Failed: ${e}`);
    }
  }

  private registerVaultEvents(): void {
    // Debounce modify events (5s) to avoid re-embedding during rapid edits
    const debouncedModify = debounce(
      (file: TAbstractFile) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.onNoteModified(file);
        }
      },
      5000,
      true
    );

    this.registerEvent(
      this.app.vault.on('modify', debouncedModify)
    );

    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.onNoteDeleted(file);
        }
      })
    );

    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.onNoteRenamed(file, oldPath);
        }
      })
    );

    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.onNoteModified(file);
        }
      })
    );
  }

  private async onNoteModified(file: TFile): Promise<void> {
    if (!this.shouldAutoUpdateChunks()) return;
    if (!this.isInTargetFolder(file.path)) return;

    try {
      const result = await this.chunkEmbeddingService!.updateNote(
        file.path,
        file.basename
      );
      if (!result.skipped) {
        console.log(`Chunk auto-update: ${file.basename} → ${result.embedded} chunks`);
      }
    } catch (err) {
      console.error(`Chunk auto-update failed for ${file.path}:`, err);
    }
  }

  private async onNoteDeleted(file: TFile): Promise<void> {
    if (!this.shouldAutoUpdateChunks()) return;
    if (!this.isInTargetFolder(file.path)) return;

    try {
      await this.chunkEmbeddingService!.deleteNote(file.path);
      console.log(`Chunk auto-delete: ${file.basename}`);
    } catch (err) {
      console.error(`Chunk delete failed for ${file.path}:`, err);
    }
  }

  private async onNoteRenamed(file: TFile, oldPath: string): Promise<void> {
    if (!this.shouldAutoUpdateChunks()) return;

    try {
      // Delete chunks for old path
      if (this.isInTargetFolder(oldPath)) {
        await this.chunkEmbeddingService!.deleteNote(oldPath);
      }

      // Re-embed under new path if still in target folder
      if (this.isInTargetFolder(file.path)) {
        await this.chunkEmbeddingService!.updateNote(file.path, file.basename);
      }
    } catch (err) {
      console.error(`Chunk rename update failed for ${file.path}:`, err);
    }
  }

  private shouldAutoUpdateChunks(): boolean {
    return (
      !!this.settings.retrieval.chunkSearch &&
      !!this.chunkEmbeddingService &&
      !!this.embeddingGateway?.isAvailable()
    );
  }

  private isInTargetFolder(path: string): boolean {
    return path.startsWith(this.settings.retrieval.targetFolder + '/');
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
