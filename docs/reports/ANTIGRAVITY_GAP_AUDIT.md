# AJSON Studio — Gap Audit

Scope: branch `feature/json-tools-ui` (the `main` branch and the uploaded `ajson-studio-main` ZIP are an empty scaffold; `files.zip` is an unrelated greeting app).

**Reference products were NOT inspected.** Antigravity, Cursor and Claude Code are not installed in the build environment and no reference screenshots were compared. Nothing here is a visual-match claim.

## Verified (run in this environment)

| Item | Result |
| --- | --- |
| `tsc --noEmit`, `npm run build` | pass (baseline failed: 4 syntax errors + type errors) |
| `npm test` | 139/139 pass (14 new tests exercise real source: process-tree kill, path/symlink confinement, timeout, git parsing) |
| Chromium UI check (browser, no Electron) | menus open/close; terminal and AI show honest "desktop app required" states; Monaco renders offline; Problems tab shows real Monaco diagnostics |

## Fixed

- Compile errors (Header duplicate `return`, EditorTabs missing `</div>`, activity-view type mismatch).
- Fake terminal (scripted output incl. fabricated "96 tests passed") replaced by a real `CommandRunner` (cwd confined to project root, timeout, 2 MB output cap, tree kill) plus a `git status` service over IPC.
- Fake Problems / Output / Tests tabs replaced by Monaco markers, a real run log and parsed `npm test` output.
- Fake AI chat (timer + canned snippet) replaced by real `ai:sendMessage` with file/selection context and cancel handling.
- Fake model-settings modal (pre-filled key, always-"Success" test) replaced by real encrypted key save/remove.
- Hardcoded git branch, model label, "19" source-control badge, fake breadcrumb, fake "thinking" block, dead menu bar.
- Monaco was loaded from a CDN (breaks offline); now bundled locally with workers.

## Not implemented

Agent loop/Agent Manager, tool system with approvals, task artifacts, diff approve/reject on real changes, git stage/commit/branch UI, browser automation, MCP, worktree isolation, inline completions, streaming, conversation persistence, light theme, visual matching to any reference.

## Known issues / unverified

- Terminal/AI/git paths verified at service level and in a browser without Electron; not run inside Electron (no display).
- AI calls never exercised against a real provider (no credentials). Cancel discards the late result but does not abort the HTTP request.
- Terminal uses pipes, not a PTY (no interactive programs). Commands run with the user's privileges; no approval gate yet (required before any AI-initiated execution).
- OpenAI/Google model ids in `src/services/aiService.ts` are not verified against live APIs.
- AI chat renders Markdown literally (`**bold**`).
- Fonts still load from Google Fonts (fall back offline).
- `DiffReviewModal`, `MultiFileEditsModal`, `CodeExplanationModal`, `AiCodeGenOverlay` still contain hardcoded demo content and need real data sources.
- `AiPanel` settings view hardcodes the Anthropic provider.
- Existing tests mostly re-implement helpers inline rather than importing source.
