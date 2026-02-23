// Visual style system - maps semantic colors to actual appearance

import { SemanticColor, NodeType } from '../dsl/types';

// Semantic color palette - professional and visually distinct
export const SEMANTIC_COLORS: Record<SemanticColor, { fill: string; stroke: string; text: string }> = {
  primary: {
    fill: '#dbeafe',     // Light blue
    stroke: '#3b82f6',   // Blue
    text: '#1e40af'      // Dark blue
  },
  secondary: {
    fill: '#f3e8ff',     // Light purple
    stroke: '#a855f7',   // Purple
    text: '#7c3aed'      // Dark purple
  },
  success: {
    fill: '#dcfce7',     // Light green
    stroke: '#22c55e',   // Green
    text: '#166534'      // Dark green
  },
  warning: {
    fill: '#fef3c7',     // Light amber
    stroke: '#f59e0b',   // Amber
    text: '#92400e'      // Dark amber
  },
  danger: {
    fill: '#fee2e2',     // Light red
    stroke: '#ef4444',   // Red
    text: '#991b1b'      // Dark red
  },
  info: {
    fill: '#e0f2fe',     // Light cyan
    stroke: '#0ea5e9',   // Cyan
    text: '#0c4a6e'      // Dark cyan
  },
  neutral: {
    fill: '#f5f5f5',     // Light gray
    stroke: '#737373',   // Gray
    text: '#404040'      // Dark gray
  }
};

// Default colors for each node type
export const NODE_TYPE_COLORS: Record<NodeType, SemanticColor> = {
  service: 'primary',
  database: 'success',
  cache: 'warning',
  queue: 'secondary',
  external: 'neutral',
  user: 'info',
  process: 'warning',
  decision: 'danger',
  note: 'warning',
  group: 'neutral'
};

// Excalidraw specific settings
export const EXCALIDRAW_STYLE = {
  // Font
  fontFamily: 1, // Hand-drawn style
  fontSize: 16,
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
  
  // Shape
  strokeWidth: 2,
  roughness: 1, // Slight hand-drawn feel
  roundness: { type: 3, value: 8 }, // Rounded corners
  
  // Arrow
  arrowStrokeWidth: 1.5,
  arrowOpacity: 50,
  
  // Group background
  groupOpacity: 30,
};

// Get colors for a node, preferring explicit semanticColor over type default
export function getNodeColors(type: NodeType, semanticColor?: SemanticColor) {
  // Fallback chain: explicit color → type default → neutral
  const colorKey = semanticColor || NODE_TYPE_COLORS[type] || 'neutral';
  return SEMANTIC_COLORS[colorKey] || SEMANTIC_COLORS.neutral;
}

// Get colors for connection — uses softer gray for default arrows
export function getConnectionColors(semanticColor?: SemanticColor) {
  if (!semanticColor) {
    return { fill: '#e5e5e5', stroke: '#9ca3af', text: '#6b7280' };
  }
  return SEMANTIC_COLORS[semanticColor] || SEMANTIC_COLORS.neutral;
}
