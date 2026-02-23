/**
 * Excalidraw Copilot Extension - Entry Point
 * 
 * v2: Uses semantic diagram DSL for much better quality diagrams
 */

import * as vscode from 'vscode';
import { ExcalidrawPanel } from './webview/WebViewPanel';
import { SemanticDiagramService } from './llm/SemanticDiagramService';
import { StateManager } from './execution/StateManager';

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
      
      const prompt = `Based on this deep code analysis, create an ARCHITECTURE DIAGRAM showing the real structure of this codebase.

${analysis}

## DIAGRAM REQUIREMENTS:
1. Show each detected component/module as a node with the RIGHT type:
   - Entry points (app/server) → "service" type, semanticColor "primary", importance "high"
   - Controllers/routes → "service" type, semanticColor "info"
   - Services/business logic → "service" type, semanticColor "success"
   - Models/entities → "database" type, semanticColor "warning"
   - External databases (PostgreSQL, MongoDB, etc.) → "database" type, semanticColor "danger"
   - External caches (Redis) → "cache" type, semanticColor "warning"
   - Message queues (Kafka, RabbitMQ) → "queue" type, semanticColor "secondary"
   - External APIs/services → "external" type, semanticColor "neutral"
2. Show REAL dependencies as arrows based on the import graph
3. Group related components (e.g., all controllers in one group, all services in another)
4. Use direction "TB" (top-to-bottom) for layered architecture
5. Use descriptive labels matching the actual file/class names
6. Add a note summarizing the architecture pattern (MVC, microservices, monolith, etc.)
7. Use row/column hints to create clean layers: entry at top, controllers next, services below, data layer at bottom`;

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

        const prompt = `Analyze this source file and create an architecture/structure diagram showing its internal design:

## File: ${relativePath}
\`\`\`
${snippet}
\`\`\`

Create a diagram showing:
1. All classes, interfaces, and major functions as nodes
2. Inheritance and implementation relationships as arrows
3. Method calls and data flow between components
4. External dependencies as "external" type nodes
5. Use direction "TB" (top-to-bottom)
6. Group related items (e.g., public API vs internal helpers)
7. Use appropriate types: "service" for classes, "process" for functions, "database" for data models
8. Add a note describing what this file/module does`;

        await runGeneration(panel, prompt);
      } catch (e) {
        vscode.window.showErrorMessage(`Failed to read file: ${(e as Error).message}`);
      }
    }
  );

  context.subscriptions.push(openCommand, generateCommand, diagramFolderCommand, diagramFileCommand, outputChannel);
}

