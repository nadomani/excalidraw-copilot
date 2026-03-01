/**
 * Folder & File Analysis — Extracted from extension.ts for reuse by chat participant
 */

import * as vscode from 'vscode';

/**
 * Detect if the user's prompt is asking about "this project" / "this codebase"
 * but NOT already enriched with folder analysis (which contains ## markers)
 */
export function isProjectPrompt(prompt: string): boolean {
  // If the prompt already has analysis sections, it came from right-click folder — skip
  if (prompt.includes('## Project Structure') || prompt.includes('## Components') || prompt.includes('## DIAGRAM REQUIREMENTS')) {
    return false;
  }
  // If prompt contains file content (from diagramFile command), skip
  if (prompt.includes('## File:') && prompt.includes('```')) {
    return false;
  }
  const lower = prompt.toLowerCase();
  const projectKeywords = [
    'this project', 'this codebase', 'this repo', 'this repository',
    'my project', 'my codebase', 'my repo', 'our project', 'our codebase',
    'the project', 'the codebase', 'current project', 'workspace',
    'this app', 'this application', 'this extension', 'this service',
    'our app', 'our service', 'our repo', 'our extension',
  ];
  if (projectKeywords.some(kw => lower.includes(kw))) {
    return true;
  }
  // Also match "project" or "codebase" combined with diagram/architecture verbs
  const hasSubject = /\b(project|codebase|repo|repository|application|app|service|extension)\b/.test(lower);
  const hasAction = /\b(diagram|architecture|structure|describe|visualize|draw|show|map|overview)\b/.test(lower);
  return hasSubject && hasAction;
}

export async function analyzeFolder(folderUri: vscode.Uri): Promise<string> {
  const analysis: string[] = [];
  
  // Find source and config files
  const sourcePatterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.py', '**/*.cs', '**/*.java', '**/*.go'];
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
  const prioritized = prioritizeFiles(sourceFiles);
  const maxFiles = 50;
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

export function prioritizeFiles(files: vscode.Uri[]): vscode.Uri[] {
  const scored = files.map(f => {
    const p = f.path.toLowerCase();
    let score = 0;
    // Entry points
    if (/\/(index|main|app|server|program)\.(tsx?|jsx?|py|cs|java|go)$/.test(p)) score += 100;
    // Routes/controllers
    if (/\/(route|controller|handler|endpoint|api)/.test(p)) score += 80;
    // Components (React/Vue/Angular)
    if (/\/component/.test(p)) score += 75;
    // Services/business logic
    if (/\/(service|usecase|interactor|manager|provider)/.test(p)) score += 70;
    // Models/entities
    if (/\/(model|entity|schema|migration|dto)/.test(p)) score += 60;
    // Middleware/guards/interceptors
    if (/\/(middleware|guard|interceptor|filter|pipe|validator)/.test(p)) score += 50;
    // Config
    if (/\/(config|setting|constant|env)/.test(p)) score += 40;
    // Tests are least useful for architecture
    if (/\.(test|spec|e2e)\.(tsx?|jsx?|py)$/.test(p)) score -= 50;
    // Prefer shorter paths (closer to root = more important)
    score -= (p.split(/[/\\]/).length * 2);
    return { file: f, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.file);
}

export function analyzeSourceFile(relativePath: string, content: string): {
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
  } else if (/\/component/.test(pathLower) || /React\.FC|React\.Component|function\s+\w+\s*\([^)]*\)\s*{[^}]*return\s*\(?\s*</.test(content) || /export\s+(?:default\s+)?function\s+\w+.*?(?:JSX|ReactElement|React\.ReactNode)/.test(content)) {
    role = 'component';
  } else if (/\/store|\/slice|\/reducer|createSlice|createStore/.test(pathLower) || /createSlice|createStore|createReducer/.test(content)) {
    role = 'state/store';
  } else if (/\/(test|spec|__test__)/.test(pathLower)) {
    role = 'test';
  } else if (/\/(index|main|app|server)\.(tsx?|jsx?|py|cs)$/.test(pathLower)) {
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
    { pattern: /\bpg\b|postgres(?:ql)?|NpgsqlConnection|npgsql/i, dep: 'PostgreSQL' },
    { pattern: /\bmysql2?\b|MySqlConnection/i, dep: 'MySQL' },
    { pattern: /\bredis\b|ioredis|RedisClient|StackExchange\.Redis/i, dep: 'Redis' },
    { pattern: /\bprisma\b/i, dep: 'Prisma ORM' },
    { pattern: /typeorm|TypeORM/i, dep: 'TypeORM' },
    { pattern: /sequelize/i, dep: 'Sequelize' },
    { pattern: /kafkajs|KafkaClient|Confluent\.Kafka/i, dep: 'Kafka' },
    { pattern: /amqplib|rabbitmq|RabbitMQ/i, dep: 'RabbitMQ' },
    { pattern: /elasticsearch|@elastic\/|Elastic\.Clients/i, dep: 'Elasticsearch' },
    { pattern: /S3Client|aws-sdk|Amazon\.S3/i, dep: 'AWS S3' },
    { pattern: /firebase/i, dep: 'Firebase' },
    { pattern: /graphql|GraphQL|gql`/i, dep: 'GraphQL' },
    { pattern: /grpc|gRPC|Grpc\.Core/i, dep: 'gRPC' },
    { pattern: /socket\.io|SignalR/i, dep: 'WebSocket' },
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

/** Build the architecture prompt for folder analysis results */
export function buildFolderAnalysisPrompt(analysis: string): string {
  return `Based on this deep code analysis, create an ARCHITECTURE DIAGRAM showing the real structure of this codebase.

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
}

/** Build the file analysis prompt */
export function buildFileAnalysisPrompt(relativePath: string, snippet: string): string {
  return `Analyze this source file and create an architecture/structure diagram showing its internal design:

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
}

/** Build the project analysis prompt (comprehensive) */
export function buildProjectAnalysisPrompt(analysis: string): string {
  return `Based on this deep code analysis, create a FULL PROJECT ARCHITECTURE DIAGRAM showing the complete structure of this codebase.

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
   - React/UI components → "process" type, semanticColor "info"
   - State management (Redux, stores) → "process" type, semanticColor "warning"
   - Config/infrastructure → "process" type, semanticColor "secondary"
2. Show REAL dependencies as arrows based on the import graph
3. Group related components (e.g., all controllers in one group, all services in another)
4. Use direction "TB" (top-to-bottom) for layered architecture
5. Use descriptive labels matching the actual file/class names
6. Add a note summarizing the architecture pattern (MVC, microservices, monolith, etc.)
7. Use row/column hints to create clean layers: entry at top, controllers next, services below, data layer at bottom
8. Be COMPREHENSIVE — include ALL major components found in the analysis`;
}
