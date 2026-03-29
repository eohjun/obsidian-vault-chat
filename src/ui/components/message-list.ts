import { App, MarkdownRenderer, Component } from 'obsidian';
import { ChatMessage } from '../../core/domain/entities/chat-message';

export class MessageList {
  private component: Component;

  constructor(
    private readonly containerEl: HTMLElement,
    private readonly app: App
  ) {
    this.component = new Component();
    this.component.load();
  }

  render(messages: ChatMessage[]): void {
    this.containerEl.empty();

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
