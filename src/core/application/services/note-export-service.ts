import { LLMMessage } from 'obsidian-llm-shared';
import { ChatSession } from '../../domain/entities/chat-session';
import { INoteWriter } from '../../domain/interfaces/i-note-writer';
import { IVaultReader } from '../../domain/interfaces/i-vault-reader';
import { AIService } from './ai-service';

const EXPORT_SYSTEM_PROMPT = `You are organizing a conversation into a structured Literature Note.

Rules:
- Create a well-structured markdown document with clear headings (H2) and bullet points
- Reference source notes using [[Note Title]] wiki-link syntax
- Organize by topic themes, not by conversation order
- Write a concise title summarizing the key topic discussed
- Write in the same language used in the conversation
- Extract key insights and conclusions, not a verbatim transcript
- Include relevant connections between mentioned notes`;

export interface NoteExportConfig {
  outputFolder: string;
}

export class NoteExportService {
  constructor(
    private readonly noteWriter: INoteWriter,
    private readonly aiService: AIService,
    private settings: NoteExportConfig,
    private readonly vaultReader?: IVaultReader
  ) {}

  updateSettings(settings: NoteExportConfig): void {
    this.settings = settings;
  }

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

    // 4. Collect tags from source notes
    const sourceTags = await this.collectSourceTags(session);

    // 5. Build frontmatter
    const date = new Date().toISOString().split('T')[0];
    const tags = ['vault-chat', ...sourceTags];
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

    // 6. Build full note content
    const body = response.text;
    const fullContent = `${frontmatter}\n\n${body}\n`;

    // 7. Save to vault via INoteWriter
    const safeName = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
    const fileName = `VaultChat_${date.replace(/-/g, '')}_${safeName}.md`;

    const filePath = await this.noteWriter.createNote(
      this.settings.outputFolder,
      fileName,
      fullContent
    );

    return filePath;
  }

  /**
   * Extract tags from source notes' frontmatter.
   * Strips taxonomy prefixes (concept/, source/) for body-style tags.
   */
  private async collectSourceTags(session: ChatSession): Promise<string[]> {
    if (!this.vaultReader) return [];

    const tagSet = new Set<string>();

    for (const msg of session.messages) {
      for (const src of msg.sources) {
        const content = await this.vaultReader.readNote(src.notePath);
        if (!content) continue;

        // Parse YAML frontmatter tags
        const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!fmMatch) continue;

        const tagsMatch = fmMatch[1].match(/^tags:\s*\n((?:\s+-\s+.+\n?)*)/m);
        if (!tagsMatch) continue;

        const tagRegex = /^\s+-\s+(.+)$/gm;
        let tagMatch: RegExpExecArray | null;
        while ((tagMatch = tagRegex.exec(tagsMatch[1])) !== null) {
          const raw = tagMatch[1].trim().replace(/^['"]|['"]$/g, '');
          // Strip taxonomy prefix: concept/mindfulness → mindfulness
          const stripped = raw.includes('/') ? raw.split('/').pop()! : raw;
          tagSet.add(stripped);
        }
      }
    }

    return [...tagSet];
  }
}
