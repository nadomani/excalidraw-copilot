# Feature Roadmap — Excalidraw Copilot

Ranked by impact on downloads, retention, and user experience.

---

## ✅ 1. Copilot Chat Participant (`@excalidraw`) — DONE

**Impact:** 🔥🔥🔥🔥🔥 — Single biggest growth lever  
**Status:** Implemented in v0.3.0

### What was built
- `@excalidraw` Chat Participant registered via `vscode.chat.createChatParticipant`
- 6 slash commands: `/new`, `/diagram`, `/architecture`, `/file`, `/folder`, `/project`
- Pipeline override with `--mermaid` / `--dsl` flags on any command
- Conversational refinement — follow-up messages refine the current diagram
- Contextual followup suggestions based on diagram topic
- Smart project detection from chat prompts
- Both flows (chat + right-click/command palette) are first-class

---

## 🥈 2. Streaming Diagram Rendering

**Impact:** 🔥🔥🔥🔥 — Turns a 30-second wait into a "wow" moment  
**Effort:** Medium (1–2 days)

### Why
The 30–40 second blank wait while the LLM generates is a UX killer. Users think it's frozen. If nodes appeared progressively as the LLM streams tokens, the same wait **feels instant**. This is the kind of visual magic that makes people record demos and share them.

### What
- Parse partial JSON/Mermaid as the LLM streams chunks
- For DSL: render nodes as they're parsed (even before connections)
- For Mermaid: show a "building..." preview that updates every few seconds
- Show a progress indicator with stage names

---

## ✅ 3. Save & Reopen as `.excalidraw` Files — DONE

**Impact:** 🔥🔥🔥🔥 — Turns "cool demo" into "daily tool"  
**Status:** Implemented in v0.5.0

### What was built
- Auto-save to `.excalidraw-copilot/` folder after every generation and refinement
- `excalidraw-copilot.autoSave` setting (default: true)
- DiagramStore module: save/load/list/delete/rename `.excalidraw` files
- `.excalidraw` files store elements, graph (DSL), mermaidSyntax, and metadata
- Custom editor: double-click `.excalidraw` files to open in Excalidraw panel
- Git integration: asks once whether to add `.excalidraw-copilot/` to `.gitignore`
- Filenames: `{prompt-slug}_{timestamp}.excalidraw`

---

## ✅ 4. Diagram from Code Selection — DONE

**Impact:** 🔥🔥🔥 — Unique differentiator nobody else has  
**Status:** Implemented in v0.4.0

### What was built
- "Diagram This Selection" in the editor right-click context menu (only appears when text is selected)
- `/selection` slash command in `@excalidraw` chat participant
- `buildSelectionAnalysisPrompt()` — language-aware prompt builder that sends selected code to the LLM
- Auto-detects language for better prompts (TypeScript, Python, Go, Java, C#, etc.)
- Works for functions, classes, code blocks, or any selection
- Pipeline override with `--mermaid` / `--dsl` flags
- Smart project detection skips selection prompts (won't override with workspace analysis)

---

## ✅ 5. Diagram Gallery (Session History) — DONE

**Impact:** 🔥🔥🔥 — Drives retention and daily use  
**Status:** Implemented in v0.5.0

### What was built
- Dedicated Activity Bar panel ("Excalidraw Diagrams") with file watcher
- Gallery lists all `.excalidraw` files with prompt, pipeline badge, and relative timestamp
- Gallery actions: Open, Delete, Rename, Reveal in Explorer, Refine Diagram
- Gallery auto-reveals after first save with one-time notification
- Refine saved diagrams: opens diagram + popup "Any changes?" (DSL uses stored graph, Mermaid uses stored syntax)
- Gallery refinement saves as `-refined` copy (original preserved)
- "Refine Diagram" context menu option opens diagram + focuses chat

---

## Implementation Order

| Phase | Feature | Why this order |
|-------|---------|---------------|
| **Done** | Chat Participant | Biggest reach — puts us in front of every Copilot user |
| **Done** | Code selection | Unique feature for marketing differentiation |
| **Done** | Save as `.excalidraw` | Foundation for gallery + retention |
| **Done** | Diagram gallery | Builds on saved files, drives daily use |
| **Next** | Streaming rendering | Polish that drives sharing and word-of-mouth |
