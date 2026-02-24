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
User Prompt → LLM Think → LLM Generate Mermaid → Native Mermaid Preview (zoom/pan/export) → (optional) Convert to Excalidraw
```
- Best for: system architecture, folder analysis, infrastructure, high-level overviews
- Speed: ~15-20 sec (compact Mermaid syntax, native render)
- Detail: 15-25 nodes with subgraphs, color-coded per type
- Layout: Mermaid's dagre engine (automatic, handles arrow routing)
- Preview: Native SVG with zoom (Ctrl+Scroll), pan (Alt+Drag), SVG/PNG export
- Convert: "Convert to Excalidraw" button uses `@excalidraw/mermaid-to-excalidraw`
- Debug output: `.excalidraw-debug/last-mermaid.md`

### Why Two Pipelines?
The DSL pipeline gives fine-grained control over every visual detail (emojis, per-line text, dynamic box sizing). The Mermaid pipeline leverages LLMs' strong Mermaid generation ability and Mermaid's mature layout engine for cleaner architecture diagrams with subgraphs and proper arrow routing.

## Key Components

| Component | File | Role |
|-----------|------|------|
| Extension Entry | `src/extension.ts` | Commands, routing, folder/file analysis, feedback loops, project detection |
| LLM Service | `src/llm/SemanticDiagramService.ts` | Two-pass LLM generation, Mermaid prompts, diagram type detection |
| DSL Types | `src/dsl/types.ts` | Semantic graph schema (nodes, connections, groups) |
| Layout Engine | `src/layout/engine.ts` | Grid positioning, snake layout, arrow routing |
| Renderer | `src/render/shapes.ts` | Semantic graph → Excalidraw elements |
| WebView Panel | `src/webview/WebViewPanel.ts` | VS Code WebView lifecycle, message passing |
| React App | `webview-ui/src/App.tsx` | Excalidraw canvas, Mermaid preview with zoom/pan/export |
| Messages | `src/types/messages.ts` | Extension ↔ WebView message protocol |

## Message Flow
Extension → WebView: `postMessage({ type, payload })`
WebView → Extension: `vscode.postMessage({ type, payload })`

Key message types:
- `addElements` — send pre-rendered Excalidraw elements (DSL pipeline)
- `showMermaidPreview` — send Mermaid syntax for native preview (Mermaid pipeline)
- `renderMermaid` — convert Mermaid directly to Excalidraw elements (legacy/fallback)
- `clearCanvas` — reset canvas + switch back to Excalidraw view mode
- `zoomToFit` — auto-zoom after rendering
