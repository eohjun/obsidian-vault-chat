import { ISessionRepository } from '../../domain/interfaces/i-session-repository';

export class DeleteOldSessionsUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly keepCount: number
  ) {}

  async execute(): Promise<void> {
    await this.sessionRepository.deleteOldest(this.keepCount);
  }
}
