// Minimal Obsidian API mock for unit tests
export class Plugin {}
export class PluginSettingTab {}
export class ItemView {}
export class WorkspaceLeaf {}
export class TFile {}
export class Notice {
  constructor(public message: string) {}
}
export class Modal {}
export class Setting {}
export const Platform = {};
export const normalizePath = (p: string) => p;
export const requestUrl = async () => ({});
