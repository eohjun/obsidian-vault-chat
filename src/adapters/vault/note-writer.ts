import { App, normalizePath } from 'obsidian';
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
}
