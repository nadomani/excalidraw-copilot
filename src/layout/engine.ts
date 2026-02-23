// Layout engine - converts semantic graph to positioned elements
// Handles all spatial reasoning so LLM doesn't have to

import { 
  DiagramGraph, 
  DiagramNode, 
  DiagramConnection,
  PositionedGraph, 
  PositionedNode,
  Importance,
  Direction
} from '../dsl/types';

// Layout configuration - sized for good text fit
const CONFIG = {
  // Grid spacing - more space between nodes
  cellWidth: 360,
  cellHeight: 220,
  margin: 80,
  
  // Node sizes by importance - large enough for label + emoji + description
  nodeSizes: {
    high: { width: 260, height: 160 },
    medium: { width: 240, height: 140 },
    low: { width: 220, height: 120 }
  } as Record<Importance, { width: number; height: number }>,
  
  // Title positioning  
  titleY: 40,
  titleFontSize: 28,
  
  // Note sizes - tall enough for multi-line text
  noteWidth: 340,
  noteHeight: 120,
  noteOffset: 50,
  
  // Group padding
  groupPadding: 35,
};

export function layoutGraph(graph: DiagramGraph): PositionedGraph {
  // 1. Assign row/column if not specified
  let rankedNodes = assignRanks(graph.nodes, graph.connections, graph.direction);
  
  // 1.5. For linear chains in LR direction, apply snake wrapping for clean arrows
  if (graph.direction === 'LR') {
    rankedNodes = applySnakeLayout(rankedNodes, graph.connections);
  }
  
  // 2. Calculate grid dimensions
  const maxRow = Math.max(...rankedNodes.map(n => n.row ?? 0));
  const maxCol = Math.max(...rankedNodes.map(n => n.column ?? 0));
  
  // 3. Position nodes on grid
  const positionedNodes: PositionedNode[] = rankedNodes.map(node => {
    const baseSize = CONFIG.nodeSizes[node.importance || 'medium'];
    const row = node.row ?? 0;
    const col = node.column ?? 0;
    
    // Dynamically widen box if label is long (est. ~10px per char at fontSize 18)
    const labelWidth = (node.label || '').length * 10 + 30; // +30 for padding
    const width = Math.max(baseSize.width, Math.min(labelWidth, 340));
    const height = baseSize.height;
    
    // Calculate center position
    const x = CONFIG.margin + (col * CONFIG.cellWidth) + (CONFIG.cellWidth / 2);
    const y = CONFIG.margin + 50 + (row * CONFIG.cellHeight) + (CONFIG.cellHeight / 2); // +50 for title
    
    return {
      ...node,
      x,
      y,
      width,
      height
    };
  });
  
  // Create node lookup for connections
  const nodeMap = new Map(positionedNodes.map(n => [n.id, n]));
  
  // Build fan-out/fan-in maps for spread exit/entry points
  const fanOutMap = new Map<string, string[]>();
  const fanInMap = new Map<string, string[]>();
  for (const conn of graph.connections) {
    if (!fanOutMap.has(conn.from)) fanOutMap.set(conn.from, []);
    fanOutMap.get(conn.from)!.push(conn.to);
    if (!fanInMap.has(conn.to)) fanInMap.set(conn.to, []);
    fanInMap.get(conn.to)!.push(conn.from);
  }
  // Sort fan-out targets by x (or y for LR), fan-in sources similarly
  for (const [, targets] of fanOutMap) {
    targets.sort((a, b) => (nodeMap.get(a)?.x ?? 0) - (nodeMap.get(b)?.x ?? 0));
  }
  for (const [, sources] of fanInMap) {
    sources.sort((a, b) => (nodeMap.get(a)?.x ?? 0) - (nodeMap.get(b)?.x ?? 0));
  }
  
  // 4. Position connections
  const positionedConnections = graph.connections.map(conn => {
    const fromNode = nodeMap.get(conn.from);
    const toNode = nodeMap.get(conn.to);
    
    if (!fromNode || !toNode) {
      console.warn(`Connection references missing node: ${conn.from} -> ${conn.to}`);
      return { ...conn, fromX: 0, fromY: 0, toX: 0, toY: 0 };
    }
    
    const fanOutTargets = fanOutMap.get(conn.from) || [conn.to];
    const fanOutIndex = fanOutTargets.indexOf(conn.to);
    const fanOutCount = fanOutTargets.length;
    const fanInSources = fanInMap.get(conn.to) || [conn.from];
    const fanInIndex = fanInSources.indexOf(conn.from);
    const fanInCount = fanInSources.length;
    
    const { fromX, fromY, toX, toY } = calculateConnectionPoints(
      fromNode, toNode, graph.direction,
      fanOutIndex, fanOutCount, fanInIndex, fanInCount
    );
    
    return { ...conn, fromX, fromY, toX, toY };
  });
  
  // 5. Position groups as bounding boxes
  const positionedGroups = (graph.groups || []).map(group => {
    const groupNodes = group.nodeIds
      .map(id => nodeMap.get(id))
      .filter((n): n is PositionedNode => n !== undefined);
    
    if (groupNodes.length === 0) {
      return { ...group, x: 0, y: 0, width: 100, height: 100 };
    }
    
    // Calculate bounding box
    const minX = Math.min(...groupNodes.map(n => n.x - n.width / 2)) - CONFIG.groupPadding;
    const minY = Math.min(...groupNodes.map(n => n.y - n.height / 2)) - CONFIG.groupPadding - 25; // Extra for label
    const maxX = Math.max(...groupNodes.map(n => n.x + n.width / 2)) + CONFIG.groupPadding;
    const maxY = Math.max(...groupNodes.map(n => n.y + n.height / 2)) + CONFIG.groupPadding;
    
    return {
      ...group,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  });
  
  // 6. Position notes - filter out empty ones
  const positionedNotes = (graph.notes || [])
    .filter(note => note && note.text && note.text.trim().length > 0)
    .map((note, index) => {
    let x: number, y: number;
    
    if (note.attachedTo) {
      const targetNode = nodeMap.get(note.attachedTo);
      if (targetNode) {
        // Position relative to attached node
        switch (note.position || 'below') {
          case 'left':
            x = targetNode.x - targetNode.width / 2 - CONFIG.noteWidth - CONFIG.noteOffset;
            y = targetNode.y;
            break;
          case 'right':
            x = targetNode.x + targetNode.width / 2 + CONFIG.noteOffset;
            y = targetNode.y;
            break;
          case 'above':
            x = targetNode.x;
            y = targetNode.y - targetNode.height / 2 - CONFIG.noteHeight - CONFIG.noteOffset;
            break;
          case 'below':
          default:
            x = targetNode.x;
            y = targetNode.y + targetNode.height / 2 + CONFIG.noteOffset + CONFIG.noteHeight / 2;
        }
      } else {
        // Fallback to bottom of diagram
        x = CONFIG.margin + ((maxCol + 1) * CONFIG.cellWidth) / 2;
        y = CONFIG.margin + 50 + ((maxRow + 1) * CONFIG.cellHeight) + 120 + (index * (CONFIG.noteHeight + 20));
      }
    } else {
      // Floating note - position well below the last row
      x = CONFIG.margin + ((maxCol + 1) * CONFIG.cellWidth) / 2;
      y = CONFIG.margin + 50 + ((maxRow + 1) * CONFIG.cellHeight) + 120 + (index * (CONFIG.noteHeight + 20));
    }
    
    // Estimate note height based on text content
    const estimatedCharsPerLine = 35;
    const noteTextLength = (note.text || '').length + 3; // +3 for emoji prefix
    const estimatedLines = Math.max(2, Math.ceil(noteTextLength / estimatedCharsPerLine));
    const noteHeight = estimatedLines * 22 + 30; // 22px per line + padding
    
    return {
      ...note,
      x,
      y,
      width: CONFIG.noteWidth,
      height: noteHeight
    };
  });
  
  // 7. Calculate title position
  const title = graph.title ? {
    text: graph.title,
    emoji: graph.titleEmoji,
    x: CONFIG.margin + ((maxCol + 1) * CONFIG.cellWidth) / 2,
    y: CONFIG.titleY
  } : undefined;
  
  return {
    direction: graph.direction,
    title,
    nodes: positionedNodes,
    connections: positionedConnections,
    groups: positionedGroups,
    notes: positionedNotes
  };
}

// Snake layout for linear chains: wraps long rows and reverses direction on alternating rows
// This creates the natural flow pattern: →→→ then ←←← (like reading a book)
function applySnakeLayout(nodes: DiagramNode[], connections: DiagramConnection[]): DiagramNode[] {
  // Build chain order by following connections
  const outgoing = new Map<string, string>();
  const incoming = new Map<string, string>();
  for (const conn of connections) {
    // Only track if each node has at most one outgoing/incoming (linear chain)
    if (outgoing.has(conn.from) || incoming.has(conn.to)) return nodes; // Not a simple chain
    outgoing.set(conn.from, conn.to);
    incoming.set(conn.to, conn.from);
  }
  
  // Find chain start (node with no incoming edge)
  const start = nodes.find(n => !incoming.has(n.id));
  if (!start) return nodes;
  
  // Follow chain to get ordered nodes
  const chain: string[] = [];
  let current: string | undefined = start.id;
  while (current) {
    chain.push(current);
    current = outgoing.get(current);
  }
  
  // Only apply snake layout if most/all nodes are in the chain
  if (chain.length < nodes.length * 0.8) return nodes;
  
  // Determine max columns (3-4 based on chain length)
  const maxCols = chain.length <= 6 ? 3 : 4;
  
  const nodeMap = new Map(nodes.map(n => [n.id, { ...n }]));
  
  chain.forEach((nodeId, index) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;
    
    const rowIndex = Math.floor(index / maxCols);
    const colIndex = index % maxCols;
    // Reverse direction on odd rows (snake pattern)
    const isReversedRow = rowIndex % 2 === 1;
    const col = isReversedRow ? (maxCols - 1 - colIndex) : colIndex;
    
    node.row = rowIndex;
    node.column = col;
  });
  
  // Handle any nodes not in the chain (keep their original positions)
  return nodes.map(n => nodeMap.get(n.id) || n);
}

