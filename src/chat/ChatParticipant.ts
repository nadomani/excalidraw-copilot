/**
 * Chat Participant — @excalidraw in the Copilot Chat panel
 * 
 * This is a thin orchestration layer on top of SemanticDiagramService.
 * It replaces manual QuickPick flows with auto-detection and uses the
 * chat panel's model selector + streaming response.
 */

import * as vscode from 'vscode';
import { ExcalidrawPanel } from '../webview/WebViewPanel';
import { SemanticDiagramService } from '../llm/SemanticDiagramService';
import { StateManager } from '../execution/StateManager';
import {
  analyzeFolder,
  isProjectPrompt,
  buildFolderAnalysisPrompt,
  buildFileAnalysisPrompt,
  buildProjectAnalysisPrompt,
} from '../analysis/folderAnalysis';

// Metadata key for storing diagram state across turns
interface ExcalidrawChatMetadata {
  pipeline: 'dsl' | 'mermaid';
  graph?: unknown;
  mermaid?: string;
  originalPrompt: string;
}

interface ExcalidrawChatResult extends vscode.ChatResult {
  metadata?: ExcalidrawChatMetadata;
}

export function registerChatParticipant(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  stateManager: StateManager
): vscode.Disposable {
  const handler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    chatContext: vscode.ChatContext,
    response: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<ExcalidrawChatResult> => {
    outputChannel.appendLine(`\n=== Chat request: command=${request.command || '(none)'}, prompt="${request.prompt.slice(0, 80)}" ===`);
    outputChannel.appendLine(`Chat history length: ${chatContext.history.length}`);

    try {
      // Check if this is a follow-up refinement (no slash command, has previous diagram)
      const previousState = getPreviousState(chatContext);
      outputChannel.appendLine(`Previous state found: ${previousState ? previousState.pipeline : 'none'}`);

      if (previousState && !request.command && request.prompt.trim()) {
        outputChannel.appendLine('Routing to refinement handler');
        return await handleRefinement(request, response, token, previousState, context, outputChannel, stateManager);
      }

      // Route based on command
      switch (request.command) {
        case 'new':
          // /new always starts fresh — skip refinement
          return await handleGeneration(request, response, token, context, outputChannel, stateManager, 'auto');
        case 'architecture':
          return await handleGeneration(request, response, token, context, outputChannel, stateManager, 'mermaid');
        case 'diagram':
          return await handleGeneration(request, response, token, context, outputChannel, stateManager, 'dsl');
        case 'file':
          return await handleFile(request, response, token, context, outputChannel, stateManager);
        case 'folder':
          return await handleFolder(request, response, token, context, outputChannel, stateManager);
        case 'project':
          return await handleProject(request, response, token, context, outputChannel, stateManager);
        default:
          // Auto-detect pipeline from prompt
          return await handleGeneration(request, response, token, context, outputChannel, stateManager, 'auto');
      }
    } catch (e) {
      const error = e as Error;
      outputChannel.appendLine(`Chat error: ${error.message}`);
      response.markdown(`❌ **Error:** ${error.message}`);
      return { errorDetails: { message: error.message } };
    }
  };

  const participant = vscode.chat.createChatParticipant('excalidraw-copilot.chat', handler);
  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');

  // Followup suggestions — contextual based on the original prompt
  participant.followupProvider = {
    provideFollowups(result: vscode.ChatResult, _context: vscode.ChatContext, _token: vscode.CancellationToken) {
      const meta = (result as ExcalidrawChatResult).metadata;
      if (!meta) return [];

      return getContextualFollowups(meta.originalPrompt, meta.pipeline);
    }
  };

  return participant;
}

