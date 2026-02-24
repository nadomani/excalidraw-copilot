import { useState, useRef, useCallback, useEffect } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types';
import { useMessageBridge } from './hooks/useMessageBridge';
import { nanoid } from 'nanoid';
import mermaid from 'mermaid';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Payload types for messages from extension
interface CreateShapePayload {
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

interface CreateTextPayload {
  id?: string;
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  strokeColor?: string;
}

interface CreateArrowPayload {
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

interface CreateLinePayload {
  id?: string;
  points: Array<{ x: number; y: number }>;
  strokeColor?: string;
}

interface MoveElementPayload {
  elementId: string;
  x: number;
  y: number;
}

interface ResizeElementPayload {
  elementId: string;
  width: number;
  height: number;
}

interface UpdateTextPayload {
  elementId: string;
  text: string;
}

interface UpdateStylePayload {
  elementId: string;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: 'hachure' | 'cross-hatch' | 'solid';
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  opacity?: number;
}

interface DeleteElementPayload {
  elementId: string;
}

interface ConnectElementsPayload {
  arrowId?: string;
  fromElementId: string;
  toElementId: string;
  label?: string;
}

interface GroupElementsPayload {
  elementIds: string[];
}

// Post-process Mermaid-converted elements for visual polish only
// NOTE: Do NOT scale positions/spacing — it breaks arrow bindings and containment
function postProcessMermaidElements(elements: any[]): any[] {
  return elements.map((el: any) => {
    // Clean <br> tags from text
    if (el.type === 'text' && el.text) {
      const cleanText = el.text.replace(/<br\s*\/?>/gi, '\n');
      const cleanOriginal = el.originalText ? el.originalText.replace(/<br\s*\/?>/gi, '\n') : cleanText;
      return {
        ...el,
        text: cleanText,
        originalText: cleanOriginal,
      };
    }

    // Solid fills for colored shapes
    if (el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'diamond') {
      return {
        ...el,
        fillStyle: el.backgroundColor && el.backgroundColor !== 'transparent' ? 'solid' : el.fillStyle,
        roughness: 1,
        strokeWidth: 2,
      };
    }

    return el;
  });
}

// Toolbar button style for Mermaid preview
function toolbarBtnStyle(theme: string): React.CSSProperties {
  return {
    padding: '4px 10px',
    borderRadius: '4px',
    border: `1px solid ${theme === 'dark' ? '#555' : '#ccc'}`,
    backgroundColor: theme === 'dark' ? '#333' : '#fff',
    color: theme === 'dark' ? '#ddd' : '#333',
    cursor: 'pointer',
    fontSize: '12px',
  };
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const excalidrawRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [prompt, setPrompt] = useState('');
  const [viewMode, setViewMode] = useState<'excalidraw' | 'mermaid'>('excalidraw');
  const [currentMermaid, setCurrentMermaid] = useState<string>('');
  const [mermaidSvg, setMermaidSvg] = useState<string>('');
  const [mermaidZoom, setMermaidZoom] = useState(1);
  const [mermaidPan, setMermaidPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const mermaidContainerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({ x: 0, y: 0, panX: 0, panY: 0 });

  // Initialize Mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
      flowchart: { curve: 'basis', padding: 20 },
    });
  }, [theme]);

  // Re-render Mermaid when syntax changes
  useEffect(() => {
    if (!currentMermaid || viewMode !== 'mermaid') return;
    const renderMermaid = async () => {
      try {
        const id = `mermaid-preview-${Date.now()}`;
        const { svg } = await mermaid.render(id, currentMermaid);
        setMermaidSvg(svg);
      } catch (err) {
        console.error('Mermaid render error:', err);
        setMermaidSvg(`<div style="color:red;padding:20px;">Mermaid render error: ${err}</div>`);
      }
    };
    renderMermaid();
  }, [currentMermaid, viewMode, theme]);

  // Handle "Convert to Excalidraw" button
  const handleConvertToExcalidraw = useCallback(async () => {
    if (!currentMermaid) return;
    try {
      const { parseMermaidToExcalidraw } = await import('@excalidraw/mermaid-to-excalidraw');
      const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw');

      const { elements: skeletonElements, files } = await parseMermaidToExcalidraw(currentMermaid);
      const excalidrawElements = convertToExcalidrawElements(skeletonElements);
      const processed = postProcessMermaidElements(excalidrawElements as any[]);

      // Switch to Excalidraw mode and load elements
      setViewMode('excalidraw');
      setTimeout(() => {
        const api = excalidrawRef.current;
        if (api) {
          api.updateScene({ elements: processed });
          api.scrollToContent(processed as any, { fitToContent: true, animate: true });

          if (files && Object.keys(files).length > 0) {
            api.addFiles(Object.values(files).map((f: any) => ({
              id: f.id, dataURL: f.dataURL, mimeType: f.mimeType,
              created: f.created, lastRetrieved: f.lastRetrieved,
            })));
          }
        }
      }, 200);
    } catch (err) {
      console.error('Convert failed:', err);
    }
  }, [currentMermaid]);

  // Reset zoom/pan when Mermaid content changes
  useEffect(() => {
    if (currentMermaid) {
      setMermaidZoom(1);
      setMermaidPan({ x: 0, y: 0 });
    }
  }, [currentMermaid]);

  // Mermaid zoom via Ctrl+wheel (like Excalidraw)
  const handleMermaidWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setMermaidZoom(z => Math.min(5, Math.max(0.1, z + delta)));
    }
  }, []);

  // Mermaid pan via mouse drag
  const handleMermaidMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle-click or space+click for pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: mermaidPan.x, panY: mermaidPan.y };
    }
  }, [mermaidPan]);

  const handleMermaidMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setMermaidPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
  }, []);

  const handleMermaidMouseUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  // Export Mermaid as SVG
  const handleExportSvg = useCallback(() => {
    if (!mermaidSvg) return;
    const blob = new Blob([mermaidSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mermaid-diagram.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, [mermaidSvg]);

  // Export Mermaid as PNG
  const handleExportPng = useCallback(() => {
    if (!mermaidSvg) return;
    const svgEl = new DOMParser().parseFromString(mermaidSvg, 'image/svg+xml').documentElement;
    const w = parseFloat(svgEl.getAttribute('width') || '800') * mermaidZoom;
    const h = parseFloat(svgEl.getAttribute('height') || '600') * mermaidZoom;
    // Use viewBox or natural size at 2x for crisp export
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.fillStyle = theme === 'dark' ? '#1e1e1e' : '#ffffff';
    ctx.fillRect(0, 0, w, h);
    const img = new Image();
    const svgBlob = new Blob([mermaidSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'mermaid-diagram.png';
      a.click();
    };
    img.src = url;
  }, [mermaidSvg, mermaidZoom, theme]);

  // Generate base element properties
  const generateBaseElement = useCallback((
    type: string,
    x: number,
    y: number,
    width: number,
    height: number,
    id?: string,
    extras?: Record<string, any>
  ): any => {
    return {
      id: id || nanoid(),
      type,
      x,
      y,
      width,
      height,
      angle: 0,
      strokeColor: '#1e1e1e',
      backgroundColor: 'transparent',
      fillStyle: 'hachure',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: { type: 3 },
      seed: Math.floor(Math.random() * 1000000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 1000000),
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      ...extras,
    };
  }, []);

  // Create text element (for labels)
  const createTextElement = useCallback((
    text: string,
    x: number,
    y: number,
    containerId?: string,
    id?: string,
    options?: { fontSize?: number; strokeColor?: string }
  ): any => {
    const fontSize = options?.fontSize ?? 20;
    const lines = text.split('\n');
    const lineHeight = fontSize * 1.25;
    const height = lines.length * lineHeight;
    const width = Math.max(...lines.map(l => l.length * fontSize * 0.6));

    return {
      id: id || nanoid(),
      type: 'text',
      x,
      y,
      width,
      height,
      angle: 0,
      strokeColor: options?.strokeColor || '#1e1e1e',
      backgroundColor: 'transparent',
      fillStyle: 'hachure',
      strokeWidth: 1,
      strokeStyle: 'solid',
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: Math.floor(Math.random() * 1000000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 1000000),
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      text,
      fontSize,
      fontFamily: 1,
      textAlign: 'center',
      verticalAlign: 'middle',
      baseline: fontSize,
      containerId: containerId || null,
      originalText: text,
      lineHeight: 1.25,
    };
  }, []);

  // Handle messages from extension
  const handleMessage = useCallback(async (message: { type: string; payload?: any }) => {
    const api = excalidrawRef.current;
    if (!api && message.type !== 'ready') {
      console.warn('Excalidraw API not ready');
      return;
    }

    const elements: any[] = api?.getSceneElements() ? [...api.getSceneElements()] : [];
    let newElements: any[] = [];
    let createdId: string | undefined;

    try {
      switch (message.type) {
        case 'createRectangle':
        case 'createEllipse':
        case 'createDiamond': {
          const p = message.payload as CreateShapePayload;
          const shapeType = message.type === 'createRectangle' ? 'rectangle' 
            : message.type === 'createEllipse' ? 'ellipse' : 'diamond';
          const shapeId = p.id || nanoid();
          const shape = generateBaseElement(shapeType, p.x, p.y, p.width, p.height, shapeId, {
            strokeColor: p.strokeColor || '#1e1e1e',
            backgroundColor: p.backgroundColor || 'transparent',
            fillStyle: p.fillStyle || 'hachure',
          });

          if (p.label) {
            const textId = nanoid();
            const textEl = createTextElement(
              p.label,
              p.x + p.width / 2,
              p.y + p.height / 2,
              shapeId,
              textId
            );
            shape.boundElements = [{ id: textId, type: 'text' }];
            newElements = [...elements, shape, textEl];
          } else {
            newElements = [...elements, shape];
          }
          createdId = shapeId;
          break;
        }

        case 'createText': {
          const p = message.payload as CreateTextPayload;
          const textId = p.id || nanoid();
          const textEl = createTextElement(p.text, p.x, p.y, undefined, textId, {
            fontSize: p.fontSize,
            strokeColor: p.strokeColor,
          });
          newElements = [...elements, textEl];
          createdId = textId;
          break;
        }

        case 'createArrow': {
          const p = message.payload as CreateArrowPayload;
          const arrowId = p.id || nanoid();
          
          let startX = p.startX;
          let startY = p.startY;
          let endX = p.endX;
          let endY = p.endY;

          if (p.startElementId) {
            const startEl = elements.find(e => e.id === p.startElementId);
            if (startEl) {
              startX = startEl.x + startEl.width / 2;
              startY = startEl.y + startEl.height / 2;
            }
          }
          if (p.endElementId) {
            const endEl = elements.find(e => e.id === p.endElementId);
            if (endEl) {
              endX = endEl.x + endEl.width / 2;
              endY = endEl.y + endEl.height / 2;
            }
          }

          const dx = endX - startX;
          const dy = endY - startY;

          const arrow = {
            ...generateBaseElement('arrow', startX, startY, Math.abs(dx), Math.abs(dy), arrowId, {
              strokeColor: p.strokeColor || '#1e1e1e',
            }),
            points: [[0, 0], [dx, dy]],
            startBinding: p.startElementId ? {
              elementId: p.startElementId,
              focus: 0,
              gap: 8,
            } : null,
            endBinding: p.endElementId ? {
              elementId: p.endElementId,
              focus: 0,
              gap: 8,
            } : null,
            startArrowhead: p.startArrowhead ?? null,
            endArrowhead: p.endArrowhead ?? 'arrow',
          };

          newElements = [...elements, arrow];

          // Update bound elements on connected shapes
          if (p.startElementId || p.endElementId) {
            newElements = newElements.map(el => {
              if (el.id === p.startElementId || el.id === p.endElementId) {
                const existing = el.boundElements || [];
                return {
                  ...el,
                  boundElements: [...existing, { id: arrowId, type: 'arrow' }],
                };
              }
              return el;
            });
          }

          if (p.label) {
            const midX = startX + dx / 2;
            const midY = startY + dy / 2;
            const labelEl = createTextElement(p.label, midX - 20, midY - 10);
            newElements = [...newElements, labelEl];
          }

          createdId = arrowId;
          break;
        }

        case 'createLine': {
          const p = message.payload as CreateLinePayload;
          const lineId = p.id || nanoid();
          
          if (p.points.length < 2) {
            throw new Error('Line needs at least 2 points');
          }

          const startPoint = p.points[0];
          const linePoints = p.points.map(pt => [pt.x - startPoint.x, pt.y - startPoint.y]);
          
          const line = {
            ...generateBaseElement('line', startPoint.x, startPoint.y, 100, 100, lineId, {
              strokeColor: p.strokeColor || '#1e1e1e',
            }),
            points: linePoints,
            startBinding: null,
            endBinding: null,
            startArrowhead: null,
            endArrowhead: null,
          };

          newElements = [...elements, line];
          createdId = lineId;
          break;
        }

        case 'moveElement': {
          const p = message.payload as MoveElementPayload;
          const el = elements.find(e => e.id === p.elementId);
          if (!el) {
            throw new Error(`Element not found: ${p.elementId}`);
          }

          const dx = p.x - el.x;
          const dy = p.y - el.y;

          newElements = elements.map(e => {
            if (e.id === p.elementId) {
              return { ...e, x: p.x, y: p.y };
            }
            if (e.containerId === p.elementId) {
              return { ...e, x: e.x + dx, y: e.y + dy };
            }
            return e;
          });
          createdId = p.elementId;
          break;
        }

        case 'resizeElement': {
          const p = message.payload as ResizeElementPayload;
          newElements = elements.map(e => {
            if (e.id === p.elementId) {
              return { ...e, width: p.width, height: p.height };
            }
            return e;
          });
          createdId = p.elementId;
          break;
        }

        case 'updateText': {
          const p = message.payload as UpdateTextPayload;
          newElements = elements.map(e => {
            if (e.id === p.elementId && e.type === 'text') {
              return { ...e, text: p.text, originalText: p.text };
            }
            if (e.containerId === p.elementId && e.type === 'text') {
              return { ...e, text: p.text, originalText: p.text };
            }
            return e;
          });
          createdId = p.elementId;
          break;
        }

        case 'updateStyle': {
          const p = message.payload as UpdateStylePayload;
          newElements = elements.map(e => {
            if (e.id === p.elementId) {
              return {
                ...e,
                ...(p.strokeColor && { strokeColor: p.strokeColor }),
                ...(p.backgroundColor && { backgroundColor: p.backgroundColor }),
                ...(p.fillStyle && { fillStyle: p.fillStyle }),
                ...(p.strokeWidth && { strokeWidth: p.strokeWidth }),
                ...(p.strokeStyle && { strokeStyle: p.strokeStyle }),
                ...(p.opacity !== undefined && { opacity: p.opacity }),
              };
            }
            return e;
          });
          createdId = p.elementId;
          break;
        }

        case 'deleteElement': {
          const p = message.payload as DeleteElementPayload;
          newElements = elements.map(e => {
            if (e.id === p.elementId || e.containerId === p.elementId) {
              return { ...e, isDeleted: true };
            }
            return e;
          });
          createdId = p.elementId;
          break;
        }

        case 'connectElements': {
          const p = message.payload as ConnectElementsPayload;
          const fromEl = elements.find(e => e.id === p.fromElementId);
          const toEl = elements.find(e => e.id === p.toElementId);

          if (!fromEl || !toEl) {
            throw new Error(`Elements not found: ${p.fromElementId} or ${p.toElementId}`);
          }

          const startX = fromEl.x + fromEl.width / 2;
          const startY = fromEl.y + fromEl.height / 2;
          const endX = toEl.x + toEl.width / 2;
          const endY = toEl.y + toEl.height / 2;
          const dx = endX - startX;
          const dy = endY - startY;

          const arrowId = p.arrowId || nanoid();
          const arrow = {
            ...generateBaseElement('arrow', startX, startY, Math.abs(dx), Math.abs(dy), arrowId),
            points: [[0, 0], [dx, dy]],
            startBinding: { elementId: p.fromElementId, focus: 0, gap: 8 },
            endBinding: { elementId: p.toElementId, focus: 0, gap: 8 },
            startArrowhead: null,
            endArrowhead: 'arrow',
          };

          newElements = elements.map(el => {
            if (el.id === p.fromElementId || el.id === p.toElementId) {
              const existing = el.boundElements || [];
              return {
                ...el,
                boundElements: [...existing, { id: arrowId, type: 'arrow' }],
              };
            }
            return el;
          });
          newElements = [...newElements, arrow];

          if (p.label) {
            const midX = startX + dx / 2;
            const midY = startY + dy / 2;
            const labelEl = createTextElement(p.label, midX - 20, midY - 10);
            newElements = [...newElements, labelEl];
          }

          createdId = arrowId;
          break;
        }

        case 'groupElements': {
          const p = message.payload as GroupElementsPayload;
          const groupId = nanoid();
          newElements = elements.map(e => {
            if (p.elementIds.includes(e.id)) {
              return { ...e, groupIds: [...e.groupIds, groupId] };
            }
            return e;
          });
          createdId = groupId;
          break;
        }

        case 'clearCanvas': {
          newElements = [];
          createdId = 'cleared';
          // Reset to Excalidraw view so DSL pipeline renders properly
          setViewMode('excalidraw');
          setCurrentMermaid('');
          setMermaidSvg('');
          break;
        }

        // NEW: Add a raw Excalidraw element directly
        case 'addElement': {
          const element = message.payload as any;
          if (element && element.id) {
            newElements = [...elements, element];
            createdId = element.id;
          }
          break;
        }

        // NEW: Add multiple raw Excalidraw elements at once (preserves bindings)
        case 'addElements': {
          const els = message.payload as any[];
          if (Array.isArray(els) && els.length > 0) {
            newElements = [...elements, ...els];
            createdId = els[0]?.id;
          }
          break;
        }

        // Mermaid pipeline: convert Mermaid syntax to Excalidraw elements
        case 'renderMermaid': {
          const { mermaidSyntax } = message.payload as { mermaidSyntax: string };
          try {
            const { parseMermaidToExcalidraw } = await import('@excalidraw/mermaid-to-excalidraw');
            const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw');
            
            const { elements: skeletonElements, files } = await parseMermaidToExcalidraw(mermaidSyntax);
            const excalidrawElements = convertToExcalidrawElements(skeletonElements);
            
            // Post-process Mermaid elements for better spacing and visuals
            newElements = postProcessMermaidElements(excalidrawElements as any[]);
            createdId = newElements[0]?.id;
            
            // Store any files (images for unsupported diagram types)
            if (files && Object.keys(files).length > 0 && api) {
              api.addFiles(Object.values(files).map((f: any) => ({
                id: f.id,
                dataURL: f.dataURL,
                mimeType: f.mimeType,
                created: f.created,
                lastRetrieved: f.lastRetrieved,
              })));
            }

            console.log(`Mermaid rendered: ${newElements.length} elements`);
          } catch (err) {
            console.error('Mermaid rendering failed:', err);
            postMessage('error', { message: `Mermaid rendering failed: ${err instanceof Error ? err.message : String(err)}` });
            return;
          }
          break;
        }

        // Mermaid preview mode: show native Mermaid render with convert button
        case 'showMermaidPreview': {
          const { mermaidSyntax: syntax } = message.payload as { mermaidSyntax: string };
          setCurrentMermaid(syntax);
          setViewMode('mermaid');
          postMessage('operationComplete', { success: true });
          return;
        }

        case 'getCanvasState': {
          const appState = api?.getAppState();
          postMessage('canvasState', {
            elements: elements,
            appState: {
              viewBackgroundColor: appState?.viewBackgroundColor || '#ffffff',
              gridSize: appState?.gridSize || null,
            },
          });
          return;
        }

        case 'setTheme': {
          const p = message.payload as { theme: 'light' | 'dark' };
          setTheme(p.theme);
          postMessage('operationComplete', { success: true });
          return;
        }

        case 'zoomToFit': {
          api?.scrollToContent(api.getSceneElements(), {
            fitToContent: true,
            animate: true,
          });
          postMessage('operationComplete', { success: true });
          return;
        }

        case 'getScreenshot': {
          // Export canvas as PNG base64
          try {
            const { exportToBlob } = await import('@excalidraw/excalidraw');
            const blob = await exportToBlob({
              elements: api?.getSceneElements() || [],
              appState: {
                ...api?.getAppState(),
                exportWithDarkMode: false,
                exportBackground: true,
              },
              files: null,
              getDimensions: () => ({ width: 1200, height: 800, scale: 1 }),
            });
            
            // Convert blob to base64
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              postMessage('screenshot', { 
                base64,
                mimeType: 'image/png',
                width: 1200,
                height: 800,
              });
            };
            reader.readAsDataURL(blob);
          } catch (err) {
            console.error('Screenshot failed:', err);
            postMessage('error', { message: 'Failed to capture screenshot' });
          }
          return;
        }

        default:
          console.warn('Unknown message type:', message.type);
          return;
      }

      // Update scene
      if (newElements.length > 0 || message.type === 'clearCanvas') {
        api?.updateScene({ elements: newElements });
      }

      postMessage('elementCreated', { id: createdId, element: newElements.find(e => e.id === createdId) });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      postMessage('error', { message: errorMessage });
    }
  }, [generateBaseElement, createTextElement]);

  const { postMessage } = useMessageBridge(handleMessage);

  // Handle prompt submission
  const handleSubmitPrompt = useCallback(() => {
    if (prompt.trim()) {
      postMessage('userPrompt', { prompt: prompt.trim() });
      setPrompt('');
    }
  }, [prompt, postMessage]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleSubmitPrompt();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmitPrompt]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Prompt input bar */}
      <div style={{
        display: 'flex',
        padding: '8px',
        gap: '8px',
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: theme === 'dark' ? '#1e1e1e' : '#f5f5f5',
      }}>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe a diagram... (Ctrl+Enter to submit)"
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            fontSize: '14px',
            backgroundColor: theme === 'dark' ? '#2d2d2d' : '#fff',
            color: theme === 'dark' ? '#fff' : '#000',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              handleSubmitPrompt();
            }
          }}
        />
        <button
          onClick={handleSubmitPrompt}
          style={{
            padding: '8px 16px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: '#007acc',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Generate
        </button>
      </div>

      {/* Excalidraw canvas or Mermaid preview */}
      {viewMode === 'mermaid' ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff',
        }}>
          {/* Mermaid toolbar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#e0e0e0'}`,
            backgroundColor: theme === 'dark' ? '#252526' : '#f0f0f0',
            flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '14px', color: theme === 'dark' ? '#ccc' : '#333' }}>
              🧜 Mermaid Preview
            </span>

            {/* Zoom controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
              <button onClick={() => setMermaidZoom(z => Math.max(0.1, z - 0.2))} style={toolbarBtnStyle(theme)} title="Zoom out">−</button>
              <span
                style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#555', minWidth: '44px', textAlign: 'center', cursor: 'pointer' }}
                onClick={() => { setMermaidZoom(1); setMermaidPan({ x: 0, y: 0 }); }}
                title="Reset zoom & pan"
              >
                {Math.round(mermaidZoom * 100)}%
              </span>
              <button onClick={() => setMermaidZoom(z => Math.min(5, z + 0.2))} style={toolbarBtnStyle(theme)} title="Zoom in">+</button>
              <button onClick={() => { setMermaidZoom(1); setMermaidPan({ x: 0, y: 0 }); }} style={toolbarBtnStyle(theme)} title="Fit to screen">⊡</button>
            </div>

            {/* Export buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
              <button onClick={handleExportSvg} style={toolbarBtnStyle(theme)} title="Export as SVG">💾 SVG</button>
              <button onClick={handleExportPng} style={toolbarBtnStyle(theme)} title="Export as PNG">📷 PNG</button>
            </div>

            <span style={{ fontSize: '11px', color: theme === 'dark' ? '#666' : '#999', flex: 1, textAlign: 'right' }}>
              Ctrl+Scroll to zoom · Alt+Drag to pan
            </span>

            <button
              onClick={handleConvertToExcalidraw}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#22c55e',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 'bold',
              }}
            >
              ✅ Convert to Excalidraw
            </button>
          </div>

          {/* Mermaid SVG render — zoomable & pannable */}
          <div
            ref={mermaidContainerRef}
            onWheel={handleMermaidWheel}
            onMouseDown={handleMermaidMouseDown}
            onMouseMove={handleMermaidMouseMove}
            onMouseUp={handleMermaidMouseUp}
            onMouseLeave={handleMermaidMouseUp}
            style={{
              flex: 1,
              overflow: 'hidden',
              cursor: isPanningRef.current ? 'grabbing' : 'default',
              position: 'relative',
            }}
          >
            <div
              style={{
                transform: `translate(${mermaidPan.x}px, ${mermaidPan.y}px) scale(${mermaidZoom})`,
                transformOrigin: 'center top',
                display: 'flex',
                justifyContent: 'center',
                padding: '30px',
                minHeight: '100%',
              }}
              dangerouslySetInnerHTML={{ __html: mermaidSvg }}
            />
          </div>
        </div>
      ) : (
        <div style={{ flex: 1 }}>
          <Excalidraw
            excalidrawAPI={(api: ExcalidrawImperativeAPI) => {
              excalidrawRef.current = api;
            }}
            theme={theme}
            initialData={{
              elements: [],
              appState: {
                viewBackgroundColor: '#ffffff',
              },
            }}
            onChange={(elements: any, appState: any) => {
              postMessage('canvasState', {
                elements: [...elements],
                appState: {
                  viewBackgroundColor: appState.viewBackgroundColor,
                  gridSize: appState.gridSize,
                },
              });
            }}
          />
        </div>
      )}
    </div>
  );
}

export default App;
