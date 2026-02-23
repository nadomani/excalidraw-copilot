/**
 * Message protocol types for extension <-> WebView communication
 */

import type { CanvasState, ExcalidrawElement, CanvasElement } from './canvas';

// Messages FROM extension TO WebView
export type ExtensionToWebViewMessage =
  | { type: 'createRectangle'; payload: CreateRectanglePayload }
  | { type: 'createEllipse'; payload: CreateEllipsePayload }
  | { type: 'createDiamond'; payload: CreateDiamondPayload }
  | { type: 'createText'; payload: CreateTextPayload }
  | { type: 'createArrow'; payload: CreateArrowPayload }
  | { type: 'createLine'; payload: CreateLinePayload }
  | { type: 'moveElement'; payload: MoveElementPayload }
  | { type: 'resizeElement'; payload: ResizeElementPayload }
  | { type: 'updateText'; payload: UpdateTextPayload }
  | { type: 'updateStyle'; payload: UpdateStylePayload }
  | { type: 'deleteElement'; payload: DeleteElementPayload }
  | { type: 'connectElements'; payload: ConnectElementsPayload }
  | { type: 'groupElements'; payload: GroupElementsPayload }
  | { type: 'clearCanvas'; payload: Record<string, never> }
  | { type: 'getCanvasState'; payload: Record<string, never> }
  | { type: 'setTheme'; payload: { theme: 'light' | 'dark' } }
  | { type: 'zoomToFit'; payload: Record<string, never> }
  | { type: 'getScreenshot'; payload: Record<string, never> }
  | { type: 'addElement'; payload: CanvasElement }
  | { type: 'addElements'; payload: CanvasElement[] };

// Messages FROM WebView TO extension
export type WebViewToExtensionMessage =
  | { type: 'ready' }
  | { type: 'canvasState'; payload: CanvasState }
  | { type: 'elementCreated'; payload: { id: string; element: ExcalidrawElement } }
  | { type: 'operationComplete'; payload: { success: boolean; elementId?: string; error?: string } }
  | { type: 'error'; payload: { message: string; details?: string } }
  | { type: 'userPrompt'; payload: { prompt: string } }
  | { type: 'screenshot'; payload: { base64: string; mimeType: string; width: number; height: number } };

// Payload types for tool operations
export interface CreateRectanglePayload {
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: 'hachure' | 'cross-hatch' | 'solid';
}

export interface CreateEllipsePayload {
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: 'hachure' | 'cross-hatch' | 'solid';
}

export interface CreateDiamondPayload {
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: 'hachure' | 'cross-hatch' | 'solid';
}

export interface CreateTextPayload {
  id?: string;
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  strokeColor?: string;
}

export interface CreateArrowPayload {
  id?: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startElementId?: string;
  endElementId?: string;
  startArrowhead?: 'arrow' | 'bar' | 'dot' | 'triangle' | null;
  endArrowhead?: 'arrow' | 'bar' | 'dot' | 'triangle' | null;
  strokeColor?: string;
  label?: string;
}

export interface CreateLinePayload {
  id?: string;
  points: Array<{ x: number; y: number }>;
  strokeColor?: string;
}

export interface MoveElementPayload {
  elementId: string;
  x: number;
  y: number;
}

export interface ResizeElementPayload {
  elementId: string;
  width: number;
  height: number;
}

export interface UpdateTextPayload {
  elementId: string;
  text: string;
}

export interface UpdateStylePayload {
  elementId: string;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: 'hachure' | 'cross-hatch' | 'solid';
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  opacity?: number;
}

export interface DeleteElementPayload {
  elementId: string;
}

export interface ConnectElementsPayload {
  arrowId?: string;
  fromElementId: string;
  toElementId: string;
  label?: string;
}

export interface GroupElementsPayload {
  elementIds: string[];
}