/** Generate contextual followup suggestions based on the diagram topic */
function getContextualFollowups(originalPrompt: string, pipeline: 'dsl' | 'mermaid'): vscode.ChatFollowup[] {
  const lower = originalPrompt.toLowerCase();
  const followups: vscode.ChatFollowup[] = [];

  // Always offer "add more detail"
  followups.push({ prompt: 'Add more detail to the diagram' });

  if (pipeline === 'mermaid') {
    // Architecture-style followups
    if (/\b(api|service|server|backend|micro)\b/.test(lower)) {
      followups.push({ prompt: 'Add a caching layer' });
      followups.push({ prompt: 'Add error handling and retry flows' });
    } else if (/\b(database|data|storage|model)\b/.test(lower)) {
      followups.push({ prompt: 'Add read replicas and failover' });
      followups.push({ prompt: 'Show the data flow between components' });
    } else if (/\b(project|codebase|folder|workspace)\b/.test(lower)) {
      followups.push({ prompt: 'Group components by layer' });
      followups.push({ prompt: 'Highlight the main entry points' });
    } else {
      followups.push({ prompt: 'Add labels to all connections' });
      followups.push({ prompt: 'Group related components together' });
    }
  } else {
    // DSL-style followups (processes, recipes, flows)
    if (/\b(process|flow|step|pipeline|workflow)\b/.test(lower)) {
      followups.push({ prompt: 'Add error/failure paths' });
      followups.push({ prompt: 'Add timing estimates to each step' });
    } else if (/\b(recipe|cook|food|make|brew|bake)\b/.test(lower)) {
      followups.push({ prompt: 'Add ingredient quantities' });
      followups.push({ prompt: 'Add tips and warnings for tricky steps' });
    } else {
      followups.push({ prompt: 'Add decision points and branches' });
      followups.push({ prompt: 'Use different colors for each phase' });
    }
  }

  return followups;
}

// ---- Helpers ----

/** Extract previous diagram state from chat history */
function getPreviousState(chatContext: vscode.ChatContext): ExcalidrawChatMetadata | null {
  for (let i = chatContext.history.length - 1; i >= 0; i--) {
    const turn = chatContext.history[i];
    if (turn instanceof vscode.ChatResponseTurn) {
      const result = turn.result as ExcalidrawChatResult;
      const meta = result?.metadata;
      if (meta && meta.pipeline && (meta.graph || meta.mermaid)) {
        return meta;
      }
    }
  }
  return null;
}

/** Create a SemanticDiagramService with the chat model */
function createService(request: vscode.ChatRequest, outputChannel: vscode.OutputChannel): SemanticDiagramService {
  const service = new SemanticDiagramService(outputChannel);
  // Use the model selected in the Copilot Chat UI
  if (request.model) {
    service.setModel(request.model);
  }
  return service;
}

/** Open the Excalidraw panel and set it up */
function openPanel(context: vscode.ExtensionContext, stateManager: StateManager): ExcalidrawPanel {
  const panel = ExcalidrawPanel.createOrShow(context.extensionUri);
  panel.setOnCanvasStateChange((state) => {
    stateManager.updateState(state);
  });
  return panel;
}

/** Extract file URIs from #file references in the chat request */
function getFileReferences(request: vscode.ChatRequest): vscode.Uri[] {
  const uris: vscode.Uri[] = [];
  for (const ref of request.references) {
    if (ref.value instanceof vscode.Uri) {
      uris.push(ref.value);
    } else if (ref.value && typeof ref.value === 'object' && 'uri' in (ref.value as any)) {
      uris.push((ref.value as vscode.Location).uri);
    }
  }
  return uris;
}

/**
 * Detect pipeline from user prompt text. --mermaid or --dsl flags
 * override the default; otherwise falls back to the provided default pipeline.
 */
function detectPipelineFromPrompt(
  prompt: string,
  service: SemanticDiagramService,
  defaultPipeline: 'dsl' | 'mermaid'
): boolean {
  const lower = prompt.toLowerCase();
  if (/\s*--mermaid\b/.test(lower)) {
    return true;
  }
  if (/\s*--dsl\b/.test(lower)) {
    return false;
  }
  return defaultPipeline === 'mermaid';
}

/** Strip pipeline flags from prompt to extract the actual path/content */
function stripPipelineKeywords(prompt: string): string {
  return prompt.replace(/\s*--(mermaid|dsl)\b/gi, '').trim();
}

// ---- Command Handlers ----

