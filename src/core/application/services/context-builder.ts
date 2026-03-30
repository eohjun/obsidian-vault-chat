import { LLMMessage } from 'obsidian-llm-shared';
import { ChatMessage } from '../../domain/entities/chat-message';

export interface NoteContent {
  title: string;
  path: string;
  content: string;
  similarity: number;
  sectionHeading?: string;
  chunkId?: string;
}

export interface ContextBuildResult {
  messages: LLMMessage[];
  includedNotes: number;
  truncated: boolean;
}

const SYSTEM_PROMPT = `You are a knowledgeable assistant that answers questions based on the user's personal knowledge vault (Zettelkasten notes).

Rules:
- Answer ONLY based on the provided note contents. If the notes don't contain relevant information, say so.
- Reference source notes using [[Note Title]] wiki-link syntax naturally within your answer.
- When referring to a specific section of a note, use [[Note Title#Section Heading]] syntax.
- Write in the same language the user uses for their question.
- Be concise and direct. Use bullet points for complex answers.
- Do not fabricate information not present in the provided notes.`;

export class ContextBuilder {
  private readonly maxContextRatio = 0.5;
  private readonly maxHistoryRatio = 0.2;

  constructor(private readonly contextWindowTokens: number) {}

  build(
    query: string,
    noteContents: NoteContent[],
    history: ChatMessage[],
    maxHistoryTurns: number
  ): ContextBuildResult {
    const messages: LLMMessage[] = [];
    let truncated = false;

    // 1. System prompt
    messages.push({ role: 'system', content: SYSTEM_PROMPT });

    // 2. Note context (auto-detect chunk mode via sectionHeading)
    const maxNoteTokens = Math.floor(this.contextWindowTokens * this.maxContextRatio);
    const isChunkMode = noteContents.some((n) => n.sectionHeading);
    const { text: noteContext, count: includedNotes, wasTruncated } = isChunkMode
      ? this.buildChunkContext(noteContents, maxNoteTokens)
      : this.buildNoteContext(noteContents, maxNoteTokens);

    if (noteContext) {
      messages.push({
        role: 'system',
        content: `## Reference Notes\n\n${noteContext}`,
      });
    }
    truncated = wasTruncated;

    // 3. Conversation history (recent N turns)
    const maxHistoryTokens = Math.floor(this.contextWindowTokens * this.maxHistoryRatio);
    const recentHistory = history.slice(-maxHistoryTurns * 2);
    let historyTokens = 0;

    for (const msg of recentHistory) {
      const tokens = this.estimateTokens(msg.content);
      if (historyTokens + tokens > maxHistoryTokens) {
        truncated = true;
        break;
      }
      messages.push({ role: msg.role, content: msg.content });
      historyTokens += tokens;
    }

    // 4. Current query
    messages.push({ role: 'user', content: query });

    return { messages, includedNotes, truncated };
  }

  buildChunkContext(
    chunks: NoteContent[],
    maxTokens: number
  ): { text: string; count: number; wasTruncated: boolean } {
    // Group chunks by note, preserving per-chunk similarity for ordering
    const noteGroups = new Map<string, NoteContent[]>();
    for (const chunk of chunks) {
      const key = chunk.path;
      if (!noteGroups.has(key)) {
        noteGroups.set(key, []);
      }
      noteGroups.get(key)!.push(chunk);
    }

    // Sort groups by best similarity within each group
    const sortedGroups = Array.from(noteGroups.entries()).sort(
      (a, b) => {
        const bestA = Math.max(...a[1].map((c) => c.similarity));
        const bestB = Math.max(...b[1].map((c) => c.similarity));
        return bestB - bestA;
      }
    );

    const parts: string[] = [];
    let totalTokens = 0;
    let count = 0;
    let wasTruncated = false;

    for (const [, noteChunks] of sortedGroups) {
      const noteTitle = noteChunks[0].title;

      // Sort chunks within same note by sectionIndex (original document order)
      // sectionIndex not directly available here, so use the order they appear
      const chunkTexts: string[] = [];
      for (const chunk of noteChunks) {
        const heading = chunk.sectionHeading
          ? `#### ${chunk.sectionHeading}`
          : '';
        chunkTexts.push(heading ? `${heading}\n${chunk.content}` : chunk.content);
      }

      const noteText = `### [[${noteTitle}]]\n${chunkTexts.join('\n\n')}\n---`;
      const tokens = this.estimateTokens(noteText);

      if (totalTokens + tokens > maxTokens) {
        const remaining = maxTokens - totalTokens;
        if (remaining > 200) {
          const joined = chunkTexts.join('\n\n');
          const truncated = joined.slice(0, remaining * 3);
          parts.push(`### [[${noteTitle}]]\n${truncated}...\n---`);
          count++;
        }
        wasTruncated = true;
        break;
      }

      parts.push(noteText);
      totalTokens += tokens;
      count++;
    }

    return { text: parts.join('\n\n'), count, wasTruncated };
  }

  private buildNoteContext(
    notes: NoteContent[],
    maxTokens: number
  ): { text: string; count: number; wasTruncated: boolean } {
    const parts: string[] = [];
    let totalTokens = 0;
    let count = 0;
    let wasTruncated = false;

    for (const note of notes) {
      const noteText = `### [[${note.title}]]\n${note.content}\n---`;
      const tokens = this.estimateTokens(noteText);

      if (totalTokens + tokens > maxTokens) {
        // Try including a truncated version of this note
        const remaining = maxTokens - totalTokens;
        if (remaining > 200) {
          const truncatedContent = note.content.slice(0, remaining * 3);
          parts.push(`### [[${note.title}]]\n${truncatedContent}...\n---`);
          count++;
        }
        wasTruncated = true;
        break;
      }

      parts.push(noteText);
      totalTokens += tokens;
      count++;
    }

    return { text: parts.join('\n\n'), count, wasTruncated };
  }

  private estimateTokens(text: string): number {
    const koreanChars = (text.match(/[\uAC00-\uD7AF]/g) || []).length;
    const otherChars = text.length - koreanChars;
    return Math.ceil(koreanChars / 2 + otherChars / 4);
  }
}
