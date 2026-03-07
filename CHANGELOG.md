# Changelog

All notable changes to this project will be documented in this file.

## [0.5.0] — 2026-03-07

### Added
- **Auto-Save Diagrams** — every generated diagram automatically saves as an `.excalidraw` file in `.excalidraw-copilot/` (configurable via `excalidraw-copilot.autoSave` setting)
- **Diagram Gallery** — dedicated Activity Bar panel showing all saved diagrams with prompt, pipeline, and relative timestamp
- **Gallery Actions** — right-click context menu: Open, Delete, Rename, Reveal in Explorer, Refine Diagram
- **Refine Saved Diagrams** — reopen any saved diagram and iterate on it; DSL refinement uses stored graph, Mermaid refinement uses stored syntax
- **Gallery auto-reveal** — gallery panel auto-focuses after first save with a one-time notification
- **Custom Editor** — double-click `.excalidraw` files to open them in Excalidraw Copilot
- **Refinement auto-save** — popup loop and chat refinement both auto-save results
- **"Refine Diagram" command** — gallery context menu option that opens diagram + focuses chat
- **Git integration** — asks once whether to add `.excalidraw-copilot/` to `.gitignore`
- **`.excalidraw` file format** — stores elements, graph (DSL), mermaidSyntax, and metadata for full round-trip refinement

### Changed
- Gallery refinement saves as a `-refined` copy (original preserved); fresh generation refinement overwrites the same file
- Filenames now use name-first format: `{prompt-slug}_{timestamp}.excalidraw` (previously timestamp-first)
- Gallery label shows filename (not prompt) so renamed files display correctly
- Mermaid auto-save stores syntax directly instead of empty Excalidraw canvas
- Chat DSL auto-save now passes graph JSON for future refinement support

### Fixed
- **Mermaid auto-save empty canvas** — Mermaid renders as SVG overlay, not Excalidraw elements; auto-save now stores Mermaid syntax directly
- **getCanvasState() race condition** — concurrent calls overwrote handler; fixed with queue pattern
- **Filename collision** — minute-precision timestamps caused collisions; fixed with second-precision
- **galleryProvider disposal leak** — wasn't in context.subscriptions; now properly disposed
- **Duplicate files on refinement** — tracked saved URI so refinement overwrites instead of creating new files each time

## [0.4.0] — 2026-03-02

### Added
- **Diagram from Code Selection** — select code in the editor, right-click → "Diagram This Selection" to generate a diagram of the selected code
- **`/selection` slash command** — use `@excalidraw /selection` in chat to diagram selected code with `--mermaid`/`--dsl` override support
- **Language-aware selection prompt** — auto-detects TypeScript, Python, Go, Java, C#, etc. for better prompts

### Fixed
- **Decision diamond text overflow** — diamond nodes now use a dedicated `createDecisionTextElements()` layout with centered text in the inscribed area
- **Decision diamond sizing** — diamonds use 1.15× multiplier instead of oversized 1.5×
- **Decision diamond arrows** — connections use cardinal points (center top/bottom/left/right) instead of fan-spread offsets that placed arrows in empty space
- **Followup suggestions after `/new`** — clicking a followup after `/new` no longer starts a fresh diagram; suggestions now set explicit `command: 'diagram'` to route through refinement
- **Uniform rectangle width** — removed dynamic label-based widening; all rectangles use consistent base size per importance tier
- **Selection prompt project detection** — `isProjectPrompt()` now skips selection prompts (guards against false positives from code containing words like "structure" or "service")

## [0.3.0] — 2026-03-01

