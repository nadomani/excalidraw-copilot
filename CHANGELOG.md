# Changelog

All notable changes to this project will be documented in this file.

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
