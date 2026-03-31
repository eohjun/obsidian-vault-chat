import { App, MarkdownRenderer, Component, setIcon } from 'obsidian';
import { ChatMessage } from '../../core/domain/entities/chat-message';

export interface MessageActionCallbacks {
  onCopy: (content: string) => void;
  onInsertAtCursor: (content: string) => void;
  onAppendToNote: (content: string) => void;
  onCreateNewNote: (content: string) => void;
  onInsertIntoNote: (content: string) => void;
}

export interface MessageListOptions {
  actionCallbacks?: MessageActionCallbacks;
  examplePrompts?: string[];
  onExamplePromptClick?: (prompt: string) => void;
}

export class MessageList {
  private component: Component;
  private streamingEl: HTMLElement | null = null;
  private streamingMsgEl: HTMLElement | null = null;
  private streamingContent = '';
  private options: MessageListOptions;

  constructor(
    private readonly containerEl: HTMLElement,
    private readonly app: App,
    options?: MessageListOptions
  ) {
    this.options = options || {};
    this.component = new Component();
    this.component.load();

    // Single global listener to close all open dropdown menus
    this.component.registerDomEvent(document, 'click', () => {
      this.containerEl
        .querySelectorAll('.vault-chat-apply-menu.is-visible')
        .forEach((el) => el.removeClass('is-visible'));
    });

    this.component.registerDomEvent(document, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.containerEl
          .querySelectorAll('.vault-chat-apply-menu.is-visible')
          .forEach((el) => el.removeClass('is-visible'));
      }
    });
  }

  render(messages: ChatMessage[]): void {
    this.containerEl.empty();
    this.streamingEl = null;
    this.streamingMsgEl = null;
    this.streamingContent = '';

    if (messages.length === 0) {
      this.renderWelcome();
      return;
    }

    for (const message of messages) {
      this.renderMessage(message);
    }
  }

  private renderWelcome(): void {
    const welcomeEl = this.containerEl.createEl('div', { cls: 'vault-chat-welcome' });

    const iconEl = welcomeEl.createEl('div', { cls: 'vault-chat-welcome-icon' });
    setIcon(iconEl, 'message-circle');
    welcomeEl.createEl('h3', { text: 'Vault Chat' });
    welcomeEl.createEl('p', {
      cls: 'vault-chat-welcome-desc',
      text: 'Ask a question about your vault notes.',
    });

    const prompts = this.options.examplePrompts;
    if (prompts && prompts.length > 0 && this.options.onExamplePromptClick) {
      const promptsEl = welcomeEl.createEl('div', { cls: 'vault-chat-example-prompts' });
      for (const prompt of prompts) {
        const btn = promptsEl.createEl('button', {
          cls: 'vault-chat-example-prompt',
          text: prompt,
        });
        btn.addEventListener('click', () => {
          this.options.onExamplePromptClick!(prompt);
        });
      }
    }
  }

  /**
   * Start a streaming assistant message placeholder.
   * Call appendToken() to add tokens, finishStreaming() when done.
   */
  startStreaming(): void {
    const msgEl = this.containerEl.createEl('div', {
      cls: 'vault-chat-message vault-chat-message-assistant',
    });
    this.streamingMsgEl = msgEl;

    const roleEl = msgEl.createEl('div', { cls: 'vault-chat-message-role' });
    roleEl.textContent = 'Vault Chat';

    this.streamingEl = msgEl.createEl('div', { cls: 'vault-chat-message-content' });
    this.streamingContent = '';

    // Show typing indicator
    this.streamingEl.textContent = '...';
    this.scrollToBottom();
  }

  /**
   * Append a token chunk to the streaming message.
   */
  appendToken(token: string): void {
    if (!this.streamingEl) return;
    this.streamingContent += token;

    // Render plain text during streaming (fast, no flicker)
    this.streamingEl.textContent = this.streamingContent;
    this.scrollToBottom();
  }

  /**
   * Finish streaming: re-render with full markdown and add action buttons.
   */
  finishStreaming(): void {
    if (!this.streamingEl) return;

    this.streamingEl.empty();
    MarkdownRenderer.render(
      this.app,
      this.streamingContent,
      this.streamingEl,
      '',
      this.component
    );

    // Add action buttons to the streaming message
    if (this.streamingMsgEl && this.options.actionCallbacks) {
      this.renderActions(this.streamingMsgEl, this.streamingContent);
    }

    this.streamingEl = null;
    this.streamingMsgEl = null;
    this.streamingContent = '';
    this.scrollToBottom();
  }

  private renderMessage(message: ChatMessage): void {
    const msgEl = this.containerEl.createEl('div', {
      cls: `vault-chat-message vault-chat-message-${message.role}`,
    });

    const roleEl = msgEl.createEl('div', { cls: 'vault-chat-message-role' });
    roleEl.textContent = message.role === 'user' ? 'You' : 'Vault Chat';

    const contentEl = msgEl.createEl('div', { cls: 'vault-chat-message-content' });

    MarkdownRenderer.render(
      this.app,
      message.content,
      contentEl,
      '',
      this.component
    );

    // Add action buttons for assistant messages only
    if (message.role === 'assistant' && this.options.actionCallbacks) {
      this.renderActions(msgEl, message.content);
    }
  }

  private renderActions(msgEl: HTMLElement, content: string): void {
    const callbacks = this.options.actionCallbacks!;
    const actionsEl = msgEl.createEl('div', { cls: 'vault-chat-message-actions' });

    // Copy button
    const copyBtn = actionsEl.createEl('button', {
      cls: 'vault-chat-action-btn',
      text: 'Copy',
    });
    copyBtn.addEventListener('click', () => {
      callbacks.onCopy(content);
      copyBtn.textContent = 'Copied!';
      copyBtn.addClass('vault-chat-action-btn-feedback');
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
        copyBtn.removeClass('vault-chat-action-btn-feedback');
      }, 2000);
    });

    // Apply dropdown
    const dropdownEl = actionsEl.createEl('div', { cls: 'vault-chat-apply-dropdown' });
    const triggerBtn = dropdownEl.createEl('button', {
      cls: 'vault-chat-action-btn',
      text: 'Apply ▾',
    });
    const menuEl = dropdownEl.createEl('div', { cls: 'vault-chat-apply-menu' });

    const menuItems: Array<{ label: string; action: () => void }> = [
      { label: 'Insert at cursor', action: () => callbacks.onInsertAtCursor(content) },
      { label: 'Append to current note', action: () => callbacks.onAppendToNote(content) },
      { label: 'Create new note', action: () => callbacks.onCreateNewNote(content) },
      { label: 'Insert into note...', action: () => callbacks.onInsertIntoNote(content) },
    ];

    for (const item of menuItems) {
      const itemEl = menuEl.createEl('div', {
        cls: 'vault-chat-apply-menu-item',
        text: item.label,
      });
      itemEl.addEventListener('click', (e) => {
        e.stopPropagation();
        menuEl.removeClass('is-visible');
        item.action();
      });
    }

    triggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close any other open menus first
      this.containerEl
        .querySelectorAll('.vault-chat-apply-menu.is-visible')
        .forEach((el) => el.removeClass('is-visible'));
      menuEl.toggleClass('is-visible', !menuEl.hasClass('is-visible'));
    });
  }

  scrollToBottom(): void {
    this.containerEl.scrollTop = this.containerEl.scrollHeight;
  }

  destroy(): void {
    this.component.unload();
  }
}
