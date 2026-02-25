import { useEffect, useCallback, useRef } from 'react';

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

type MessageHandler = (message: { type: string; payload?: unknown }) => void;

let vscodeApi: VsCodeApi | null = null;

export function getVsCodeApi(): VsCodeApi | null {
  if (vscodeApi) return vscodeApi;
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vscodeApi = (window as any).acquireVsCodeApi?.();
    return vscodeApi;
  } catch {
    // Running outside VS Code (dev mode)
    return null;
  }
}

export function useMessageBridge(onMessage: MessageHandler) {
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message && typeof message.type === 'string') {
        handlerRef.current(message);
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Signal ready to extension
    const api = getVsCodeApi();
    if (api) {
      api.postMessage({ type: 'ready' });
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const postMessage = useCallback((type: string, payload?: unknown) => {
    const api = getVsCodeApi();
    if (api) {
      api.postMessage({ type, payload });
    } else {
      // Dev mode - no VS Code API available
    }
  }, []);

  return { postMessage };
}