async function handleGeneration(
  request: vscode.ChatRequest,
  response: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  stateManager: StateManager,
  forcePipeline: 'dsl' | 'mermaid' | 'auto'
): Promise<ExcalidrawChatResult> {
  const prompt = stripPipelineKeywords(request.prompt).trim();
  if (!prompt) {
    response.markdown('Please describe the diagram you want to create. For example:\n\n`@excalidraw design a microservices architecture with API gateway`');
    return {};
  }

  const service = createService(request, outputChannel);

  // Enrich prompt if it references the project
  let enrichedPrompt = prompt;
  if (isProjectPrompt(prompt)) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      response.progress('📂 Analyzing workspace...');
      const analysis = await analyzeFolder(workspaceFolder.uri);
      enrichedPrompt = `Based on this deep code analysis, create a diagram showing the real structure of this codebase.

${analysis}

ORIGINAL USER REQUEST: "${prompt}"

Show ONLY what actually exists in this codebase. Do NOT invent technologies or components not found in the analysis.`;
    }
  }

  // Determine pipeline — check #mermaid/#dsl first, then auto-detect from original prompt
  let useMermaid: boolean;
  if (forcePipeline === 'auto') {
    useMermaid = detectPipelineFromPrompt(request.prompt, service, service.shouldUseMermaid(prompt) ? 'mermaid' : 'dsl');
  } else {
    useMermaid = forcePipeline === 'mermaid';
  }

  outputChannel.appendLine(`Chat pipeline: ${useMermaid ? 'MERMAID' : 'DSL'}`);

  if (useMermaid) {
    return await generateMermaid(service, enrichedPrompt, prompt, response, token, context, stateManager, outputChannel);
  } else {
    return await generateDsl(service, enrichedPrompt, prompt, response, token, context, stateManager, outputChannel);
  }
}

async function handleFile(
  request: vscode.ChatRequest,
  response: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  stateManager: StateManager,
): Promise<ExcalidrawChatResult> {
  // Try to get file from references, then from active editor
  const fileUris = getFileReferences(request);
  let fileUri: vscode.Uri | undefined = fileUris[0];

  if (!fileUri) {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      fileUri = editor.document.uri;
    }
  }

  if (!fileUri) {
    response.markdown('Please reference a file with `#file` or have one open in the editor.\n\nExample: `@excalidraw /file #file:src/server.ts`');
    return {};
  }

  response.progress('📄 Reading file...');
  const content = await vscode.workspace.fs.readFile(fileUri);
  const text = Buffer.from(content).toString();
  const relativePath = vscode.workspace.asRelativePath(fileUri, false);
  const snippet = text.slice(0, 6000);
  const prompt = buildFileAnalysisPrompt(relativePath, snippet);

  const service = createService(request, outputChannel);
  const useMermaid = detectPipelineFromPrompt(request.prompt, service, 'dsl');
  if (useMermaid) {
    return await generateMermaid(service, prompt, `Diagram file: ${relativePath}`, response, token, context, stateManager, outputChannel);
  }
  return await generateDsl(service, prompt, `Diagram file: ${relativePath}`, response, token, context, stateManager, outputChannel);
}

async function handleFolder(
  request: vscode.ChatRequest,
  response: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  stateManager: StateManager,
): Promise<ExcalidrawChatResult> {
  // Try references first
  const fileUris = getFileReferences(request);
  let folderUri: vscode.Uri | undefined = fileUris[0];

  // Try to parse a folder path from the prompt (e.g., "/folder src/api")
  if (!folderUri) {
    const folderPath = stripPipelineKeywords(request.prompt).trim();
    if (folderPath) {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        folderUri = vscode.Uri.joinPath(workspaceFolder.uri, folderPath);
        // Verify it exists
        try {
          const stat = await vscode.workspace.fs.stat(folderUri);
          if (stat.type !== vscode.FileType.Directory) {
            response.markdown(`\`${folderPath}\` is not a folder. Usage: \`@excalidraw /folder src/api\``);
            return {};
          }
        } catch {
          response.markdown(`Folder \`${folderPath}\` not found. Usage: \`@excalidraw /folder src/api\`\n\nOr use \`/project\` to diagram the entire workspace.`);
          return {};
        }
      }
    }
  }

  // Fall back to workspace root
  if (!folderUri) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      folderUri = workspaceFolder.uri;
    }
  }

  if (!folderUri) {
    response.markdown('No workspace open. Open a project folder first.');
    return {};
  }

  response.progress('📂 Analyzing folder...');
  const analysis = await analyzeFolder(folderUri);
  const prompt = buildFolderAnalysisPrompt(analysis);

  const service = createService(request, outputChannel);
  const useMermaid = detectPipelineFromPrompt(request.prompt, service, 'mermaid');
  if (useMermaid) {
    return await generateMermaid(service, prompt, `Diagram folder`, response, token, context, stateManager, outputChannel);
  }
  return await generateDsl(service, prompt, `Diagram folder`, response, token, context, stateManager, outputChannel);
}

