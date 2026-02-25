/**
 * WebView Panel Manager - Handles the Excalidraw WebView lifecycle
 */

import * as vscode from 'vscode';
import type { ExtensionToWebViewMessage, WebViewToExtensionMessage } from '../types/messages';
import type { CanvasState } from '../types/canvas';

export class ExcalidrawPanel {
  public static currentPanel: ExcalidrawPanel | undefined;
  private static readonly viewType = 'excalidrawCopilot';

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  private isReady = false;
  private readyPromise: Promise<void>;
  private readyResolve!: () => void;

  private pendingResult: {
    resolve: (value: { success: boolean; elementId?: string; error?: string }) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  } | null = null;

  private onCanvasStateChange: ((state: CanvasState) => void) | null = null;
  private onUserPrompt: ((prompt: string) => void) | null = null;

  public static createOrShow(extensionUri: vscode.Uri): ExcalidrawPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (ExcalidrawPanel.currentPanel) {
      ExcalidrawPanel.currentPanel.panel.reveal(column);
      return ExcalidrawPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      ExcalidrawPanel.viewType,
      'Excalidraw Copilot',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist'),
          vscode.Uri.joinPath(extensionUri, 'media'),
        ],
      }
    );

    ExcalidrawPanel.currentPanel = new ExcalidrawPanel(panel, extensionUri);
    return ExcalidrawPanel.currentPanel;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;

    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });

    this.panel.webview.html = this.getHtmlContent();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (message: WebViewToExtensionMessage) => this.handleMessage(message),
      null,
      this.disposables
    );
  }

  private handleMessage(message: WebViewToExtensionMessage): void {
    switch (message.type) {
      case 'ready':
        this.isReady = true;
        this.readyResolve();
        break;

      case 'canvasState':
        if (this.onCanvasStateChange) {
          this.onCanvasStateChange(message.payload);
        }
        break;

      case 'operationComplete':
        if (this.pendingResult) {
          clearTimeout(this.pendingResult.timeout);
          this.pendingResult.resolve(message.payload);
          this.pendingResult = null;
        }
        break;

      case 'elementCreated':
        if (this.pendingResult) {
          clearTimeout(this.pendingResult.timeout);
          this.pendingResult.resolve({
            success: true,
            elementId: message.payload.id,
          });
          this.pendingResult = null;
        }
        break;

      case 'error':
        if (this.pendingResult) {
          clearTimeout(this.pendingResult.timeout);
          this.pendingResult.resolve({
            success: false,
            error: message.payload.message,
          });
          this.pendingResult = null;
        }
        break;

      case 'userPrompt':
        if (this.onUserPrompt) {
          this.onUserPrompt(message.payload.prompt);
        }
        break;

      case 'screenshot':
        if (this.pendingScreenshot) {
          this.pendingScreenshot.resolve(message.payload);
          this.pendingScreenshot = null;
        }
        break;

      case 'saveToFile':
        this.handleSaveToFile(message.payload);
        break;
    }
  }

  private pendingScreenshot: {
    resolve: (value: { base64: string; mimeType: string; width: number; height: number }) => void;
  } | null = null;

  public async getScreenshot(): Promise<{ base64: string; mimeType: string; width: number; height: number }> {
    await this.waitUntilReady();
    return new Promise((resolve) => {
      this.pendingScreenshot = { resolve };
      this.sendMessage({ type: 'getScreenshot', payload: {} });
    });
  }

  public async waitUntilReady(): Promise<void> {
    if (this.isReady) return;
    await this.readyPromise;
  }

  public async sendMessage(message: ExtensionToWebViewMessage): Promise<boolean> {
    await this.waitUntilReady();
    return this.panel.webview.postMessage(message);
  }

  public async waitForResult(timeoutMs: number = 5000): Promise<{ success: boolean; elementId?: string; error?: string }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingResult = null;
        resolve({ success: false, error: 'Operation timed out' });
      }, timeoutMs);

      this.pendingResult = { resolve, reject, timeout };
    });
  }

  public async getCanvasState(): Promise<CanvasState> {
    return new Promise((resolve) => {
      const originalHandler = this.onCanvasStateChange;
      this.onCanvasStateChange = (state) => {
        this.onCanvasStateChange = originalHandler;
        resolve(state);
      };
      this.sendMessage({ type: 'getCanvasState', payload: {} });
    });
  }

  public setOnCanvasStateChange(handler: (state: CanvasState) => void): void {
    this.onCanvasStateChange = handler;
  }

  public setOnUserPrompt(handler: (prompt: string) => void): void {
    this.onUserPrompt = handler;
  }

  private async handleSaveToFile(payload: { data: string; filename: string; mimeType: string; encoding?: 'utf8' | 'base64' }): Promise<void> {
    const ext = payload.filename.split('.').pop() || 'bin';
    const filterMap: Record<string, string> = {
      'excalidraw': 'Excalidraw Files',
      'svg': 'SVG Files',
      'png': 'PNG Files',
      'json': 'JSON Files',
    };
    const filters: Record<string, string[]> = {};
    filters[filterMap[ext] || 'All Files'] = [ext];

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(payload.filename),
      filters,
    });

    if (!uri) { return; }

    const content = payload.encoding === 'base64'
      ? Buffer.from(payload.data, 'base64')
      : Buffer.from(payload.data, 'utf8');

    await vscode.workspace.fs.writeFile(uri, content);
    vscode.window.showInformationMessage(`Saved to ${uri.fsPath}`);
  }

  public dispose(): void {
    ExcalidrawPanel.currentPanel = undefined;

    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private getHtmlContent(): string {
    const webviewUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${this.panel.webview.cspSource}; font-src ${this.panel.webview.cspSource}; img-src ${this.panel.webview.cspSource} data: blob:; connect-src data: blob:; worker-src ${this.panel.webview.cspSource} blob:;">
  <title>Excalidraw Copilot</title>
  <style>
    html, body, #root {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    window.EXCALIDRAW_ASSET_PATH = "${webviewUri}/";
    window.WEBVIEW_BASE_URI = "${webviewUri}";
  </script>
  <script type="module" nonce="${nonce}" src="${webviewUri}/index.js"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
