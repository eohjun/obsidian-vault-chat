import { App, MarkdownRenderer, Component } from 'obsidian';
import { ChatMessage } from '../../core/domain/entities/chat-message';

export class MessageList {
  private component: Component;
  private streamingEl: HTMLElement | null = null;
  private streamingContent = '';

  constructor(
    private readonly containerEl: HTMLElement,
    private readonly app: App
  ) {
    this.component = new Component();
    this.component.load();
  }

  render(messages: ChatMessage[]): void {
    this.containerEl.empty();
    this.streamingEl = null;
    this.streamingContent = '';

    if (messages.length === 0) {
      this.containerEl.createEl('div', {
        cls: 'vault-chat-empty',
        text: 'Ask a question about your vault notes.',
      });
      return;
    }

    for (const message of messages) {
      this.renderMessage(message);
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
   * Finish streaming: re-render with full markdown.
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

    this.streamingEl = null;
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
  }

  scrollToBottom(): void {
    this.containerEl.scrollTop = this.containerEl.scrollHeight;
  }

  destroy(): void {
    this.component.unload();
  }
}
