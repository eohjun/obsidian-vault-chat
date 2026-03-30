import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import {
  AIProviderType,
  AI_PROVIDERS,
  getModelsByProvider,
} from 'obsidian-llm-shared';
import type VaultChatPlugin from '../main';

export class VaultChatSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: VaultChatPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Vault Chat Settings' });

    this.renderAISection(containerEl);
    this.renderRetrievalSection(containerEl);
    this.renderChatSection(containerEl);
    this.renderExportSection(containerEl);
  }

  private renderAISection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'AI Provider' });

    const SUPPORTED_PROVIDERS = ['claude', 'openai', 'gemini'];
    const providerOptions: Record<string, string> = {};
    for (const [id, config] of Object.entries(AI_PROVIDERS)) {
      if (!SUPPORTED_PROVIDERS.includes(id)) continue;
      providerOptions[id] = config.displayName;
    }

    new Setting(containerEl)
      .setName('Provider')
      .setDesc('Select AI provider for chat responses')
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(providerOptions)
          .setValue(this.plugin.settings.ai.provider)
          .onChange(async (value) => {
            this.plugin.settings.ai.provider = value as AIProviderType;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    // API key
    const currentProvider = this.plugin.settings.ai.provider;
    const providerConfig = AI_PROVIDERS[currentProvider];

    new Setting(containerEl)
      .setName(`${providerConfig.displayName} API Key`)
      .setDesc(`Enter your ${providerConfig.displayName} API key`)
      .addText((text) => {
        text.inputEl.type = 'password';
        text.inputEl.placeholder = providerConfig.apiKeyPrefix
          ? `${providerConfig.apiKeyPrefix}...`
          : 'Enter API key';
        text
          .setValue(this.plugin.settings.ai.apiKeys[currentProvider] || '')
          .onChange(async (value) => {
            this.plugin.settings.ai.apiKeys[currentProvider] = value;
            await this.plugin.saveSettings();
          });
      });

    // Model selector - use getModelsByProvider from obsidian-llm-shared
    const models = getModelsByProvider(currentProvider);
    const modelOptions: Record<string, string> = {};
    for (const model of models) {
      if (model.deprecated) continue;
      modelOptions[model.id] = model.displayName;
    }

    new Setting(containerEl)
      .setName('Model')
      .setDesc('Select the AI model')
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(modelOptions)
          .setValue(
            this.plugin.settings.ai.models[currentProvider] ||
              providerConfig.defaultModel
          )
          .onChange(async (value) => {
            this.plugin.settings.ai.models[currentProvider] = value;
            await this.plugin.saveSettings();
          })
      );

    // Test button
    new Setting(containerEl)
      .setName('Test Connection')
      .setDesc('Verify your API key works')
      .addButton((button) =>
        button
          .setButtonText('Test')
          .setCta()
          .onClick(async () => {
            button.setDisabled(true);
            button.setButtonText('Testing...');
            try {
              const ok = await this.plugin.aiService.testApiKey(currentProvider);
              new Notice(ok ? 'API key is valid!' : 'API key is invalid');
            } catch {
              new Notice('Connection test failed');
            } finally {
              button.setDisabled(false);
              button.setButtonText('Test');
            }
          })
      );

    // Temperature
    new Setting(containerEl)
      .setName('Temperature')
      .setDesc('Controls randomness (0.0 = focused, 1.0 = creative)')
      .addSlider((slider) =>
        slider
          .setLimits(0, 1, 0.1)
          .setValue(this.plugin.settings.ai.temperature)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.ai.temperature = value;
            await this.plugin.saveSettings();
          })
      );
  }

  private renderRetrievalSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Retrieval' });

    new Setting(containerEl)
      .setName('Top K Notes')
      .setDesc('Number of relevant notes to include as context')
      .addSlider((slider) =>
        slider
          .setLimits(1, 20, 1)
          .setValue(this.plugin.settings.retrieval.topK)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.retrieval.topK = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Similarity Threshold')
      .setDesc('Minimum similarity score (0.0-1.0)')
      .addSlider((slider) =>
        slider
          .setLimits(0, 0.9, 0.05)
          .setValue(this.plugin.settings.retrieval.similarityThreshold)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.retrieval.similarityThreshold = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Target Folder')
      .setDesc('Folder to search for notes')
      .addText((text) =>
        text
          .setValue(this.plugin.settings.retrieval.targetFolder)
          .onChange(async (value) => {
            this.plugin.settings.retrieval.targetFolder = value;
            await this.plugin.saveSettings();
          })
      );

    // Chunk search settings
    containerEl.createEl('h4', { text: 'Chunk Search' });

    new Setting(containerEl)
      .setName('Enable Chunk Search')
      .setDesc(
        'Split notes into sections and search at section level for more precise results. Requires Vault Embeddings plugin.'
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.retrieval.chunkSearch)
          .onChange(async (value) => {
            this.plugin.settings.retrieval.chunkSearch = value;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    if (this.plugin.settings.retrieval.chunkSearch) {
      new Setting(containerEl)
        .setName('Top K Chunks')
        .setDesc('Number of chunk results to include as context')
        .addSlider((slider) =>
          slider
            .setLimits(5, 30, 1)
            .setValue(this.plugin.settings.retrieval.topKChunks)
            .setDynamicTooltip()
            .onChange(async (value) => {
              this.plugin.settings.retrieval.topKChunks = value;
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName('Build Chunk Index')
        .setDesc('Build or update the chunk index for all notes')
        .addButton((button) =>
          button
            .setButtonText('Build Index')
            .setCta()
            .onClick(async () => {
              button.setDisabled(true);
              button.setButtonText('Building...');
              try {
                await this.plugin.buildChunkIndex();
                new Notice('Chunk index built successfully');
              } catch (e) {
                new Notice(`Failed to build chunk index: ${e}`);
              } finally {
                button.setDisabled(false);
                button.setButtonText('Build Index');
              }
            })
        )
        .addButton((button) =>
          button
            .setButtonText('Clear Index')
            .setWarning()
            .onClick(async () => {
              await this.plugin.clearChunkIndex();
              new Notice('Chunk index cleared');
            })
        );
    }
  }

  private renderChatSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Chat' });

    new Setting(containerEl)
      .setName('Max History Turns')
      .setDesc('Number of previous turns sent to LLM')
      .addSlider((slider) =>
        slider
          .setLimits(2, 30, 1)
          .setValue(this.plugin.settings.chat.maxHistoryTurns)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.chat.maxHistoryTurns = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Max Sessions')
      .setDesc('Number of recent sessions to keep')
      .addSlider((slider) =>
        slider
          .setLimits(1, 20, 1)
          .setValue(this.plugin.settings.chat.maxSessions)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.chat.maxSessions = value;
            await this.plugin.saveSettings();
          })
      );
  }

  private renderExportSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Export' });

    new Setting(containerEl)
      .setName('Output Folder')
      .setDesc('Folder for exported notes')
      .addText((text) =>
        text
          .setValue(this.plugin.settings.export.outputFolder)
          .onChange(async (value) => {
            this.plugin.settings.export.outputFolder = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
