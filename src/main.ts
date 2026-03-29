import { Plugin } from 'obsidian';
import { VaultChatSettings, DEFAULT_SETTINGS } from './settings';
import { AIService } from './core/application/services/ai-service';

export default class VaultChatPlugin extends Plugin {
  settings!: VaultChatSettings;
  aiService!: AIService;

  async onload(): Promise<void> {
    await this.loadSettings();
    console.log('Vault Chat plugin loaded');
  }

  onunload(): void {
    console.log('Vault Chat plugin unloaded');
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
