export interface NoteFile {
  path: string;
  basename: string;
}

export interface IVaultReader {
  readNote(notePath: string): Promise<string | null>;
}
