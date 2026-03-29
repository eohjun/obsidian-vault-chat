import { App, TFile, normalizePath } from 'obsidian';
import { LLMMessage } from 'obsidian-llm-shared';
import { ChatSession } from '../../domain/entities/chat-session';
import { AIService } from './ai-service';
import { VaultChatSettings } from '../../../settings';

const EXPORT_SYSTEM_PROMPT = `You are organizing a conversation into a structured Literature Note.

Rules:
- Create a well-structured markdown document with clear headings (H2) and bullet points
- Reference source notes using [[Note Title]] wiki-link syntax
- Organize by topic themes, not by conversation order
- Write a concise title summarizing the key topic discussed
- Write in the same language used in the conversation
- Extract key insights and conclusions, not a verbatim transcript
- Include relevant connections between mentioned notes`;

export class NoteExportService {
  constructor(
    private readonly app: App,
    private readonly aiService: AIService,
    private readonly settings: VaultChatSettings
  ) {}

  async export(session: ChatSession): Promise<string> {
    // 1. Build conversation text for LLM
    const conversationText = session.messages
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    // Collect all source notes
    const allSources = new Set<string>();
    for (const msg of session.messages) {
      for (const src of msg.sources) {
        allSources.add(src.title);
      }
    }

    // 2. Ask LLM to organize the conversation
    const messages: LLMMessage[] = [
      { role: 'system', content: EXPORT_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Organize this conversation into a structured note. Source notes referenced: ${[...allSources].map((s) => `[[${s}]]`).join(', ')}\n\n---\n\n${conversationText}`,
      },
    ];

    const response = await this.aiService.generateText(messages);

    if (!response.success) {
      throw new Error(`Failed to generate note: ${response.error}`);
    }

    // 3. Extract title from LLM response (first H1 or H2, or generate from session)
    const titleMatch = response.text.match(/^#+\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : session.title;

    // 4. Build frontmatter
    const date = new Date().toISOString().split('T')[0];
    const tags = ['vault-chat'];
    const sourcesYaml = [...allSources]
      .map((s) => `  - "[[${s}]]"`)
      .join('\n');

    const frontmatter = [
      '---',
      `title: "${title}"`,
      `date: ${date}`,
      `type: vault-chat`,
      `tags:`,
      ...tags.map((t) => `  - ${t}`),
      `sources:`,
      sourcesYaml,
      '---',
    ].join('\n');

    // 5. Build full note content
    const body = response.text;
    const fullContent = `${frontmatter}\n\n${body}\n`;

    // 6. Save to vault
    const safeName = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
    const fileName = `VaultChat_${date.replace(/-/g, '')}_${safeName}.md`;
    const filePath = normalizePath(
      `${this.settings.export.outputFolder}/${fileName}`
    );

    // Ensure folder exists
    const folder = this.settings.export.outputFolder;
    if (!this.app.vault.getAbstractFileByPath(folder)) {
      await this.app.vault.createFolder(folder);
    }

    await this.app.vault.create(filePath, fullContent);

    return filePath;
  }
}
