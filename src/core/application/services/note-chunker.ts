export interface NoteChunk {
  heading: string;
  headingLevel: number;
  sectionIndex: number;
  content: string;
}

export interface ChunkOptions {
  /** Sections to skip (not embed). Default: metadata sections */
  skipSections?: string[];
  /** Minimum tokens for a chunk; smaller chunks merge into previous */
  minChunkTokens?: number;
}

const DEFAULT_SKIP_SECTIONS = [
  '연결된 생각',
  '참고 자료',
  '🔗 연결된 노트',
  '🏷️ 관련 태그',
];

/**
 * Split a permanent note into semantic chunks for embedding.
 * Optimized for the standardized Zettelkasten format:
 *   ## 핵심 아이디어 → 1 chunk
 *   ## 상세 설명 → split on #### sub-headings
 *   ## 적용 예시 → 1 chunk
 *   metadata sections → skipped
 *
 * For non-standard notes (no H2), falls back to single whole-note chunk.
 */
export function chunkNote(
  markdown: string,
  noteTitle: string,
  options?: ChunkOptions
): NoteChunk[] {
  const skipSections = options?.skipSections ?? DEFAULT_SKIP_SECTIONS;
  const minChunkTokens = options?.minChunkTokens ?? 50;

  // Strip frontmatter
  const content = stripFrontmatter(markdown);

  // Parse into H2 sections
  const h2Sections = splitByHeading(content, 2);

  // No H2 headings → single chunk (non-standard note fallback)
  if (h2Sections.length === 0) {
    const text = content.trim();
    if (!text) return [];
    return [
      {
        heading: noteTitle,
        headingLevel: 1,
        sectionIndex: 0,
        content: prependTitle(text, noteTitle),
      },
    ];
  }

  const chunks: NoteChunk[] = [];
  let sectionIndex = 0;

  for (const section of h2Sections) {
    const headingText = section.heading.replace(/^#+\s*/, '').trim();

    // Skip metadata sections
    if (skipSections.some((skip) => headingText.includes(skip))) {
      continue;
    }

    // "상세 설명" section: split on #### sub-headings
    if (headingText === '상세 설명') {
      const subSections = splitByHeading(section.body, 4);
      if (subSections.length > 0) {
        let addedAny = false;
        for (const sub of subSections) {
          const subHeading = sub.heading.replace(/^#+\s*/, '').trim();
          const text = sub.body.trim();
          if (estimateTokens(text) < minChunkTokens) continue;
          chunks.push({
            heading: `상세 설명 > ${subHeading}`,
            headingLevel: 4,
            sectionIndex: sectionIndex++,
            content: prependTitle(text, noteTitle),
          });
          addedAny = true;
        }
        if (addedAny) continue;
        // All sub-sections too small — fall through to add as single chunk
      }
    }

    const text = section.body.trim();
    if (estimateTokens(text) < minChunkTokens) continue;

    chunks.push({
      heading: headingText,
      headingLevel: 2,
      sectionIndex: sectionIndex++,
      content: prependTitle(text, noteTitle),
    });
  }

  return chunks;
}

interface HeadingSection {
  heading: string;
  body: string;
}

function splitByHeading(text: string, level: number): HeadingSection[] {
  const prefix = '#'.repeat(level);
  // Match exactly N hashes followed by space (not more)
  const regex = new RegExp(`^${prefix}(?!#)\\s+(.+)$`, 'gm');
  const sections: HeadingSection[] = [];
  const matches: { index: number; heading: string }[] = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    matches.push({ index: match.index, heading: match[0] });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].heading.length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    sections.push({
      heading: matches[i].heading,
      body: text.slice(start, end),
    });
  }

  return sections;
}

function stripFrontmatter(markdown: string): string {
  const match = markdown.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  return match ? markdown.slice(match[0].length) : markdown;
}

function prependTitle(content: string, noteTitle: string): string {
  return `# ${noteTitle}\n\n${content}`;
}

export function estimateTokens(text: string): number {
  const koreanChars = (text.match(/[\uAC00-\uD7AF]/g) || []).length;
  const otherChars = text.length - koreanChars;
  return Math.ceil(koreanChars / 2 + otherChars / 4);
}

/**
 * Extract section content from a full note markdown by heading name.
 * Used at query time to retrieve the text for a chunk match.
 */
export function extractSectionContent(
  markdown: string,
  sectionHeading: string
): string | null {
  const content = stripFrontmatter(markdown);

  // Handle "상세 설명 > 소제목" format
  if (sectionHeading.includes(' > ')) {
    const [, subHeading] = sectionHeading.split(' > ');
    const subSections = splitByHeading(content, 4);
    for (const sub of subSections) {
      const heading = sub.heading.replace(/^#+\s*/, '').trim();
      if (heading === subHeading) {
        return sub.body.trim();
      }
    }
    return null;
  }

  // Match H2 section
  const h2Sections = splitByHeading(content, 2);
  for (const section of h2Sections) {
    const heading = section.heading.replace(/^#+\s*/, '').trim();
    if (heading === sectionHeading) {
      return section.body.trim();
    }
  }

  return null;
}
