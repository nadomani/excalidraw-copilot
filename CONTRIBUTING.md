# Contributing to Excalidraw Copilot

## Architecture

### Dual Pipeline Design

Excalidraw Copilot uses **two rendering pipelines**. In the Chat Participant, the pipeline is auto-detected from the prompt (or forced with `/architecture`, `/diagram`, `--mermaid`, `--dsl`). In the Command Palette flow, the user picks via a QuickPick dialog:

#### 🎨 Semantic DSL Pipeline (Process Diagrams)
```
Prompt → LLM Think → LLM Generate JSON → Layout Engine → Excalidraw Elements → WebView
```
- **Best for:** Recipes, tutorials, step-by-step processes, detailed code documentation
- **Speed:** ~30-40 sec (JSON generation + custom layout + individual element rendering)
- **Detail:** 15-30 nodes with emojis, descriptions, pro tips, rich color palette
- **How it works:** The LLM outputs a semantic graph JSON (nodes, connections, groups, notes). Our custom layout engine positions everything on a grid with snake wrapping. The renderer converts each node into styled Excalidraw shapes.

#### 🧜 Mermaid Pipeline (Architecture Diagrams)
```
Prompt → LLM Think → LLM Generate Mermaid → Native Mermaid Preview → (optional) Convert to Excalidraw
```
- **Best for:** System design, architecture diagrams, folder analysis, infrastructure
- **Speed:** ~15-20 sec (compact Mermaid syntax + native render)
- **Detail:** 15-25 nodes with subgraphs, color-coded per type
- **How it works:** The LLM outputs Mermaid flowchart syntax. The webview renders it natively as SVG with zoom/pan/export. User can optionally convert to Excalidraw via `@excalidraw/mermaid-to-excalidraw`.

### Key Files

| File | Purpose |
|------|---------|
| `src/extension.ts` | Commands, pipeline routing, feedback loops, project detection |
| `src/chat/ChatParticipant.ts` | `@excalidraw` Chat Participant — slash commands, refinement, contextual followups |
| `src/analysis/folderAnalysis.ts` | Folder/file/project analysis, prompt builders, role detection, import graph |
| `src/llm/SemanticDiagramService.ts` | Two-pass LLM generation (think → generate), Mermaid prompts, refinement, pipeline detection |
| `src/dsl/types.ts` | TypeScript types for the semantic graph DSL |
| `src/dsl/prompt.ts` | System prompts with schema + examples for the LLM |
| `src/layout/engine.ts` | Grid layout, snake wrapping, connection routing, fan-out spread |
| `src/render/shapes.ts` | Converts positioned graph → Excalidraw elements (per-line text rendering) |
| `src/render/styles.ts` | Semantic color palette (7 colors × 3 shades each) |
| `src/types/messages.ts` | Extension ↔ WebView message types |
| `src/webview/WebViewPanel.ts` | VS Code WebView panel management |
| `webview-ui/src/App.tsx` | React app: Excalidraw canvas, Mermaid preview with zoom/pan/export, message handling |

### Message Protocol

Extension → WebView: `postMessage({ type, payload })`
WebView → Extension: `vscode.postMessage({ type, payload })`

Key message types:
- `addElements` — batch add pre-rendered Excalidraw elements (DSL pipeline)
- `showMermaidPreview` — send Mermaid syntax for native preview (Mermaid pipeline)
- `renderMermaid` — convert Mermaid syntax directly to Excalidraw elements (legacy)
- `clearCanvas` — reset canvas + switch back to Excalidraw view mode
- `zoomToFit` — auto-zoom after rendering

### Code Analysis (Folder Scanner)
`analyzeFolder()` in `src/analysis/folderAnalysis.ts` scans:
- **Source patterns:** `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.cs`, `.java`, `.go`
- **Config patterns:** `package.json`, `requirements.txt`, `*.csproj`, `Dockerfile`, etc.
- **Role detection:** entry point, controller, service, model, component, state/store, middleware, utility
- **Import graph:** local imports traced between files
- **External deps:** databases, caches, queues, cloud services detected from code patterns
- **Max files:** 50 (prioritized: entry points > controllers > components > services > models)

### Smart Project Detection
`isProjectPrompt()` detects when user prompt refers to "this project/codebase/app" and auto-injects workspace analysis. Skips if the prompt already contains analysis markers (from right-click folder).

### Node Types
`service` (blue rect), `database` (green ellipse), `cache` (orange), `queue` (purple), `external` (gray dashed), `user` (info), `process` (yellow rect), `decision` (diamond), `note` (sticky), `group` (container)

