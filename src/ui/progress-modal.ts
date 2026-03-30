import { App, Modal } from 'obsidian';

export interface ProgressUpdate {
  current: number;
  total: number;
  message: string;
  percentage: number;
}

export class ProgressModal extends Modal {
  private progressBar!: HTMLDivElement;
  private progressFill!: HTMLDivElement;
  private statusText!: HTMLDivElement;
  private percentageText!: HTMLDivElement;
  private closeBtn!: HTMLButtonElement;

  constructor(app: App, private readonly title: string) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('vault-chat-progress-modal');

    contentEl.createEl('h3', { text: this.title });

    this.statusText = contentEl.createDiv({ cls: 'vc-progress-status' });
    this.statusText.setText('Preparing...');

    this.progressBar = contentEl.createDiv({ cls: 'vc-progress-bar' });
    this.progressFill = this.progressBar.createDiv({ cls: 'vc-progress-fill' });
    this.progressFill.style.width = '0%';

    this.percentageText = contentEl.createDiv({ cls: 'vc-progress-percentage' });
    this.percentageText.setText('0 / 0 (0%)');

    const buttonContainer = contentEl.createDiv({ cls: 'vc-progress-buttons' });
    this.closeBtn = buttonContainer.createEl('button', { text: 'Close' });
    this.closeBtn.disabled = true;
    this.closeBtn.addEventListener('click', () => this.close());

    // Apply inline styles (no external CSS dependency)
    this.applyStyles();
  }

  updateProgress(update: ProgressUpdate): void {
    this.statusText.setText(update.message);
    this.progressFill.style.width = `${Math.min(update.percentage, 100)}%`;
    this.percentageText.setText(
      `${update.current} / ${update.total} (${Math.round(update.percentage)}%)`
    );
  }

  setComplete(message: string): void {
    this.statusText.setText(message);
    this.progressFill.style.width = '100%';
    this.progressFill.style.backgroundColor = 'var(--interactive-success, #28a745)';
    this.closeBtn.disabled = false;
    this.closeBtn.addClass('mod-cta');
  }

  setError(message: string): void {
    this.statusText.setText(message);
    this.progressFill.style.backgroundColor = 'var(--text-error, #dc3545)';
    this.closeBtn.disabled = false;
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private applyStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .vault-chat-progress-modal { padding: 1em; min-width: 400px; }
      .vc-progress-status { margin: 1em 0 0.5em; color: var(--text-muted); font-size: 0.9em; }
      .vc-progress-bar {
        width: 100%; height: 8px; border-radius: 4px;
        background: var(--background-modifier-border);
        overflow: hidden; margin: 0.5em 0;
      }
      .vc-progress-fill {
        height: 100%; border-radius: 4px;
        background: var(--interactive-accent);
        transition: width 0.3s ease;
      }
      .vc-progress-percentage { text-align: center; font-size: 0.85em; color: var(--text-muted); margin: 0.5em 0 1em; }
      .vc-progress-buttons { display: flex; justify-content: flex-end; }
    `;
    this.contentEl.prepend(style);
  }
}
