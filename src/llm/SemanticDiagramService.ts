/**
 * Semantic Diagram Service - Uses semantic DSL instead of raw geometry
 * Works with VS Code Copilot LM API (free for Microsoft employees)
 * 
 * Uses TWO-PASS approach like Claude Desktop:
 * 1. THINKING PASS: Plan the diagram structure, decide what to include
 * 2. GENERATION PASS: Create the detailed graph with all the creativity
 */

import * as vscode from 'vscode';
import { DiagramGraph } from '../dsl/types';
import { COPILOT_DIAGRAM_PROMPT } from '../dsl/prompt';
import { layoutGraph } from '../layout/engine';
import { renderToExcalidraw } from '../render/shapes';
import { CanvasElement } from '../types/canvas';

export interface DiagramResult {
  elements: CanvasElement[];
  graph: DiagramGraph;
  thinkingOutput?: string;
  error?: string;
}

export interface MermaidDiagramResult {
  mermaidSyntax: string;
  thinkingOutput?: string;
  error?: string;
}

// Thinking prompt - asks LLM to plan before drawing
const THINKING_PROMPT = `You are a creative diagram designer creating BEAUTIFUL, DETAILED diagrams. Before creating, THINK and PLAN carefully.

## CRITICAL RULES:
1. For recipes, tutorials, how-to guides → Create SEQUENTIAL NUMBERED STEPS (Step 1, Step 2, Step 3...)
2. Each step needs: a CLEAR ACTION label, a BIG relevant emoji, and SPECIFIC details (quantities, times, temperatures)
3. Use 5-8 steps minimum for processes
4. Make it COLORFUL - use different semantic colors for different steps
5. Always include a TIP or PRO TIP note at the end

## Analyze the request:

1. **Diagram Type**: Is this a PROCESS/RECIPE (use numbered steps) or ARCHITECTURE (use components)?

2. **Steps/Elements** - List 5-8 elements with:
   - Label: "Step 1 - Grind Beans" or "API Gateway"
   - BIG emoji: 🫘 ☕ 🥛 (pick visually distinct ones!)
   - Description: Specific details! "18-20g beans, medium-fine grind"
   - Color: Vary them! danger(red), warning(amber), info(cyan), success(green), primary(blue)

3. **Flow**: 
   - Recipes/processes → LR (left-to-right) with row wrapping
   - Architectures → TB (top-to-bottom)

4. **Layout hints**: Use row/column to create visual flow
   - Row 0: First row of steps (columns 0,1,2,3)
   - Row 1: Second row continuing (columns 3,2,1,0 for snake pattern)

5. **Notes**: Add a TIP box with practical advice

Think step-by-step. Be SPECIFIC with details (grams, ml, seconds, temperatures).`;

const GENERATION_PROMPT = `Now create the detailed JSON diagram.

CRITICAL REQUIREMENTS:
1. For processes/recipes: Use "Step 1 - Action", "Step 2 - Action" format
2. Add SPECIFIC details in descriptions (18g beans, 25 seconds, 65°C)
3. Use DIFFERENT colors for each step to make it colorful
4. YOU MUST include a "notes" array with at least one pro tip!

SCHEMA:
{
  "title": "How to Make a Latte",
  "titleEmoji": "☕",
  "direction": "LR",
  "nodes": [
    {
      "id": "step1",
      "type": "process",
      "label": "Step 1 - Grind",
      "emoji": "🫘",
      "description": "18-20g beans, medium-fine",
      "semanticColor": "danger",
      "row": 0,
      "column": 0
    },
    {
      "id": "step2",
      "type": "process",
      "label": "Step 2 - Extract",
      "emoji": "💧",
      "description": "25-30 sec, 60ml",
      "semanticColor": "warning",
      "row": 0,
      "column": 1
    }
  ],
  "connections": [
    {"from": "step1", "to": "step2", "style": "solid"}
  ],
  "notes": [
    {
      "text": "Pro Tip: The secret is microfoam - creamy and shiny, not big bubbles! Ratio: 1 espresso : 5 milk",
      "emoji": "💡"
    }
  ]
}

IMPORTANT: The "notes" array is REQUIRED! Add a helpful tip related to the topic.

COLORS: danger=red, warning=amber, info=cyan, success=green, primary=blue, secondary=purple

OUTPUT ONLY JSON. No markdown blocks, no explanation.`;

