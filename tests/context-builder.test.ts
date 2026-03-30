import { describe, it, expect } from 'vitest';
import { ContextBuilder, NoteContent } from '../src/core/application/services/context-builder';

const makeNote = (
  title: string,
  content: string,
  similarity: number,
  path?: string,
  sectionHeading?: string
): NoteContent => ({
  title,
  path: path ?? `04_Zettelkasten/${title}.md`,
  content,
  similarity,
  sectionHeading,
});

describe('ContextBuilder', () => {
  const builder = new ContextBuilder(128000);

  describe('build - note mode', () => {
    it('should include notes in context', () => {
      const notes = [makeNote('Note A', 'Content A', 0.9)];
      const result = builder.build('query', notes, [], 10);

      expect(result.messages.length).toBeGreaterThanOrEqual(3);
      expect(result.includedNotes).toBe(1);
      const context = result.messages.find((m) =>
        m.content.includes('Reference Notes')
      );
      expect(context?.content).toContain('[[Note A]]');
    });
  });

  describe('build - chunk mode (auto-detected via sectionHeading)', () => {
    it('should auto-detect chunk mode when sectionHeading is present', () => {
      const chunks = [
        makeNote('Note A', 'Section 1 content here with enough text', 0.9, 'path/a.md', '핵심 아이디어'),
        makeNote('Note A', 'Section 2 content here with enough text', 0.85, 'path/a.md', '상세 설명 > 메커니즘'),
      ];

      const result = builder.build('query', chunks, [], 10);
      const context = result.messages.find((m) =>
        m.content.includes('Reference Notes')
      );

      expect(context?.content).toContain('[[Note A]]');
      expect(context?.content).toContain('핵심 아이디어');
      expect(context?.content).toContain('상세 설명 > 메커니즘');
    });

    it('should group chunks from same note', () => {
      const chunks = [
        makeNote('Note A', 'Chunk 1 text', 0.95, 'path/a.md', 'Section 1'),
        makeNote('Note B', 'Chunk 2 text', 0.90, 'path/b.md', 'Section 1'),
        makeNote('Note A', 'Chunk 3 text', 0.85, 'path/a.md', 'Section 2'),
      ];

      const result = builder.build('query', chunks, [], 10);
      const context = result.messages.find((m) =>
        m.content.includes('Reference Notes')
      )?.content ?? '';

      const noteACount = (context.match(/\[\[Note A\]\]/g) || []).length;
      expect(noteACount).toBe(1);
    });

    it('should order note groups by best similarity', () => {
      const chunks = [
        makeNote('Low Note', 'Content', 0.5, 'path/low.md', 'Section'),
        makeNote('High Note', 'Content', 0.95, 'path/high.md', 'Section'),
      ];

      const result = builder.build('query', chunks, [], 10);
      const context = result.messages.find((m) =>
        m.content.includes('Reference Notes')
      )?.content ?? '';

      const highIdx = context.indexOf('[[High Note]]');
      const lowIdx = context.indexOf('[[Low Note]]');
      expect(highIdx).toBeLessThan(lowIdx);
    });
  });

  describe('buildChunkContext', () => {
    it('should respect token budget and truncate', () => {
      const smallBuilder = new ContextBuilder(100);
      const chunks = [
        makeNote('Note', 'x'.repeat(500), 0.9, 'p.md', 'Sec'),
      ];

      const result = smallBuilder.buildChunkContext(chunks, 50);
      expect(result.wasTruncated).toBe(true);
    });
  });
});
