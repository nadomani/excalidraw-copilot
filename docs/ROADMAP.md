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

## 🥉 3. Save & Reopen as `.excalidraw` Files

**Impact:** 🔥🔥🔥🔥 — Turns "cool demo" into "daily tool"  
**Effort:** Small (0.5–1 day)

### Why
Currently, diagrams are ephemeral — close the tab and they're gone. Nobody builds a habit around a tool that loses their work. If diagrams save as `.excalidraw` files, users can:
- Version control diagrams alongside code
- Reopen and edit them later
- Share with teammates
- Open in excalidraw.com

### What
- Auto-save generated diagrams as `.excalidraw` files in the workspace
- Add "Save Diagram" and "Open Diagram" commands
- Support the standard Excalidraw JSON format
- Register as file editor for `.excalidraw` files

---

## 4. Diagram from Code Selection

**Impact:** 🔥🔥🔥 — Unique differentiator nobody else has  
**Effort:** Small (0.5 day)

### Why
Users often stare at a complex function or class and think "I wish I could see this visually." Right now they can diagram a whole file or folder — but not the 30 lines they're confused about. Select → right-click → "Diagram This" is the most natural developer gesture.

### What
- Add "Diagram This Selection" to the editor context menu
- Send selected code to the LLM with a structure-analysis prompt
- Works for functions, classes, code blocks, or any selection
- Auto-detects language for better prompts

---

## 5. Diagram Gallery (Session History)

**Impact:** 🔥🔥🔥 — Drives retention and daily use  
**Effort:** Medium (1–2 days)

### Why
After a week of use, users have generated 20 diagrams and can't find any of them. A gallery of past diagrams (with thumbnails) turns one-time users into daily users. Combined with `.excalidraw` file saving, this becomes a visual knowledge base.

### What
- Side panel showing thumbnail previews of recent diagrams
- Store diagrams in workspace `.excalidraw-copilot/` folder
- Click to reopen any past diagram
- Search/filter by prompt text
- "Regenerate" button to re-run with a different model

---

## Implementation Order

| Phase | Feature | Why this order |
|-------|---------|---------------|
| **Done** | Chat Participant | Biggest reach — puts us in front of every Copilot user |
| **Now** | Save as `.excalidraw` | Foundation for gallery + retention |
| **Then** | Streaming rendering | Polish that drives sharing and word-of-mouth |
| **Then** | Code selection | Unique feature for marketing differentiation |
| **Later** | Diagram gallery | Builds on saved files, drives daily use |
