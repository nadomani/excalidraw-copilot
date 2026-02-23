/**
 * LLM Service - Handles communication with VS Code Copilot LM API or OpenAI
 */

import * as vscode from 'vscode';
import OpenAI from 'openai';
import type { LLMConfig, LLMMessage, LLMResponse } from './types';
import type { ToolCall } from '../types/tools';
import { getToolDefinitionsForOpenAI, toolDefinitions } from './toolSchemas';

export class LLMService {
  private openaiClient: OpenAI | null = null;
  private config: LLMConfig;
  private vscodeModel: vscode.LanguageModelChat | null = null;

  constructor(config: LLMConfig) {
    this.config = config;
    this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    if (this.config.provider === 'copilot') {
      // Use VS Code's built-in Copilot LM API
      try {
        const models = await vscode.lm.selectChatModels({
          vendor: 'copilot',
          family: 'gpt-4o'
        });
        if (models.length > 0) {
          this.vscodeModel = models[0];
        } else {
          // Fallback to any available model
          const allModels = await vscode.lm.selectChatModels();
          if (allModels.length > 0) {
            this.vscodeModel = allModels[0];
          }
        }
      } catch (e) {
        console.error('Failed to initialize Copilot LM:', e);
      }
    } else if (this.config.provider === 'openai') {
      this.openaiClient = new OpenAI({
        apiKey: this.config.apiKey,
      });
    }
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    if (this.config.provider === 'copilot') {
      return this.chatVSCode(messages);
    }
    if (this.config.provider === 'openai') {
      return this.chatOpenAI(messages);
    }
    throw new Error(`Unsupported provider: ${this.config.provider}`);
  }

