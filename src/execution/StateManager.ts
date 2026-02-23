/**
 * State Manager - Tracks canvas state and provides summaries for LLM context
 */

import type { CanvasState, ElementSummary } from '../types/canvas';
import { summarizeCanvasState } from '../types/canvas';

export class StateManager {
  private currentState: CanvasState = {
    elements: [],
    appState: {
      viewBackgroundColor: '#ffffff',
      gridSize: null,
    },
  };

  private elementLabels: Map<string, string> = new Map();

  updateState(state: CanvasState): void {
    this.currentState = state;
    this.updateLabelMap();
  }

  private updateLabelMap(): void {
    this.elementLabels.clear();
    for (const el of this.currentState.elements) {
      if (el.isDeleted) continue;
      
      if (el.type === 'text') {
        // For text elements, the text itself is the label
        const textEl = el as { text: string };
        this.elementLabels.set(el.id, textEl.text);
      }
      
      // Also check for bound text elements
      if (el.boundElements) {
        for (const bound of el.boundElements) {
          if (bound.type === 'text') {
            const textEl = this.currentState.elements.find(
              (e) => e.id === bound.id && e.type === 'text'
            );
            if (textEl && 'text' in textEl) {
              this.elementLabels.set(el.id, (textEl as { text: string }).text);
            }
          }
        }
      }
    }
  }

  getState(): CanvasState {
    return this.currentState;
  }

  getSummary(): ElementSummary[] {
    return summarizeCanvasState(this.currentState);
  }

  getStateDescription(): string {
    const summary = this.getSummary();
    if (summary.length === 0) {
      return 'Canvas is empty.';
    }

    const lines: string[] = ['Current canvas elements:'];
    
    for (const el of summary) {
      let desc = `- ${el.type} (id: ${el.id})`;
      if (el.label) {
        desc += ` label: "${el.label}"`;
      }
      desc += ` at (${el.x}, ${el.y}) size: ${el.width}x${el.height}`;
      if (el.connectedTo && el.connectedTo.length > 0) {
        desc += ` connects: ${el.connectedTo.join(' → ')}`;
      }
      lines.push(desc);
    }

    return lines.join('\n');
  }

  findElementByLabel(label: string): string | undefined {
    const lowerLabel = label.toLowerCase();
    for (const [id, elLabel] of this.elementLabels) {
      if (elLabel.toLowerCase().includes(lowerLabel)) {
        return id;
      }
    }
    return undefined;
  }

  getElementCount(): number {
    return this.currentState.elements.filter((el) => !el.isDeleted).length;
  }

  clear(): void {
    this.currentState = {
      elements: [],
      appState: {
        viewBackgroundColor: '#ffffff',
        gridSize: null,
      },
    };
    this.elementLabels.clear();
  }
}
