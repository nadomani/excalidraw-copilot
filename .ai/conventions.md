# Coding Conventions

## TypeScript
- Strict mode enabled
- All types in `src/types/` or `src/dsl/types.ts`
- Union types for message protocols (discriminated unions on `type` field)

## Excalidraw Elements
- NEVER use `containerId`/`boundElements` text binding — it breaks with sequential adds
- Always use per-line text rendering (each line = separate text element)
- Dynamic box width: grows with label length, max 340px

## Layout
- Grid-based positioning (cellWidth: 360, cellHeight: 220)
- Snake layout for linear chains (alternating direction per row)
- Orthogonal Z-shaped arrows only — no diagonal arrows
- Fan-out spreading for multiple connections from one node

## LLM Integration
- Two-pass: THINKING prompt first, then GENERATION prompt
- Use VS Code Copilot Language Model API (`vscode.lm.selectChatModels`)
- Model picker before every generation
- Conversational feedback loop: up to 10 refinement rounds

## WebView
- React + Excalidraw in `webview-ui/`
- Built with Vite, output to `webview-ui/dist/`
- Communication via `postMessage` / `onDidReceiveMessage`

## Git
- Branch naming: `enhance/*`, `fix/*`, `feat/*`
- CHANGELOG.md tracks all versions
- Conventional-style commit messages