### Semantic Colors
`primary` (blue), `secondary` (purple), `success` (green), `warning` (amber), `danger` (red), `info` (cyan), `neutral` (gray)

## Development Setup

```bash
git clone https://github.com/nadomani/excalidraw-copilot.git
cd excalidraw-copilot
npm install
cd webview-ui && npm install && cd ..
npm run compile
# Press F5 in VS Code → launches Extension Development Host
```

**Build:** `npm run compile` (webpack)
**Watch:** `npm run watch`
**Webview:** `cd webview-ui && npm run build`

### Debug Tips
- Output panel: `Ctrl+Shift+U` → "Excalidraw Copilot" — logs model name, pipeline choice, node counts, errors
- WebView DevTools: `Ctrl+Shift+P` → "Developer: Open Webview Developer Tools"
- Mermaid debug: `.excalidraw-debug/last-mermaid.md` in the workspace

## Configuration Reference

### Layout Config (`src/layout/engine.ts` CONFIG object)
```typescript
cellWidth: 360,        // Grid spacing horizontal
cellHeight: 220,       // Grid spacing vertical
margin: 80,            // Canvas margin
nodeSizes: {
  high:   { width: 260, height: 160 },
  medium: { width: 240, height: 140 },  // Dynamic: grows up to 340px for long labels
  low:    { width: 220, height: 120 }
},
noteWidth: 340,
noteHeight: 120,       // Dynamic: grows with text
groupPadding: 35
```

### LLM Prompts (`src/llm/SemanticDiagramService.ts`)
- **THINKING_PROMPT**: Plans diagram structure, decides type
- **GENERATION_PROMPT**: Creates JSON with schema, examples, color guidance
- **MERMAID_THINKING_PROMPT**: Plans Mermaid architecture (15-25 nodes, 4-7 subgraphs)
- **MERMAID_GENERATION_PROMPT**: Generates Mermaid with strict style rules, abstract example
- **MERMAID_REFINEMENT_PROMPT**: Updates Mermaid syntax based on user feedback
- **refineDiagramWithFeedback()**: Updates DSL JSON with auto-renumbering instructions

## Known Issues

### 1. Arrow Mess on Complex DSL Diagrams (Medium)
- When 20+ nodes with many cross-connections, arrows overlap
- Fan-out spread helps for parent-child, but cross-layer connections still overlap
- **Fix ideas:** A* pathfinding avoiding node rects, or curved bezier arrows

### 2. Mermaid-to-Excalidraw Conversion Quality (Low)
- Native Mermaid SVG looks better than converted Excalidraw (arrow routing, spacing)
- This is a fundamental limitation of `@excalidraw/mermaid-to-excalidraw`
- **Workaround:** Use the Mermaid preview mode and only convert when you need to edit

### 3. Visual Refinement Loop Disabled
- Originally: render → screenshot → LLM critique → improve
- Caused bugs (empty boxes appearing after refinement)
- Currently disabled in extension.ts

### 4. Excalidraw Text Rendering Quirks (Documented)
- Excalidraw ignores `width` for standalone text — it auto-sizes
- `containerId`/`boundElements` binding unreliable with sequential `addElement`
- **Solution in place:** Per-line rendering — each line is a separate text element

## Future Enhancements

### Priority 1: Save & Reopen as `.excalidraw` Files
1. Auto-save generated diagrams as `.excalidraw` files in the workspace
2. Add "Save Diagram" and "Open Diagram" commands
3. Support the standard Excalidraw JSON format
4. Register as file editor for `.excalidraw` files

### Priority 2: Streaming Diagram Rendering
1. Parse partial JSON/Mermaid as the LLM streams chunks
2. For DSL: render nodes as they're parsed (even before connections)
3. For Mermaid: show a "building..." preview that updates every few seconds

### Priority 3: Architecture Diagram Quality
1. Extend DSL with "list items" inside groups
2. Add `fontFamily: 3` option for monospace
3. Tighter group rendering — groups as visual containers
4. Nested subgraphs in Mermaid for complex systems

### Priority 4: More Visualization Types
1. Class diagrams — UML-style with methods/properties
2. ER diagrams — entity-relationship with cardinality
3. Mind maps — radial layout from center

### Priority 5: Polish
1. Re-enable visual refinement loop
2. Undo in feedback loop ("go back to previous version")
3. Remember model choice across sessions
4. Diagram from code selection (select → right-click → "Diagram This")
