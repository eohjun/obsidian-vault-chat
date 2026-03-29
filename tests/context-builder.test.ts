import { describe, it, expect } from 'vitest';
import { ContextBuilder } from '../src/core/application/services/context-builder';
import { ChatMessage } from '../src/core/domain/entities/chat-message';

describe('ContextBuilder', () => {
  const builder = new ContextBuilder(10000); // 10k token window

  it('builds basic message structure', () => {
    const result = builder.build(
      'What is X?',
      [{ title: 'Note1', path: 'note1.md', content: 'Content about X', similarity: 0.8 }],
      [],
      10
    );

    expect(result.messages[0].role).toBe('system'); // system prompt
    expect(result.messages[1].role).toBe('system'); // note context
    expect(result.messages[1].content).toContain('[[Note1]]');
    expect(result.messages[2].role).toBe('user'); // query
    expect(result.messages[2].content).toBe('What is X?');
    expect(result.includedNotes).toBe(1);
    expect(result.truncated).toBe(false);
  });

  it('includes conversation history', () => {
    const history: ChatMessage[] = [
      { id: '1', role: 'user', content: 'First question', sources: [], timestamp: '' },
      { id: '2', role: 'assistant', content: 'First answer', sources: [], timestamp: '' },
    ];

    const result = builder.build('Follow up?', [], history, 10);
    // system prompt + history (user + assistant) + query
    expect(result.messages).toHaveLength(4);
    expect(result.messages[1].content).toBe('First question');
    expect(result.messages[2].content).toBe('First answer');
  });

  it('returns empty note context when no notes', () => {
    const result = builder.build('Hello?', [], [], 10);
    expect(result.messages).toHaveLength(2); // system + query
    expect(result.includedNotes).toBe(0);
  });

  it('truncates when notes exceed budget', () => {
    const smallBuilder = new ContextBuilder(500); // very small window
    const bigNotes = Array.from({ length: 20 }, (_, i) => ({
      title: `Note${i}`,
      path: `note${i}.md`,
      content: 'A'.repeat(500), // each note is ~125 tokens
      similarity: 0.9 - i * 0.01,
    }));

    const result = smallBuilder.build('query', bigNotes, [], 10);
    expect(result.truncated).toBe(true);
    expect(result.includedNotes).toBeLessThan(20);
  });

  it('estimates Korean text as higher token count than equivalent-length English', () => {
    // Access private method via cast to any for token estimation test
    const b = builder as any;
    const korean = '안녕하세요반갑습니다'; // 9 Korean chars
    const english = 'abcdefghi';            // 9 ASCII chars (same length)
    const koreanTokens = b.estimateTokens(korean);
    const englishTokens = b.estimateTokens(english);
    // Korean: ceil(9/2) = 5, English: ceil(9/4) = 3
    expect(koreanTokens).toBeGreaterThan(englishTokens);
  });
});
