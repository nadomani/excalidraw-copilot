# Contributing to Excalidraw Copilot

## Architecture

### Semantic DSL Pipeline
```
User Prompt → LLM (Thinking + Generation) → Semantic Graph JSON → Layout Engine → Excalidraw Elements → WebView
```

The LLM outputs **WHAT** (nodes, connections, groups, notes — no coordinates). The layout engine decides **WHERE**. The renderer decides **HOW** (colors, shapes, text).

### Key Files

| File | Purpose |
|------|---------|
| `src/dsl/types.ts` | TypeScript types for the semantic graph DSL |
| `src/dsl/prompt.ts` | System prompts with schema + examples for the LLM |
| `src/layout/engine.ts` | Grid layout, snake wrapping, connection routing, fan-out spread |
| `src/render/shapes.ts` | Converts positioned graph → Excalidraw elements (per-line text rendering) |
| `src/render/styles.ts` | Semantic color palette (7 colors × 3 shades each) |
| `src/llm/SemanticDiagramService.ts` | Two-pass LLM: think → generate, plus feedback refinement |
| `src/extension.ts` | Main entry: commands, folder analysis, feedback loop, model picker |
| `src/types/messages.ts` | WebView ↔ Extension message types (includes `addElements` batch) |
| `webview-ui/src/App.tsx` | React app embedding Excalidraw, handles messages |
| `src/webview/WebViewPanel.ts` | VS Code WebView panel management |

### Node Types
`service` (blue rect), `database` (green ellipse), `cache` (orange), `queue` (purple), `external` (gray dashed), `user` (info), `process` (yellow rect), `decision` (diamond), `note` (sticky), `group` (container)

### Semantic Colors
`primary` (blue), `secondary` (purple), `success` (green), `warning` (amber), `danger` (red), `info` (cyan), `neutral` (gray)

## Development Setup

```bash
git clone https://github.com/nadomani/excalidraw-copilot.git
cd excalidraw-copilot
npm install
npm run compile
# Press F5 in VS Code → launches Extension Development Host
# If "errors exist" dialog appears → click "Debug Anyway" (false alarm from DevSkim)
```

**Build:** `npm run compile` (webpack)  
**Watch:** `npm run watch`  
**Webview:** `cd webview-ui && npm run build`  

### Debug Tips
- Output panel: `Ctrl+Shift+U` → "Excalidraw Copilot" channel logs model name, node counts, errors
- WebView DevTools: `Ctrl+Shift+P` → "Developer: Open Webview Developer Tools"

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

### Rendering Zones (per node box, 140px medium height)
```
boxTop + 6-10:    Label (fontSize 18, color = border color, wraps to 2 lines max)
labelBottom + 2:  Emoji (fontSize 26)
boxBottom - desc: Description (fontSize 13, color #333333, max 3 lines, per-line rendered)
```

### LLM Prompts (`src/llm/SemanticDiagramService.ts`)
- **THINKING_PROMPT**: Plans diagram structure, decides type (process vs architecture), lists 5-8 elements
- **GENERATION_PROMPT**: Creates JSON with schema, examples, color guidance
- **refineDiagramWithFeedback()**: Sends current graph JSON + user feedback, asks for updated JSON only

## Known Issues

### 1. Arrow Mess on Complex Architecture Diagrams (Medium)
- When 20+ nodes with many cross-connections exist, arrows overlap and create visual clutter
- Fan-out spread helps for direct parent-child, but cross-layer connections still overlap
- **Fix ideas:** Arrow path-finding algorithm (A* avoiding node rects), or curved bezier arrows

### 2. Architecture Diagrams Less Rich Than Claude Desktop (Medium)
- Claude Desktop creates "boxes within boxes" — nested containers with inline text lists
- Our DSL only supports: nodes in a grid + groups as background rectangles
- **Root cause:** DSL limitation — no concept of "text list items within a group"
- **Fix:** Extend DSL with new element types (see Future Enhancements)

### 3. Visual Refinement Loop Disabled
- Originally: render → screenshot → LLM critique → improve
- Caused bugs (empty boxes appearing after refinement)
- Currently disabled in extension.ts

### 4. Excalidraw Text Rendering Quirks (Documented)
- Excalidraw IGNORES the `width` property for standalone text (containerId: null) — it auto-sizes
- `containerId`/`boundElements` binding doesn't work reliably with sequential `addElement` calls
- **Solution in place:** Per-line rendering — each line is a separate text element, positioned manually
- Any future text changes MUST use per-line rendering or binding will break

## Future Enhancements

### Priority 1: Architecture Diagram Quality
1. **Extend DSL with "list items"** — new element type for text-only items inside groups
2. **Add `fontFamily: 3` option** — monospace font for architecture diagrams
3. **Tighter group rendering** — groups should feel like visual containers
4. **Separate architecture prompts** — dedicated prompts for architecture vs process

### Priority 2: Arrow Routing
1. **A* pathfinding** — route arrows around node rectangles
2. **Curved arrows** — Excalidraw supports bezier curves
3. **Arrow labels** — render connection labels along the arrow path
4. **Arrow color by semantic** — dashed=optional, solid=required, red=critical path

### Priority 3: More Visualization Types
1. **Sequence diagrams** — vertical timeline with participant swim-lanes
2. **Class diagrams** — UML-style with methods/properties
3. **ER diagrams** — entity-relationship with cardinality labels
4. **Mind maps** — radial layout from center
5. **Diagram type picker** — let user choose visualization style

### Priority 4: Polish
1. **Re-enable visual refinement** — fix the screenshot→critique→improve loop
2. **Export options** — save as PNG, SVG, or .excalidraw file
3. **Undo in feedback loop** — "go back to previous version"
4. **Remember model choice** — persist model selection across sessions
5. **Better progress** — show actual LLM streaming progress

### Priority 5: Code Intelligence
1. **Deeper file analysis** — read full files, understand call graphs
2. **Multi-project support** — analyze multiple related repos
3. **Live updates** — watch for file changes and suggest diagram updates
4. **Language server integration** — use VS Code symbol info for accurate detection
