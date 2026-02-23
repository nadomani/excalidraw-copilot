/**
 * Message Handler - Bridge between extension and WebView
 */

import type { ExcalidrawPanel } from './WebViewPanel';
import type { StateManager } from '../execution/StateManager';
import type { CanvasState } from '../types/canvas';
import type { ExtensionToWebViewMessage } from '../types/messages';

export class MessageHandler {
  private panel: ExcalidrawPanel;
  private stateManager: StateManager;

  constructor(panel: ExcalidrawPanel, stateManager: StateManager) {
    this.panel = panel;
    this.stateManager = stateManager;

    // Set up canvas state sync
    this.panel.setOnCanvasStateChange((state: CanvasState) => {
      this.stateManager.updateState(state);
    });
  }

  async sendMessage(message: ExtensionToWebViewMessage): Promise<boolean> {
    return this.panel.sendMessage(message);
  }

  async waitForResult(timeoutMs?: number): Promise<{ success: boolean; elementId?: string; error?: string }> {
    return this.panel.waitForResult(timeoutMs);
  }

  async requestCanvasState(): Promise<void> {
    const state = await this.panel.getCanvasState();
    this.stateManager.updateState(state);
  }
}
