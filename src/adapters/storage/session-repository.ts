import { normalizePath, Plugin } from 'obsidian';
import { ChatSession } from '../../core/domain/entities/chat-session';
import { ISessionRepository } from '../../core/domain/interfaces/i-session-repository';

const SESSIONS_DIR = 'sessions';

export class SessionRepository implements ISessionRepository {
  constructor(private readonly plugin: Plugin) {}

  private getSessionPath(sessionId: string): string {
    return normalizePath(`${this.getBaseDir()}/${sessionId}.json`);
  }

  private getBaseDir(): string {
    const pluginDir = this.plugin.manifest.dir;
    return normalizePath(`${pluginDir}/${SESSIONS_DIR}`);
  }

  private async ensureDir(): Promise<void> {
    const dir = this.getBaseDir();
    const adapter = this.plugin.app.vault.adapter;
    if (!(await adapter.exists(dir))) {
      await adapter.mkdir(dir);
    }
  }

  async save(session: ChatSession): Promise<void> {
    await this.ensureDir();
    session.updatedAt = new Date().toISOString();
    const path = this.getSessionPath(session.id);
    await this.plugin.app.vault.adapter.write(
      path,
      JSON.stringify(session, null, 2)
    );
  }

  async load(sessionId: string): Promise<ChatSession | null> {
    const path = this.getSessionPath(sessionId);
    try {
      const data = await this.plugin.app.vault.adapter.read(path);
      return JSON.parse(data) as ChatSession;
    } catch {
      return null;
    }
  }

  async list(): Promise<ChatSession[]> {
    await this.ensureDir();
    const dir = this.getBaseDir();
    const adapter = this.plugin.app.vault.adapter;
    const files = await adapter.list(dir);
    const sessions: ChatSession[] = [];

    for (const file of files.files) {
      if (!file.endsWith('.json')) continue;
      try {
        const data = await adapter.read(file);
        sessions.push(JSON.parse(data) as ChatSession);
      } catch {
        // Skip corrupted files
      }
    }

    return sessions.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async delete(sessionId: string): Promise<void> {
    const path = this.getSessionPath(sessionId);
    try {
      await this.plugin.app.vault.adapter.remove(path);
    } catch {
      // Already deleted
    }
  }

  async deleteOldest(keepCount: number): Promise<void> {
    const sessions = await this.list();
    if (sessions.length <= keepCount) return;

    const toDelete = sessions.slice(keepCount);
    for (const session of toDelete) {
      await this.delete(session.id);
    }
  }
}