async function handleProject(
  request: vscode.ChatRequest,
  response: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  stateManager: StateManager,
): Promise<ExcalidrawChatResult> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    response.markdown('No workspace open. Open a project folder first.');
    return {};
  }

  response.progress('📂 Analyzing entire project...');
  const analysis = await analyzeFolder(workspaceFolder.uri);
  const prompt = buildProjectAnalysisPrompt(analysis);

  const service = createService(request, outputChannel);
  const useMermaid = detectPipelineFromPrompt(request.prompt, service, 'mermaid');
  if (useMermaid) {
    return await generateMermaid(service, prompt, `Diagram project`, response, token, context, stateManager, outputChannel);
  }
  return await generateDsl(service, prompt, `Diagram project`, response, token, context, stateManager, outputChannel);
}

async function handleRefinement(
  request: vscode.ChatRequest,
  response: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  previousState: ExcalidrawChatMetadata,
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  stateManager: StateManager,
): Promise<ExcalidrawChatResult> {
  const feedback = request.prompt.trim();
  outputChannel.appendLine(`Chat refinement: "${feedback.slice(0, 80)}" (pipeline: ${previousState.pipeline})`);

  const service = createService(request, outputChannel);

  response.progress(`🔄 Applying changes: "${feedback.slice(0, 50)}..."`);

  const panel = openPanel(context, stateManager);
  await panel.waitUntilReady();

  if (previousState.pipeline === 'mermaid' && previousState.mermaid) {
    const updatedMermaid = await service.refineMermaidWithFeedback(
      previousState.originalPrompt,
      previousState.mermaid,
      feedback
    );

    await panel.sendMessage({ type: 'clearCanvas', payload: {} });
    await panel.sendMessage({ type: 'showMermaidPreview', payload: { mermaidSyntax: updatedMermaid } } as any);
    await panel.sendMessage({ type: 'zoomToFit', payload: {} });

    response.markdown(`✅ **Diagram updated!**\n\n💬 *Keep typing changes or use \`/new\` to start fresh.*\n\n`);
    response.button({ command: 'excalidraw-copilot.open', title: '🎨 Open Canvas' });

    return {
      metadata: {
        pipeline: 'mermaid',
        mermaid: updatedMermaid,
        originalPrompt: previousState.originalPrompt,
      }
    };
  } else if (previousState.pipeline === 'dsl' && previousState.graph) {
    const { layoutGraph } = await import('../layout/engine');
    const { renderToExcalidraw } = await import('../render/shapes');

    const updatedGraph = await service.refineDiagramWithFeedback(
      previousState.originalPrompt,
      previousState.graph as any,
      feedback
    );

    const positionedGraph = layoutGraph(updatedGraph);
    const elements = renderToExcalidraw(positionedGraph);

    await panel.sendMessage({ type: 'clearCanvas', payload: {} });
    await panel.sendMessage({ type: 'addElements', payload: elements } as any);
    await panel.sendMessage({ type: 'zoomToFit', payload: {} });

    response.markdown(`✅ **Diagram updated!** ${updatedGraph.nodes.length} nodes, ${updatedGraph.connections.length} connections\n\n💬 *Keep typing changes or use \`/new\` to start fresh.*\n\n`);
    response.button({ command: 'excalidraw-copilot.open', title: '🎨 Open Canvas' });

    return {
      metadata: {
        pipeline: 'dsl',
        graph: updatedGraph,
        originalPrompt: previousState.originalPrompt,
      }
    };
  }

  response.markdown('Could not find previous diagram state to refine. Please start a new diagram.');
  return {};
}

