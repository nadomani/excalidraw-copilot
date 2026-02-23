/**
 * Tool Executor - Translates LLM tool calls to WebView messages
 */

import type { ToolCall, ToolResult } from '../types/tools';
import type { ExtensionToWebViewMessage } from '../types/messages';
import type * as vscode from 'vscode';

type SendMessageFn = (message: ExtensionToWebViewMessage) => Promise<boolean>;
type WaitForResultFn = (timeoutMs?: number) => Promise<{ success: boolean; elementId?: string; error?: string }>;

export class ToolExecutor {
  private sendMessage: SendMessageFn;
  private waitForResult: WaitForResultFn;
  private outputChannel: vscode.OutputChannel;

  constructor(
    sendMessage: SendMessageFn,
    waitForResult: WaitForResultFn,
    outputChannel: vscode.OutputChannel
  ) {
    this.sendMessage = sendMessage;
    this.waitForResult = waitForResult;
    this.outputChannel = outputChannel;
  }

  async execute(toolCall: ToolCall): Promise<ToolResult> {
    this.outputChannel.appendLine(`Executing tool: ${toolCall.name}`);
    this.outputChannel.appendLine(`  Arguments: ${JSON.stringify(toolCall.arguments)}`);

    try {
      // Check for parse errors
      if ('_parseError' in toolCall.arguments) {
        return {
          toolCallId: toolCall.id,
          success: false,
          error: `Failed to parse tool arguments: ${toolCall.arguments._parseError}`,
        };
      }

      const message = this.toolCallToMessage(toolCall);
      if (!message) {
        // Handle finish_diagram specially
        if (toolCall.name === 'finish_diagram') {
          return {
            toolCallId: toolCall.id,
            success: true,
            result: {
              finished: true,
              summary: toolCall.arguments.summary,
            },
          };
        }
        return {
          toolCallId: toolCall.id,
          success: false,
          error: `Unknown tool: ${toolCall.name}`,
        };
      }

      const sent = await this.sendMessage(message);
      if (!sent) {
        return {
          toolCallId: toolCall.id,
          success: false,
          error: 'Failed to send message to WebView',
        };
      }

      const result = await this.waitForResult(5000);
      
      this.outputChannel.appendLine(`  Result: ${JSON.stringify(result)}`);

      return {
        toolCallId: toolCall.id,
        success: result.success,
        result: result.elementId ? { elementId: result.elementId } : undefined,
        error: result.error,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`  Error: ${errorMessage}`);
      return {
        toolCallId: toolCall.id,
        success: false,
        error: errorMessage,
      };
    }
  }

  private toolCallToMessage(toolCall: ToolCall): ExtensionToWebViewMessage | null {
    const args = toolCall.arguments;

    switch (toolCall.name) {
      case 'create_rectangle':
        return {
          type: 'createRectangle',
          payload: {
            x: args.x as number,
            y: args.y as number,
            width: args.width as number,
            height: args.height as number,
            label: args.label as string | undefined,
            strokeColor: args.strokeColor as string | undefined,
            backgroundColor: args.backgroundColor as string | undefined,
            fillStyle: args.fillStyle as 'hachure' | 'cross-hatch' | 'solid' | undefined,
          },
        };

      case 'create_ellipse':
        return {
          type: 'createEllipse',
          payload: {
            x: args.x as number,
            y: args.y as number,
            width: args.width as number,
            height: args.height as number,
            label: args.label as string | undefined,
            strokeColor: args.strokeColor as string | undefined,
            backgroundColor: args.backgroundColor as string | undefined,
            fillStyle: args.fillStyle as 'hachure' | 'cross-hatch' | 'solid' | undefined,
          },
        };

      case 'create_diamond':
        return {
          type: 'createDiamond',
          payload: {
            x: args.x as number,
            y: args.y as number,
            width: args.width as number,
            height: args.height as number,
            label: args.label as string | undefined,
            strokeColor: args.strokeColor as string | undefined,
            backgroundColor: args.backgroundColor as string | undefined,
            fillStyle: args.fillStyle as 'hachure' | 'cross-hatch' | 'solid' | undefined,
          },
        };

      case 'create_text':
        return {
          type: 'createText',
          payload: {
            x: args.x as number,
            y: args.y as number,
            text: args.text as string,
            fontSize: args.fontSize as number | undefined,
            strokeColor: args.strokeColor as string | undefined,
          },
        };

      case 'create_arrow':
        return {
          type: 'createArrow',
          payload: {
            startX: args.startX as number,
            startY: args.startY as number,
            endX: args.endX as number,
            endY: args.endY as number,
            startElementId: args.startElementId as string | undefined,
            endElementId: args.endElementId as string | undefined,
            startArrowhead: args.startArrowhead === 'none' ? null : (args.startArrowhead as 'arrow' | 'bar' | 'dot' | 'triangle' | null | undefined),
            endArrowhead: args.endArrowhead === 'none' ? null : (args.endArrowhead as 'arrow' | 'bar' | 'dot' | 'triangle' | null | undefined),
            strokeColor: args.strokeColor as string | undefined,
            label: args.label as string | undefined,
          },
        };

      case 'create_line':
        return {
          type: 'createLine',
          payload: {
            points: args.points as Array<{ x: number; y: number }>,
            strokeColor: args.strokeColor as string | undefined,
          },
        };

      case 'move_element':
        return {
          type: 'moveElement',
          payload: {
            elementId: args.elementId as string,
            x: args.x as number,
            y: args.y as number,
          },
        };

      case 'resize_element':
        return {
          type: 'resizeElement',
          payload: {
            elementId: args.elementId as string,
            width: args.width as number,
            height: args.height as number,
          },
        };

      case 'update_text':
        return {
          type: 'updateText',
          payload: {
            elementId: args.elementId as string,
            text: args.text as string,
          },
        };

      case 'update_style':
        return {
          type: 'updateStyle',
          payload: {
            elementId: args.elementId as string,
            strokeColor: args.strokeColor as string | undefined,
            backgroundColor: args.backgroundColor as string | undefined,
            fillStyle: args.fillStyle as 'hachure' | 'cross-hatch' | 'solid' | undefined,
            strokeWidth: args.strokeWidth as number | undefined,
            strokeStyle: args.strokeStyle as 'solid' | 'dashed' | 'dotted' | undefined,
            opacity: args.opacity as number | undefined,
          },
        };

      case 'delete_element':
        return {
          type: 'deleteElement',
          payload: {
            elementId: args.elementId as string,
          },
        };

      case 'connect_elements':
        return {
          type: 'connectElements',
          payload: {
            fromElementId: args.fromElementId as string,
            toElementId: args.toElementId as string,
            label: args.label as string | undefined,
          },
        };

      case 'group_elements':
        return {
          type: 'groupElements',
          payload: {
            elementIds: args.elementIds as string[],
          },
        };

      case 'clear_canvas':
        return {
          type: 'clearCanvas',
          payload: {},
        };

      default:
        return null;
    }
  }
}
