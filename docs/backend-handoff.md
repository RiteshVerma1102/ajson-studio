# Ajson Studio — Backend Handoff Guide

- **Status:** Complete & Approved for Implementation
- **Target Audience:** Desktop Shell & Backend Engineering Teams
- **Associated Contract:** `@ajson/contracts` v0.1.0

---

## 1. Executive Summary

The frontend layer of Ajson Studio is **100% complete**. It implements a full IDE design system, multi-panel grid layouts, Monaco code editor, terminal container, Git staging, project search, AI conversational assistant, and agent mission control.

All services communicate through the abstract contracts defined in `@ajson/contracts`. The frontend detects `window.ajson`:
- If `window.ajson` is absent (browser mode), it runs against tested, deterministic in-memory mock services.
- If `window.ajson` is present (Electron desktop mode), it dispatches calls through validated `IpcService` adapters.

The backend team can now build the native services incrementally according to the recommended build order below.

---

## 2. Recommended Build Order

```
(1) Electron Gateway ──► (2) File System ──► (3) Terminal PTY
                                                    │
(6) AI & Keychain   ◄── (5) Search & Index ◄── (4) Git Engine
       │
       ▼
(7) Agent Loop & Approval Enforcement
       │
       ▼
(8) MCP Client ──► (9) Browser Automation ──► (10) DAP & Test Runners
```

### Stage 1: Electron Main, Preload & IPC Gateway
- **Objective**: Bootstrap Electron 33+, configure native window, and implement the IPC router.
- **Key Files**: `electron/main/index.ts`, `electron/preload/index.ts`, `electron/ipc/gateway.ts`.
- **Requirements**:
  - Expose `window.ajson` with `invoke(channel, payload)` and `on(channel, callback)`.
  - Validate every incoming IPC payload against `@ajson/contracts` Zod schemas before handing off to service handlers.
  - Return serialized `AjsonErrorPayload` on exceptions.

### Stage 2: FileSystem & Watcher Service
- **Objective**: Native local disk read/write/CRUD operations and directory watcher.
- **Key Requirements**:
  - **Workspace Root Guard**: Resolve all incoming paths against `activeProjectRoot`. Reject directory traversal (`../`) or absolute path escapes with `PATH_TRAVERSAL`.
  - **Symlink Safety**: Call `fs.realpathSync` to ensure symbolic links do not resolve outside the project root.
  - **Binary Sniffing**: Inspect initial 512 bytes for null bytes (`\0`) to prevent opening binary/archive files in Monaco.
  - **Watcher**: Watch the workspace tree using `chokidar` with sensible ignore rules (`node_modules`, `.git`, `dist`). Emit `ajson:fs:event` to renderer.

### Stage 3: Terminal with `node-pty`
- **Objective**: Real interactive pseudo-terminal emulation for bash, zsh, and PowerShell.
- **Key Requirements**:
  - Spawn PTY processes via `node-pty` with `cols`, `rows`, and initial `cwd = activeProjectRoot`.
  - Stream binary/UTF-8 data directly across `ajson:terminal:onData`.
  - Handle process tree teardown on session kill to avoid orphaned processes.
  - Command execution timeout support (default 60s).

### Stage 4: Git Integration
- **Objective**: Repository status tracking, branch management, and staging.
- **Key Requirements**:
  - Use `simple-git` or embedded libgit2 bindings.
  - Query `.git` index status asynchronously and push `ajson:git:onChange` updates when `.git/index` or `.git/HEAD` changes.
  - Provide unified line diffs for both working tree and staged index changes.

### Stage 5: Search & Project Index
- **Objective**: Ultra-fast project-wide text search and code symbol index.
- **Key Requirements**:
  - Bundle `ripgrep` binary for high-speed multi-threaded disk searching.
  - Build embedded SQLite database with FTS5 or vector embeddings for semantic symbol navigation.
  - Parse files using WebAssembly Tree-sitter for AST symbol identification (functions, classes, methods).

### Stage 6: AI Provider Layer & OS Keychain (`safeStorage`)
- **Objective**: Secure credential storage and multi-provider LLM communication.
- **Key Requirements**:
  - Encrypt API keys via Electron's `safeStorage.encryptString()` / `decryptString()`. Never write plaintext secrets to disk.
  - Implement streaming adapters for Anthropic Messages API, OpenAI Chat API, Google Gemini API, and local Ollama endpoint.
  - Support `AbortController` cancellation registry keyed by `requestId`.

### Stage 7: Agent Orchestrator & Server-Side Permission Enforcement
- **Objective**: Autonomous coding agent execution loop with strict safety guardrails.
- **CRITICAL ARCHITECTURAL RULE**:
  > **The renderer is untrusted. Permission enforcement MUST occur server-side in the main process.**
  - When an agent generates a tool call requiring approval (terminal command, file edit, package install, MCP call), the main process creates an approval token and pauses execution.
  - The renderer displays the approval card and user clicks Approve/Reject.
  - The main process verifies that the approval token matches the current paused task state before executing the action. The renderer cannot forge or bypass approvals.

### Stage 8: Model Context Protocol (MCP) Client
- **Objective**: Connect external MCP tool servers (e.g. database connectors, remote APIs).
- **Key Requirements**:
  - Implement JSON-RPC 2.0 stdio / SSE transport for MCP servers.
  - Route MCP tool calls through Stage 7 approval gate with kind `'mcp'`.

### Stage 9: Headless Browser & Webview Automation
- **Objective**: In-app web application preview, automated testing, and visual QA.
- **Key Requirements**:
  - Sandboxed Electron `<webview>` tag with remote debugging enabled.
  - Automate browser actions via Chrome DevTools Protocol (CDP) or Playwright Core.

### Stage 10: Debug Adapter Protocol (DAP) & Test Runners
- **Objective**: Breakpoint debugging, call stack inspection, and test runner integration.
- **Key Requirements**:
  - DAP client connecting to V8 Inspector / Node.js debugger.
  - Auto-discovery of Jest, Vitest, and pytest runners with streaming TAP / JSON test event feeds.

---

## 3. Conformance Verification

Before certifying a backend service for production, run the shared conformance suite:
```typescript
import { runFileSystemConformanceTests } from '@ajson/contracts/testing';
import { NativeFileSystemService } from './nativeFileSystem';

await runFileSystemConformanceTests(() => new NativeFileSystemService('/path/to/project'));
```
All 9 service conformance suites must pass with zero exceptions.
