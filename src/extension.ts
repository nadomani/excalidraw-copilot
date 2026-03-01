/**
 * Excalidraw Copilot Extension - Entry Point
 * 
 * v2: Uses semantic diagram DSL for much better quality diagrams
 */

import * as vscode from 'vscode';
import { ExcalidrawPanel } from './webview/WebViewPanel';
import { SemanticDiagramService } from './llm/SemanticDiagramService';
import { StateManager } from './execution/StateManager';
import { analyzeFolder, isProjectPrompt, buildFolderAnalysisPrompt, buildFileAnalysisPrompt, buildProjectAnalysisPrompt } from './analysis/folderAnalysis';
import { registerChatParticipant } from './chat/ChatParticipant';

let outputChannel: vscode.OutputChannel;
let stateManager: StateManager;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Excalidraw Copilot');
  stateManager = new StateManager();

  outputChannel.appendLine('Excalidraw Copilot extension activated');

  // Register open command
  const openCommand = vscode.commands.registerCommand(
    'excalidraw-copilot.open',
    () => {
      const panel = ExcalidrawPanel.createOrShow(context.extensionUri);
      setupPanel(panel);
      outputChannel.appendLine('Opened Excalidraw canvas');
    }
  );

  // Register generate command
  const generateCommand = vscode.commands.registerCommand(
    'excalidraw-copilot.generate',
    async () => {
      const panel = ExcalidrawPanel.createOrShow(context.extensionUri);
      setupPanel(panel);

      const prompt = await vscode.window.showInputBox({
        prompt: 'Describe the diagram you want to create',
        placeHolder: 'e.g., Draw a microservices architecture with API gateway and Redis cache',
      });

      if (!prompt) {
        return;
      }

      await runGeneration(panel, prompt);
    }
  );

  // Register diagram folder command
  const diagramFolderCommand = vscode.commands.registerCommand(
    'excalidraw-copilot.diagramFolder',
    async (folderUri?: vscode.Uri) => {
      // If not provided, ask user to select
      if (!folderUri) {
        const folders = await vscode.window.showOpenDialog({
          canSelectFolders: true,
          canSelectFiles: false,
          canSelectMany: false,
          openLabel: 'Select folder to diagram',
        });
        if (!folders || folders.length === 0) {
          return;
        }
        folderUri = folders[0];
      }

      const panel = ExcalidrawPanel.createOrShow(context.extensionUri);
      setupPanel(panel);

      // Analyze the folder
      const analysis = await analyzeFolder(folderUri);
      const prompt = buildFolderAnalysisPrompt(analysis);

      await runGeneration(panel, prompt);
    }
  );

  // Register diagram file command - diagram a single file's internal structure
  const diagramFileCommand = vscode.commands.registerCommand(
    'excalidraw-copilot.diagramFile',
    async (fileUri?: vscode.Uri) => {
      // Use active editor if not provided
      if (!fileUri) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('No file open. Open a file or right-click one in Explorer.');
          return;
        }
        fileUri = editor.document.uri;
      }

      const panel = ExcalidrawPanel.createOrShow(context.extensionUri);
      setupPanel(panel);

      try {
        const content = await vscode.workspace.fs.readFile(fileUri);
        const text = Buffer.from(content).toString();
        const relativePath = vscode.workspace.asRelativePath(fileUri, false);
        // Send up to 6000 chars for a single file deep analysis
        const snippet = text.slice(0, 6000);

        const prompt = buildFileAnalysisPrompt(relativePath, snippet);

        await runGeneration(panel, prompt);
      } catch (e) {
        vscode.window.showErrorMessage(`Failed to read file: ${(e as Error).message}`);
      }
    }
  );

  // Register diagram project command - diagram the entire workspace
  const diagramProjectCommand = vscode.commands.registerCommand(
    'excalidraw-copilot.diagramProject',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showWarningMessage('No workspace open. Open a project folder first.');
        return;
      }

      const panel = ExcalidrawPanel.createOrShow(context.extensionUri);
      setupPanel(panel);

      vscode.window.showInformationMessage('📂 Analyzing entire project...');
      const analysis = await analyzeFolder(workspaceFolder.uri);
      const prompt = buildProjectAnalysisPrompt(analysis);

      await runGeneration(panel, prompt);
    }
  );

  // Register @excalidraw chat participant
  const chatParticipant = registerChatParticipant(context, outputChannel, stateManager);

  context.subscriptions.push(openCommand, generateCommand, diagramFolderCommand, diagramFileCommand, diagramProjectCommand, chatParticipant, outputChannel);
}

