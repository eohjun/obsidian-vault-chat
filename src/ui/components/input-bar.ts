export class InputBar {
  private inputEl!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;

  constructor(
    private readonly containerEl: HTMLElement,
    private readonly onSend: (query: string) => void
  ) {
    this.render();
  }

  private render(): void {
    this.inputEl = this.containerEl.createEl('textarea', {
      cls: 'vault-chat-input',
      attr: {
        placeholder: 'Ask about your notes...',
        rows: '2',
      },
    });

    this.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
    });

    this.sendBtn = this.containerEl.createEl('button', {
      cls: 'vault-chat-send-btn',
      text: 'Send',
    });
    this.sendBtn.addEventListener('click', () => this.send());
  }

  private send(): void {
    const query = this.inputEl.value.trim();
    if (!query) return;
    this.onSend(query);
    this.inputEl.value = '';
  }

  setDisabled(disabled: boolean): void {
    this.inputEl.disabled = disabled;
    this.sendBtn.disabled = disabled;
  }

  focus(): void {
    this.inputEl.focus();
  }
}
