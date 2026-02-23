/**
 * Canvas and Excalidraw element types
 */

export interface Point {
  x: number;
  y: number;
}

// Generic element type for arbitrary Excalidraw elements created by render engine
export interface CanvasElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  [key: string]: any; // Allow additional properties
}

export interface ExcalidrawElementBase {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: 'hachure' | 'cross-hatch' | 'solid';
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  roughness: number;
  opacity: number;
  groupIds: string[];
  frameId: string | null;
  roundness: { type: number; value?: number } | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: Array<{ id: string; type: 'text' | 'arrow' }> | null;
  updated: number;
  link: string | null;
  locked: boolean;
}

export interface RectangleElement extends ExcalidrawElementBase {
  type: 'rectangle';
}

export interface EllipseElement extends ExcalidrawElementBase {
  type: 'ellipse';
}

export interface DiamondElement extends ExcalidrawElementBase {
  type: 'diamond';
}

export interface TextElement extends ExcalidrawElementBase {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: number;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  baseline: number;
  containerId: string | null;
  originalText: string;
  lineHeight: number;
}

export interface ArrowElement extends ExcalidrawElementBase {
  type: 'arrow';
  points: Point[];
  startBinding: {
    elementId: string;
    focus: number;
    gap: number;
  } | null;
  endBinding: {
    elementId: string;
    focus: number;
    gap: number;
  } | null;
  startArrowhead: 'arrow' | 'bar' | 'dot' | 'triangle' | null;
  endArrowhead: 'arrow' | 'bar' | 'dot' | 'triangle' | null;
}

export interface LineElement extends ExcalidrawElementBase {
  type: 'line';
  points: Point[];
  startBinding: null;
  endBinding: null;
  startArrowhead: null;
  endArrowhead: null;
}

export type ExcalidrawElement =
  | RectangleElement
  | EllipseElement
  | DiamondElement
  | TextElement
  | ArrowElement
  | LineElement;

export interface CanvasState {
  elements: ExcalidrawElement[];
  appState: {
    viewBackgroundColor: string;
    gridSize: number | null;
  };
}

export interface ElementSummary {
  id: string;
  type: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  connectedTo?: string[];
}

export function summarizeCanvasState(state: CanvasState): ElementSummary[] {
  return state.elements
    .filter((el) => !el.isDeleted)
    .map((el) => {
      const summary: ElementSummary = {
        id: el.id,
        type: el.type,
        x: Math.round(el.x),
        y: Math.round(el.y),
        width: Math.round(el.width),
        height: Math.round(el.height),
      };

      if (el.type === 'text') {
        summary.label = (el as TextElement).text;
      }

      if (el.type === 'arrow') {
        const arrow = el as ArrowElement;
        const connections: string[] = [];
        if (arrow.startBinding) connections.push(arrow.startBinding.elementId);
        if (arrow.endBinding) connections.push(arrow.endBinding.elementId);
        if (connections.length > 0) {
          summary.connectedTo = connections;
        }
      }

      return summary;
    });
}
