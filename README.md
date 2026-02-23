# Excalidraw Copilot 🎨

A VS Code extension that generates beautiful diagrams from natural language using your GitHub Copilot subscription. No API keys needed.

## ✨ What It Does

Type a prompt like **"Draw the architecture of Twitter"** or **"How to make cheese step by step"** and get a visual Excalidraw diagram — then refine it conversationally.

### Process Diagrams
Great for recipes, tutorials, how-to guides — colorful numbered steps with emojis, snake layout, pro tips.

### Architecture Diagrams
Generates system architecture from descriptions or **real code analysis** — scans your project files, detects components, and diagrams the actual structure.

## 🚀 Quick Start

### 1. Clone & Open
```bash
git clone https://github.com/nadomani/excalidraw-copilot.git
cd excalidraw-copilot
npm install
code .
```

### 2. Build & Launch
Press **F5** in VS Code. This opens a new VS Code window with the extension loaded.

> If you see "errors exist after running preLaunchTask" — click **Debug Anyway** (it's a false alarm from DevSkim scanning other extensions).

### 3. Generate Your First Diagram
In the **new VS Code window**:
1. `Ctrl+Shift+P` → **"Excalidraw Copilot: Generate Diagram"**
2. Pick a model (Opus = best quality, Sonnet = fast)
3. Type your prompt
4. Watch the diagram render!
5. A feedback input appears — describe changes or press Escape

## 📋 Commands

| Command | How to Trigger |
|---------|---------------|
| **Generate Diagram** | `Ctrl+Shift+P` → "Generate Diagram" |
| **Diagram This Folder** | Right-click a folder in Explorer |
| **Diagram This File** | Right-click a file in Explorer, or right-click in the editor |
| **Open Canvas** | `Ctrl+Shift+P` → "Open Canvas" (blank canvas) |

## 🎯 Usage Guide

### Free-Text Prompts
```
Draw a microservices architecture with API gateway, user service, and PostgreSQL
Create a flowchart for user registration with email verification
How to make a latte step by step
Design the architecture of a real-time chat application
```

### Diagram Your Code
1. Open any project in the Extension Development Host window
2. Right-click a **folder** in Explorer → **"Excalidraw Copilot: Diagram This Folder"**
3. The extension scans your code:
   - File structure and roles (controllers, services, models)
   - Import/dependency graph
   - External services (databases, caches, queues)
   - HTTP endpoints
   - Docker/infrastructure files
4. Sends the analysis to the LLM to generate an architecture diagram

### Diagram a Single File
1. Right-click a **file** → **"Excalidraw Copilot: Diagram This File"**
2. Shows classes, functions, relationships, and dependencies within that file

### Conversational Refinement (Ping-Pong)
After any diagram generates, an input box asks **"Any changes?"**:
```
"Add a caching layer between API and database"
"Step 3 is wrong, it should be pasteurize not boil"
"Remove the queue and connect directly"
"Make the auth service red and add OAuth in the description"
```
Press **Escape** when you're happy. Up to 10 refinement rounds.

### Model Selection
Every generation starts with a model picker:
- **Claude Opus** — Best quality, most detailed diagrams
- **Claude Sonnet** — Good balance of speed and quality
- **GPT-4o** — Fast, decent quality
- Other models available depending on your Copilot subscription

## 🏗️ Architecture

```
User Prompt → LLM (Think + Generate) → Semantic Graph JSON → Layout Engine → Excalidraw Elements → WebView
```

The LLM outputs a **semantic graph** (nodes, connections, groups, notes — no coordinates). The layout engine positions everything automatically. The renderer converts to Excalidraw elements.

### Semantic DSL
The LLM generates JSON like:
```json
{
  "title": "Twitter Architecture",
  "direction": "TB",
  "nodes": [
    {"id": "gateway", "type": "service", "label": "API Gateway", "emoji": "🚪", "semanticColor": "primary"},
    {"id": "redis", "type": "cache", "label": "Redis Cache", "emoji": "⚡", "semanticColor": "warning"}
  ],
  "connections": [
    {"from": "gateway", "to": "redis", "style": "dashed"}
  ]
}
```

### Node Types
`service` (blue), `database` (green), `cache` (orange), `queue` (purple), `external` (gray), `user` (cyan), `process` (yellow), `decision` (red diamond)

### Semantic Colors
`primary` (blue), `secondary` (purple), `success` (green), `warning` (amber), `danger` (red), `info` (cyan), `neutral` (gray)

## 🔧 Development

### Build
```bash
npm install
npm run compile        # One-time build
npm run watch          # Auto-rebuild on changes
```

### Webview (React/Excalidraw)
```bash
cd webview-ui
npm install
npm run build          # Build webview
npm run dev            # Dev mode with hot reload
```

### Project Structure
```
src/
  extension.ts           # Main entry, commands, folder analysis, feedback loop
  dsl/
    types.ts             # Semantic graph types
    prompt.ts            # LLM system prompts
  layout/
    engine.ts            # Grid layout, snake wrapping, arrow routing
  render/
    shapes.ts            # Excalidraw element generation
    styles.ts            # Color palette
  llm/
    SemanticDiagramService.ts  # LLM two-pass generation + refinement
  webview/
    WebViewPanel.ts      # VS Code WebView panel management
  types/
    messages.ts          # WebView ↔ Extension message protocol
webview-ui/
  src/App.tsx            # React app with Excalidraw
```

## 🐛 Troubleshooting

**"GitHub Copilot is not available"**
- Install the GitHub Copilot extension
- Sign in to GitHub in VS Code
- Make sure your Copilot subscription is active

**Canvas not loading**
- Check Output panel: `Ctrl+Shift+U` → "Excalidraw Copilot"
- Open WebView DevTools: `Ctrl+Shift+P` → "Developer: Open Webview Developer Tools"

**Diagram looks wrong**
- Use the feedback loop: "move X to the right", "make Y bigger"
- Try a different model (Opus produces best results)
- Check the Output channel for the generated JSON

**Build errors on F5**
- Run `npm run compile` manually to see actual errors
- The "preLaunchTask errors" dialog is usually a false alarm — click "Debug Anyway"

## 📄 License

MIT
