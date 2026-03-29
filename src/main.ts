import { Plugin, WorkspaceLeaf } from 'obsidian';
import { VaultChatSettings, DEFAULT_SETTINGS } from './settings';
import { AIService } from './core/application/services/ai-service';
import { ChatService } from './core/application/services/chat-service';
import { NoteExportService } from './core/application/services/note-export-service';
import { VaultEmbeddingsRetriever } from './adapters/retrieval/vault-embeddings-retriever';
import { SessionRepository } from './adapters/storage/session-repository';
import { ChatView, VIEW_TYPE_VAULT_CHAT } from './ui/chat-view';
import { VaultChatSettingTab } from './ui/settings-tab';
import { ClaudeProvider } from './adapters/llm/claude-provider';
import { OpenAIProvider } from './adapters/llm/openai-provider';
import { GeminiProvider } from './adapters/llm/gemini-provider';

export default class VaultChatPlugin extends Plugin {
  settings!: VaultChatSettings;
  aiService!: AIService;
  private chatService!: ChatService;
  private noteExportService!: NoteExportService;
  private retrievalService!: VaultEmbeddingsRetriever;

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
    this.chatService = new ChatService(
      this.app,
      this.aiService,
      this.retrievalService,
      sessionRepository,
      this.settings
    );
    this.noteExportService = new NoteExportService(
      this.app,
      this.aiService,
      this.settings
    );

    // 3. View
    this.registerView(VIEW_TYPE_VAULT_CHAT, (leaf) =>
      new ChatView(leaf, this.chatService, this.noteExportService, this.retrievalService)
    );

    // 4. Commands
    this.addCommand({
      id: 'open-vault-chat',
      name: 'Open Vault Chat',
      callback: () => this.activateView(),
    });

    // 5. Ribbon
    this.addRibbonIcon('message-circle', 'Vault Chat', () =>
      this.activateView()
    );

    // 6. Settings tab
    this.addSettingTab(new VaultChatSettingTab(this.app, this));
  }

  onunload(): void {
    // View cleanup is automatic via registerView
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
