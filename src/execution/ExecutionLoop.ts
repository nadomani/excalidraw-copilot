/**
 * Execution Loop - Orchestrates the LLM conversation and tool execution
 */

import type * as vscode from 'vscode';
import type { LLMService } from '../llm/LLMService';
import type { LLMMessage } from '../llm/types';
import type { ToolExecutor } from './ToolExecutor';
import type { StateManager } from './StateManager';
import type { ToolCall, ExecutionState } from '../types/tools';

const SYSTEM_PROMPT = `You are an expert diagram designer that creates visual diagrams using Excalidraw.

When the user describes a diagram, you must create it by calling the available tools to draw shapes, add text, and connect elements with arrows.

## Guidelines:
1. ALWAYS start by planning the layout mentally before making tool calls
2. Use appropriate spacing (typically 150-200px between elements)
3. Position elements logically (e.g., data flows top-to-bottom or left-to-right)
4. Use colors meaningfully (e.g., blue for services, green for databases, red for external)
5. Add labels to all important elements
6. Connect related elements with arrows to show relationships/flow
7. When the diagram is complete, call finish_diagram with a summary

## Layout Tips:
- Start at coordinates around (100, 100) for the first element
- Typical component size: 140x80 for rectangles
- Spacing between rows: ~120px
- Spacing between columns: ~180px
- For microservices: API Gateway at top, services in middle row, databases at bottom

## Current Canvas State:
{CANVAS_STATE}

Remember: You can only interact through the provided tools. Make multiple tool calls in a single response when creating related elements.`;

export class ExecutionLoop {
  private llmService: LLMService;
  private toolExecutor: ToolExecutor;
  private stateManager: StateManager;
  private outputChannel: vscode.OutputChannel;
  private state: ExecutionState;
  private conversationHistory: LLMMessage[] = [];
  private abortController: AbortController | null = null;
  private getScreenshot: (() => Promise<{ base64: string; mimeType: string }>) | null = null;

  constructor(
    llmService: LLMService,
    toolExecutor: ToolExecutor,
    stateManager: StateManager,
    outputChannel: vscode.OutputChannel,
    maxIterations: number = 50
  ) {
    this.llmService = llmService;
    this.toolExecutor = toolExecutor;
    this.stateManager = stateManager;
    this.outputChannel = outputChannel;
    this.state = {
      isRunning: false,
      iterationCount: 0,
      maxIterations,
      lastToolCalls: [],
      completedToolIds: new Set(),
      errorCount: 0,
      maxConsecutiveErrors: 3,
    };
  }

  setScreenshotProvider(fn: () => Promise<{ base64: string; mimeType: string }>): void {
    this.getScreenshot = fn;
  }

