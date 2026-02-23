interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

declare global {
  interface Window {
    WEBVIEW_BASE_URI?: string;
    vscodeApi?: VsCodeApi;
  }
}

export {};
