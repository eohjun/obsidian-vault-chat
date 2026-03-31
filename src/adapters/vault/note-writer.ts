import { App, normalizePath, TFile } from 'obsidian';
import { INoteWriter } from '../../core/domain/interfaces/i-note-writer';

export class NoteWriter implements INoteWriter {
  constructor(private readonly app: App) {}

  async createNote(folderPath: string, fileName: string, content: string): Promise<string> {
    const filePath = normalizePath(`${folderPath}/${fileName}`);

    if (!this.folderExists(folderPath)) {
      await this.createFolder(folderPath);
    }

    await this.app.vault.create(filePath, content);
    return filePath;
  }

  folderExists(path: string): boolean {
    return this.app.vault.getAbstractFileByPath(path) !== null;
  }

  async createFolder(path: string): Promise<void> {
    await this.app.vault.createFolder(path);
  }

  async appendToNote(notePath: string, content: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(notePath);
    if (!(file instanceof TFile)) {
      throw new Error(`File not found: ${notePath}`);
    }
    await this.app.vault.process(file, (data) => data + '\n\n' + content);
  }

  async insertAtCursor(content: string): Promise<boolean> {
    const editor = this.app.workspace.activeEditor?.editor;
    if (!editor) return false;
    editor.replaceSelection(content);
    return true;
  }
}
