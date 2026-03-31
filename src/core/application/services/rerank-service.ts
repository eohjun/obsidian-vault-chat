import { LLMMessage } from 'obsidian-llm-shared';
import { AIService } from './ai-service';

export interface RerankCandidate {
  index: number;
  title: string;
  sectionHeading: string;
  content: string;
}

const RERANK_SYSTEM_PROMPT = `You are a relevance ranker. Given a user query and numbered text snippets from a knowledge vault, return ONLY the snippet numbers in order of relevance to the query, most relevant first.

Rules:
- Return ONLY a comma-separated list of numbers (e.g., "3,1,5,2,4")
- Include ALL snippet numbers
- Do not explain or add any other text`;

export class RerankService {
  constructor(private readonly aiService: AIService) {}

  /**
   * Rerank candidates using LLM. Returns reordered indices.
   * Falls back to original order on failure.
   */
  async rerank(
    query: string,
    candidates: RerankCandidate[]
  ): Promise<number[]> {
    if (candidates.length <= 1) {
      return candidates.map((c) => c.index);
    }

    // Build snippet list for LLM
    const snippets = candidates
      .map(
        (c, i) =>
          `[${i + 1}] ${c.title} — ${c.sectionHeading}\n${c.content.slice(0, 300)}`
      )
      .join('\n\n');

    const messages: LLMMessage[] = [
      { role: 'system', content: RERANK_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Query: ${query}\n\nSnippets:\n${snippets}`,
      },
    ];

    try {
      const response = await this.aiService.generateText(messages);
      if (!response.success) {
        return candidates.map((c) => c.index);
      }

      // Parse comma-separated numbers
      const numbers = response.text
        .replace(/[^0-9,]/g, '')
        .split(',')
        .map((n) => parseInt(n.trim(), 10))
        .filter((n) => !isNaN(n) && n >= 1 && n <= candidates.length);

      if (numbers.length === 0) {
        return candidates.map((c) => c.index);
      }

      // Map 1-based LLM indices back to original candidate indices
      const reordered: number[] = [];
      const seen = new Set<number>();

      for (const num of numbers) {
        const candidate = candidates[num - 1];
        if (candidate && !seen.has(candidate.index)) {
          reordered.push(candidate.index);
          seen.add(candidate.index);
        }
      }

      // Append any missing candidates at the end (robustness)
      for (const c of candidates) {
        if (!seen.has(c.index)) {
          reordered.push(c.index);
        }
      }

      return reordered;
    } catch {
      // Fallback to original order on any error
      return candidates.map((c) => c.index);
    }
  }
}
