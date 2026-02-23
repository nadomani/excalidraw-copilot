// Semantic Diagram DSL Types
// LLM outputs these high-level types; layout engine converts to coordinates

export type NodeType = 
  | 'service'        // Blue, rounded rectangle - microservices, APIs
  | 'database'       // Green, cylinder shape - databases, storage
  | 'cache'          // Orange, hexagon/rounded - Redis, Memcached
  | 'queue'          // Purple, parallelogram - message queues, events
  | 'external'       // Gray, dashed border - external services, 3rd party
  | 'user'           // Person icon - users, actors
  | 'process'        // Yellow, rectangle - steps, actions, processes
  | 'decision'       // Diamond - conditionals, choices
  | 'note'           // Yellow sticky note - annotations
  | 'group';         // Container for related nodes

export type SemanticColor = 
  | 'primary'        // Main flow elements (blue)
  | 'secondary'      // Supporting elements (purple)
  | 'success'        // Positive outcomes (green)
  | 'warning'        // Caution points (amber)
  | 'danger'         // Critical/hot items (red)
  | 'info'           // Informational (cyan)
  | 'neutral';       // Default (gray)

export type Importance = 'high' | 'medium' | 'low';

export type Direction = 'TB' | 'LR' | 'radial';

export type ConnectionStyle = 'solid' | 'dashed';

export type NotePosition = 'left' | 'right' | 'below' | 'above';

// Main node definition - no coordinates!
export interface DiagramNode {
  id: string;
  type: NodeType;
  label: string;
  emoji?: string;              // Rendered inside/before label
  description?: string;        // Subtitle below label
  semanticColor?: SemanticColor;
  importance?: Importance;     // Affects size
  row?: number;                // Layout hint (0 = top/left)
  column?: number;             // Layout hint (0 = top/left)
}

// Connection between nodes
export interface DiagramConnection {
  from: string;                // Node ID
  to: string;                  // Node ID
  label?: string;
  style: ConnectionStyle;
  semanticColor?: SemanticColor;
}

// Visual grouping of nodes
export interface DiagramGroup {
  id: string;
  label: string;
  emoji?: string;
  nodeIds: string[];           // IDs of nodes to group
  semanticColor?: SemanticColor;
}

// Annotation attached to a node or floating
export interface DiagramNote {
  text: string;
  emoji?: string;
  attachedTo?: string;         // Node ID, floating if omitted
  position?: NotePosition;     // Where relative to node
}

// The complete diagram graph - LLM outputs this
export interface DiagramGraph {
  title?: string;
  titleEmoji?: string;
  direction: Direction;
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  groups?: DiagramGroup[];
  notes?: DiagramNote[];
}

// Positioned node after layout engine processes it
export interface PositionedNode extends DiagramNode {
  x: number;                   // Center X
  y: number;                   // Center Y  
  width: number;
  height: number;
}

// Positioned elements ready for rendering
export interface PositionedGraph {
  direction: Direction;
  title?: { text: string; emoji?: string; x: number; y: number };
  nodes: PositionedNode[];
  connections: Array<DiagramConnection & { 
    fromX: number; 
    fromY: number; 
    toX: number; 
    toY: number;
  }>;
  groups: Array<DiagramGroup & {
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  notes: Array<DiagramNote & {
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}
