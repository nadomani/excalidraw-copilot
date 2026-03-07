/**
 * DiagramStore — Save, load, list, and delete .excalidraw diagram files.
 * Storage folder: .excalidraw-copilot/ in the workspace root.
 */

import * as vscode from 'vscode';
import * as path from 'path';

/** Metadata stored alongside diagram elements in the .excalidraw JSON */
export interface DiagramMetadata {
  prompt: string;
  pipeline: 'dsl' | 'mermaid';
  model?: string;
  timestamp: number;
  nodeCount: number;
  connectionCount: number;
}

/** The full .excalidraw file format with our custom metadata */
export interface ExcalidrawFile {
  type: 'excalidraw';
  version: 2;
  source: 'excalidraw-copilot';
  elements: any[];
  appState: {
    viewBackgroundColor: string;
    gridSize: number | null;
  };
  /** Custom metadata — ignored by excalidraw.com but preserved */
  metadata?: DiagramMetadata;
  /** Mermaid source syntax — stored for Mermaid pipeline diagrams */
  mermaidSyntax?: string;
  /** DSL semantic graph — stored for DSL pipeline refinement */
  graph?: any;
  files: Record<string, never>;
}

/** Gallery list item with parsed metadata */
export interface DiagramListItem {
  uri: vscode.Uri;
  name: string;
  metadata?: DiagramMetadata;
  fileSize: number;
  modifiedTime: number;
}

const STORAGE_FOLDER = '.excalidraw-copilot';
const GITIGNORE_PROMPTED_KEY = 'excalidraw-copilot.gitignorePrompted';