// Assign row/column to nodes that don't have explicit hints
function assignRanks(
  nodes: DiagramNode[], 
  connections: DiagramConnection[],
  direction: Direction
): DiagramNode[] {
  // Build adjacency list
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  
  for (const conn of connections) {
    if (!outgoing.has(conn.from)) outgoing.set(conn.from, []);
    if (!incoming.has(conn.to)) incoming.set(conn.to, []);
    outgoing.get(conn.from)!.push(conn.to);
    incoming.get(conn.to)!.push(conn.from);
  }
  
  // Find roots (no incoming edges)
  const roots = nodes.filter(n => !incoming.has(n.id) || incoming.get(n.id)!.length === 0);
  
  // Assign ranks via BFS from roots
  const nodeRanks = new Map<string, number>();
  const queue: Array<{ id: string; rank: number }> = [];
  
  // Initialize roots
  if (roots.length > 0) {
    roots.forEach((root, idx) => {
      queue.push({ id: root.id, rank: 0 });
    });
  } else if (nodes.length > 0) {
    // No clear roots, start from first node
    queue.push({ id: nodes[0].id, rank: 0 });
  }
  
  while (queue.length > 0) {
    const { id, rank } = queue.shift()!;
    
    if (nodeRanks.has(id)) {
      // Already visited, update to max rank
      nodeRanks.set(id, Math.max(nodeRanks.get(id)!, rank));
      continue;
    }
    
    nodeRanks.set(id, rank);
    
    const children = outgoing.get(id) || [];
    for (const child of children) {
      queue.push({ id: child, rank: rank + 1 });
    }
  }
  
  // Handle disconnected nodes
  let maxRank = Math.max(...Array.from(nodeRanks.values()), 0);
  for (const node of nodes) {
    if (!nodeRanks.has(node.id)) {
      maxRank++;
      nodeRanks.set(node.id, maxRank);
    }
  }
  
  // Group nodes by rank
  const rankGroups = new Map<number, string[]>();
  for (const [id, rank] of nodeRanks) {
    if (!rankGroups.has(rank)) rankGroups.set(rank, []);
    rankGroups.get(rank)!.push(id);
  }
  
  // Assign row/column based on direction and rank
  return nodes.map(node => {
    const rank = nodeRanks.get(node.id) ?? 0;
    const rankGroup = rankGroups.get(rank) || [node.id];
    const posInRank = rankGroup.indexOf(node.id);
    
    // Use explicit hints if provided
    if (node.row !== undefined && node.column !== undefined) {
      return node;
    }
    
    // Auto-assign based on direction
    if (direction === 'TB') {
      return {
        ...node,
        row: node.row ?? rank,
        column: node.column ?? posInRank
      };
    } else if (direction === 'LR') {
      return {
        ...node,
        row: node.row ?? posInRank,
        column: node.column ?? rank
      };
    } else {
      // Radial - use rank as distance from center
      const angle = (posInRank / Math.max(rankGroup.length, 1)) * 2 * Math.PI;
      const radius = rank;
      return {
        ...node,
        row: node.row ?? Math.round(Math.sin(angle) * radius),
        column: node.column ?? Math.round(Math.cos(angle) * radius)
      };
    }
  });
}

