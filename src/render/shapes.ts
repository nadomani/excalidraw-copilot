// Shape generators - create Excalidraw elements from positioned graph

import { PositionedGraph, PositionedNode, NodeType, Direction } from '../dsl/types';
import { getNodeColors, getConnectionColors, EXCALIDRAW_STYLE } from './styles';
import { CanvasElement } from '../types/canvas';

// Generate unique IDs
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Main render function - converts positioned graph to Excalidraw elements
export function renderToExcalidraw(graph: PositionedGraph): CanvasElement[] {
  const elements: CanvasElement[] = [];
  let zIndex = 0;
  
  // 1. Render groups first (background)
  for (const group of graph.groups) {
    elements.push(...createGroupElement(group, zIndex++));
  }
  
  // 2. Render title
  if (graph.title) {
    elements.push(createTitleElement(graph.title, zIndex++));
  }
  
  // 3. Render nodes
  for (const node of graph.nodes) {
    elements.push(...createNodeElements(node, zIndex++));
  }
  
  // 4. Render connections
  for (const conn of graph.connections) {
    elements.push(createConnectionElement(conn, zIndex++, graph.direction));
  }
  
  // 5. Render notes
  for (const note of graph.notes) {
    elements.push(...createNoteElements(note, zIndex++));
  }
  
  return elements;
}

// Create title text element
function createTitleElement(
  title: { text: string; emoji?: string; x: number; y: number },
  zIndex: number
): CanvasElement {
  const text = title.emoji ? `${title.emoji} ${title.text}` : title.text;
  
  return {
    id: generateId(),
    type: 'text',
    x: title.x - (text.length * 7),
    y: title.y,
    width: text.length * 16,
    height: 40,
    text,
    fontSize: 28,
    fontFamily: 1,
    textAlign: 'center',
    verticalAlign: 'middle',
    strokeColor: '#1a1a1a',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 0,
    roughness: 0,
    opacity: 100,
    angle: 0,
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 100000),
    isDeleted: false,
    groupIds: [],
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    containerId: null,
    originalText: text,
    lineHeight: 1.25,
    baseline: 25
  } as any;
}

// Truncate text to max length
function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3) + '...';
}

