import { Plugin } from 'obsidian';

export default class VaultChatPlugin extends Plugin {
  async onload(): Promise<void> {
    console.log('Vault Chat plugin loaded');
  }

  onunload(): void {
    console.log('Vault Chat plugin unloaded');
  }
}