export class DiagramStore {
  private workspaceRoot: vscode.Uri | undefined;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
  }

  /** Get the storage folder URI, creating it if needed */
  private async getStorageFolder(): Promise<vscode.Uri> {
    if (!this.workspaceRoot) {
      throw new Error('No workspace folder open');
    }
    const folder = vscode.Uri.joinPath(this.workspaceRoot, STORAGE_FOLDER);
    try {
      await vscode.workspace.fs.stat(folder);
    } catch {
      await vscode.workspace.fs.createDirectory(folder);
    }
    return folder;
  }

  /** Generate a filename from timestamp and prompt text */
  private generateFilename(prompt: string): string {
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/T/, '_')
      .replace(/:/g, '-')
      .slice(0, 19); // YYYY-MM-DD_HH-mm-ss
    const slug = prompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    return `${slug || 'diagram'}_${timestamp}.excalidraw`;
  }

  /** Generate a refined filename from the original URI (e.g. foo.excalidraw → foo-refined.excalidraw) */
  generateRefinedUri(originalUri: vscode.Uri): vscode.Uri {
    const originalPath = originalUri.fsPath;
    const base = originalPath.replace(/\.excalidraw$/, '');
    // Check for existing -refined, -refined-2, etc.
    const match = base.match(/-refined(?:-(\d+))?$/);
    let newBase: string;
    if (match) {
      const num = match[1] ? parseInt(match[1]) + 1 : 2;
      newBase = base.replace(/-refined(?:-\d+)?$/, `-refined-${num}`);
    } else {
      newBase = `${base}-refined`;
    }
    return vscode.Uri.file(`${newBase}.excalidraw`);
  }

  /** Save a diagram to a .excalidraw file */
  async saveDiagram(
    elements: any[],
    appState: { viewBackgroundColor: string; gridSize: number | null },
    metadata: DiagramMetadata,
    targetUri?: vscode.Uri,
    graph?: any
  ): Promise<vscode.Uri> {
    const file: ExcalidrawFile = {
      type: 'excalidraw',
      version: 2,
      source: 'excalidraw-copilot',
      elements,
      appState,
      metadata,
      graph,
      files: {},
    };

    const content = JSON.stringify(file, null, 2);
    const encoded = Buffer.from(content, 'utf-8');

    let uri: vscode.Uri;
    if (targetUri) {
      uri = targetUri;
    } else {
      const folder = await this.getStorageFolder();
      const filename = this.generateFilename(metadata.prompt);
      uri = vscode.Uri.joinPath(folder, filename);
    }

    await vscode.workspace.fs.writeFile(uri, encoded);
    return uri;
  }

  /** Auto-save after diagram generation (respects setting) */
  async autoSave(
    elements: any[],
    appState: { viewBackgroundColor: string; gridSize: number | null },
    metadata: DiagramMetadata,
    graph?: any
  ): Promise<vscode.Uri | undefined> {
    const config = vscode.workspace.getConfiguration('excalidraw-copilot');
    if (!config.get<boolean>('autoSave', true)) {
      return undefined;
    }

    const uri = await this.saveDiagram(elements, appState, metadata, undefined, graph);
    await this.promptGitignoreOnce();
    return uri;
  }

  /** Auto-save a Mermaid diagram (stores syntax, not canvas elements) */
  async autoSaveMermaid(
    mermaidSyntax: string,
    metadata: DiagramMetadata
  ): Promise<vscode.Uri | undefined> {
    const config = vscode.workspace.getConfiguration('excalidraw-copilot');
    if (!config.get<boolean>('autoSave', true)) {
      return undefined;
    }
    return this.saveMermaid(mermaidSyntax, metadata);
  }

  /** Save a Mermaid diagram to a specific or auto-generated URI */
  async saveMermaid(
    mermaidSyntax: string,
    metadata: DiagramMetadata,
    targetUri?: vscode.Uri
  ): Promise<vscode.Uri> {
    const file: ExcalidrawFile = {
      type: 'excalidraw',
      version: 2,
      source: 'excalidraw-copilot',
      elements: [],
      appState: { viewBackgroundColor: '#ffffff', gridSize: null },
      metadata,
      mermaidSyntax,
      files: {},
    };

    const content = JSON.stringify(file, null, 2);
    const encoded = Buffer.from(content, 'utf-8');

    let uri: vscode.Uri;
    if (targetUri) {
      uri = targetUri;
    } else {
      const folder = await this.getStorageFolder();
      const filename = this.generateFilename(metadata.prompt);
      uri = vscode.Uri.joinPath(folder, filename);
    }
    await vscode.workspace.fs.writeFile(uri, encoded);

    await this.promptGitignoreOnce();
    return uri;
  }

  /** Load a diagram from a .excalidraw file */
  async loadDiagram(uri: vscode.Uri): Promise<ExcalidrawFile> {
    const data = await vscode.workspace.fs.readFile(uri);
    const content = Buffer.from(data).toString('utf-8');
    const parsed = JSON.parse(content);

    // Allow Mermaid files with empty elements array
    if (!parsed.elements && !parsed.mermaidSyntax) {
      throw new Error('Invalid .excalidraw file: missing elements array');
    }

    return {
      type: parsed.type || 'excalidraw',
      version: parsed.version || 2,
      source: parsed.source || 'unknown',
      elements: parsed.elements || [],
      appState: parsed.appState || {
        viewBackgroundColor: '#ffffff',
        gridSize: null,
      },
      metadata: parsed.metadata,
      mermaidSyntax: parsed.mermaidSyntax,
      graph: parsed.graph,
      files: parsed.files || {},
    };
  }

  /** List all diagrams in the storage folder */
  async listDiagrams(): Promise<DiagramListItem[]> {
    try {
      const folder = await this.getStorageFolder();
      const entries = await vscode.workspace.fs.readDirectory(folder);
      const items: DiagramListItem[] = [];

      for (const [name, type] of entries) {
        if (type !== vscode.FileType.File || !name.endsWith('.excalidraw')) {
          continue;
        }

        const uri = vscode.Uri.joinPath(folder, name);
        try {
          const stat = await vscode.workspace.fs.stat(uri);
          let metadata: DiagramMetadata | undefined;

          // Try to read metadata from file without loading all elements
          try {
            const data = await vscode.workspace.fs.readFile(uri);
            const content = Buffer.from(data).toString('utf-8');
            const parsed = JSON.parse(content);
            metadata = parsed.metadata;
          } catch {
            // Metadata read failed — still list the file
          }

          items.push({
            uri,
            name: name.replace('.excalidraw', ''),
            metadata,
            fileSize: stat.size,
            modifiedTime: stat.mtime,
          });
        } catch {
          // Skip files we can't stat
        }
      }

      // Sort by modification time, newest first
      items.sort((a, b) => b.modifiedTime - a.modifiedTime);
      return items;
    } catch {
      return [];
    }
  }

  /** Delete a diagram file */
  async deleteDiagram(uri: vscode.Uri): Promise<void> {
    await vscode.workspace.fs.delete(uri);
  }

  /** Rename a diagram file */
  async renameDiagram(oldUri: vscode.Uri, newName: string): Promise<vscode.Uri> {
    const folder = vscode.Uri.joinPath(oldUri, '..');
    const newFilename = newName.endsWith('.excalidraw')
      ? newName
      : `${newName}.excalidraw`;
    const newUri = vscode.Uri.joinPath(folder, newFilename);
    await vscode.workspace.fs.rename(oldUri, newUri);
    return newUri;
  }

  /** Prompt user once about adding .excalidraw-copilot/ to .gitignore */
  private async promptGitignoreOnce(): Promise<void> {
    if (!this.workspaceRoot) { return; }

    const state = (globalThis as any).__excalidrawWorkspaceState as vscode.Memento | undefined;
    if (!state) { return; }

    const prompted = state.get<boolean>(GITIGNORE_PROMPTED_KEY, false);
    if (prompted) { return; }

    // Mark as prompted immediately so we don't ask again
    await state.update(GITIGNORE_PROMPTED_KEY, true);

    const gitignoreUri = vscode.Uri.joinPath(this.workspaceRoot, '.gitignore');
    let gitignoreExists = false;
    let gitignoreContent = '';

    try {
      const data = await vscode.workspace.fs.readFile(gitignoreUri);
      gitignoreContent = Buffer.from(data).toString('utf-8');
      gitignoreExists = true;
    } catch {
      // No .gitignore yet
    }

    // Check if already ignored
    if (gitignoreContent.includes(STORAGE_FOLDER)) {
      return;
    }

    const choice = await vscode.window.showInformationMessage(
      `Excalidraw Copilot saves diagrams to ${STORAGE_FOLDER}/. Add it to .gitignore?`,
      'Yes, add to .gitignore',
      'No, keep in version control'
    );

    if (choice === 'Yes, add to .gitignore') {
      const entry = `\n# Excalidraw Copilot auto-saved diagrams\n${STORAGE_FOLDER}/\n`;
      const newContent = gitignoreExists
        ? gitignoreContent + entry
        : entry.trimStart();
      await vscode.workspace.fs.writeFile(
        gitignoreUri,
        Buffer.from(newContent, 'utf-8')
      );
    }
  }

  /** Set workspace state reference for gitignore prompt tracking */
  static setWorkspaceState(state: vscode.Memento): void {
    (globalThis as any).__excalidrawWorkspaceState = state;
  }
}
