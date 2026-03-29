import { ChatService } from '../../core/application/services/chat-service';
import { ChatSession } from '../../core/domain/entities/chat-session';

export class SessionSelector {
  private selectEl!: HTMLSelectElement;
  private sessions: ChatSession[] = [];

  constructor(
    private readonly containerEl: HTMLElement,
    private readonly chatService: ChatService,
    private readonly onSessionChange: (session: ChatSession | null) => void
  ) {}

  async render(): Promise<void> {
    const wrapper = this.containerEl.createEl('div', { cls: 'vault-chat-session-bar' });

    this.selectEl = wrapper.createEl('select', { cls: 'vault-chat-session-select' });
    this.selectEl.addEventListener('change', () => this.handleChange());

    const newBtn = wrapper.createEl('button', {
      cls: 'vault-chat-new-session-btn',
      text: '+ New',
    });
    newBtn.addEventListener('click', () => this.onSessionChange(null));

    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.sessions = await this.chatService.listSessions();
    this.selectEl.empty();

    const currentSession = this.chatService.getCurrentSession();

    for (const session of this.sessions) {
      const option = this.selectEl.createEl('option', {
        text: session.title,
        value: session.id,
      });
      if (currentSession && session.id === currentSession.id) {
        option.selected = true;
      }
    }
  }

  private handleChange(): void {
    const selectedId = this.selectEl.value;
    const session = this.sessions.find((s) => s.id === selectedId);
    if (session) {
      this.onSessionChange(session);
    }
  }
}