### Added
- **`@excalidraw` Chat Participant** — type `@excalidraw` in the Copilot Chat panel to generate diagrams conversationally
- **6 slash commands** — `/new`, `/diagram`, `/architecture`, `/file`, `/folder`, `/project`
- **Pipeline override flags** — `--mermaid` and `--dsl` flags work with any command to override the default pipeline
- **Conversational refinement in chat** — follow-up messages automatically refine the current diagram
- **`/new` command** — start a fresh diagram, bypassing refinement even when there's a previous diagram in history
- **Contextual followup suggestions** — followups change based on the diagram topic (architecture vs. recipe vs. process)
- **Smart project detection in chat** — typing "diagram this project" in chat auto-analyzes the workspace

### Changed
- Extracted analysis functions into `src/analysis/folderAnalysis.ts` for reuse by both flows
- Extracted chat handler into `src/chat/ChatParticipant.ts`
- Reduced `src/extension.ts` by ~384 lines of duplicated code
- Pipeline detection in chat uses original prompt text (not enriched), fixing false Mermaid detection
- Removed duplicate "Planning diagram structure..." progress message in chat flow

### Unchanged
- Right-click and Command Palette flows continue working as before

## [0.2.2] — 2026-02-28

### Changed
- Added GitHub badges (Marketplace, installs, stars, license) to README
- Added star-the-repo call-to-action to README
- Added Contributing section with link to good first issues
- Added GitHub issue templates (bug report, feature request, good first issue)
- Added FUNDING.yml for GitHub Sponsors
- Updated marketplace keywords: added `sequence-diagram`, `system-design`
- Added sequence diagram screenshots to README

## [0.2.1] — 2026-02-25

### Changed
- DSL pipeline now listed first in pipeline picker (recommended for most prompts)
- Updated marketplace keywords

## [0.2.0] — 2026-02-24

### Added
- **Dual pipeline** — Mermaid + Semantic DSL, user picks per prompt
- **Mermaid native preview** — renders as native Mermaid SVG before converting to Excalidraw
- **Mermaid zoom & pan** — Ctrl+Scroll zoom, Alt+Drag pan, reset button
- **Mermaid export** — Save as SVG or PNG (2× resolution)
- **Convert to Excalidraw** button — one-click conversion from Mermaid preview
- **Smart project detection** — prompts like "diagram this project" auto-analyze workspace
- **Diagram This Project** command — right-click or Command Palette to diagram the entire workspace architecture
- **Continue Refining** — notification button to re-enter the feedback loop after pressing Escape
- **Auto step renumbering** — inserting/removing steps in DSL automatically renumbers all labels
- **`.tsx`/`.jsx` support** — React components, stores, and JSX files now included in code analysis
- **Component & state/store role detection** — React components and Redux slices properly categorized
- **Broadened file analysis** — up to 50 files scanned per folder (was 30)
- **Pipeline recommendation** — Mermaid suggested for architecture, DSL for processes
- `.ai/` folder with architecture docs and conventions
- `CONTRIBUTING.md` with full developer reference
- `docs/PLAN-complex-charts.md` and `docs/PLAN-mermaid-editor.md`

### Fixed
- **False DB detection** — tightened patterns (Pool/Client/pg no longer false-positive)
- **`<br>` literal in Mermaid labels** — stripped in post-processing
- **DSL not rendering after Mermaid** — `clearCanvas` now resets viewMode
- **Workspace double-analysis** — right-click folder no longer re-analyzed at workspace root
- **LLM hallucinating generic architecture** — replaced specific example (PostgreSQL/Redis/S3) with abstract template

### Unchanged
- Process/recipe diagrams continue using the existing DSL pipeline

## [0.1.0] — 2026-02-23

### Added
- Initial release
- Embedded Excalidraw WebView canvas
- LLM integration via VS Code Copilot Language Model API
- Two-pass generation (Thinking → Generation)
- Model picker (Opus, Sonnet, GPT-4o, etc.)
- Process/recipe diagrams with snake layout
- Architecture diagrams with grid layout
- Folder analysis (200 files, import graph, role detection)
- File analysis (classes, functions, relationships)
- Conversational feedback loop (up to 10 rounds)
- Right-click context menus (Diagram Folder, Diagram File)
