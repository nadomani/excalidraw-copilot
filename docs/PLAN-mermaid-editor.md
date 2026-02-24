# Enhancement Plan: Mermaid Editor with Excalidraw Export

## Branch: `enhance/complex-charts` (continuation)

## Concept
Two-phase workflow for architecture diagrams:
1. **Design phase (Mermaid):** LLM generates Mermaid → native preview with text editor. User refines via text edits or LLM feedback loop. Every change re-renders perfectly with Mermaid's layout engine.
2. **Polish phase (Excalidraw):** Click "Convert to Excalidraw" → diagram becomes editable Excalidraw elements. User can drag boxes, change colors, add notes, export.

## UX Flow
```
User prompt → Model picker → Pipeline picker (if Mermaid)
  → LLM generates Mermaid syntax
  → Webview shows: [Mermaid preview | Mermaid text editor]
  → User can:
      - Edit text directly (add nodes, rename, restructure)
      - Use feedback input box → LLM updates Mermaid → re-render
      - Click "✅ Convert to Excalidraw" → switch to Excalidraw canvas
  → Excalidraw mode: full visual editing (drag, resize, style)
```

## Architecture
```
Extension Host                          Webview
─────────────                          ──────────────────────────
LLM → Mermaid syntax ──────────────→  MermaidEditorPanel
                                        ├─ Split view:
                                        │   ├─ Left: Mermaid text editor (editable textarea)
                                        │   └─ Right: Live Mermaid render (mermaid.js)
                                        ├─ "Convert to Excalidraw" button
                                        └─ On convert: mermaid-to-excalidraw → Excalidraw canvas
```

## Implementation Tasks

### 1. mermaid-renderer
Add Mermaid.js renderer to webview for native SVG rendering.
- Install `mermaid` in webview-ui
- Create a `MermaidPreview` React component that renders Mermaid syntax to SVG
- Handle theme (light/dark) matching

### 2. mermaid-editor-panel
Create a split-view panel with text editor + live preview.
- Left: `<textarea>` with Mermaid syntax, monospace font, syntax highlighting (optional)
- Right: Live Mermaid SVG render (updates on text change with debounce)
- Bottom bar: "Convert to Excalidraw" button + "Regenerate with AI" button

### 3. webview-mode-switching
Support two modes in the webview: MermaidEditor mode and Excalidraw mode.
- New message types: `showMermaidEditor`, `convertToExcalidraw`
- `showMermaidEditor` → hide Excalidraw, show Mermaid editor with syntax
- `convertToExcalidraw` → user clicks button → run mermaid-to-excalidraw → switch to Excalidraw canvas
- Back button? "Edit Mermaid" to go back to text editing

### 4. extension-mermaid-flow
Update extension.ts Mermaid pipeline to use the new editor mode.
- After LLM generates Mermaid, send `showMermaidEditor` message (not `renderMermaid`)
- Feedback loop operates on Mermaid syntax (text from editor or LLM updates)
- User clicks "Convert to Excalidraw" in webview → webview handles conversion internally

### 5. mermaid-text-sync
Sync Mermaid text between webview editor and extension.
- Webview sends `mermaidTextChanged` message when user edits text
- Extension stores current Mermaid syntax for feedback loop
- LLM feedback updates → send updated syntax back to webview editor

### 6. convert-button
Implement the "Convert to Excalidraw" flow.
- Button in webview triggers conversion
- Uses parseMermaidToExcalidraw + convertToExcalidrawElements
- Switches webview from MermaidEditor mode to Excalidraw mode
- Post-process: text cleanup + fill styles (no spacing manipulation)

## Dependencies
- 1 → 2 → 3 → 4 → 5 → 6 (mostly sequential)

## Risks
- Mermaid.js is large (~2MB) — will increase webview bundle size
- Mermaid rendering in VS Code webview may have CSP issues
- Mode switching (Mermaid editor ↔ Excalidraw) needs careful state management
- Need to handle the case where user edits Mermaid and it becomes invalid syntax

## Notes
- The existing `renderMermaid` message type can stay as a fallback/quick mode
- The DSL pipeline (process diagrams) is unchanged
- This is architecture-diagram specific
