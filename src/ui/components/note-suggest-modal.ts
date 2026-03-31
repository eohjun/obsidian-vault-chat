import { App, FuzzySuggestModal, TFile } from 'obsidian';

export class NoteSuggestModal extends FuzzySuggestModal<TFile> {
  private onChoose: (file: TFile) => void;

  constructor(app: App, onChoose: (file: TFile) => void) {
    super(app);
    this.onChoose = onChoose;
    this.setPlaceholder('Select a note to insert into...');
  }

  getItems(): TFile[] {
    return this.app.vault.getMarkdownFiles().sort((a, b) =>
      a.basename.localeCompare(b.basename)
    );
  }

  getItemText(item: TFile): string {
    return item.path;
  }

  onChooseItem(item: TFile): void {
    this.onChoose(item);
  }
}