async function analyzeFolder(folderUri: vscode.Uri): Promise<string> {
  const analysis: string[] = [];
  
  // Find source and config files
  const sourcePatterns = ['**/*.ts', '**/*.js', '**/*.py', '**/*.cs', '**/*.java', '**/*.go'];
  const configPatterns = ['**/package.json', '**/requirements.txt', '**/go.mod', '**/*.csproj', '**/pom.xml', '**/Dockerfile', '**/docker-compose.yml', '**/.env.example'];
  const excludePattern = '{**/node_modules/**,**/dist/**,**/build/**,**/.git/**,**/coverage/**,**/__pycache__/**,**/vendor/**}';

  const sourceFiles: vscode.Uri[] = [];
  const configFiles: vscode.Uri[] = [];
  for (const pattern of sourcePatterns) {
    const found = await vscode.workspace.findFiles(new vscode.RelativePattern(folderUri, pattern), excludePattern, 200);
    sourceFiles.push(...found);
  }
  for (const pattern of configPatterns) {
    const found = await vscode.workspace.findFiles(new vscode.RelativePattern(folderUri, pattern), excludePattern, 20);
    configFiles.push(...found);
  }

  // --- 1. Project structure by directory ---
  const filesByDir = new Map<string, string[]>();
  for (const file of [...sourceFiles, ...configFiles]) {
    const relativePath = vscode.workspace.asRelativePath(file, false);
    const dir = relativePath.split(/[/\\]/).slice(0, -1).join('/') || '.';
    const fileName = relativePath.split(/[/\\]/).pop() || '';
    if (!filesByDir.has(dir)) filesByDir.set(dir, []);
    filesByDir.get(dir)!.push(fileName);
  }
  analysis.push('## Project Structure');
  for (const [dir, dirFiles] of filesByDir) {
    analysis.push(`- ${dir}/: ${dirFiles.slice(0, 8).join(', ')}${dirFiles.length > 8 ? ` (+${dirFiles.length - 8} more)` : ''}`);
  }

  // --- 2. Dependencies from manifest files ---
  const packageJsons = configFiles.filter(f => f.path.endsWith('package.json'));
  for (const pj of packageJsons.slice(0, 3)) {
    try {
      const content = await vscode.workspace.fs.readFile(pj);
      const pkg = JSON.parse(Buffer.from(content).toString());
      const relativePath = vscode.workspace.asRelativePath(pj, false);
      analysis.push(`\n## Dependencies (${relativePath})`);
      if (pkg.name) analysis.push(`Package: ${pkg.name}`);
      const deps = { ...pkg.dependencies };
      const devDeps = { ...pkg.devDependencies };
      if (Object.keys(deps).length > 0) {
        analysis.push(`Runtime: ${Object.keys(deps).join(', ')}`);
      }
      const frameworks = Object.keys({ ...deps, ...devDeps }).filter(d =>
        ['express', 'fastify', 'next', 'react', 'vue', 'angular', 'nestjs', 'prisma',
         'typeorm', 'sequelize', 'mongoose', 'redis', 'ioredis', 'pg', 'mysql', 'mysql2',
         'mongodb', 'graphql', 'apollo', 'aws-sdk', '@aws-sdk', 'azure', 'firebase',
         'socket.io', 'kafkajs', 'amqplib', 'bull', 'webpack', 'vite', 'esbuild',
         'jest', 'mocha', 'vitest', 'passport', 'jsonwebtoken', 'bcrypt', 'axios',
         'grpc', '@grpc', 'trpc', 'swagger', 'openapi'].some(k => d.includes(k))
      );
      if (frameworks.length > 0) {
        analysis.push(`Key frameworks/libs: ${frameworks.join(', ')}`);
      }
    } catch (e) { /* ignore */ }
  }

  // Check for Docker
  const dockerFiles = configFiles.filter(f => f.path.endsWith('Dockerfile') || f.path.endsWith('docker-compose.yml'));
  if (dockerFiles.length > 0) {
    analysis.push('\n## Infrastructure');
    for (const df of dockerFiles.slice(0, 2)) {
      try {
        const content = await vscode.workspace.fs.readFile(df);
        const text = Buffer.from(content).toString().slice(0, 800);
        const relativePath = vscode.workspace.asRelativePath(df, false);
        analysis.push(`- ${relativePath}:\n${text}`);
      } catch (e) { /* ignore */ }
    }
  }

  // --- 3. Prioritize and analyze source files ---
  // Priority: entry points first, then controllers/routes, services, models, then others
  const prioritized = prioritizeFiles(sourceFiles);
  const maxFiles = 30;
  const filesToAnalyze = prioritized.slice(0, maxFiles);

  // Track the import graph
  const importGraph: Array<{ file: string; exports: string[]; imports: string[]; role: string; externalDeps: string[] }> = [];

  analysis.push('\n## Components');
  for (const file of filesToAnalyze) {
    try {
      const content = await vscode.workspace.fs.readFile(file);
      const text = Buffer.from(content).toString();
      const relativePath = vscode.workspace.asRelativePath(file, false);
      // Read up to 2000 chars for analysis
      const snippet = text.slice(0, 2000);

      const fileInfo = analyzeSourceFile(relativePath, snippet);
      if (fileInfo.exports.length > 0 || fileInfo.imports.length > 0 || fileInfo.role !== 'unknown') {
        importGraph.push(fileInfo);
        analysis.push(`- **${relativePath}** [${fileInfo.role}]`);
        if (fileInfo.exports.length > 0) {
          analysis.push(`  Exports: ${fileInfo.exports.slice(0, 5).join(', ')}`);
        }
        if (fileInfo.imports.length > 0) {
          analysis.push(`  Imports from: ${fileInfo.imports.slice(0, 5).join(', ')}`);
        }
        if (fileInfo.externalDeps.length > 0) {
          analysis.push(`  External: ${fileInfo.externalDeps.join(', ')}`);
        }
      }
    } catch (e) { /* ignore */ }
  }

  // --- 4. Detect architectural patterns ---
  analysis.push('\n## Detected Architecture Patterns');
  const roles = importGraph.map(f => f.role);
  const roleCounts = new Map<string, number>();
  for (const r of roles) {
    roleCounts.set(r, (roleCounts.get(r) || 0) + 1);
  }
  for (const [role, count] of roleCounts) {
    if (role !== 'unknown') analysis.push(`- ${role}: ${count} file(s)`);
  }

  // --- 5. Dependency edges between modules ---
  analysis.push('\n## Internal Dependencies');
  for (const fileInfo of importGraph) {
    const shortName = fileInfo.file.split(/[/\\]/).pop()?.replace(/\.(ts|js|py|cs|java|go)$/, '') || fileInfo.file;
    for (const imp of fileInfo.imports) {
      // Only show local imports
      if (imp.startsWith('.') || imp.startsWith('/')) {
        analysis.push(`- ${shortName} → ${imp}`);
      }
    }
  }

  return analysis.join('\n');
}