// Architecture-specific thinking prompt — used when folder analysis data is present
const ARCHITECTURE_THINKING_PROMPT = `You are an expert software architect creating a PRECISE architecture diagram from REAL code analysis data.

## CRITICAL RULES:
1. You are given ACTUAL code analysis data — file roles, imports, dependencies, frameworks
2. Use ONLY what was detected. Do NOT invent or guess components that aren't in the analysis
3. Do NOT add generic placeholders like "Logging Service", "Monitoring", "Prometheus", "Grafana" unless they appear in the detected dependencies
4. Every node in your diagram MUST map to something found in the analysis (a file, a dependency, a framework, an external service)
5. If something wasn't detected, it does NOT go in the diagram

## Analyze the provided code analysis:

1. **Entry points**: What files are entry points? (app.ts, server.ts, index.ts, main.ts)
2. **Layers**: What architectural layers exist? (routes/controllers → services → models → data)
3. **External dependencies**: What SPECIFIC databases, caches, queues were detected? (e.g., PostgreSQL, Redis, Kafka — only if found)
4. **Frameworks**: What SPECIFIC frameworks are used? (Express, NestJS, React, etc.)
5. **Internal modules**: What services/modules talk to each other based on the import graph?
6. **Architecture pattern**: Is this MVC, layered, microservices, monolith? Based on the file structure.

## Output your plan:
- List each component with its REAL name from the codebase
- Map real import relationships as connections
- Group by architectural layer
- Use direction "TB" (top-to-bottom) for layered architecture
- Add a note summarizing the detected architecture pattern

## CONNECTION RULES (for readability):
- Use "solid" style for primary/critical data flow paths
- Use "dashed" style for secondary/optional connections
- Prefer showing layer-to-layer flow (entry → controller → service → data)

Think step-by-step. Be FAITHFUL to the analysis data.`;

// Architecture-specific generation prompt
const ARCHITECTURE_GENERATION_PROMPT = `Now create the detailed JSON diagram based on your analysis.

CRITICAL REQUIREMENTS:
1. Every node MUST correspond to a REAL component from the code analysis
2. Use ACTUAL names from the codebase (file names, class names, package names)
3. Do NOT add generic/placeholder components — if it wasn't in the analysis, leave it out
4. Connections should reflect REAL import/dependency relationships from the analysis
5. Group by architectural layer (entry points at top, data layer at bottom)
6. Include a note summarizing the architecture pattern detected
7. Use "solid" for primary data flow, "dashed" for secondary connections

NODE TYPE MAPPING:
- Entry points (app/server/index) → "service" type, semanticColor "primary", importance "high"
- Controllers/routes → "service" type, semanticColor "info"
- Services/business logic → "service" type, semanticColor "success"
- Models/entities → "database" type, semanticColor "warning"
- Detected databases (PostgreSQL, MongoDB, etc.) → "database" type, semanticColor "danger"
- Detected caches (Redis, etc.) → "cache" type, semanticColor "warning"
- Detected queues (Kafka, RabbitMQ, etc.) → "queue" type, semanticColor "secondary"
- External APIs/3rd-party services → "external" type, semanticColor "neutral"
- Config/middleware → "process" type, semanticColor "neutral"

SCHEMA:
{
  "title": "Project Architecture",
  "titleEmoji": "🏗️",
  "direction": "TB",
  "nodes": [
    {
      "id": "unique_id",
      "type": "service|database|cache|queue|external|process",
      "label": "Real Component Name",
      "emoji": "🔥",
      "description": "What this actually does based on the code",
      "semanticColor": "primary|secondary|success|warning|danger|info|neutral",
      "importance": "high|medium|low",
      "row": 0,
      "column": 0
    }
  ],
  "connections": [
    {"from": "node_id", "to": "node_id", "style": "solid|dashed", "label": "optional"}
  ],
  "groups": [
    {"id": "group_id", "label": "Layer Name", "nodeIds": ["node1", "node2"], "semanticColor": "neutral"}
  ],
  "notes": [
    {"text": "Architecture: Detected pattern summary", "emoji": "🏗️"}
  ]
}

COLORS: primary=blue, secondary=purple, success=green, warning=amber, danger=red, info=cyan, neutral=gray

OUTPUT ONLY JSON. No markdown blocks, no explanation.`;