function setupPanel(panel: ExcalidrawPanel): void {
  // Set up user prompt handler (for prompts entered in WebView)
  panel.setOnUserPrompt(async (prompt: string) => {
    await runGeneration(panel, prompt);
  });

  // Set up canvas state sync
  panel.setOnCanvasStateChange((state) => {
    stateManager.updateState(state);
  });
}

async function runGeneration(panel: ExcalidrawPanel, prompt: string): Promise<void> {
  outputChannel.appendLine(`\n=== Generating diagram for: ${prompt} ===`);
  
  // Auto-detect "project/codebase" prompts and inject workspace analysis
  let enrichedPrompt = prompt;
  const detected = isProjectPrompt(prompt);
  outputChannel.appendLine(`Project prompt detection: ${detected} (prompt: "${prompt.slice(0, 80)}")`);
  if (detected) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      outputChannel.appendLine('Detected project-level prompt — injecting workspace analysis...');
      vscode.window.showInformationMessage('📂 Analyzing workspace for project context...');
      try {
        const analysis = await analyzeFolder(workspaceFolder.uri);
        enrichedPrompt = `Based on this deep code analysis, create a diagram showing the real structure of this codebase.

${analysis}

ORIGINAL USER REQUEST: "${prompt}"

Show ONLY what actually exists in this codebase. Do NOT invent technologies or components not found in the analysis.`;
        outputChannel.appendLine(`Workspace analysis injected (${analysis.length} chars)`);
      } catch (e) {
        outputChannel.appendLine(`Workspace analysis failed: ${(e as Error).message}, using original prompt`);
      }
    }
  }

  const diagramService = new SemanticDiagramService(outputChannel);

  // Let user pick a model
  const models = await diagramService.getAvailableModels();
  if (models.length === 0) {
    vscode.window.showErrorMessage(
      'GitHub Copilot is not available. Make sure the Copilot extension is installed and you are signed in.'
    );
    return;
  }

  const modelItems = models.map(m => ({
    label: m.name,
    description: `(${m.family})`,
    model: m
  }));
  
  // Sort: opus first, then sonnet, then others
  modelItems.sort((a, b) => {
    const order = (m: typeof modelItems[0]) => {
      if (m.model.family.includes('opus')) return 0;
      if (m.model.family.includes('sonnet')) return 1;
      if (m.model.family.includes('gpt-4o')) return 2;
      return 3;
    };
    return order(a) - order(b);
  });

  const picked = await vscode.window.showQuickPick(modelItems, {
    placeHolder: '🤖 Pick a model (Opus = best quality, Sonnet = fast)',
    title: 'Excalidraw Copilot — Choose Model'
  });

  if (!picked) {
    return; // user cancelled
  }

  diagramService.setModel(picked.model);

  await panel.waitUntilReady();

  // Detect pipeline suggestion, but let user choose
  const suggestedMermaid = diagramService.shouldUseMermaid(enrichedPrompt);
  
  const pipelineItems = [
    {
      label: suggestedMermaid ? 'Semantic DSL' : '$(star) Semantic DSL (Recommended)',
      description: 'Best for processes/recipes — custom layout with colors & emojis',
      pipeline: 'dsl' as const
    },
    {
      label: suggestedMermaid ? '$(star) Mermaid (Recommended)' : 'Mermaid',
      description: 'Best for architecture — uses Mermaid layout engine',
      pipeline: 'mermaid' as const
    }
  ];

  const pickedPipeline = await vscode.window.showQuickPick(pipelineItems, {
    placeHolder: '🔧 Choose rendering pipeline',
    title: 'Excalidraw Copilot — Pipeline'
  });

  if (!pickedPipeline) {
    return; // user cancelled
  }

  const useMermaid = pickedPipeline.pipeline === 'mermaid';
  outputChannel.appendLine(`Pipeline: ${useMermaid ? 'MERMAID (user choice)' : 'DSL (user choice)'}`);

  if (useMermaid) {
    await runMermaidGeneration(panel, diagramService, enrichedPrompt);
  } else {
    await runDslGeneration(panel, diagramService, enrichedPrompt);
  }
}

