export interface INoteWriter {
  createNote(folderPath: string, fileName: string, content: string): Promise<string>;
  folderExists(path: string): boolean;
  createFolder(path: string): Promise<void>;
  appendToNote(notePath: string, content: string): Promise<void>;
  insertAtCursor(content: string): Promise<boolean>;
}