// Create node shape + text elements - CLAUDE STYLE
// Layout: Label at top, BIG emoji in center, description at bottom
function createNodeElements(node: PositionedNode, zIndex: number): CanvasElement[] {
  const colors = getNodeColors(node.type, node.semanticColor);
  const elements: CanvasElement[] = [];
  const groupId = generateId();
  
  // Create shape based on node type
  const shapeElement = createNodeShape(node, colors, groupId);
  elements.push(shapeElement);
  
  // Calculate vertical positions
  // Database nodes use ellipse with 0.8 height — bottom doesn't extend as far as rectangle
  const isDatabase = node.type === 'database';
  const boxTop = node.y - node.height / 2;
  const boxBottom = node.y + node.height / 2 - (isDatabase ? node.height * 0.2 : 0);
  
  // 1. LABEL TEXT at top - colored like the box border (Claude style)
  // Wrap to 2 lines if too long for the box
  const labelFontSize = 18;
  const labelMaxChars = Math.floor((node.width - 20) / 10); // ~10px per char at 18px
  const labelText = node.label;
  
  if (labelText.length <= labelMaxChars) {
    // Single line label
    elements.push({
      id: generateId(),
      type: 'text',
      x: node.x - node.width / 2 + 10,
      y: boxTop + 10,
      width: node.width - 20,
      height: 24,
      text: labelText,
      fontSize: labelFontSize,
      fontFamily: 1,
      textAlign: 'center',
      verticalAlign: 'top',
      strokeColor: colors.stroke,
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 0,
      roughness: 0,
      opacity: 100,
      angle: 0,
      seed: Math.floor(Math.random() * 100000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 100000),
      isDeleted: false,
      groupIds: [groupId],
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      containerId: null,
      originalText: labelText,
      lineHeight: 1.25,
      baseline: 16
    } as any);
  } else {
    // Multi-line label: wrap and render each line separately
    const wrappedLabel = wrapText(labelText, labelMaxChars);
    const labelLines = wrappedLabel.split('\n').slice(0, 2); // max 2 lines
    const lineH = labelFontSize * 1.25;
    for (let i = 0; i < labelLines.length; i++) {
      elements.push({
        id: generateId(),
        type: 'text',
        x: node.x - node.width / 2 + 10,
        y: boxTop + 6 + i * lineH,
        width: node.width - 20,
        height: lineH,
        text: labelLines[i],
        fontSize: labelFontSize,
        fontFamily: 1,
        textAlign: 'center',
        verticalAlign: 'top',
        strokeColor: colors.stroke,
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 0,
        roughness: 0,
        opacity: 100,
        angle: 0,
        seed: Math.floor(Math.random() * 100000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 100000),
        isDeleted: false,
        groupIds: [groupId],
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
        containerId: null,
        originalText: labelLines[i],
        lineHeight: 1.25,
        baseline: 16
      } as any);
    }
  }
  
  // Calculate label height for positioning emoji below it
  const labelLineCount = labelText.length <= labelMaxChars ? 1 : 
    Math.min(2, wrapText(labelText, labelMaxChars).split('\n').length);
  const labelBottomY = boxTop + 10 + labelLineCount * (labelFontSize * 1.25);
  
  // 2. EMOJI in center area - positioned below label (smaller for database nodes)
  const emojiFontSize = isDatabase ? 20 : 26;
  const emojiHeight = isDatabase ? 24 : 32;
  if (node.emoji) {
    elements.push({
      id: generateId(),
      type: 'text',
      x: node.x - 18,
      y: labelBottomY + 2,
      width: 36,
      height: emojiHeight,
      text: node.emoji,
      fontSize: emojiFontSize,
      fontFamily: 1,
      textAlign: 'center',
      verticalAlign: 'middle',
      strokeColor: '#000000',
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 0,
      roughness: 0,
      opacity: 100,
      angle: 0,
      seed: Math.floor(Math.random() * 100000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 100000),
      isDeleted: false,
      groupIds: [groupId],
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      containerId: null,
      originalText: node.emoji,
      lineHeight: 1.25,
      baseline: emojiFontSize - 4
    } as any);
  }
  
  // 3. DESCRIPTION at bottom - bigger font, wrapped, dark text
  if (node.description) {
    const descFontSize = 13;
    const maxCharsPerLine = Math.floor((node.width - 24) / 8);
    const wrappedDesc = wrapText(node.description, maxCharsPerLine);
    const allLines = wrappedDesc.split('\n');
    // Limit to 2 lines for database (tight ellipse), 3 for others
    const maxDescLines = isDatabase ? 2 : 3;
    const descLines = allLines.length > maxDescLines
      ? [...allLines.slice(0, maxDescLines - 1), allLines[maxDescLines - 1].replace(/\s+$/, '') + '...']
      : allLines;
    const lineH = descFontSize * 1.25;
    const descHeight = descLines.length * lineH;
    
    // Render each line separately to prevent Excalidraw re-wrapping
    const descStartY = boxBottom - descHeight - 10;
    for (let i = 0; i < descLines.length; i++) {
      elements.push({
        id: generateId(),
        type: 'text',
        x: node.x - node.width / 2 + 12,
        y: descStartY + i * lineH,
        width: node.width - 24,
        height: lineH,
        text: descLines[i],
        fontSize: descFontSize,
        fontFamily: 1,
        textAlign: 'center',
        verticalAlign: 'top',
        strokeColor: '#333333',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 0,
        roughness: 0,
        opacity: 90,
        angle: 0,
        seed: Math.floor(Math.random() * 100000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 100000),
        isDeleted: false,
        groupIds: [groupId],
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
        containerId: null,
        originalText: descLines[i],
        lineHeight: 1.25,
        baseline: descFontSize - 2
      } as any);
    }
  }
  
  return elements;
}