  private async chatVSCode(messages: LLMMessage[]): Promise<LLMResponse> {
    if (!this.vscodeModel) {
      // Try to initialize again
      await this.initializeClient();
      if (!this.vscodeModel) {
        throw new Error('No Copilot language model available. Make sure GitHub Copilot is installed and signed in.');
      }
    }

    // Build the tool schema description for the prompt
    const toolSchemaText = toolDefinitions.map(t => {
      const params = Object.entries(t.parameters.properties)
        .map(([name, def]) => `  - ${name} (${def.type}): ${def.description}`)
        .join('\n');
      return `### ${t.name}\n${t.description}\nParameters:\n${params}\nRequired: ${t.parameters.required.join(', ')}`;
    }).join('\n\n');

    // Convert messages to VS Code format, injecting tool schema into system prompt
    const vscodeMessages: vscode.LanguageModelChatMessage[] = [];
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        // Inject tool calling instructions into system prompt
        const contentStr = typeof msg.content === 'string' ? msg.content : '';
        const enhancedContent = `${contentStr}

## Available Tools
You MUST respond with tool calls in this exact JSON format when you want to perform actions:
\`\`\`json
{"tool_calls": [{"id": "call_1", "name": "tool_name", "arguments": {...}}]}
\`\`\`

You can make MULTIPLE tool calls in a single response to create multiple elements at once.

When you're done with all actions, respond with:
\`\`\`json
{"tool_calls": [{"id": "call_done", "name": "finish_diagram", "arguments": {"summary": "what you created"}}]}
\`\`\`

## IMPORTANT LAYOUT GUIDELINES
- Use coordinates starting at (100, 100) for top-left elements
- Standard component size: 160x80 pixels
- Horizontal spacing between components: 200 pixels
- Vertical spacing between rows: 150 pixels
- For architecture diagrams: clients at top (y=100), API layer (y=300), services (y=500), databases (y=700)
- Use colors: blue (#1e90ff) for services, green (#10b981) for databases, orange (#f59e0b) for external, purple (#8b5cf6) for cache

${toolSchemaText}`;
        vscodeMessages.push(vscode.LanguageModelChatMessage.User(enhancedContent));
      } else if (msg.role === 'user') {
        // Check if content includes an image
        if (Array.isArray(msg.content)) {
          // Build message parts
          const parts: (vscode.LanguageModelTextPart | vscode.LanguageModelDataPart)[] = [];
          for (const part of msg.content) {
            if (part.type === 'text') {
              parts.push(new vscode.LanguageModelTextPart(part.text));
            } else if (part.type === 'image') {
              // Use static image method
              // Convert base64 to Uint8Array
              const binaryString = atob(part.base64);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const dataPart = vscode.LanguageModelDataPart.image(bytes, part.mimeType);
              parts.push(dataPart);
            }
          }
          vscodeMessages.push(vscode.LanguageModelChatMessage.User(parts));
        } else {
          vscodeMessages.push(vscode.LanguageModelChatMessage.User(msg.content ?? ''));
        }
      }else if (msg.role === 'assistant') {
        const contentStr = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        vscodeMessages.push(vscode.LanguageModelChatMessage.Assistant(contentStr ?? ''));
      } else if (msg.role === 'tool') {
        // Tool results go as user messages
        const contentStr = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        vscodeMessages.push(vscode.LanguageModelChatMessage.User(`Tool result for ${msg.tool_call_id}: ${contentStr}`));
      } else {
        const contentStr = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        vscodeMessages.push(vscode.LanguageModelChatMessage.User(contentStr ?? ''));
      }
    }

    // Send request
    const response = await this.vscodeModel.sendRequest(
      vscodeMessages,
      {},
      new vscode.CancellationTokenSource().token
    );

    // Collect response text
    let fullText = '';
    for await (const chunk of response.text) {
      fullText += chunk;
    }

    // Parse tool calls from response
    const toolCalls = this.parseToolCallsFromText(fullText);

    return {
      content: fullText,
      toolCalls,
      finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
    };
  }

  private parseToolCallsFromText(text: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    
    // Look for JSON blocks with tool_calls
    const jsonMatches = text.match(/```json\s*([\s\S]*?)```/g) || [];
    
    for (const match of jsonMatches) {
      try {
        const jsonStr = match.replace(/```json\s*/, '').replace(/```/, '').trim();
        const parsed = JSON.parse(jsonStr);
        
        if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
          for (const tc of parsed.tool_calls) {
            if (tc.name && tc.arguments) {
              toolCalls.push({
                id: tc.id || `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                name: tc.name,
                arguments: tc.arguments,
              });
            }
          }
        }
      } catch (e) {
        // Not valid JSON, skip
      }
    }

    // Also try to find inline JSON (without code blocks)
    if (toolCalls.length === 0) {
      try {
        const inlineMatch = text.match(/\{"tool_calls"\s*:\s*\[[\s\S]*?\]\}/);
        if (inlineMatch) {
          const parsed = JSON.parse(inlineMatch[0]);
          if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
            for (const tc of parsed.tool_calls) {
              if (tc.name && tc.arguments) {
                toolCalls.push({
                  id: tc.id || `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                  name: tc.name,
                  arguments: tc.arguments,
                });
              }
            }
          }
        }
      } catch (e) {
        // Not valid JSON, skip
      }
    }

    return toolCalls;
  }

  private async chatOpenAI(messages: LLMMessage[]): Promise<LLMResponse> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    const openaiMessages: any[] = messages.map((msg) => {
      // Convert content to string if it's an array (for OpenAI compatibility)
      const contentStr = typeof msg.content === 'string' 
        ? msg.content 
        : Array.isArray(msg.content) 
          ? msg.content.map(p => p.type === 'text' ? p.text : '[image]').join('\n')
          : '';

      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: contentStr,
          tool_call_id: msg.tool_call_id ?? '',
        };
      }
      if (msg.role === 'assistant' && msg.tool_calls) {
        return {
          role: 'assistant' as const,
          content: contentStr || null,
          tool_calls: msg.tool_calls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }
      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: contentStr,
      };
    });

    const response = await this.openaiClient.chat.completions.create({
      model: this.config.model,
      messages: openaiMessages,
      tools: getToolDefinitionsForOpenAI(),
      tool_choice: 'auto',
      max_tokens: this.config.maxTokens ?? 4096,
      temperature: this.config.temperature ?? 0.7,
    });

    const choice = response.choices[0];
    const toolCalls: ToolCall[] = [];

    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        try {
          const args = JSON.parse(tc.function.arguments);
          toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            arguments: args,
          });
        } catch (e) {
          toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            arguments: { _parseError: tc.function.arguments },
          });
        }
      }
    }

    return {
      content: choice.message.content,
      toolCalls,
      finishReason:
        choice.finish_reason === 'tool_calls'
          ? 'tool_calls'
          : choice.finish_reason === 'stop'
            ? 'stop'
            : choice.finish_reason === 'length'
              ? 'length'
              : 'content_filter',
    };
  }

  updateConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.apiKey || config.provider) {
      this.initializeClient();
    }
  }

  async isAvailable(): Promise<boolean> {
    if (this.config.provider === 'copilot') {
      try {
        const models = await vscode.lm.selectChatModels();
        return models.length > 0;
      } catch {
        return false;
      }
    }
    return !!this.config.apiKey;
  }
}
