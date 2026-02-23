/**
 * Tool schema definitions for LLM function calling
 */

import type { ToolDefinition } from '../types/tools';

const colorSchema = {
  type: 'string' as const,
  description:
    'Color in hex format (e.g., "#1e90ff") or named color. Common: #1e90ff (blue), #ff6b6b (red), #51cf66 (green), #ffd43b (yellow), #845ef7 (purple), #339af0 (light blue), #868e96 (gray)',
};

const fillStyleSchema = {
  type: 'string' as const,
  description: 'Fill style for the shape',
  enum: ['hachure', 'cross-hatch', 'solid'],
};

const arrowheadSchema = {
  type: 'string' as const,
  description: 'Arrowhead style',
  enum: ['arrow', 'bar', 'dot', 'triangle', 'none'],
};

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'create_rectangle',
    description:
      'Create a rectangle shape on the canvas. Use for boxes, containers, services, components, etc. The label will be centered inside the rectangle.',
    parameters: {
      type: 'object',
      properties: {
        x: {
          type: 'number',
          description: 'X coordinate of top-left corner in pixels',
        },
        y: {
          type: 'number',
          description: 'Y coordinate of top-left corner in pixels',
        },
        width: {
          type: 'number',
          description: 'Width in pixels (typical: 120-200 for components)',
        },
        height: {
          type: 'number',
          description: 'Height in pixels (typical: 60-100 for components)',
        },
        label: {
          type: 'string',
          description: 'Text label to display inside the rectangle',
        },
        backgroundColor: colorSchema,
        strokeColor: colorSchema,
        fillStyle: fillStyleSchema,
      },
      required: ['x', 'y', 'width', 'height'],
    },
  },
  {
    name: 'create_ellipse',
    description:
      'Create an ellipse/circle shape. Use for databases, actors, decision points, or any rounded entity.',
    parameters: {
      type: 'object',
      properties: {
        x: {
          type: 'number',
          description: 'X coordinate of bounding box top-left corner',
        },
        y: {
          type: 'number',
          description: 'Y coordinate of bounding box top-left corner',
        },
        width: {
          type: 'number',
          description: 'Width in pixels',
        },
        height: {
          type: 'number',
          description: 'Height in pixels (equal to width for a circle)',
        },
        label: {
          type: 'string',
          description: 'Text label to display inside',
        },
        backgroundColor: colorSchema,
        strokeColor: colorSchema,
        fillStyle: fillStyleSchema,
      },
      required: ['x', 'y', 'width', 'height'],
    },
  },
  {
    name: 'create_diamond',
    description:
      'Create a diamond/rhombus shape. Use for decision points, conditions, or gateways in flowcharts.',
    parameters: {
      type: 'object',
      properties: {
        x: {
          type: 'number',
          description: 'X coordinate of bounding box top-left corner',
        },
        y: {
          type: 'number',
          description: 'Y coordinate of bounding box top-left corner',
        },
        width: {
          type: 'number',
          description: 'Width in pixels',
        },
        height: {
          type: 'number',
          description: 'Height in pixels',
        },
        label: {
          type: 'string',
          description: 'Text label to display inside',
        },
        backgroundColor: colorSchema,
        strokeColor: colorSchema,
        fillStyle: fillStyleSchema,
      },
      required: ['x', 'y', 'width', 'height'],
    },
  },
  {
    name: 'create_text',
    description:
      'Create a standalone text element. Use for titles, annotations, labels outside shapes.',
    parameters: {
      type: 'object',
      properties: {
        x: {
          type: 'number',
          description: 'X coordinate',
        },
        y: {
          type: 'number',
          description: 'Y coordinate',
        },
        text: {
          type: 'string',
          description: 'The text content',
        },
        fontSize: {
          type: 'number',
          description: 'Font size in pixels (default: 20)',
        },
        strokeColor: colorSchema,
      },
      required: ['x', 'y', 'text'],
    },
  },
  {
    name: 'create_arrow',
    description:
      'Create an arrow connecting two points or elements. Use to show data flow, dependencies, or relationships between components.',
    parameters: {
      type: 'object',
      properties: {
        startX: {
          type: 'number',
          description:
            'X coordinate of arrow start (ignored if startElementId provided)',
        },
        startY: {
          type: 'number',
          description:
            'Y coordinate of arrow start (ignored if startElementId provided)',
        },
        endX: {
          type: 'number',
          description:
            'X coordinate of arrow end (ignored if endElementId provided)',
        },
        endY: {
          type: 'number',
          description:
            'Y coordinate of arrow end (ignored if endElementId provided)',
        },
        startElementId: {
          type: 'string',
          description:
            'ID of element to connect FROM. Arrow will auto-attach to element boundary.',
        },
        endElementId: {
          type: 'string',
          description:
            'ID of element to connect TO. Arrow will auto-attach to element boundary.',
        },
        label: {
          type: 'string',
          description: 'Optional label on the arrow (e.g., "HTTP", "gRPC")',
        },
        startArrowhead: arrowheadSchema,
        endArrowhead: arrowheadSchema,
        strokeColor: colorSchema,
      },
      required: ['startX', 'startY', 'endX', 'endY'],
    },
  },
  {
    name: 'create_line',
    description:
      'Create a line (no arrowheads) through multiple points. Use for boundaries, separators, or custom paths.',
    parameters: {
      type: 'object',
      properties: {
        points: {
          type: 'array',
          description: 'Array of {x, y} coordinates',
          items: {
            type: 'object',
            description: 'Point coordinate',
            properties: {
              x: { type: 'number', description: 'X coordinate' },
              y: { type: 'number', description: 'Y coordinate' },
            },
          },
        },
        strokeColor: colorSchema,
      },
      required: ['points'],
    },
  },
  {
    name: 'move_element',
    description: 'Move an existing element to a new position.',
    parameters: {
      type: 'object',
      properties: {
        elementId: {
          type: 'string',
          description: 'ID of the element to move',
        },
        x: {
          type: 'number',
          description: 'New X coordinate',
        },
        y: {
          type: 'number',
          description: 'New Y coordinate',
        },
      },
      required: ['elementId', 'x', 'y'],
    },
  },
  {
    name: 'resize_element',
    description: 'Resize an existing element.',
    parameters: {
      type: 'object',
      properties: {
        elementId: {
          type: 'string',
          description: 'ID of the element to resize',
        },
        width: {
          type: 'number',
          description: 'New width in pixels',
        },
        height: {
          type: 'number',
          description: 'New height in pixels',
        },
      },
      required: ['elementId', 'width', 'height'],
    },
  },
  {
    name: 'update_text',
    description: 'Update the text content of a text element or shape label.',
    parameters: {
      type: 'object',
      properties: {
        elementId: {
          type: 'string',
          description: 'ID of the text element or shape with label',
        },
        text: {
          type: 'string',
          description: 'New text content',
        },
      },
      required: ['elementId', 'text'],
    },
  },
  {
    name: 'update_style',
    description: 'Update visual style properties of an element.',
    parameters: {
      type: 'object',
      properties: {
        elementId: {
          type: 'string',
          description: 'ID of the element to style',
        },
        strokeColor: colorSchema,
        backgroundColor: colorSchema,
        fillStyle: fillStyleSchema,
        strokeWidth: {
          type: 'number',
          description: 'Stroke width (1-4)',
        },
        strokeStyle: {
          type: 'string',
          description: 'Stroke style',
          enum: ['solid', 'dashed', 'dotted'],
        },
        opacity: {
          type: 'number',
          description: 'Opacity from 0-100',
        },
      },
      required: ['elementId'],
    },
  },
  {
    name: 'delete_element',
    description: 'Delete an element from the canvas.',
    parameters: {
      type: 'object',
      properties: {
        elementId: {
          type: 'string',
          description: 'ID of the element to delete',
        },
      },
      required: ['elementId'],
    },
  },
  {
    name: 'connect_elements',
    description:
      'Create an arrow connecting two existing elements by their IDs. Simpler than create_arrow when you just need to connect shapes.',
    parameters: {
      type: 'object',
      properties: {
        fromElementId: {
          type: 'string',
          description: 'ID of the source element',
        },
        toElementId: {
          type: 'string',
          description: 'ID of the target element',
        },
        label: {
          type: 'string',
          description: 'Optional label on the arrow',
        },
      },
      required: ['fromElementId', 'toElementId'],
    },
  },
  {
    name: 'group_elements',
    description: 'Group multiple elements together so they move as one.',
    parameters: {
      type: 'object',
      properties: {
        elementIds: {
          type: 'array',
          description: 'Array of element IDs to group',
          items: {
            type: 'string',
            description: 'Element ID',
          },
        },
      },
      required: ['elementIds'],
    },
  },
  {
    name: 'clear_canvas',
    description: 'Remove all elements from the canvas. Use with caution.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'finish_diagram',
    description:
      'Signal that the diagram is complete. Call this when you have finished drawing all requested elements.',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Brief summary of what was created',
        },
      },
      required: ['summary'],
    },
  },
];

export function getToolDefinitionsForOpenAI(): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolDefinition['parameters'];
  };
}> {
  return toolDefinitions.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