// Create the appropriate shape for node type
function createNodeShape(
  node: PositionedNode, 
  colors: { fill: string; stroke: string; text: string },
  groupId: string
): CanvasElement {
  const baseProps = {
    id: generateId(),
    x: node.x - node.width / 2,
    y: node.y - node.height / 2,
    width: node.width,
    height: node.height,
    strokeColor: colors.stroke,
    backgroundColor: colors.fill,
    fillStyle: 'solid' as const,
    strokeWidth: EXCALIDRAW_STYLE.strokeWidth,
    roughness: EXCALIDRAW_STYLE.roughness,
    opacity: 100,
    angle: 0,
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 100000),
    isDeleted: false,
    groupIds: [groupId],
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false
  };
  
  // Different shapes for different node types
  switch (node.type) {
    case 'decision':
      // Diamond shape
      return {
        ...baseProps,
        type: 'diamond',
        roundness: null
      } as any;
      
    case 'database':
      // Ellipse (cylinder top) - we'll use ellipse as Excalidraw doesn't have cylinder
      return {
        ...baseProps,
        type: 'ellipse',
        height: node.height * 0.8
      } as any;
      
    default:
      // Rounded rectangle for most types
      return {
        ...baseProps,
        type: 'rectangle',
        roundness: EXCALIDRAW_STYLE.roundness
      } as any;
  }
}

// Create arrow/connection element with orthogonal routing
function createConnectionElement(
  conn: {
    from: string;
    to: string;
    label?: string;
    style: 'solid' | 'dashed';
    semanticColor?: string;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  },
  zIndex: number,
  direction?: Direction
): CanvasElement {
  const colors = getConnectionColors(conn.semanticColor as any);
  const dx = conn.toX - conn.fromX;
  const dy = conn.toY - conn.fromY;
  
  // Build orthogonal (right-angle) path instead of diagonal
  let points: number[][];
  if (Math.abs(dx) < 1 || Math.abs(dy) < 1) {
    // Already straight (horizontal or vertical)
    points = [[0, 0], [dx, dy]];
  } else if (Math.abs(dx) >= Math.abs(dy)) {
    // Primarily horizontal: go half-x, then vertical, then rest of x
    points = [[0, 0], [dx / 2, 0], [dx / 2, dy], [dx, dy]];
  } else {
    // Primarily vertical — route horizontal segment near source to avoid
    // cutting through intermediate row nodes in TB layouts
    if (direction === 'TB') {
      const routeY = dy > 0
        ? Math.min(40, Math.abs(dy) * 0.15)
        : -Math.min(40, Math.abs(dy) * 0.15);
      points = [[0, 0], [0, routeY], [dx, routeY], [dx, dy]];
    } else {
      points = [[0, 0], [0, dy / 2], [dx, dy / 2], [dx, dy]];
    }
  }
  
  return {
    id: generateId(),
    type: 'arrow',
    x: conn.fromX,
    y: conn.fromY,
    width: dx,
    height: dy,
    strokeColor: colors.stroke,
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: EXCALIDRAW_STYLE.arrowStrokeWidth,
    strokeStyle: conn.style === 'dashed' ? 'dashed' : 'solid',
    roughness: EXCALIDRAW_STYLE.roughness,
    opacity: EXCALIDRAW_STYLE.arrowOpacity,
    angle: 0,
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 100000),
    isDeleted: false,
    groupIds: [],
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    points,
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: 'arrow'
  } as any;
}