// Detect if a prompt contains folder analysis data
function isArchitectureAnalysis(prompt: string): boolean {
  const markers = ['## Project Structure', '## Components', '## Detected Architecture', '## Dependencies', '## Internal Dependencies'];
  return markers.some(marker => prompt.includes(marker));
}

// Detect if a prompt is for architecture (broader than just folder analysis)
function isArchitecturePrompt(prompt: string): boolean {
  if (isArchitectureAnalysis(prompt)) return true;
  const archKeywords = [
    /architect/i, /system design/i, /infrastructure/i, /microservice/i,
    /backend.*design/i, /design.*backend/i, /tech.*stack/i,
    /deployment/i, /cloud.*architecture/i, /database.*design/i,
  ];
  return archKeywords.some(kw => kw.test(prompt));
}

// Mermaid generation prompt for architecture diagrams
const MERMAID_THINKING_PROMPT = `You are an expert software architect creating a DETAILED, READABLE Mermaid flowchart.

## CONSTRAINTS:
1. **15-25 nodes** — show all important components, but still merge truly trivial items
2. **Layer-to-layer connections ONLY** — arrows go DOWN between adjacent layers, NEVER skip layers
3. **4-7 subgraphs** for logical grouping (can nest subgraphs for complex systems)
4. **Max 4 dotted arrows** for async/optional paths
5. **ONLY include technologies, components, and services that are EXPLICITLY mentioned in the user's analysis/description** — do NOT invent or assume technologies (no Redis, S3, Kafka, Nginx, etc. unless the user mentions them)

## ANALYZE:
1. What are the 4-7 main layers/groups?
2. What are the 3-6 key components per layer?
3. What are ALL the important data flows? (primary AND secondary paths)
4. What are the async/background processes?

Think step-by-step. Be THOROUGH — show the full picture. Base your diagram STRICTLY on the provided information.`;

const MERMAID_GENERATION_PROMPT = `Now output the Mermaid flowchart diagram.

## STRICT RULES:
1. Start with \`flowchart TB\`
2. **15-25 nodes** — show all important components, don't oversimplify
3. **4-7 subgraphs** for layers (nest if needed for complex systems)
4. Arrows go DOWN between adjacent layers — NO long cross-layer arrows
5. **Keep labels SHORT** — max 3-4 words per node. Put details in parentheses: \`A["🚀 API Server (Express)"]\`
6. Do NOT use \`<br/>\` or \`<br>\` in labels — keep everything on one line
7. Arrow styles:
   - \`-->\` solid (primary flow)
   - \`-.->\` dotted (async, MAX 2)
   - \`-->|"label"|\` for key labeled flows only
8. **MUST include style directives** for EVERY node:
   - Blue (services): \`style NODE fill:#dbeafe,stroke:#3b82f6,color:#1e40af\`
   - Green (databases): \`style NODE fill:#dcfce7,stroke:#22c55e,color:#166534\`
   - Amber (cache/queue): \`style NODE fill:#fef3c7,stroke:#f59e0b,color:#92400e\`
   - Purple (auth/security): \`style NODE fill:#f3e8ff,stroke:#a855f7,color:#6b21a8\`
   - Cyan (client apps): \`style NODE fill:#e0f2fe,stroke:#0ea5e9,color:#0c4a6e\`
   - Pink (external): \`style NODE fill:#fce7f3,stroke:#ec4899,color:#9d174d\`

## CRITICAL: Only diagram what was described — do NOT add technologies or components that are not in the user's input. If the user's project uses .NET, don't add Node.js. If there's no Redis, don't add Redis.

## EXAMPLE (structure only — replace with ACTUAL project content):
\`\`\`mermaid
flowchart TB
    subgraph Presentation["🌐 Presentation"]
        APP["📱 Client App"]
    end

    subgraph Logic["⚙️ Business Logic"]
        SVC1["🔧 Service A"]
        SVC2["📋 Service B"]
    end

    subgraph Storage["💾 Storage"]
        DB["🗄️ Database"]
    end

    APP --> SVC1
    APP --> SVC2
    SVC1 --> DB
    SVC2 -.-> DB

    style APP fill:#e0f2fe,stroke:#0ea5e9,color:#0c4a6e
    style SVC1 fill:#dbeafe,stroke:#3b82f6,color:#1e40af
    style SVC2 fill:#dbeafe,stroke:#3b82f6,color:#1e40af
    style DB fill:#dcfce7,stroke:#22c55e,color:#166534
\`\`\`

OUTPUT ONLY the Mermaid code block. No explanation.`;

