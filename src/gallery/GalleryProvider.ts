/**
 * GalleryProvider — TreeView data provider for the Excalidraw Diagrams sidebar.
 * Lists .excalidraw files from .excalidraw-copilot/ with metadata display.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { DiagramStore, DiagramListItem } from './DiagramStore';

export class GalleryItem extends vscode.TreeItem {
  constructor(
    public readonly diagramItem: DiagramListItem,
  ) {
    super(GalleryItem.formatLabel(diagramItem), vscode.TreeItemCollapsibleState.None);

    this.tooltip = GalleryItem.formatTooltip(diagramItem);
    this.description = GalleryItem.formatDescription(diagramItem);
    this.resourceUri = diagramItem.uri;
    this.contextValue = 'excalidrawDiagram';

    this.command = {
      command: 'excalidraw-copilot.galleryOpen',
      title: 'Open Diagram',
      arguments: [this],
    };

    this.iconPath = new vscode.ThemeIcon(
      diagramItem.metadata?.pipeline === 'mermaid' ? 'type-hierarchy' : 'symbol-misc',
    );
  }

  private static formatLabel(item: DiagramListItem): string {
    // Always use filename as label (user may have renamed it)
    return item.name;
  }

  private static formatDescription(item: DiagramListItem): string {
    const parts: string[] = [];

    if (item.metadata?.prompt) {
      const prompt = item.metadata.prompt;
      parts.push(prompt.length > 40 ? prompt.slice(0, 37) + '...' : prompt);
    }
    if (item.metadata?.pipeline) {
      parts.push(item.metadata.pipeline.toUpperCase());
    }

    const date = new Date(item.metadata?.timestamp || item.modifiedTime);
    parts.push(GalleryItem.formatRelativeTime(date));

    return parts.join(' · ');
  }

  private static formatTooltip(item: DiagramListItem): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${item.name}**\n\n`);
    if (item.metadata?.prompt) {
      md.appendMarkdown(`💬 ${item.metadata.prompt}\n\n`);
    }
    if (item.metadata?.pipeline) {
      md.appendMarkdown(`🔧 Pipeline: ${item.metadata.pipeline}\n\n`);
    }
    if (item.metadata?.model) {
      md.appendMarkdown(`🤖 Model: ${item.metadata.model}\n\n`);
    }
    if (item.metadata?.nodeCount) {
      md.appendMarkdown(`📊 ${item.metadata.nodeCount} nodes, ${item.metadata.connectionCount || 0} connections\n\n`);
    }
    const date = new Date(item.metadata?.timestamp || item.modifiedTime);
    md.appendMarkdown(`📅 ${date.toLocaleString()}`);
    return md;
  }

  private static formatRelativeTime(date: Date): string {
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) { return 'just now'; }
    if (minutes < 60) { return `${minutes}m ago`; }
    if (hours < 24) { return `${hours}h ago`; }
    if (days < 7) { return `${days}d ago`; }
    return date.toLocaleDateString();
  }
}

export class GalleryProvider implements vscode.TreeDataProvider<GalleryItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<GalleryItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private store: DiagramStore;
  private watcher: vscode.FileSystemWatcher | undefined;

  constructor(store: DiagramStore) {
    this.store = store;
    this.setupWatcher();
  }

  private setupWatcher(): void {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!workspaceRoot) { return; }

    const pattern = new vscode.RelativePattern(workspaceRoot, '.excalidraw-copilot/*.excalidraw');
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
    this.watcher.onDidCreate(() => this.refresh());
    this.watcher.onDidDelete(() => this.refresh());
    this.watcher.onDidChange(() => this.refresh());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: GalleryItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<GalleryItem[]> {
    const items = await this.store.listDiagrams();
    return items.map(item => new GalleryItem(item));
  }

  dispose(): void {
    this.watcher?.dispose();
    this._onDidChangeTreeData.dispose();
  }
}
