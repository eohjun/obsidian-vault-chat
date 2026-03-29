export interface INoteWriter {
  createNote(folderPath: string, fileName: string, content: string): Promise<string>;
  folderExists(path: string): boolean;
  createFolder(path: string): Promise<void>;
}
