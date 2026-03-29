import { SourceNote } from '../entities/chat-message';

export interface RetrievalOptions {
  limit: number;
  threshold: number;
  targetFolder: string;
}

export interface IRetrievalService {
  search(query: string, options: RetrievalOptions): Promise<SourceNote[]>;
  isAvailable(): boolean;
}
