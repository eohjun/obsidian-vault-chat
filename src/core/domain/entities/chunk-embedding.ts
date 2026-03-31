export interface ChunkEmbedding {
  chunkId: string;
  noteId: string;
  notePath: string;
  noteTitle: string;
  sectionHeading: string;
  headingLevel: number;
  sectionIndex: number;
  contentHash: string;
  content?: string;
  vector: number[];
  dimensions: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChunkIndex {
  version: string;
  totalChunks: number;
  lastUpdated: string;
  dimensions: number;
  notes: Record<
    string,
    {
      path: string;
      noteContentHash: string;
      chunkIds: string[];
      updatedAt: string;
    }
  >;
}

export function createChunkId(noteId: string, sectionIndex: number): string {
  return `${noteId}__${sectionIndex}`;
}

export function createEmptyChunkIndex(): ChunkIndex {
  return {
    version: '1.0.0',
    totalChunks: 0,
    lastUpdated: new Date().toISOString(),
    dimensions: 0,
    notes: {},
  };
}