// Prioritize files: entry points > routes/controllers > services > models > utils > others
function prioritizeFiles(files: vscode.Uri[]): vscode.Uri[] {
  const scored = files.map(f => {
    const p = f.path.toLowerCase();
    let score = 0;
    // Entry points
    if (/\/(index|main|app|server|program)\.(ts|js|py|cs|java|go)$/.test(p)) score += 100;
    // Routes/controllers
    if (/\/(route|controller|handler|endpoint|api)/.test(p)) score += 80;
    // Services/business logic
    if (/\/(service|usecase|interactor|manager|provider)/.test(p)) score += 70;
    // Models/entities
    if (/\/(model|entity|schema|migration|dto)/.test(p)) score += 60;
    // Middleware/guards/interceptors
    if (/\/(middleware|guard|interceptor|filter|pipe|validator)/.test(p)) score += 50;
    // Config
    if (/\/(config|setting|constant|env)/.test(p)) score += 40;
    // Tests are least useful for architecture
    if (/\.(test|spec|e2e)\.(ts|js|py)$/.test(p)) score -= 50;
    // Prefer shorter paths (closer to root = more important)
    score -= (p.split(/[/\\]/).length * 2);
    return { file: f, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.file);
}

// Analyze a single source file to extract role, exports, imports, external deps
function analyzeSourceFile(relativePath: string, content: string): {
  file: string; exports: string[]; imports: string[]; role: string; externalDeps: string[];
} {
  const exports: string[] = [];
  const imports: string[] = [];
  const externalDeps: string[] = [];
  let role = 'unknown';

  // Detect role from path and content
  const pathLower = relativePath.toLowerCase();
  if (/\/(route|router)/.test(pathLower) || /app\.(get|post|put|delete|use)\s*\(/.test(content)) {
    role = 'route/controller';
  } else if (/\/controller/.test(pathLower) || /@(Controller|Get|Post|Put|Delete)/.test(content)) {
    role = 'route/controller';
  } else if (/\/service/.test(pathLower) || /@Injectable/.test(content)) {
    role = 'service';
  } else if (/\/(model|entity|schema)/.test(pathLower) || /@Entity|@Schema|@Table|class\s+\w+Model/.test(content)) {
    role = 'model/entity';
  } else if (/\/middleware/.test(pathLower)) {
    role = 'middleware';
  } else if (/\/(config|setting)/.test(pathLower)) {
    role = 'config';
  } else if (/\/(util|helper|lib|common)/.test(pathLower)) {
    role = 'utility';
  } else if (/\/(test|spec|__test__)/.test(pathLower)) {
    role = 'test';
  } else if (/\/(index|main|app|server)\.(ts|js|py|cs)$/.test(pathLower)) {
    role = 'entry point';
  }

  // Extract exports (TS/JS)
  const exportMatches = content.matchAll(/export\s+(?:default\s+)?(?:class|function|const|interface|type|enum|abstract class)\s+(\w+)/g);
  for (const m of exportMatches) exports.push(m[1]);
  // Python classes/functions
  const pyClassMatches = content.matchAll(/^class\s+(\w+)/gm);
  for (const m of pyClassMatches) exports.push(m[1]);
  const pyDefMatches = content.matchAll(/^def\s+(\w+)/gm);
  for (const m of pyDefMatches) { if (!m[1].startsWith('_')) exports.push(m[1]); }
  // Java/C# classes
  const javaClassMatches = content.matchAll(/(?:public|internal)\s+(?:class|interface)\s+(\w+)/g);
  for (const m of javaClassMatches) exports.push(m[1]);
  // Go exported functions
  const goFuncMatches = content.matchAll(/^func\s+(?:\(\w+\s+\*?\w+\)\s+)?([A-Z]\w+)/gm);
  for (const m of goFuncMatches) exports.push(m[1]);

  // Extract imports (TS/JS)
  const importMatches = content.matchAll(/import\s+.*?from\s+['"](.*?)['"]/g);
  for (const m of importMatches) {
    const imp = m[1];
    if (imp.startsWith('.') || imp.startsWith('/') || imp.startsWith('@/')) {
      imports.push(imp);
    } else {
      externalDeps.push(imp.split('/')[0]);
    }
  }
  // require()
  const requireMatches = content.matchAll(/require\s*\(\s*['"](.*?)['"]\s*\)/g);
  for (const m of requireMatches) {
    const imp = m[1];
    if (imp.startsWith('.') || imp.startsWith('/')) {
      imports.push(imp);
    } else {
      externalDeps.push(imp.split('/')[0]);
    }
  }
  // Python imports
  const pyImportMatches = content.matchAll(/^(?:from\s+(\S+)\s+import|import\s+(\S+))/gm);
  for (const m of pyImportMatches) {
    const imp = m[1] || m[2];
    if (imp.startsWith('.')) imports.push(imp);
    else externalDeps.push(imp.split('.')[0]);
  }
  // Go imports
  const goImportMatches = content.matchAll(/"([\w./]+)"/g);
  for (const m of goImportMatches) {
    if (m[1].includes('/')) externalDeps.push(m[1].split('/').pop() || m[1]);
  }

  // Detect external service connections
  const dbPatterns = [
    { pattern: /mongoose|mongodb|MongoClient/i, dep: 'MongoDB' },
    { pattern: /pg|postgres|PostgreSQL|Pool|Client/i, dep: 'PostgreSQL' },
    { pattern: /mysql|mysql2/i, dep: 'MySQL' },
    { pattern: /redis|ioredis|RedisClient/i, dep: 'Redis' },
    { pattern: /prisma/i, dep: 'Prisma ORM' },
    { pattern: /typeorm|TypeORM/i, dep: 'TypeORM' },
    { pattern: /sequelize/i, dep: 'Sequelize' },
    { pattern: /kafka|KafkaClient/i, dep: 'Kafka' },
    { pattern: /amqp|rabbitmq|RabbitMQ/i, dep: 'RabbitMQ' },
    { pattern: /elasticsearch|elastic/i, dep: 'Elasticsearch' },
    { pattern: /s3|S3Client|aws-sdk/i, dep: 'AWS S3' },
    { pattern: /firebase/i, dep: 'Firebase' },
    { pattern: /graphql|GraphQL|gql`/i, dep: 'GraphQL' },
    { pattern: /grpc|gRPC/i, dep: 'gRPC' },
    { pattern: /socket\.io|WebSocket|ws/i, dep: 'WebSocket' },
  ];
  for (const { pattern, dep } of dbPatterns) {
    if (pattern.test(content) && !externalDeps.includes(dep)) {
      externalDeps.push(dep);
    }
  }

  // Detect HTTP endpoints
  const endpointMatches = content.matchAll(/\.(get|post|put|delete|patch)\s*\(\s*['"](.*?)['"]/gi);
  for (const m of endpointMatches) {
    if (!exports.includes(`${m[1].toUpperCase()} ${m[2]}`)) {
      exports.push(`${m[1].toUpperCase()} ${m[2]}`);
    }
  }
  // Decorator-based endpoints (NestJS, etc.)
  const decoratorEndpoints = content.matchAll(/@(Get|Post|Put|Delete|Patch)\s*\(\s*['"](.*?)['"]\s*\)/g);
  for (const m of decoratorEndpoints) {
    exports.push(`${m[1].toUpperCase()} ${m[2]}`);
  }

  return {
    file: relativePath,
    exports: [...new Set(exports)],
    imports: [...new Set(imports)],
    role,
    externalDeps: [...new Set(externalDeps)]
  };
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

  // Generate initial diagram
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

  // Feedback loop: let user refine conversationally
  if (currentGraph) {
    await runFeedbackLoop(panel, diagramService, prompt, currentGraph, renderGraph);
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
}

export function deactivate() {
  // Clean up
}
