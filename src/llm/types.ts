/**
 * LLM types
 */

import type { ToolCall } from '../types/tools';

export interface ImageContent {
  type: 'image';
  base64: string;
  mimeType: string;
}

export interface TextContent {
  type: 'text';
  text: string;
}

export type MessageContent = string | (TextContent | ImageContent)[];

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: MessageContent | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface LLMResponse {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'copilot';
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}
