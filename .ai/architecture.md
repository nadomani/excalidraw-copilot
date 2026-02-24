# Architecture Overview

## Dual Pipeline Design

### Pipeline A — Semantic DSL (Process Diagrams)
```
User Prompt → LLM Think → LLM Generate → Semantic Graph JSON → Layout Engine → Excalidraw Elements → WebView
```
- Best for: recipes, tutorials, flowcharts, step-by-step processes, detailed code documentation
- Speed: ~30-40 sec (JSON is verbose, custom layout + per-element rendering)
- Detail: 15-30 nodes with emojis, descriptions, pro tips, rich color palette
- Layout: Custom grid engine with snake wrapping, orthogonal arrows, fan-out spread

### Pipeline B — Mermaid (Architecture Diagrams)
```
User Prompt → LLM Think → LLM Generate Mermaid → WebView → mermaid-to-excalidraw → Excalidraw Canvas
```
- Best for: system architecture, folder analysis, infrastructure, high-level overviews
- Speed: ~15-20 sec (compact Mermaid syntax, automatic dagre layout)
- Detail: 10-15 nodes with concise labels, color-coded per type
- Layout: Mermaid's dagre engine (automatic, handles arrow routing)
- Debug output: `.excalidraw-debug/last-mermaid.md`

### Why Two Pipelines?
The DSL pipeline gives fine-grained control over every visual detail (emojis, per-line text, dynamic box sizing). The Mermaid pipeline leverages LLMs' strong Mermaid generation ability and Mermaid's mature layout engine for cleaner architecture diagrams with subgraphs and proper arrow routing.

## Key Components

| Component | File | Role |
|-----------|------|------|
| Extension Entry | `src/extension.ts` | Commands, routing, folder/file analysis, feedback loop |
| LLM Service | `src/llm/SemanticDiagramService.ts` | Two-pass LLM generation, diagram type detection |
| DSL Types | `src/dsl/types.ts` | Semantic graph schema (nodes, connections, groups) |
| Layout Engine | `src/layout/engine.ts` | Grid positioning, snake layout, arrow routing |
| Renderer | `src/render/shapes.ts` | Semantic graph → Excalidraw elements |
| WebView Panel | `src/webview/WebViewPanel.ts` | VS Code WebView lifecycle, message passing |
| React App | `webview-ui/src/App.tsx` | Excalidraw canvas, message handling, Mermaid conversion |
| Messages | `src/types/messages.ts` | Extension ↔ WebView message protocol |

## Diagram Type Detection
In `SemanticDiagramService.ts`, architecture markers are detected:
- Keywords: "architecture", "system design", "infrastructure"
- Folder/file analysis commands always → architecture
- Everything else → process/recipe

## Message Flow
Extension → WebView: `postMessage({ type, payload })`
WebView → Extension: `vscode.postMessage({ type, payload })`

Key message types:
- `addElements` — send pre-rendered Excalidraw elements (DSL pipeline)
- `renderMermaid` — send Mermaid syntax string (Mermaid pipeline)
- `clearCanvas` — reset canvas before new diagram
- `zoomToFit` — auto-zoom after rendering