// DSL pipeline — process/recipe diagrams (existing behavior)
async function runDslGeneration(panel: ExcalidrawPanel, diagramService: SemanticDiagramService, prompt: string): Promise<void> {
  const { layoutGraph } = await import('./layout/engine');
  const { renderToExcalidraw } = await import('./render/shapes');

  // Helper to render a graph to canvas
  const renderGraph = async (graph: any) => {
    if (!graph || !graph.nodes) {
      throw new Error('Invalid graph - no nodes');
    }
    const positionedGraph = layoutGraph(graph);
    const elements = renderToExcalidraw(positionedGraph);
    await panel.sendMessage({ type: 'clearCanvas', payload: {} });
    await panel.sendMessage({ type: 'addElements', payload: elements } as any);
    await panel.sendMessage({ type: 'zoomToFit', payload: {} });
    await new Promise(resolve => setTimeout(resolve, 500));
    return elements;
  };

  let currentGraph: any = null;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Generating diagram...',
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: '🧠 Planning diagram... (15-20 sec)' });
        
        const initialResult = await diagramService.generateDiagram(
          prompt,
          (stage) => progress.report({ message: stage })
        );
        
        outputChannel.appendLine(`Initial: ${initialResult.graph.nodes.length} nodes`);
        
        progress.report({ message: '🖼️ Rendering diagram...' });
        currentGraph = initialResult.graph;
        await renderGraph(currentGraph);
        
        vscode.window.showInformationMessage(
          `✅ Diagram ready! ${currentGraph.nodes.length} nodes, ${currentGraph.connections.length} connections`
        );
        
      } catch (e) {
        const error = e as Error;
        outputChannel.appendLine(`Error: ${error.message}`);
        outputChannel.appendLine(error.stack || '');
        vscode.window.showErrorMessage(`Diagram generation failed: ${error.message}`);
      }
    }
  );

  // Feedback loop (DSL path)
  if (currentGraph) {
    await runFeedbackLoop(panel, diagramService, prompt, currentGraph, renderGraph);
  }
}

// Mermaid pipeline — architecture diagrams
async function runMermaidGeneration(panel: ExcalidrawPanel, diagramService: SemanticDiagramService, prompt: string): Promise<void> {
  let currentMermaid: string | null = null;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Generating architecture diagram (Mermaid)...',
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: '🧠 Planning architecture... (15-20 sec)' });
        
        const result = await diagramService.generateMermaidDiagram(
          prompt,
          (stage) => progress.report({ message: stage })
        );
        
        currentMermaid = result.mermaidSyntax;
        outputChannel.appendLine(`Mermaid generated (${currentMermaid.length} chars)`);
        
        progress.report({ message: '🖼️ Rendering Mermaid preview...' });
        await panel.sendMessage({ type: 'clearCanvas', payload: {} });
        await panel.sendMessage({ type: 'showMermaidPreview', payload: { mermaidSyntax: currentMermaid } } as any);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        vscode.window.showInformationMessage('✅ Architecture diagram ready! (Mermaid pipeline)');
        
      } catch (e) {
        const error = e as Error;
        outputChannel.appendLine(`Mermaid error: ${error.message}`);
        outputChannel.appendLine(error.stack || '');
        vscode.window.showErrorMessage(`Diagram generation failed: ${error.message}`);
      }
    }
  );

  // Feedback loop (Mermaid path)
  if (currentMermaid) {
    await runMermaidFeedbackLoop(panel, diagramService, prompt, currentMermaid);
  }
}

