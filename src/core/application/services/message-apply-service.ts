import { INoteWriter } from '../../domain/interfaces/i-note-writer';

export interface MessageApplyConfig {
  outputFolder: string;
}

export class MessageApplyService {
  constructor(
    private readonly noteWriter: INoteWriter,
    private settings: MessageApplyConfig
  ) {}

  updateSettings(settings: MessageApplyConfig): void {
    this.settings = settings;
  }

  async insertAtCursor(content: string): Promise<boolean> {
    return this.noteWriter.insertAtCursor(content);
  }

  async appendToNote(notePath: string, content: string): Promise<void> {
    await this.noteWriter.appendToNote(notePath, content);
  }

  async createNewNote(content: string): Promise<string> {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const timestamp = now.toISOString().replace(/[:.]/g, '').slice(0, 15);

    const frontmatter = [
      '---',
      `date: ${date}`,
      `type: vault-chat-response`,
      `tags:`,
      `  - vault-chat`,
      '---',
    ].join('\n');

    const fullContent = `${frontmatter}\n\n${content}\n`;
    const fileName = `VaultChat_${timestamp}.md`;

    return this.noteWriter.createNote(
      this.settings.outputFolder,
      fileName,
      fullContent
    );
  }
}