// Create group background element
function createGroupElement(
  group: {
    id: string;
    label: string;
    emoji?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    semanticColor?: string;
  },
  zIndex: number
): CanvasElement[] {
  const colors = getConnectionColors(group.semanticColor as any);
  const elements: CanvasElement[] = [];
  const groupId = generateId();
  
  // Background rectangle
  elements.push({
    id: generateId(),
    type: 'rectangle',
    x: group.x,
    y: group.y,
    width: group.width,
    height: group.height,
    strokeColor: colors.stroke,
    backgroundColor: colors.fill,
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'dashed',
    roughness: EXCALIDRAW_STYLE.roughness,
    opacity: EXCALIDRAW_STYLE.groupOpacity,
    angle: 0,
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 100000),
    isDeleted: false,
    groupIds: [],
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    roundness: EXCALIDRAW_STYLE.roundness
  } as any);
  
  // Group label
  const labelText = group.emoji ? `${group.emoji} ${group.label}` : group.label;
  elements.push({
    id: generateId(),
    type: 'text',
    x: group.x + 10,
    y: group.y + 5,
    width: group.width - 20,
    height: 20,
    text: labelText,
    fontSize: 14,
    fontFamily: 1,
    textAlign: 'left',
    verticalAlign: 'top',
    strokeColor: colors.text,
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 0,
    roughness: 0,
    opacity: 100,
    angle: 0,
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 100000),
    isDeleted: false,
    groupIds: [],
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    containerId: null,
    originalText: labelText,
    lineHeight: 1.25,
    baseline: 12
  } as any);
  
  return elements;
}

// Create note elements
function createNoteElements(
  note: {
    text: string;
    emoji?: string;
    x: number;
    y: number;
    width: number;
    height: number;
  },
  zIndex: number
): CanvasElement[] {
  const elements: CanvasElement[] = [];
  const groupId = generateId();
  
  // Note text content
  const noteText = note.text || 'Pro Tip: Add your tip here!';
  const prefix = note.emoji ? `${note.emoji} ` : '💡 ';
  const hasProTip = noteText.toLowerCase().startsWith('pro tip');
  const fullText = hasProTip ? prefix + noteText : prefix + 'Pro Tip: ' + noteText;
  
  // Wrap text with short lines to prevent Excalidraw re-wrapping
  const fontSize = 14;
  const maxCharsPerLine = 28;
  const wrappedText = wrapText(fullText, maxCharsPerLine);
  const lines = wrappedText.split('\n');
  const lineH = fontSize * 1.25;
  const textHeight = lines.length * lineH;
  
  // Size box to fit text
  const boxHeight = textHeight + 30;
  
  // Note background (yellow sticky note style)
  elements.push({
    id: generateId(),
    type: 'rectangle',
    x: note.x - note.width / 2,
    y: note.y - boxHeight / 2,
    width: note.width,
    height: boxHeight,
    strokeColor: '#f59e0b',
    backgroundColor: '#fef3c7',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'dashed',
    roughness: EXCALIDRAW_STYLE.roughness,
    opacity: 90,
    angle: 0,
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 100000),
    isDeleted: false,
    groupIds: [groupId],
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    roundness: EXCALIDRAW_STYLE.roundness
  } as any);
  
  // Render each line as a separate text element to prevent re-wrapping
  const textStartY = note.y - textHeight / 2;
  for (let i = 0; i < lines.length; i++) {
    elements.push({
      id: generateId(),
      type: 'text',
      x: note.x - note.width / 2 + 15,
      y: textStartY + i * lineH,
      width: note.width - 30,
      height: lineH,
      text: lines[i],
      fontSize,
      fontFamily: 1,
      textAlign: 'center',
      verticalAlign: 'top',
      strokeColor: '#92400e',
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 0,
      roughness: 0,
      opacity: 100,
      angle: 0,
      seed: Math.floor(Math.random() * 100000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 100000),
      isDeleted: false,
      groupIds: [groupId],
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      containerId: null,
      originalText: lines[i],
      lineHeight: 1.25,
      baseline: fontSize
    } as any);
  }
  
  return elements;
}

// Wrap text to fit within maxChars per line
function wrapText(text: string, maxChars: number): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxChars) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  return lines.join('\n');
}
