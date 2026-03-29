import { App, TFile } from 'obsidian';
import { IVaultReader } from '../../core/domain/interfaces/i-vault-reader';

export class VaultReader implements IVaultReader {
  constructor(private readonly app: App) {}

  async readNote(notePath: string): Promise<string | null> {
    const file = this.app.vault.getAbstractFileByPath(notePath);
    if (file instanceof TFile) {
      try {
        return await this.app.vault.cachedRead(file);
      } catch {
        return null;
      }
    }
    return null;
  }
}