const MERMAID_REFINEMENT_PROMPT = `You previously created this Mermaid diagram for: "{originalPrompt}"

CURRENT MERMAID:
\`\`\`mermaid
{currentMermaid}
\`\`\`

THE USER WANTS CHANGES:
"{userFeedback}"

Apply the requested changes. Keep everything else the same unless the user asks to change it.

Rules:
- Keep existing node IDs stable
- Add/remove/modify nodes as requested
- Update connections if nodes change
- Keep subgraph structure unless user asks to change it

OUTPUT ONLY the updated Mermaid code block. No explanation.`;

export class SemanticDiagramService {
  private vscodeModel: vscode.LanguageModelChat | null = null;
  private outputChannel: vscode.OutputChannel | null = null;
  private availableModels: vscode.LanguageModelChat[] = [];

  constructor(outputChannel?: vscode.OutputChannel) {
    this.outputChannel = outputChannel || null;
  }

  private log(message: string): void {
    if (this.outputChannel) {
      this.outputChannel.appendLine(message);
    }
    console.log(message);
  }

  // Get all available models for the picker UI
  async getAvailableModels(): Promise<vscode.LanguageModelChat[]> {
    try {
      this.availableModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });
      return this.availableModels;
    } catch (e) {
      return [];
    }
  }

  // Set the model explicitly (from user picker)
  setModel(model: vscode.LanguageModelChat): void {
    this.vscodeModel = model;
    this.log(`Model set to: ${model.name} (family: ${model.family})`);
  }

  private async initializeModel(): Promise<void> {
    try {
      const models = await this.getAvailableModels();
      
      if (models.length > 0) {
        const preferred = models.find(m => m.family.includes('opus')) 
          || models.find(m => m.family.includes('sonnet'))
          || models.find(m => m.family.includes('gpt-4o'))
          || models[0];
        this.vscodeModel = preferred;
        this.log(`Auto-selected model: ${this.vscodeModel.name} (family: ${this.vscodeModel.family})`);
      }
    } catch (e) {
      console.error('Failed to initialize Copilot LM:', e);
    }
  }

  async generateDiagram(
    userPrompt: string, 
    onProgress?: (stage: string) => void
  ): Promise<DiagramResult> {
    if (!this.vscodeModel) {
      await this.initializeModel();
      if (!this.vscodeModel) {
        throw new Error('No Copilot language model available. Make sure GitHub Copilot is installed and signed in.');
      }
    }

    // Detect if this is an architecture analysis (from folder scan) or a general prompt
    const isArchMode = isArchitectureAnalysis(userPrompt);
    const thinkingPrompt = isArchMode ? ARCHITECTURE_THINKING_PROMPT : THINKING_PROMPT;
    const generationPrompt = isArchMode ? ARCHITECTURE_GENERATION_PROMPT : GENERATION_PROMPT;
    this.log(`Mode: ${isArchMode ? 'ARCHITECTURE' : 'PROCESS/GENERAL'}`);

    // ========== PASS 1: THINKING ==========
    onProgress?.('🧠 Planning diagram structure... (15-20 sec)');
    this.log('\n=== PASS 1: THINKING ===');
    
    const thinkingMessages: vscode.LanguageModelChatMessage[] = [
      vscode.LanguageModelChatMessage.User(thinkingPrompt),
      vscode.LanguageModelChatMessage.User(`Create a diagram for: ${userPrompt}`)
    ];

    const thinkingResponse = await this.vscodeModel.sendRequest(
      thinkingMessages,
      {},
      new vscode.CancellationTokenSource().token
    );

    let thinkingOutput = '';
    for await (const chunk of thinkingResponse.text) {
      thinkingOutput += chunk;
    }
    
    this.log(`Thinking output (${thinkingOutput.length} chars):`);
    this.log(thinkingOutput.substring(0, 500) + '...');

    // ========== PASS 2: INITIAL GENERATION ==========
    onProgress?.('🎨 Creating initial diagram...');
    this.log('\n=== PASS 2: INITIAL GENERATION ===');

    const graph = await this.generateGraphFromThinking(userPrompt, thinkingOutput, thinkingPrompt, generationPrompt);
    
    this.log(`Initial graph: ${graph.nodes.length} nodes, ${graph.connections.length} connections`);

    // ========== LAYOUT & RENDER ==========
    onProgress?.('📐 Laying out diagram...');
    
    const positionedGraph = layoutGraph(graph);
    const elements = renderToExcalidraw(positionedGraph);
    
    this.log(`Rendered ${elements.length} Excalidraw elements`);
    
    return { elements, graph, thinkingOutput };
  }

  // Public method for visual refinement (called by extension after rendering)
  async refineWithVisual(
    userPrompt: string,
    currentGraph: DiagramGraph,
    screenshot: { base64: string; mimeType: string }
  ): Promise<DiagramGraph | null> {
    if (!this.vscodeModel) {
      await this.initializeModel();
      if (!this.vscodeModel) {
        return null;
      }
    }
    
    return this.refineWithScreenshot(userPrompt, currentGraph, screenshot, 1);
  }

  private async generateGraphFromThinking(
    userPrompt: string,
    thinkingOutput: string,
    thinkingPrompt: string,
    generationPrompt: string
  ): Promise<DiagramGraph> {
    const generationMessages: vscode.LanguageModelChatMessage[] = [
      vscode.LanguageModelChatMessage.User(thinkingPrompt),
      vscode.LanguageModelChatMessage.User(`Create a diagram for: ${userPrompt}`),
      vscode.LanguageModelChatMessage.Assistant(thinkingOutput),
      vscode.LanguageModelChatMessage.User(generationPrompt)
    ];

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.vscodeModel!.sendRequest(
          generationMessages,
          {},
          new vscode.CancellationTokenSource().token
        );

        let fullText = '';
        for await (const chunk of response.text) {
          fullText += chunk;
        }
        
        this.log(`Generation output (${fullText.length} chars)`);

        const graph = this.parseGraphFromResponse(fullText);
        this.validateGraph(graph);
        return graph;
      } catch (e) {
        lastError = e as Error;
        this.log(`Generation attempt ${attempt + 1} failed: ${(e as Error).message}`);
        
        if (attempt < 2) {
          generationMessages.push(vscode.LanguageModelChatMessage.User(
            `Error: ${(e as Error).message}. Output ONLY valid JSON.`
          ));
        }
      }
    }

    throw lastError || new Error('Failed to generate diagram');
  }

  private async refineWithScreenshot(
    userPrompt: string,
    currentGraph: DiagramGraph,
    screenshot: { base64: string; mimeType: string },
    iteration: number
  ): Promise<DiagramGraph | null> {
    const REFINEMENT_PROMPT = `You are reviewing a diagram you created. Look at the screenshot and the current graph JSON.

ORIGINAL REQUEST: "${userPrompt}"

CURRENT GRAPH:
${JSON.stringify(currentGraph, null, 2)}

Look at the diagram image and CRITIQUE it:
1. Are the steps/nodes clear and well-labeled?
2. Are there enough details in descriptions?
3. Is the color variety good?
4. Is the layout logical?
5. Is there a helpful tip/note?
6. Are emojis visible and relevant?
7. What's MISSING that would make this better?

Then output an IMPROVED version of the graph JSON with:
- More specific descriptions (quantities, times, temperatures)
- Better color variety (use different semanticColors)
- Additional helpful notes
- Any missing steps
- **If steps have sequential numbers in labels, ensure numbering is correct and contiguous after any additions or removals**

OUTPUT ONLY THE IMPROVED JSON. No explanation.`;

    try {
      // Check if screenshot is valid
      if (!screenshot.base64) {
        this.log('No screenshot available for refinement');
        return null;
      }
      
      // Convert base64 to Uint8Array for the image
      // Use Buffer in Node.js environment
      const buffer = Buffer.from(screenshot.base64, 'base64');
      const bytes = new Uint8Array(buffer);
      
      const imagePart = vscode.LanguageModelDataPart.image(bytes, screenshot.mimeType);
      
      const messages: vscode.LanguageModelChatMessage[] = [
        vscode.LanguageModelChatMessage.User([
          new vscode.LanguageModelTextPart(REFINEMENT_PROMPT),
          imagePart
        ])
      ];

      const response = await this.vscodeModel!.sendRequest(
        messages,
        {},
        new vscode.CancellationTokenSource().token
      );

      let fullText = '';
      for await (const chunk of response.text) {
        fullText += chunk;
      }
      
      this.log(`Refinement ${iteration} output (${fullText.length} chars)`);

      const improvedGraph = this.parseGraphFromResponse(fullText);
      this.validateGraph(improvedGraph);
      
      // Only accept if it's actually different/better
      if (improvedGraph.nodes.length >= currentGraph.nodes.length) {
        return improvedGraph;
      }
      
      return null;
    } catch (e) {
      this.log(`Refinement ${iteration} failed: ${(e as Error).message}`);
      return null;
    }
  }

  private parseGraphFromResponse(text: string): DiagramGraph {
    // Try multiple extraction strategies
    
    // Strategy 1: Find JSON code block
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch (e) {
        this.log('Failed to parse code block JSON');
      }
    }
    
    // Strategy 2: Find raw JSON object (greedy match for nested objects)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        this.log('Failed to parse raw JSON');
      }
    }
    
    // Strategy 3: Clean up and try again
    const cleaned = text
      .replace(/^[^{]*/, '')  // Remove leading non-JSON
      .replace(/[^}]*$/, '')  // Remove trailing non-JSON
      .trim();
    
    if (cleaned) {
      try {
        return JSON.parse(cleaned);
      } catch (e) {
        this.log('Failed to parse cleaned JSON');
      }
    }
    
    throw new Error(`Could not parse JSON. Response started with: ${text.substring(0, 100)}...`);
  }

  private validateGraph(graph: DiagramGraph): void {
    if (!graph) {
      throw new Error('Graph is null or undefined');
    }
    
    if (!graph.direction) {
      graph.direction = 'LR'; // Default to left-right
    }
    
    if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
      throw new Error('Graph must have at least one node');
    }
    
    if (!Array.isArray(graph.connections)) {
      graph.connections = []; // Allow no connections
    }
    
    // Validate node IDs are unique
    const nodeIds = new Set<string>();
    for (const node of graph.nodes) {
      if (!node.id) {
        throw new Error('Every node must have an "id"');
      }
      if (!node.type) {
        node.type = 'process'; // Default type
      }
      if (!node.label) {
        throw new Error(`Node "${node.id}" missing required "label" field`);
      }
      if (nodeIds.has(node.id)) {
        throw new Error(`Duplicate node ID: ${node.id}`);
      }
      nodeIds.add(node.id);
    }
    
    // Validate connections reference valid nodes (but don't fail - just filter)
    graph.connections = graph.connections.filter(conn => {
      if (!conn.from || !conn.to) return false;
      if (!nodeIds.has(conn.from) || !nodeIds.has(conn.to)) {
        this.log(`Warning: Removing invalid connection ${conn.from} -> ${conn.to}`);
        return false;
      }
      return true;
    });
    
    // Validate groups reference valid nodes
    if (graph.groups) {
      for (const group of graph.groups) {
        group.nodeIds = group.nodeIds.filter(id => nodeIds.has(id));
      }
      graph.groups = graph.groups.filter(g => g.nodeIds.length > 0);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const models = await vscode.lm.selectChatModels();
      return models.length > 0;
    } catch {
      return false;
    }
  }

  // Check if a prompt should use the Mermaid pipeline
  shouldUseMermaid(prompt: string): boolean {
    return isArchitecturePrompt(prompt);
  }

  // Generate a Mermaid diagram (architecture path)
  async generateMermaidDiagram(
    userPrompt: string,
    onProgress?: (stage: string) => void
  ): Promise<MermaidDiagramResult> {
    if (!this.vscodeModel) {
      await this.initializeModel();
      if (!this.vscodeModel) {
        throw new Error('No Copilot language model available.');
      }
    }

    // Pass 1: Thinking
    onProgress?.('🧠 Planning architecture... (15-20 sec)');
    this.log('\n=== MERMAID PASS 1: THINKING ===');

    const thinkingMessages: vscode.LanguageModelChatMessage[] = [
      vscode.LanguageModelChatMessage.User(MERMAID_THINKING_PROMPT),
      vscode.LanguageModelChatMessage.User(`Create an architecture diagram for: ${userPrompt}`)
    ];

    const thinkingResponse = await this.vscodeModel.sendRequest(
      thinkingMessages,
      {},
      new vscode.CancellationTokenSource().token
    );

    let thinkingOutput = '';
    for await (const chunk of thinkingResponse.text) {
      thinkingOutput += chunk;
    }
    this.log(`Mermaid thinking (${thinkingOutput.length} chars)`);

    // Pass 2: Generate Mermaid
    onProgress?.('🎨 Generating Mermaid diagram...');
    this.log('\n=== MERMAID PASS 2: GENERATION ===');

    const generationMessages: vscode.LanguageModelChatMessage[] = [
      vscode.LanguageModelChatMessage.User(MERMAID_THINKING_PROMPT),
      vscode.LanguageModelChatMessage.User(`Create an architecture diagram for: ${userPrompt}`),
      vscode.LanguageModelChatMessage.Assistant(thinkingOutput),
      vscode.LanguageModelChatMessage.User(MERMAID_GENERATION_PROMPT)
    ];

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.vscodeModel.sendRequest(
          generationMessages,
          {},
          new vscode.CancellationTokenSource().token
        );

        let fullText = '';
        for await (const chunk of response.text) {
          fullText += chunk;
        }
        this.log(`Mermaid output (${fullText.length} chars)`);

        const mermaidSyntax = this.parseMermaidFromResponse(fullText);
        this.log(`Parsed Mermaid:\n${mermaidSyntax.substring(0, 300)}...`);

        return { mermaidSyntax, thinkingOutput };
      } catch (e) {
        lastError = e as Error;
        this.log(`Mermaid attempt ${attempt + 1} failed: ${(e as Error).message}`);
        if (attempt < 2) {
          generationMessages.push(vscode.LanguageModelChatMessage.User(
            `Error: ${(e as Error).message}. Output ONLY a valid Mermaid code block.`
          ));
        }
      }
    }

    throw lastError || new Error('Failed to generate Mermaid diagram');
  }

  // Refine Mermaid diagram with user feedback
  async refineMermaidWithFeedback(
    originalPrompt: string,
    currentMermaid: string,
    userFeedback: string
  ): Promise<string> {
    if (!this.vscodeModel) {
      await this.initializeModel();
      if (!this.vscodeModel) {
        throw new Error('No Copilot language model available.');
      }
    }

    const prompt = MERMAID_REFINEMENT_PROMPT
      .replace('{originalPrompt}', originalPrompt)
      .replace('{currentMermaid}', currentMermaid)
      .replace('{userFeedback}', userFeedback);

    const messages: vscode.LanguageModelChatMessage[] = [
      vscode.LanguageModelChatMessage.User(prompt)
    ];

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.vscodeModel.sendRequest(
          messages,
          {},
          new vscode.CancellationTokenSource().token
        );

        let fullText = '';
        for await (const chunk of response.text) {
          fullText += chunk;
        }
        this.log(`Mermaid refinement output (${fullText.length} chars)`);

        return this.parseMermaidFromResponse(fullText);
      } catch (e) {
        lastError = e as Error;
        this.log(`Mermaid refinement attempt ${attempt + 1} failed: ${(e as Error).message}`);
        if (attempt < 2) {
          messages.push(vscode.LanguageModelChatMessage.User(
            `Error: ${(e as Error).message}. Output ONLY a valid Mermaid code block.`
          ));
        }
      }
    }

    throw lastError || new Error('Failed to refine Mermaid diagram');
  }

  private parseMermaidFromResponse(text: string): string {
    // Strategy 1: Extract from ```mermaid code block
    const mermaidBlock = text.match(/```mermaid\s*([\s\S]*?)```/);
    if (mermaidBlock) {
      return mermaidBlock[1].trim();
    }

    // Strategy 2: Extract from generic code block
    const codeBlock = text.match(/```\s*([\s\S]*?)```/);
    if (codeBlock) {
      const content = codeBlock[1].trim();
      if (content.startsWith('flowchart') || content.startsWith('graph')) {
        return content;
      }
    }

    // Strategy 3: Look for flowchart/graph keyword in raw text
    const flowchartMatch = text.match(/((?:flowchart|graph)\s+(?:TB|BT|LR|RL)[\s\S]*)/);
    if (flowchartMatch) {
      return flowchartMatch[1].trim();
    }

    throw new Error('Could not extract Mermaid syntax from LLM response');
  }

  // Refine diagram based on user text feedback (no screenshot needed)
  async refineDiagramWithFeedback(
    originalPrompt: string,
    currentGraph: DiagramGraph,
    userFeedback: string
  ): Promise<DiagramGraph> {
    if (!this.vscodeModel) {
      await this.initializeModel();
      if (!this.vscodeModel) {
        throw new Error('No Copilot language model available.');
      }
    }

    const refinementPrompt = `You previously created this diagram for: "${originalPrompt}"

CURRENT DIAGRAM JSON:
${JSON.stringify(currentGraph, null, 2)}

THE USER WANTS CHANGES:
"${userFeedback}"

Apply the user's requested changes to the diagram. Keep everything else the same unless the user asks to change it.

Rules:
- Keep existing node IDs stable (don't rename IDs that haven't changed)
- Add/remove/modify nodes as requested
- Update connections if nodes are added/removed
- Keep the same direction, groups, and notes unless user asks to change them
- If user says "step X is wrong", fix that specific step
- If user says "add X", add a new node with appropriate connections
- If user says "remove X", remove that node and its connections
- **IMPORTANT: If steps/nodes have sequential numbers in their labels (e.g., "1. Do X", "2. Do Y", "Step 3: ..."), ALWAYS renumber ALL subsequent labels after an insert or delete so the sequence stays correct and contiguous. Never leave gaps or duplicates in numbering.**

OUTPUT ONLY THE UPDATED JSON. No markdown blocks, no explanation.`;

    const messages: vscode.LanguageModelChatMessage[] = [
      vscode.LanguageModelChatMessage.User(COPILOT_DIAGRAM_PROMPT),
      vscode.LanguageModelChatMessage.User(refinementPrompt)
    ];

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.vscodeModel.sendRequest(
          messages,
          {},
          new vscode.CancellationTokenSource().token
        );

        let fullText = '';
        for await (const chunk of response.text) {
          fullText += chunk;
        }
        
        this.log(`Refinement output (${fullText.length} chars)`);
        const graph = this.parseGraphFromResponse(fullText);
        this.validateGraph(graph);
        return graph;
      } catch (e) {
        lastError = e as Error;
        this.log(`Refinement attempt ${attempt + 1} failed: ${(e as Error).message}`);
        if (attempt < 2) {
          messages.push(vscode.LanguageModelChatMessage.User(
            `Error: ${(e as Error).message}. Output ONLY valid JSON.`
          ));
        }
      }
    }

    throw lastError || new Error('Failed to refine diagram');
  }
}