// Spread offset for fan-out/fan-in: distributes points evenly across a range
function spreadOffset(index: number, count: number, totalSpread: number): number {
  if (count <= 1) return 0;
  return -totalSpread / 2 + (totalSpread * index) / (count - 1);
}

// Calculate optimal connection points between two nodes (direction-aware, fan-spread)
function calculateConnectionPoints(
  from: PositionedNode,
  to: PositionedNode,
  direction?: Direction,
  fanOutIndex: number = 0,
  fanOutCount: number = 1,
  fanInIndex: number = 0,
  fanInCount: number = 1
): { fromX: number; fromY: number; toX: number; toY: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  
  let fromX: number, fromY: number, toX: number, toY: number;
  
  // For TB layouts: prefer vertical flow (bottom→top exits)
  // For LR layouts: prefer horizontal flow (right→left exits)
  const preferVertical = direction === 'TB' && Math.abs(dy) > 0;
  const preferHorizontal = direction === 'LR' && Math.abs(dx) > 0;
  
  const useHorizontal = preferHorizontal || (!preferVertical && Math.abs(dx) > Math.abs(dy));
  
  if (useHorizontal) {
    if (dx > 0) {
      fromX = from.x + from.width / 2;
      toX = to.x - to.width / 2;
    } else {
      fromX = from.x - from.width / 2;
      toX = to.x + to.width / 2;
    }
    // Spread y along the edge for fan-out/fan-in
    fromY = from.y + spreadOffset(fanOutIndex, fanOutCount, from.height * 0.5);
    toY = to.y + spreadOffset(fanInIndex, fanInCount, to.height * 0.5);
  } else {
    if (dy > 0) {
      fromY = from.y + from.height / 2;
      toY = to.y - to.height / 2;
    } else if (dy < 0) {
      fromY = from.y - from.height / 2;
      toY = to.y + to.height / 2;
    } else {
      // Same row: horizontal
      if (dx > 0) {
        fromX = from.x + from.width / 2;
        fromY = from.y;
        toX = to.x - to.width / 2;
        toY = to.y;
        return { fromX, fromY, toX, toY };
      } else {
        fromX = from.x - from.width / 2;
        fromY = from.y;
        toX = to.x + to.width / 2;
        toY = to.y;
        return { fromX, fromY, toX, toY };
      }
    }
    // Spread x along the edge for fan-out/fan-in
    fromX = from.x + spreadOffset(fanOutIndex, fanOutCount, from.width * 0.6);
    toX = to.x + spreadOffset(fanInIndex, fanInCount, to.width * 0.6);
  }
  
  return { fromX, fromY, toX, toY };
}
