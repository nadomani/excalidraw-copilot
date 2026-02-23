/**
 * Tool types for LLM function calling
 */

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameterDefinition>;
    required: string[];
  };
}

export interface ToolParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: ToolParameterDefinition;
  properties?: Record<string, ToolParameterDefinition>;
  default?: unknown;
}

export type ToolName =
  | 'create_rectangle'
  | 'create_ellipse'
  | 'create_diamond'
  | 'create_text'
  | 'create_arrow'
  | 'create_line'
  | 'move_element'
  | 'resize_element'
  | 'update_text'
  | 'update_style'
  | 'delete_element'
  | 'connect_elements'
  | 'group_elements'
  | 'clear_canvas'
  | 'finish_diagram';

export interface ExecutionState {
  isRunning: boolean;
  iterationCount: number;
  maxIterations: number;
  lastToolCalls: ToolCall[];
  completedToolIds: Set<string>;
  errorCount: number;
  maxConsecutiveErrors: number;
}
