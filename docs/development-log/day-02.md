# Development Log — Day 02

**Date:** October 9, 2026  
**Objective:** Real File System, Project Explorer, File Operations, and Editor Integration  
**Phase:** Core File Management & Desktop Infrastructure  

---

## 1. Objective
Transform Ajson Studio from a static visual mockup into a real, functioning desktop development environment with local filesystem access, interactive project tree exploration, safe file CRUD operations, multi-tab state management, unsaved-change protection, and strict Electron IPC security boundaries.

---

## 2. Work Completed & Features Implemented

### 2.1 Native Directory Selection & Project Initialization
- Implemented `project:openFolder` IPC handler using Electron's native `dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })`.
- Added global `activeProjectRoot` tracking in the Electron main process.
- Implemented recursive directory tree scanning with sensible ignore lists (`node_modules`, `.git`, `dist`, `dist-electron`, `build`, `.vscode`, `out`, `.cache`).
- Added an empty project state in the UI prompting the user to open a folder when none is selected.

### 2.2 Production-Grade Project File Explorer (`src/components/FileExplorer.tsx`)
- Hierarchical tree rendering with expand/collapse states for folders.
- Clean file type iconography (TypeScript, JavaScript, Python, JSON, CSS, HTML, Markdown).
- Toolbar with one-click actions: **New File**, **New Folder**, **Refresh**, **Collapse All**, and **Open Folder**.
- Inline file/folder creation and in-place renaming with keyboard confirmation (`Enter`) and cancel (`Escape`).
- Context menu support on right-click for any item in the explorer.
- Destructive operation safety: Delete Confirmation Modal displaying item name and warning before deletion.

### 2.3 Real Monaco Editor Disk Synchronization
- Connected clicking supported files in the explorer to `window.ajsonAPI.fs.readFile`.
- Automatic language inference based on file extensions and canonical filenames (`package.json`, `tsconfig.json`, `Dockerfile`).
- Direct disk save on `Ctrl+S` / `Cmd+S` via `window.ajsonAPI.fs.saveFile`.
- Rejection of binary files (image/archive/executable extension checks + 512-byte null character header sniffing).
- Enforced a 5 MB maximum file-size limit for text editing.

### 2.4 Multi-Tab Management & Unsaved Changes Guard
- Normalized path identification for tabs to prevent duplicates.
- Real-time `isDirty` tracking comparing in-memory content against original saved content.
- Unsaved changes indicator (dot badge) on dirty tabs.
- Three-way close confirmation modal (**Save**, **Don't Save**, **Cancel**) preventing accidental data loss when closing a dirty tab.
- Active tab switching, previous/next tab fallback on tab closure, and scratchpad creation (`Ctrl+N`).

### 2.5 Security Architecture & Path Traversal Prevention
- `contextIsolation: true` and `nodeIntegration: false` maintained.
- Strict project root containment using `path.normalize`, `path.resolve`, and `fs.realpathSync`.
- Directory traversal attacks (`../`, `..\`, null bytes, encoded escapes) actively blocked.
- Symbolic link escape prevention: symlinks pointing outside the project root are filtered and blocked from modification/deletion.

---

## 3. Files Created & Changed

| File Path | Description of Changes |
| :--- | :--- |
| `electron/ipc/handlers.ts` | Added `project:openFolder`, `project:getTree`, `project:getRoot`, `file:read`, `file:write`, `fs:createFile`, `fs:createFolder`, `fs:rename`, `fs:delete`, with path containment and binary sniffer |
| `electron/preload/index.ts` | Exposed typed `project` and `fs` methods via `contextBridge.exposeInMainWorld('ajsonAPI', ...)` |
| `src/types/electron.d.ts` | Added complete TypeScript contracts for all Day 2 IPC payloads |
| `src/types/editor.ts` | Updated `EditorTab` with `originalContent?: string` and extended `SupportedLanguage` |
| `src/utils/fileUtils.ts` | Created language inference mapping, binary extension detection, and filename character validation |
| `src/components/FileExplorer.tsx` | Created interactive project explorer with toolbar, inline inputs, context menu, and delete modal |
| `src/components/Sidebar.tsx` | Replaced mockup tree with `FileExplorer` integration |
| `src/components/Header.tsx` | Connected active project name to the top breadcrumb |
| `src/App.tsx` | Orchestrated project folder state, multi-tab life-cycle, dirty tracking, save prompt modal, and shortcuts |
| `package.json` | Added `"test": "node --test tests/fileOperations.test.mjs"` |
| `tests/fileOperations.test.mjs` | Automated unit test suite verifying security, CRUD operations, binary detection, and tab state |
| `docs/development-log/day-02.md` | Created Day 2 development log |
| `Ajson_Studio_Project_Report.docx` | Generated Word document update covering all Day 2 technical documentation |

---

## 4. Tests Performed & Results

```
✔ Security: Path traversal attacks are strictly rejected (9.0419ms)
✔ Validation: Filename rules reject illegal characters and empty names (0.9511ms)
✔ Filesystem: Create, Rename and Safe Delete operations (29.2041ms)
✔ Binary Detection: Sniffs null bytes and distinguishes text from binaries (0.8141ms)
✔ Unsaved Changes & Tab State: Accurately computes dirty state and tab synchronization (1.1611ms)

Total Tests: 5 | Passed: 5 | Failed: 0 | Duration: 787ms
TypeScript Check (`tsc`): PASSED (0 errors)
Production Bundling (`vite build`): PASSED (1604 modules transformed, built in 1m 7s)
```

---

## 5. Errors Encountered & Fixed

1. **Unused Import (`TS6133`)**:
   - *Error*: `src/components/FileExplorer.tsx` imported `FileQuestion` from `lucide-react` without reading it.
   - *Fix*: Removed unused import from `FileExplorer.tsx`.
2. **Missing Property in Mock Data (`TS2741`)**:
   - *Error*: `sampleFiles.ts` lacked `originalContent` property on initial mock objects.
   - *Fix*: Made `originalContent?: string` optional in `EditorTab` interface.
3. **Stray Parameter in Test**:
   - *Error*: `fs.renameSync(newFile, raw => raw)` raised `ERR_INVALID_ARG_TYPE`.
   - *Fix*: Removed stray line from `tests/fileOperations.test.mjs`. All 5 tests passed immediately.
4. **Word Document File Lock**:
   - *Error*: `Ajson Studio.docx` was open in Microsoft Word, causing `PermissionError: [Errno 13]`.
   - *Fix*: Saved the updated report to `Ajson_Studio_Project_Report.docx` at both `OneDrive/Music` and `OneDrive/Music/Ajson`.

---

## 6. Git Status

- Repository: `RiteshVerma1102/ajson-studio`
- Branch: `development`
- All changes verified against production build and automated tests.

---

## 7. Next Day Plan (Day 3)

- **Integrated Terminal**: Embed real terminal emulation (`xterm.js` / `node-pty`) supporting PowerShell, Bash, and CMD.
- **Workspace Search**: Backend full-text search across all project files with regex and case sensitivity.
- **Live File Watcher**: Automatic tree synchronization on external file modifications using file system watchers.
- **Problems & Output Panels**: Connect syntax diagnostics and process logs to the bottom panel.
