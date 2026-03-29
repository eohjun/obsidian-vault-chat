import { describe, it, expect } from 'vitest';
import { createChatMessage } from '../src/core/domain/entities/chat-message';
import { createChatSession } from '../src/core/domain/entities/chat-session';

describe('createChatMessage', () => {
  it('creates user message with defaults', () => {
    const msg = createChatMessage('user', 'hello');
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('hello');
    expect(msg.sources).toEqual([]);
    expect(msg.id).toBeTruthy();
    expect(msg.timestamp).toBeTruthy();
  });

  it('creates assistant message with sources', () => {
    const sources = [{ notePath: 'note.md', title: 'Note', similarity: 0.9 }];
    const msg = createChatMessage('assistant', 'answer', sources);
    expect(msg.role).toBe('assistant');
    expect(msg.sources).toHaveLength(1);
    expect(msg.sources[0].title).toBe('Note');
  });

  it('generates unique IDs', () => {
    const msg1 = createChatMessage('user', 'a');
    const msg2 = createChatMessage('user', 'b');
    expect(msg1.id).not.toBe(msg2.id);
  });
});

describe('createChatSession', () => {
  it('creates session with default title', () => {
    const session = createChatSession();
    expect(session.title).toBe('New Chat');
    expect(session.messages).toEqual([]);
    expect(session.id).toBeTruthy();
    expect(session.createdAt).toBeTruthy();
    expect(session.updatedAt).toBeTruthy();
  });

  it('creates session with custom title', () => {
    const session = createChatSession('My Topic');
    expect(session.title).toBe('My Topic');
  });
});
