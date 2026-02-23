// Single tool schema for semantic diagram creation
// This replaces the 15+ low-level geometry tools

export const createDiagramSchema = {
  name: 'create_diagram',
  description: `Create a complete diagram from a semantic graph. 
You define WHAT to show (nodes, connections, groups, notes) and the layout engine handles WHERE to place them.
Use row/column hints to suggest positioning - the engine will optimize the final layout.
Be creative with emojis, colors, and descriptions to make diagrams informative and visually appealing.`,
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Title displayed at the top of the diagram'
      },
      titleEmoji: {
        type: 'string',
        description: 'Emoji to display before the title (e.g., "☕", "🏗️", "📊")'
      },
      direction: {
        type: 'string',
        enum: ['TB', 'LR', 'radial'],
        description: 'Layout direction: TB=top-to-bottom (vertical flow), LR=left-to-right (horizontal flow), radial=center outward'
      },
      nodes: {
        type: 'array',
        description: 'The nodes/elements in the diagram',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier for this node (used in connections)'
            },
            type: {
              type: 'string',
              enum: ['service', 'database', 'cache', 'queue', 'external', 'user', 'process', 'decision', 'note', 'group'],
              description: 'The semantic type - determines shape and default styling'
            },
            label: {
              type: 'string',
              description: 'Main label text'
            },
            emoji: {
              type: 'string',
              description: 'Emoji displayed inside the node (e.g., "🔥", "💾", "👤")'
            },
            description: {
              type: 'string',
              description: 'Subtitle/description shown below the label'
            },
            semanticColor: {
              type: 'string',
              enum: ['primary', 'secondary', 'success', 'warning', 'danger', 'info', 'neutral'],
              description: 'Color category - primary=blue, success=green, danger=red, warning=amber, info=cyan'
            },
            importance: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'Affects node size - high=larger, low=smaller'
            },
            row: {
              type: 'integer',
              description: 'Row position hint (0=first row). Nodes in same row appear horizontally aligned.'
            },
            column: {
              type: 'integer',
              description: 'Column position hint (0=first column). Nodes in same column appear vertically aligned.'
            }
          },
          required: ['id', 'type', 'label']
        }
      },
      connections: {
        type: 'array',
        description: 'Connections/arrows between nodes',
        items: {
          type: 'object',
          properties: {
            from: {
              type: 'string',
              description: 'Source node ID'
            },
            to: {
              type: 'string',
              description: 'Target node ID'
            },
            label: {
              type: 'string',
              description: 'Label on the arrow'
            },
            style: {
              type: 'string',
              enum: ['solid', 'dashed'],
              description: 'Arrow line style'
            },
            semanticColor: {
              type: 'string',
              enum: ['primary', 'secondary', 'success', 'warning', 'danger', 'info', 'neutral'],
              description: 'Arrow color category'
            }
          },
          required: ['from', 'to', 'style']
        }
      },
      groups: {
        type: 'array',
        description: 'Visual groups that contain multiple nodes',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier for this group'
            },
            label: {
              type: 'string',
              description: 'Group label'
            },
            emoji: {
              type: 'string',
              description: 'Emoji for the group'
            },
            nodeIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'IDs of nodes contained in this group'
            },
            semanticColor: {
              type: 'string',
              enum: ['primary', 'secondary', 'success', 'warning', 'danger', 'info', 'neutral']
            }
          },
          required: ['id', 'label', 'nodeIds']
        }
      },
      notes: {
        type: 'array',
        description: 'Annotations and tips',
        items: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Note content'
            },
            emoji: {
              type: 'string',
              description: 'Emoji before the note (e.g., "💡", "⚠️", "ℹ️")'
            },
            attachedTo: {
              type: 'string',
              description: 'Node ID to attach to (floating if omitted)'
            },
            position: {
              type: 'string',
              enum: ['left', 'right', 'below', 'above'],
              description: 'Position relative to attached node'
            }
          },
          required: ['text']
        }
      }
    },
    required: ['direction', 'nodes', 'connections']
  }
};

// Schema as string for prompt injection
export const schemaForPrompt = JSON.stringify(createDiagramSchema, null, 2);
