/**
 * ExcalidrawEditorProvider — Custom editor for .excalidraw files.
 * Double-clicking a .excalidraw file opens it in the Excalidraw panel.
 */

import * as vscode from 'vscode';
import { DiagramStore, ExcalidrawFile } from '../gallery/DiagramStore';

export class ExcalidrawEditorProvider implements vscode.CustomReadonlyEditorProvider {
  public static readonly viewType = 'excalidraw-copilot.excalidrawEditor';

  private store: DiagramStore;
  private openHandler: ((file: ExcalidrawFile) => Promise<void>) | undefined;

  constructor(store: DiagramStore) {
    this.store = store;
  }

  /** Set the function that opens a diagram file in the Excalidraw panel */
  setOpenHandler(handler: (file: ExcalidrawFile) => Promise<void>): void {
    this.openHandler = handler;
  }

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.CustomDocument> {
    return { uri, dispose: () => {} };
  }

  async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Close the custom editor tab — we'll open in our own panel
    webviewPanel.dispose();

    try {
      const file = await this.store.loadDiagram(document.uri);
      if (this.openHandler) {
        await this.openHandler(file);
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to open .excalidraw file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
