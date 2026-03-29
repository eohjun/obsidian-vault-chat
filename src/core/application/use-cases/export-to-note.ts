import { ChatSession } from '../../domain/entities/chat-session';
import { NoteExportService } from '../services/note-export-service';

export class ExportToNoteUseCase {
  constructor(private readonly noteExportService: NoteExportService) {}

  async execute(session: ChatSession): Promise<string> {
    return this.noteExportService.export(session);
  }
}
