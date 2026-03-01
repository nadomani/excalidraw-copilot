# Excalidraw Copilot 🎨

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/nadomani.excalidraw-copilot?label=VS%20Code%20Marketplace&logo=visual-studio-code&color=blue)](https://marketplace.visualstudio.com/items?itemName=nadomani.excalidraw-copilot)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/nadomani.excalidraw-copilot?color=brightgreen)](https://marketplace.visualstudio.com/items?itemName=nadomani.excalidraw-copilot)
[![GitHub stars](https://img.shields.io/github/stars/nadomani/excalidraw-copilot?style=social)](https://github.com/nadomani/excalidraw-copilot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A VS Code extension that generates beautiful, editable diagrams from natural language using your GitHub Copilot subscription. No API keys needed — just describe what you want.

> ⭐ **If you find this useful, [star the repo](https://github.com/nadomani/excalidraw-copilot) — it helps others discover it!**

## ✨ Features at a Glance

- 💬 **`@excalidraw` Chat Participant** — type `@excalidraw` in Copilot Chat and just describe what you want
- 🗣️ **Natural language → Diagram** — describe it, see it
- 📂 **Code-aware** — right-click any folder or file, or use `/folder`, `/file`, `/project` in chat
- 🔄 **Conversational refinement** — follow-up messages refine the diagram in-place
- 🧜 **Dual pipeline** — Mermaid for architecture, Semantic DSL for processes — auto-detected or use `--mermaid`/`--dsl`
- 📊 **Sequence diagrams** — ask for one directly or convert any diagram via refinement
- 🔍 **Mermaid zoom, pan & export** — Ctrl+Scroll to zoom, export as SVG or PNG
- 🤖 **Model picker** — choose any Copilot model from the Chat panel or Command Palette
- 🧠 **Smart project detection** — type "diagram this project" and it auto-analyzes your workspace
- ✏️ **Fully editable** — every diagram lands on an Excalidraw canvas you can hand-edit

> **💡 Model tip:** For architecture/process diagrams, use **Sonnet** or **GPT-4o** — they produce cleaner, more readable layouts. **Opus** shines on detailed process flows and step-by-step tutorials where extra detail is a plus.

## 📸 See It in Action

### Chat Participant — `@excalidraw` in Copilot Chat

> Type `@excalidraw` directly in the Copilot Chat panel — no command palette needed.

#### 1. Type `@excalidraw` and see all available slash commands
![Slash Commands](media/chat-slash-commands.png)

#### 2. Type your prompt — e.g. `@excalidraw How do LLMs work?`
![Chat Prompt](media/chat-prompt-input.png)

#### 3. Watch the progress stream in the chat panel
![Planning](media/chat-progress-planning.png)
![Creating](media/chat-progress-creating.png)

#### 4. Get a beautiful DSL process diagram on the Excalidraw canvas
![DSL Result](media/chat-dsl-result-llm.png)

#### 5. Followup suggestions appear — click one or type your own refinement
![Followup Suggestions](media/chat-followup-suggestions.png)

#### 6. Use `/architecture` to force the Mermaid pipeline
![Architecture Command](media/chat-architecture-command.png)

#### 7. Mermaid pipeline — clean layered architecture with subgraphs
![Mermaid Architecture](media/chat-mermaid-architecture.png)

#### 8. Refine the Mermaid diagram — "change to sequence diagram"
![Refine to Sequence](media/chat-refine-to-sequence.png)

#### 9. The result: a detailed Mermaid sequence diagram showing component interactions
![Sequence Diagram Result](media/chat-sequence-diagram-result.png)

#### 10. Use `/diagram` to force the Semantic DSL pipeline
![Diagram Command](media/chat-diagram-command.png)

#### 11. DSL pipeline — rich process diagram with emojis, colors, and pro tips
![DSL Elasticsearch](media/chat-dsl-result-elasticsearch.png)

#### 12. Refine by typing follow-up messages — "Add more details to diagram"
![Refinement Input](media/chat-refinement-input.png)

#### 13. Refined diagram with additional detail, groups, and architecture notes
![Refinement Result](media/chat-refinement-result.png)

#### 14. Use `--dsl` or `--mermaid` flags to override any command's default pipeline
![Folder DSL Flag](media/chat-folder-dsl-flag.png)
![Folder Mermaid Flag](media/chat-folder-mermaid-flag.png)

#### 15. Use `/file` with a `#file` reference to diagram a specific file
![File Command](media/chat-file-command.png)

#### 16. Use `/project` to diagram the entire workspace architecture
![Project Command](media/chat-project-command.png)

#### 17. Use `/new` to start a fresh diagram (ignores previous conversation)
![New Command](media/chat-new-command.png)

#### 18. Ask any question — even general knowledge — and get a visual diagram
![General Question](media/chat-general-question.png)

#### 19. The result: a beautiful step-by-step process with emojis, colors, and pro tips
![Milk Process Result](media/chat-milk-process-result.png)

#### 20. Contextual followup suggestions adapt to the diagram topic
![Contextual Followups](media/chat-contextual-followups.png)

### Right-Click & Command Palette (Classic Flow)

### 1. Open the Command Palette and launch "Generate Diagram"
![Command Palette](media/01-command-palette.png)

### 2. Type your prompt — any question or design request
![Prompt Input](media/02-prompt-input.png)

### 3. Pick your LLM model
![Model Picker](media/03-model-picker.png)

### 4. Get a beautiful process diagram (DSL pipeline)
![DSL Process Diagram](media/04-dsl-process-diagram.png)

### 5. Refine with conversational feedback
![Feedback Loop](media/05-feedback-loop.png)

### 6. Try an architecture prompt — "Design Twitter"
![Architecture Prompt](media/06-architecture-prompt.png)

### 7. DSL pipeline — rich vertical architecture with emojis, colors, and pro tips
![DSL Twitter Architecture](media/07-dsl-twitter-architecture.png)

### 8. Mermaid pipeline — clean layered architecture with subgraphs
![Mermaid Twitter Architecture](media/08-mermaid-twitter-architecture.png)

### 9. Right-click any file → "Diagram This File"
![Right-click File](media/09-right-click-file.png)

### 10. Right-click any folder → "Diagram This Folder" or "Diagram This Project"
![Right-click Folder](media/10-right-click-folder.png)

### 11. Full project architecture from real code analysis
![Project Diagram](media/11-project-diagram.png)

### 12. Sequence diagrams — just ask for one!
![Sequence Diagram](media/12-sequence-diagram.png)

---

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/nadomani/excalidraw-copilot.git
cd excalidraw-copilot
npm install
cd webview-ui && npm install && cd ..
```

### 2. Build & Launch
Press **F5** in VS Code. This opens an Extension Development Host window with the extension loaded.

> If you see "errors exist after running preLaunchTask" — click **Debug Anyway** (it's a false alarm from DevSkim).

### 3. Generate Your First Diagram
In the **Extension Development Host** window:

**Option A — Chat Participant:**
1. Open the Copilot Chat panel (`Ctrl+Shift+I`)
2. Type `@excalidraw design a microservices architecture`
3. The diagram generates and opens automatically

**Option B — Command Palette:**
1. `Ctrl+Shift+P` → **"Excalidraw Copilot: Generate Diagram"**
2. Pick a model (Opus = best quality, Sonnet = fast)
3. Choose a pipeline (Mermaid or Semantic DSL)
4. Type your prompt — watch the diagram render!
5. A feedback popup appears — describe changes or press Escape to finish
6. If you close the popup, a **"Continue Refining"** button lets you re-enter anytime

## 💬 Chat Participant (`@excalidraw`)

Type `@excalidraw` in the **Copilot Chat panel** to generate diagrams conversationally. The model is selected from the Chat panel's model dropdown — no QuickPick needed.

### Slash Commands

| Command | Example | What It Does |
|---------|---------|--------------|
| *(none)* | `@excalidraw design a Twitter architecture` | Auto-detects the best pipeline and generates a diagram |
| `/new` | `@excalidraw /new coffee brewing process` | Start a fresh diagram (ignores previous conversation) |
| `/diagram` | `@excalidraw /diagram how cheese is made` | Force the **Semantic DSL** pipeline |
| `/architecture` | `@excalidraw /architecture microservices with API gateway` | Force the **Mermaid** pipeline |
| `/file` | `@excalidraw /file #file:src/server.ts` | Diagram a file's internal structure (classes, functions, imports) |
| `/folder` | `@excalidraw /folder src/api` | Diagram a folder's architecture (scans code, dependencies, imports) |
| `/project` | `@excalidraw /project` | Diagram the entire workspace project |

### Pipeline Override (`--mermaid` / `--dsl`)

By default, `/file` uses DSL and `/folder`/`/project` use Mermaid. Override with a flag:

```
@excalidraw /folder src/models --dsl         → DSL instead of Mermaid
@excalidraw /project --dsl                   → DSL instead of Mermaid
@excalidraw /file --mermaid #file:server.ts  → Mermaid instead of DSL
@excalidraw draw a coffee process --mermaid  → force Mermaid on free-text
```

No flag = sensible default for that command.

### Conversational Refinement

After generating a diagram, just keep typing — follow-up messages automatically refine the current diagram:

```
User: @excalidraw design a microservices architecture
Bot:  ✅ Diagram ready! 8 nodes, 7 connections
      💬 Type any changes you want or use /new to start fresh.

User: add a caching layer between API and database
Bot:  ✅ Diagram updated!

User: /new how to make cheese step by step
Bot:  ✅ Diagram ready! (fresh diagram, previous one ignored)
```

Followup suggestions are **contextual** — architecture diagrams suggest things like "Add a caching layer", while recipe/process diagrams suggest things like "Add ingredient quantities".

## 📋 Commands (Right-Click & Command Palette)

The classic flow uses the Command Palette and right-click context menus. It includes a model picker and pipeline picker (QuickPick dialogs).

| Command | How to Trigger | What It Does |
|---------|---------------|--------------|
| **Generate Diagram** | `Ctrl+Shift+P` → "Generate Diagram" | Free-text prompt → diagram |
| **Diagram This Folder** | Right-click folder in Explorer | Scans that folder's code, generates architecture |
| **Diagram This Project** | Right-click folder / `Ctrl+Shift+P` | Scans entire workspace, full project architecture |
| **Diagram This File** | Right-click file in Explorer / editor | Diagrams a file's internal structure |
| **Open Canvas** | `Ctrl+Shift+P` → "Open Canvas" | Opens a blank Excalidraw canvas |

## 🎯 Complete Usage Guide

> **Two ways to use Excalidraw Copilot:**
> 1. **Chat Participant** — type `@excalidraw` in the Copilot Chat panel. See the [Chat Participant section](#-chat-participant-excalidraw) above.
> 2. **Command Palette / Right-click** — classic flow with QuickPick dialogs. Detailed below.

### Free-Text Prompts
Type anything — the extension figures out the best approach:
```
Draw the architecture of Twitter
How to make cheese step by step
Create a flowchart for user registration with email verification
Design a microservices system with API gateway and message queue
```

### Smart Project Detection
Type prompts like **"diagram this project"** or **"show the architecture of this app"** in the prompt bar — the extension automatically scans your open workspace (files, dependencies, imports) and passes the real analysis to the LLM. No need to right-click.

### Diagram Your Code (Folder)
1. Right-click any **folder** in Explorer → **"Excalidraw Copilot: Diagram This Folder"**
2. The extension deep-scans that folder's code:
   - **File structure** and directory layout
   - **Component roles** — entry points, controllers, services, models, components, state/stores, utilities
   - **Import/dependency graph** — who imports whom
   - **External services** — databases (PostgreSQL, MongoDB, Redis), queues (Kafka, RabbitMQ), cloud services
   - **HTTP endpoints** — REST routes detected from code
   - **Frameworks** — React, Express, NestJS, .NET, Flask, and more
   - **Infrastructure** — Dockerfile, docker-compose analysis
3. Supports: `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.cs`, `.java`, `.go`
4. The analysis is sent to the LLM — you get a diagram of your **actual** codebase, not a generic template

### Diagram Entire Project
1. Right-click any **folder** → **"Excalidraw Copilot: Diagram This Project"** (or use Command Palette)
2. Always scans the **entire workspace root** — gives you the full project architecture with all layers, components, and connections
3. Great for getting a high-level overview of a new codebase

### Diagram a Single File
1. Right-click a **file** → **"Excalidraw Copilot: Diagram This File"**
2. Shows classes, interfaces, functions, inheritance, method calls, and external dependencies

### Sequence Diagrams
The Mermaid pipeline supports sequence diagrams out of the box. Three ways to get one:
1. **From chat** — type `@excalidraw /architecture draw a sequence diagram of user authentication with JWT`
2. **From scratch** — use "Generate Diagram", type a prompt like *"Draw a sequence diagram of user authentication with JWT"*, and pick the **Mermaid** pipeline
3. **Via refinement** — after any diagram, type *"now show this as a sequence diagram"* — works in both chat and the Command Palette feedback loop

Great for showing interactions between components, API call flows, and request/response patterns.

### Conversational Refinement
After every diagram, you can refine by describing changes:
```
"Add a caching layer between API and database"
"Step 3 is wrong — it should be pasteurize not boil"
"Remove the queue and connect directly"
"Add a step after step 2 for validation"
"Group all the databases together"
```

**In Chat:** just keep typing — follow-up messages automatically refine the current diagram. Use `/new` to start fresh.

**In Command Palette:** a feedback popup appears after each diagram:
- Up to **10 refinement rounds** per session
- Press **Escape** to finish — a **"Continue Refining"** notification lets you re-enter the loop anytime
- Step numbers are **automatically renumbered** when you add or remove steps

### Model Selection
**In Chat:** select the model from the Chat panel's model dropdown (top of the chat window).

**In Command Palette:** a model picker appears before each generation:
- **Claude Sonnet** — ⭐ Recommended for architecture diagrams. Clean, well-structured output
- **GPT-4o** — ⭐ Also great for architecture. Fast and produces readable layouts
- **Claude Opus** — Best for detailed process diagrams and step-by-step flows. Can be *too* detailed for architecture (many nodes/connections), so prefer Sonnet or GPT-4o for system design
- Any other model available through your Copilot subscription

> **💡 Tip:** For architecture diagrams ("Design Twitter", "Diagram this project"), use **Sonnet** or **GPT-4o** — they produce cleaner, more readable layouts. Save **Opus** for detailed process flows and tutorials where extra detail is a plus.

### Pipeline Selection (Mermaid vs DSL)
**In Chat:** auto-detected from the prompt, or forced with `/architecture`, `/diagram`, `--mermaid`, `--dsl`.

**In Command Palette:** after choosing a model, you pick a **rendering pipeline**. The extension recommends one based on your prompt:

| | 🎨 Semantic DSL | 🧜 Mermaid |
|--|-----------------|-----------|
| **Best for** | Process diagrams, recipes, tutorials | Architecture diagrams, system design |
| **Output** | Editable Excalidraw shapes | Native Mermaid preview → convert to Excalidraw |
| **Detail** | 15-30 nodes with emojis, colors, descriptions, pro tips | 15-25 nodes with subgraphs, clean layers |
| **Speed** | ~30-40 sec | ~15-20 sec |
| **Layout** | Custom grid engine with snake wrapping | Mermaid's dagre layout engine |
| **Colors** | Rich semantic palette (7 colors × 3 shades) | Per-node style directives (6 color categories) |

### Mermaid Preview Mode
When using the Mermaid pipeline, diagrams render as **native Mermaid** first (better layout and arrow routing than direct conversion). The preview includes:

- **Zoom** — `Ctrl+Scroll` to zoom in/out, or use the `+`/`−` buttons
- **Pan** — `Alt+Drag` or middle-click drag to pan around
- **Reset** — Click the `%` label or `⊡` button to reset zoom and pan
- **Export SVG** — Download the diagram as a vector SVG file
- **Export PNG** — Download as a high-resolution PNG (2× for crisp output)
- **Convert to Excalidraw** — Click the green button to convert to editable Excalidraw elements

### DSL Internals (For the Curious)
The Semantic DSL pipeline generates a JSON graph:
```json
{
  "title": "Twitter Architecture",
  "direction": "TB",
  "nodes": [
    {"id": "gateway", "type": "service", "label": "API Gateway", "emoji": "🚪", "semanticColor": "primary"},
    {"id": "redis", "type": "cache", "label": "Redis Cache", "emoji": "⚡", "semanticColor": "warning"}
  ],
  "connections": [{"from": "gateway", "to": "redis", "style": "dashed"}]
}
```

**Node types:** `service` (blue), `database` (green), `cache` (orange), `queue` (purple), `external` (gray), `user` (cyan), `process` (yellow), `decision` (red diamond)

**Semantic colors:** `primary` (blue), `secondary` (purple), `success` (green), `warning` (amber), `danger` (red), `info` (cyan), `neutral` (gray)

## 🔧 Development

### Build
```bash
npm install
npm run compile        # Build extension (webpack)
npm run watch          # Auto-rebuild on changes
```

### Webview (React/Excalidraw)
```bash
cd webview-ui
npm install
npm run build          # Production build (vite)
npm run dev            # Dev mode with hot reload
```

### Project Structure
```
src/
  extension.ts              # Commands, pipeline routing, feedback loops
  chat/
    ChatParticipant.ts      # @excalidraw Chat Participant — slash commands, refinement
  analysis/
    folderAnalysis.ts       # Folder/file/project analysis, prompt builders, role detection
  llm/
    SemanticDiagramService.ts  # Two-pass LLM generation (think → generate), refinement, Mermaid prompts
  dsl/
    types.ts                # Semantic graph types (nodes, connections, groups)
    prompt.ts               # LLM system prompts with schema + examples
  layout/
    engine.ts               # Grid layout, snake wrapping, arrow routing
  render/
    shapes.ts               # Semantic graph → Excalidraw elements
    styles.ts               # Color palette (7 colors × 3 shades)
  execution/
    StateManager.ts         # Canvas state management
  webview/
    WebViewPanel.ts         # VS Code WebView panel management
  types/
    messages.ts             # Extension ↔ WebView message protocol
webview-ui/
  src/
    App.tsx                 # React app: Excalidraw canvas + Mermaid preview mode
    hooks/useMessageBridge.ts  # WebView ↔ Extension messaging hook
docs/                       # Plans and design documents
```

## 🐛 Troubleshooting

**"GitHub Copilot is not available"**
- Install the GitHub Copilot extension
- Sign in to GitHub in VS Code
- Make sure your Copilot subscription is active

**Canvas not loading**
- Check Output panel: `Ctrl+Shift+U` → "Excalidraw Copilot"
- Open WebView DevTools: `Ctrl+Shift+P` → "Developer: Open Webview Developer Tools"

**Diagram shows generic architecture (not my project)**
- Use right-click → "Diagram This Folder" for code-aware analysis
- Or type `@excalidraw /project` in Chat, or "diagram this project" in the prompt bar — it auto-detects and scans your workspace
- Check the Output channel for `Project prompt detection: true`

**Diagram looks wrong or incomplete**
- Use the feedback loop to refine: *"move X to the right"*, *"add Y"*
- Try a different model (Opus produces the most detailed results)
- Try the other pipeline (Mermaid vs DSL) for a different perspective
- Check the Output channel for the generated graph/Mermaid

**Mermaid preview not rendering**
- Open WebView DevTools to check for console errors
- Check the Output channel for the generated Mermaid syntax

**Build errors on F5**
- Run `npm run compile` manually to see actual errors
- The "preLaunchTask errors" dialog is usually a false alarm — click **Debug Anyway**

## ⚠️ Known Limitations

- **Mermaid → Excalidraw conversion quality** — The "Convert to Excalidraw" button uses the third-party [`@excalidraw/mermaid-to-excalidraw`](https://github.com/excalidraw/mermaid-to-excalidraw) library, which can produce degraded arrow routing, overlapping labels, and spacing issues compared to the native Mermaid preview. For best visual results, use the **Mermaid preview mode** (with zoom, pan, and SVG/PNG export) and only convert to Excalidraw when you need to hand-edit individual elements.
- **Complex DSL diagrams (20+ nodes)** — Arrow overlaps can occur on dense diagrams with many cross-layer connections. Use the feedback loop to simplify or regroup.
- **LLM variability** — Results vary by model. Claude Opus produces the most detailed and accurate diagrams. Smaller models may oversimplify or hallucinate components.

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for architecture details, development setup, and known issues to work on.

Check out the [open issues](https://github.com/nadomani/excalidraw-copilot/issues) — look for the `good first issue` label if you're new.

## 📄 License

MIT

---

<p align="center">
  Made with ❤️ for developers who think visually.<br/>
  <a href="https://github.com/nadomani/excalidraw-copilot">⭐ Star on GitHub</a> · <a href="https://marketplace.visualstudio.com/items?itemName=nadomani.excalidraw-copilot">📦 Install from Marketplace</a>
</p>