/** Get a contextual refinement example based on the original prompt */
function getRefinementExample(originalPrompt: string, pipeline: 'dsl' | 'mermaid'): string {
  const lower = originalPrompt.toLowerCase();
  if (pipeline === 'mermaid') {
    if (/\b(api|service|server|backend|micro)\b/.test(lower)) return 'add a caching layer';
    if (/\b(database|data|storage)\b/.test(lower)) return 'add read replicas';
    if (/\b(project|codebase|folder|workspace)\b/.test(lower)) return 'group by layer';
    return 'add more components';
  }
  if (/\b(recipe|cook|food|make|brew|bake|honey|cheese|bread)\b/.test(lower)) return 'add more detail to step 3';
  if (/\b(process|flow|step|pipeline|workflow)\b/.test(lower)) return 'add error handling paths';
  return 'add more detail';
}

// ---- Pipeline Runners ----

async function generateDsl(
  service: SemanticDiagramService,
  prompt: string,
  originalPrompt: string,
  response: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  context: vscode.ExtensionContext,
  stateManager: StateManager,
  outputChannel: vscode.OutputChannel,
): Promise<ExcalidrawChatResult> {
  const { layoutGraph } = await import('../layout/engine');
  const { renderToExcalidraw } = await import('../render/shapes');

  const result = await service.generateDiagram(
    prompt,
    (stage) => response.progress(stage)
  );

  outputChannel.appendLine(`Chat DSL: ${result.graph.nodes.length} nodes, ${result.graph.connections.length} connections`);

  response.progress('📐 Laying out and rendering...');

  const panel = openPanel(context, stateManager);
  await panel.waitUntilReady();

  const positionedGraph = layoutGraph(result.graph);
  const elements = renderToExcalidraw(positionedGraph);

  await panel.sendMessage({ type: 'clearCanvas', payload: {} });
  await panel.sendMessage({ type: 'addElements', payload: elements } as any);
  await panel.sendMessage({ type: 'zoomToFit', payload: {} });
  await new Promise(resolve => setTimeout(resolve, 500));

  const example = getRefinementExample(originalPrompt, 'dsl');
  response.markdown(`✅ **Diagram ready!** ${result.graph.nodes.length} nodes, ${result.graph.connections.length} connections\n\n💬 *Type any changes you want (e.g. "${example}") or use \`/new\` to start a fresh diagram.*\n\n`);
  response.button({ command: 'excalidraw-copilot.open', title: '🎨 Open Canvas' });

  return {
    metadata: {
      pipeline: 'dsl',
      graph: result.graph,
      originalPrompt,
    }
  };
}

async function generateMermaid(
  service: SemanticDiagramService,
  prompt: string,
  originalPrompt: string,
  response: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  context: vscode.ExtensionContext,
  stateManager: StateManager,
  outputChannel: vscode.OutputChannel,
): Promise<ExcalidrawChatResult> {
  const result = await service.generateMermaidDiagram(
    prompt,
    (stage) => response.progress(stage)
  );

  outputChannel.appendLine(`Chat Mermaid: ${result.mermaidSyntax.length} chars`);

  response.progress('🖼️ Rendering diagram...');

  const panel = openPanel(context, stateManager);
  await panel.waitUntilReady();

  await panel.sendMessage({ type: 'clearCanvas', payload: {} });
  await panel.sendMessage({ type: 'showMermaidPreview', payload: { mermaidSyntax: result.mermaidSyntax } } as any);
  await new Promise(resolve => setTimeout(resolve, 500));

  const example = getRefinementExample(originalPrompt, 'mermaid');
  response.markdown(`✅ **Architecture diagram ready!** (Mermaid pipeline)\n\n💬 *Type any changes you want (e.g. "${example}") or use \`/new\` to start a fresh diagram.*\n\n`);
  response.button({ command: 'excalidraw-copilot.open', title: '🎨 Open Canvas' });

  return {
    metadata: {
      pipeline: 'mermaid',
      mermaid: result.mermaidSyntax,
      originalPrompt,
    }
  };
}