// Mermaid feedback loop
async function runMermaidFeedbackLoop(
  panel: ExcalidrawPanel,
  diagramService: SemanticDiagramService,
  originalPrompt: string,
  initialMermaid: string
): Promise<void> {
  let currentMermaid = initialMermaid;
  let iteration = 0;

  while (iteration < 10) {
    const feedback = await vscode.window.showInputBox({
      prompt: iteration === 0
        ? '💬 Any changes? (e.g., "add a caching layer", "group the databases together")'
        : '💬 More changes? (press Escape when done)',
      placeHolder: 'Describe what to change, or press Escape to finish',
      ignoreFocusOut: true,
    });

    if (!feedback || feedback.trim() === '') {
      break;
    }

    iteration++;
    outputChannel.appendLine(`\n=== Mermaid Feedback #${iteration}: ${feedback} ===`);

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Updating architecture diagram...',
        cancellable: false,
      },
      async (progress) => {
        try {
          progress.report({ message: `🔄 Applying: "${feedback.slice(0, 50)}..."` });
          
          currentMermaid = await diagramService.refineMermaidWithFeedback(
            originalPrompt,
            currentMermaid,
            feedback
          );
          
          progress.report({ message: '🖼️ Re-rendering preview...' });
          await panel.sendMessage({ type: 'showMermaidPreview', payload: { mermaidSyntax: currentMermaid } } as any);
          await new Promise(resolve => setTimeout(resolve, 500));
          
          vscode.window.showInformationMessage('✅ Architecture updated! (Mermaid pipeline)');
          
        } catch (e) {
          const error = e as Error;
          outputChannel.appendLine(`Mermaid feedback error: ${error.message}`);
          vscode.window.showErrorMessage(`Update failed: ${error.message}. Try rephrasing.`);
        }
      }
    );
  }

  // Offer re-entry after the loop ends
  const reopen = await vscode.window.showInformationMessage(
    '✅ Mermaid diagram finalized. Want to refine further?',
    'Continue Refining'
  );
  if (reopen === 'Continue Refining') {
    await runMermaidFeedbackLoop(panel, diagramService, originalPrompt, currentMermaid);
  }
}

// Conversational feedback loop — keeps asking for changes until user presses Escape
async function runFeedbackLoop(
  panel: ExcalidrawPanel,
  diagramService: SemanticDiagramService,
  originalPrompt: string,
  initialGraph: any,
  renderGraph: (graph: any) => Promise<any>
): Promise<void> {
  let currentGraph = initialGraph;
  let iteration = 0;

  while (iteration < 10) {
    const feedback = await vscode.window.showInputBox({
      prompt: iteration === 0
        ? '💬 Any changes? (e.g., "add a caching layer", "step 3 is wrong", "remove the database")'
        : '💬 More changes? (press Escape when done)',
      placeHolder: 'Describe what to change, or press Escape to finish',
      ignoreFocusOut: true,
    });

    if (!feedback || feedback.trim() === '') {
      break;
    }

    iteration++;
    outputChannel.appendLine(`\n=== Feedback #${iteration}: ${feedback} ===`);

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Updating diagram...',
        cancellable: false,
      },
      async (progress) => {
        try {
          progress.report({ message: `🔄 Applying: "${feedback.slice(0, 50)}..."` });
          
          const updatedGraph = await diagramService.refineDiagramWithFeedback(
            originalPrompt,
            currentGraph,
            feedback
          );
          
          currentGraph = updatedGraph;
          
          progress.report({ message: '🖼️ Re-rendering...' });
          await renderGraph(currentGraph);
          
          vscode.window.showInformationMessage(
            `✅ Updated! ${currentGraph.nodes.length} nodes, ${currentGraph.connections.length} connections`
          );
          
        } catch (e) {
          const error = e as Error;
          outputChannel.appendLine(`Feedback error: ${error.message}`);
          vscode.window.showErrorMessage(`Update failed: ${error.message}. Try rephrasing.`);
        }
      }
    );
  }

  // Offer re-entry after the loop ends
  const reopen = await vscode.window.showInformationMessage(
    '✅ Diagram finalized. Want to refine further?',
    'Continue Refining'
  );
  if (reopen === 'Continue Refining') {
    await runFeedbackLoop(panel, diagramService, originalPrompt, currentGraph, renderGraph);
  }
}

export function deactivate() {
  // Clean up
}
