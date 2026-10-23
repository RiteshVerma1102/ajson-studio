# AJSON Studio — Frontend Build Plan

## Audit Baseline (Phase 0) — 2026-10-21

### Stack Detected
| Item | Value |
|------|-------|
| Framework | React 18.3 + TypeScript 5.6 |
| Bundler | Vite 5.4 (web) + vite-plugin-electron 0.29 |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| Editor | Monaco Editor (`@monaco-editor/react` 4.7) |
| Icons | Lucide React 0.468 |
| Desktop | Electron 33 |
| Package manager | npm (package-lock.json present) |
| Branch | `feature/json-tools-ui` (new) |
| License | NOT FOUND — noted in README |

### Baseline TypeScript Check
- `npx tsc --noEmit` → exit 0, 0 errors ✅

### Working (baseline)
- App shell renders (IdeLayout, ActivityBar, Sidebar, Header, EditorTabs, MonacoEditor, BottomPanel, AiPanel, StatusBar)
- Resizable panels with pointer + keyboard handlers
- Monaco editor with syntax highlighting, tabs, find/replace
- Command palette (Ctrl+Shift+P)
- Toast notifications
- AI service types / validation (no real API calls)
- Electron IPC types defined

### Missing (what this build adds)
- Design tokens (css vars in tokens.css per spec)
- Theme switching (dark / light / system)
- JSON tool views (format, minify, validate, diff, schema, JSONPath, CSV)
- JSON-specific editor with live validation and tree view
- Templates panel, Settings panel
- Persistence (autosave to localStorage)
- AI panel JSON-specific task presets
- API Playground (fetch UI with honest CORS errors)
- Unit tests for all transforms

### Dependency Gap
- ajv (JSON Schema) — must install
- jsonpath-plus (JSONPath) — must install
- papaparse + @types/papaparse (CSV) — must install

---

## Phase Status Table

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Audit + baseline | Done |
| 1 | Design tokens + theme + app shell refactor | In Progress |
| 2 | JSON core editor (validate, format, minify, sort, tree, stats) | Todo |
| 3 | Settings, templates, persistence (localStorage) | Todo |
| 4 | Tools (diff, schema, CSV, TS types, JSONPath) | Todo |
| 5 | AI panel presets + API playground | Todo |
| 6 | Polish, a11y, responsive, large-file, tests | Todo |

---

## Incomplete / Blocked
- No LICENSE file in repo — user should add one.
- Electron IPC (window.ajsonAPI) unavailable in browser; all JSON tools are 100% client-side.
