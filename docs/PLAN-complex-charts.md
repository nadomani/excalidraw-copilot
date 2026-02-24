# Excalidraw Copilot — Enhancement Plan: Dual Pipeline

## Branch: `enhance/complex-charts`

## Problem
Architecture diagrams with 20+ nodes have messy arrows, no nesting, and are less rich than Claude Desktop.
Process diagrams (coffee, recipes, etc.) already look great with the current DSL pipeline.

## Approach
Add a **Mermaid pipeline** for architecture diagrams alongside the existing DSL pipeline:
- **Process diagrams** → Current DSL path (LLM → JSON → our layout → Excalidraw)
- **Architecture diagrams** → Mermaid path (LLM → Mermaid syntax → `mermaid-to-excalidraw` → Excalidraw)

## Architecture
```
Extension Host (Node.js)                    Webview (Browser/React)
─────────────────────────                   ───────────────────────
User prompt
  ↓
LLM detects type
  ↓
[PROCESS] → DSL JSON → layout → elements ──→ addElements → Excalidraw
[ARCHITECTURE] → Mermaid syntax ───────────→ renderMermaid → mermaid-to-excalidraw → Excalidraw
```

## Tasks
1. Install `@excalidraw/mermaid-to-excalidraw` in webview-ui/
2. Add `renderMermaid` message type in messages.ts
3. Create Mermaid LLM prompt for architecture in SemanticDiagramService
4. Handle `renderMermaid` in webview App.tsx (depends on 1, 2)
5. Route architecture→Mermaid, process→DSL in extension.ts (depends on 2, 3)
6. Adapt feedback loop for Mermaid syntax (depends on 5)
7. Test both pipelines side by side (depends on 4, 5, 6)

## Risks
- `mermaid-to-excalidraw` only fully supports flowcharts natively; sequence/class may fall back to images
- Mermaid subgraphs may not look as polished as hand-crafted DSL groups
- Need to verify library works in VS Code webview context (CSP restrictions?)