  async execute(userPrompt: string): Promise<{ success: boolean; message: string }> {
    if (this.state.isRunning) {
      return { success: false, message: 'Execution already in progress' };
    }

    this.state.isRunning = true;
    this.state.iterationCount = 0;
    this.state.errorCount = 0;
    this.abortController = new AbortController();

    try {
      // Initialize conversation with system prompt
      const systemPrompt = SYSTEM_PROMPT.replace(
        '{CANVAS_STATE}',
        this.stateManager.getStateDescription()
      );

      this.conversationHistory = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      this.outputChannel.appendLine(`\n${'='.repeat(60)}`);
      this.outputChannel.appendLine(`Starting execution: "${userPrompt}"`);
      this.outputChannel.appendLine(`${'='.repeat(60)}`);

      while (this.state.iterationCount < this.state.maxIterations) {
        if (this.abortController.signal.aborted) {
          return { success: false, message: 'Execution aborted' };
        }

        this.state.iterationCount++;
        this.outputChannel.appendLine(`\n--- Iteration ${this.state.iterationCount} ---`);

        // Call LLM
        const response = await this.llmService.chat(this.conversationHistory);

        if (response.content) {
          this.outputChannel.appendLine(`LLM: ${response.content}`);
        }

        // Check if we're done
        if (response.finishReason === 'stop' && response.toolCalls.length === 0) {
          this.outputChannel.appendLine('LLM finished without tool calls');
          return {
            success: true,
            message: response.content || 'Diagram generation complete',
          };
        }

        // Process tool calls
        if (response.toolCalls.length > 0) {
          // Check for loops
          if (this.detectLoop(response.toolCalls)) {
            this.outputChannel.appendLine('Loop detected - stopping');
            return {
              success: false,
              message: 'Detected infinite loop in tool calls',
            };
          }

          // Add assistant message with tool calls to history
          this.conversationHistory.push({
            role: 'assistant',
            content: response.content,
            tool_calls: response.toolCalls,
          });

          // Execute each tool call
          const results = await this.executeToolCalls(response.toolCalls);

          // Check for finish_diagram
          for (const result of results) {
            if (result.result && typeof result.result === 'object' && 'finished' in result.result) {
              const summary = (result.result as { summary?: string }).summary || 'Diagram complete';
              this.outputChannel.appendLine(`Diagram finished: ${summary}`);
              return { success: true, message: summary };
            }
          }

          // Check error threshold
          const errors = results.filter((r) => !r.success);
          if (errors.length === results.length) {
            this.state.errorCount++;
            if (this.state.errorCount >= this.state.maxConsecutiveErrors) {
              return {
                success: false,
                message: `Too many consecutive errors: ${errors.map((e) => e.error).join(', ')}`,
              };
            }
          } else {
            this.state.errorCount = 0;
          }

          // Add tool results to conversation
          for (const result of results) {
            this.conversationHistory.push({
              role: 'tool',
              tool_call_id: result.toolCallId,
              content: JSON.stringify({
                success: result.success,
                elementId: result.result && typeof result.result === 'object' && 'elementId' in result.result
                  ? (result.result as { elementId: string }).elementId
                  : undefined,
                error: result.error,
              }),
            });
          }

          // Capture screenshot and add to conversation for visual feedback
          if (this.getScreenshot && this.state.iterationCount > 0) {
            try {
              // Small delay to let canvas render
              await new Promise(resolve => setTimeout(resolve, 100));
              
              const screenshot = await this.getScreenshot();
              this.outputChannel.appendLine('Captured canvas screenshot for visual feedback');
              
              // Add screenshot as a user message with image
              this.conversationHistory.push({
                role: 'user',
                content: [
                  {
                    type: 'image',
                    base64: screenshot.base64,
                    mimeType: screenshot.mimeType,
                  },
                  {
                    type: 'text',
                    text: 'Here is the current state of the diagram. Review what you have created and continue or call finish_diagram if complete.',
                  },
                ],
              });
            } catch (e) {
              this.outputChannel.appendLine(`Screenshot failed: ${e}`);
            }
          }

          // Update canvas state in system prompt for next iteration
          this.updateSystemPrompt();

          this.state.lastToolCalls = response.toolCalls;
        }
      }

      return {
        success: false,
        message: `Reached maximum iterations (${this.state.maxIterations})`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`Execution error: ${errorMessage}`);
      return { success: false, message: errorMessage };
    } finally {
      this.state.isRunning = false;
      this.abortController = null;
    }
  }

  private async executeToolCalls(toolCalls: ToolCall[]): Promise<Array<{ toolCallId: string; success: boolean; result?: unknown; error?: string }>> {
    const results = [];
    for (const toolCall of toolCalls) {
      const result = await this.toolExecutor.execute(toolCall);
      results.push(result);
      this.state.completedToolIds.add(toolCall.id);
    }
    return results;
  }

  private detectLoop(currentCalls: ToolCall[]): boolean {
    if (this.state.lastToolCalls.length === 0) {
      return false;
    }

    // Check if current calls are identical to last calls
    if (currentCalls.length !== this.state.lastToolCalls.length) {
      return false;
    }

    const currentSignature = currentCalls
      .map((c) => `${c.name}:${JSON.stringify(c.arguments)}`)
      .sort()
      .join('|');

    const lastSignature = this.state.lastToolCalls
      .map((c) => `${c.name}:${JSON.stringify(c.arguments)}`)
      .sort()
      .join('|');

    return currentSignature === lastSignature;
  }

  private updateSystemPrompt(): void {
    const newSystemPrompt = SYSTEM_PROMPT.replace(
      '{CANVAS_STATE}',
      this.stateManager.getStateDescription()
    );
    this.conversationHistory[0] = { role: 'system', content: newSystemPrompt };
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  isRunning(): boolean {
    return this.state.isRunning;
  }

  getIterationCount(): number {
    return this.state.iterationCount;
  }

  clearHistory(): void {
    this.conversationHistory = [];
    this.state.lastToolCalls = [];
    this.state.completedToolIds.clear();
  }
}
