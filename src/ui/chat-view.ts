import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import { ChatService } from '../core/application/services/chat-service';
import { NoteExportService } from '../core/application/services/note-export-service';
import { MessageApplyService } from '../core/application/services/message-apply-service';
import { IRetrievalService } from '../core/domain/interfaces/i-retrieval-service';
import { ChatSession } from '../core/domain/entities/chat-session';
import { VaultChatSettings } from '../settings';
import { MessageList } from './components/message-list';
import { InputBar } from './components/input-bar';
import { SessionSelector } from './components/session-selector';
import { NoteSuggestModal } from './components/note-suggest-modal';

export const VIEW_TYPE_VAULT_CHAT = 'vault-chat-view';

export class ChatView extends ItemView {
  private messageList!: MessageList;
  private inputBar!: InputBar;
  private sessionSelector!: SessionSelector;
  private statusEl!: HTMLElement;
  private isProcessing = false;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly chatService: ChatService,
    private readonly noteExportService: NoteExportService,
    private readonly retrievalService: IRetrievalService,
    private readonly messageApplyService: MessageApplyService,
    private readonly settings: VaultChatSettings
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_VAULT_CHAT;
  }

  getDisplayText(): string {
    return 'Vault Chat';
  }

  getIcon(): string {
    return 'message-circle';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('vault-chat-container');

    if (!this.retrievalService.isAvailable()) {
      this.renderUnavailableState(container as HTMLElement);
      // Re-check every 5 seconds in case the user enables Vault Embeddings after opening
      this.registerInterval(
        window.setInterval(() => {
          if (this.retrievalService.isAvailable()) {
            this.onOpen();
          }
        }, 5000)
      );
      return;
    }

    // Header with session selector
    const headerEl = (container as HTMLElement).createEl('div', { cls: 'vault-chat-header' });
    this.sessionSelector = new SessionSelector(
      headerEl,
      this.chatService,
      (session) => this.onSessionChanged(session)
    );
    await this.sessionSelector.render();

    // Message area
    const messageArea = (container as HTMLElement).createEl('div', { cls: 'vault-chat-messages' });
    this.messageList = new MessageList(messageArea, this.app, {
      actionCallbacks: {
        onCopy: async (content) => {
          try {
            await navigator.clipboard.writeText(content);
            new Notice('Copied to clipboard');
          } catch {
            new Notice('Failed to copy to clipboard');
          }
        },
        onInsertAtCursor: async (content) => {
          const ok = await this.messageApplyService.insertAtCursor(content);
          new Notice(ok ? 'Inserted at cursor' : 'No active editor — open a note first');
        },
        onAppendToNote: async (content) => {
          const activeFile = this.app.workspace.getActiveFile();
          if (!activeFile) {
            new Notice('No active note — open a note first');
            return;
          }
          try {
            await this.messageApplyService.appendToNote(activeFile.path, content);
            new Notice(`Appended to ${activeFile.basename}`);
          } catch (e) {
            new Notice(`Failed to append: ${e}`);
          }
        },
        onCreateNewNote: async (content) => {
          try {
            const path = await this.messageApplyService.createNewNote(content);
            new Notice(`Note created: ${path}`);
          } catch (e) {
            new Notice(`Failed to create note: ${e}`);
          }
        },
        onInsertIntoNote: (content) => {
          new NoteSuggestModal(this.app, async (file) => {
            try {
              await this.messageApplyService.appendToNote(file.path, content);
              new Notice(`Inserted into ${file.basename}`);
            } catch (e) {
              new Notice(`Failed to insert: ${e}`);
            }
          }).open();
        },
      },
      examplePrompts: this.settings.chat.examplePrompts,
      onExamplePromptClick: (prompt) => {
        this.handleSend(prompt);
      },
    });

    // Status indicator
    this.statusEl = (container as HTMLElement).createEl('div', { cls: 'vault-chat-status' });
    this.statusEl.style.display = 'none';

    // Input bar
    const inputArea = (container as HTMLElement).createEl('div', { cls: 'vault-chat-input-area' });
    this.inputBar = new InputBar(inputArea, (query) => this.handleSend(query));

    // Export button
    const footerEl = (container as HTMLElement).createEl('div', { cls: 'vault-chat-footer' });
    const exportBtn = footerEl.createEl('button', {
      cls: 'vault-chat-export-btn',
      text: 'Export to Note',
    });
    exportBtn.addEventListener('click', () => this.handleExport());

    // Load current or create new session
    const sessions = await this.chatService.listSessions();
    if (sessions.length > 0) {
      await this.chatService.loadSession(sessions[0].id);
      this.renderCurrentSession();
    }
  }

  async onClose(): Promise<void> {
    this.messageList?.destroy();
    this.containerEl.empty();
  }

  private renderUnavailableState(container: HTMLElement): void {
    const msgEl = container.createEl('div', { cls: 'vault-chat-unavailable' });
    msgEl.createEl('h3', { text: 'Vault Embeddings Required' });
    msgEl.createEl('p', {
      text: 'Vault Chat requires the Vault Embeddings plugin to search your notes. Please install and configure it, then generate embeddings for your vault.',
    });
  }

  private async handleSend(query: string): Promise<void> {
    if (this.isProcessing || !query.trim()) return;

    this.isProcessing = true;
    this.inputBar.setDisabled(true);
    this.setStatus('Searching notes...');

    try {
      // Render user message immediately
      this.renderCurrentSession();

      // Start streaming placeholder
      this.messageList.startStreaming();
      this.setStatus('');

      await this.chatService.sendMessageStreaming(query, (token) => {
        this.messageList.appendToken(token);
      });

      // Re-render with full markdown and session state
      this.messageList.finishStreaming();
      this.renderCurrentSession();
      await this.sessionSelector.refresh();
    } catch (error) {
      this.messageList.finishStreaming();
      const msg = error instanceof Error ? error.message : 'Unknown error';
      new Notice(`Vault Chat error: ${msg}`);
    } finally {
      this.isProcessing = false;
      this.inputBar.setDisabled(false);
      this.setStatus('');
    }
  }

  private async handleExport(): Promise<void> {
    const session = this.chatService.getCurrentSession();
    if (!session || session.messages.length === 0) {
      new Notice('No conversation to export');
      return;
    }

    this.setStatus('Exporting conversation to note...');

    try {
      const filePath = await this.noteExportService.export(session);
      new Notice(`Note created: ${filePath}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      new Notice(`Export failed: ${msg}`);
    } finally {
      this.setStatus('');
    }
  }

  private async onSessionChanged(session: ChatSession | null): Promise<void> {
    if (session) {
      await this.chatService.loadSession(session.id);
    } else {
      await this.chatService.createSession();
    }
    this.renderCurrentSession();
  }

  private renderCurrentSession(): void {
    const session = this.chatService.getCurrentSession();
    this.messageList.render(session?.messages || []);
    this.messageList.scrollToBottom();
  }

  private setStatus(text: string): void {
    if (!this.statusEl) return;
    if (text) {
      this.statusEl.textContent = text;
      this.statusEl.style.display = 'block';
    } else {
      this.statusEl.style.display = 'none';
    }
  }
}
