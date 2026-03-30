/**
 * Estimate token count for mixed Korean/English text.
 *
 * Heuristics:
 * - Korean characters: ~2 chars per token
 * - ASCII characters: ~4 chars per token
 * - Code blocks: ~3 chars per token (denser than prose)
 * - 10% overhead for markdown syntax (headings, links, formatting)
 */
export function estimateTokens(text: string): number {
  // Extract and measure code blocks separately
  let codeTokens = 0;
  const withoutCode = text.replace(/```[\s\S]*?```/g, (match) => {
    codeTokens += Math.ceil(match.length / 3);
    return '';
  });

  const koreanChars = (withoutCode.match(/[\uAC00-\uD7AF]/g) || []).length;
  const otherChars = withoutCode.length - koreanChars;
  const proseTokens = Math.ceil(koreanChars / 2 + otherChars / 4);

  // 10% overhead for markdown syntax
  return Math.ceil((proseTokens + codeTokens) * 1.1);
}
