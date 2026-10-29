# Ajson Studio — Frontend & Services Audit Report

- **Date:** 2026-10-27
- **Target:** Phase 9 — Frontend Completion & Backend Handoff
- **Scope:** Complete analysis of mock vs. native desktop services, security boundaries, and migration roadmap.

---

## 1. Service Comparison: Mock Implementation vs. Real Backend

| Service | What the Mock Does | What the Real Implementation Must Do | Priority | Risk Level |
| :--- | :--- | :--- | :--- | :--- |
| **FileSystemService** | Maintains an in-memory `Map<string, string>` containing seed React/TS files and fixtures. Emits synthetic watch callbacks on mutation. | Interacts with native local filesystem via `node:fs/promises`. Enforces canonical project root path confinement (`realpathSync`). Monitors directory trees with `chokidar` or native OS events. Handles binary sniffing and file size caps (5MB max text). | **P0 (Critical)** | **High** (Path traversal, symlink escapes, concurrency race conditions) |
| **TerminalService** | Emulates a virtual shell (`MockShell`) interpreting simple commands (`ls`, `cd`, `cat`, `echo`, `npm run dev`, `git status`). Simulates ANSI color streams and fake process completion. | Spawns real native PTY processes using `node-pty` (bash/zsh on Unix, PowerShell/cmd on Windows). Manages terminal resize, SIGINT signals, and environment variables. Strictly confines working directory to project root. | **P0 (Critical)** | **High** (Privileged arbitrary code execution, orphan process leaks) |
| **GitService** | Maintains an internal commit DAG, index map, and branch table. Computes text diffs in-memory using `diff` npm package. | Executes native Git commands via `simple-git` or embedded libgit2 / isomorphic-git. Reads live repository status (`.git/HEAD`, `.git/index`). Provides streaming diffs and atomic commits. | **P0 (Critical)** | **Medium** (Lock file conflicts, large binary diff memory spikes) |
| **SearchService** | Performs in-memory regex and substring searches across all simulated virtual files. | Invokes native `ripgrep` binary over streaming stdout/stderr or worker threads. Honors `.gitignore` and ignores binary/minified files. Clamps memory to 10k matches. | **P1 (High)** | **Low** (Process spawn overhead, regex DoS) |
| **AiService** | Provides canned assistant responses, simulates thought events, and stores API keys in memory. | Connects to Anthropic Claude, OpenAI, and Google Gemini via streaming HTTPS; communicates with local Ollama via localhost socket. Encrypts user API keys in the OS keychain using Electron's `safeStorage`. Manages `AbortController` cancellation. | **P0 (Critical)** | **High** (API key exfiltration, unbounded token billing, timeout stalls) |
| **AgentService** | Creates simulated agent missions, records synthetic thought/tool events, and stores approval requests in memory. | Executes an autonomous multi-turn reasoning loop (Plan -> Action -> Evaluate). Dispatches tool calls (terminal, file edits, git, browser). **Enforces approvals server-side in main process before any execution.** Renderer is strictly untrusted. | **P0 (Critical)** | **Critical** (Unauthorized system mutation, runaway agent loops) |
| **IndexService** | Scans in-memory text files with regex patterns to extract function and class declarations. | Builds an embedded SQLite database with FTS5 or vector embeddings (e.g. SQLite-vec / Chroma). Parses AST using Tree-sitter for semantic code symbol extraction and definition jumping. | **P1 (High)** | **Medium** (Initial indexing CPU/disk I/O usage) |
| **DiagnosticsService** | Aggregates Monaco editor markers and mock linter diagnostics in-memory. | Connects to language servers (TypeScript Server, ESLint, Pyright) via Language Server Protocol (LSP) over JSON-RPC sockets. | **P1 (High)** | **Low** (Marker synchronization latency) |
| **OutputService** | Buffers categorized log lines in-memory across Tasks, Git, and Ajson channels. | Tails background build tasks, process stdout, and system warnings to rotating log files in user data directory. | **P2 (Medium)** | **Low** (Buffer memory overflow; handled with 2MB ring buffer) |

---

## 2. Simulated Features & Their Real Replacements

1. **Virtual Shell (`MockShell`)**  
   - *Current Behavior*: Hardcoded regex dispatch for `cd`, `ls`, `git`, `npm`.  
   - *Production Replacement*: Native `node-pty` session bound to xterm.js via bidirectional IPC channels (`ajson:terminal:write` and `ajson:terminal:onData`).
2. **In-Memory File System**  
   - *Current Behavior*: Browser memory storage seeded with sample files.  
   - *Production Replacement*: Native filesystem access guarded by root-containment middleware and safe atomic writes (write to `.tmp` file then atomic rename).
3. **Simulated AI Generation**  
   - *Current Behavior*: Returns pre-written markdown responses with simulated timer delay.  
   - *Production Replacement*: Direct HTTP/2 streaming from official provider SDKs or REST APIs, with request aborting and real token counting.
4. **Regex-Based Symbol Search**  
   - *Current Behavior*: Line-by-line regex match for `function` or `class`.  
   - *Production Replacement*: AST parsing via WebAssembly Tree-sitter + SQLite FTS5 database.
5. **Simulated Browser / Webview**  
   - *Current Behavior*: Placeholder preview card.  
   - *Production Replacement*: Electron `<webview>` tag with sandboxing, Chrome DevTools Protocol (CDP) session automation, and DOM interaction hooks.
6. **Debugger**  
   - *Current Behavior*: UI placeholder in ActivityBar and SideBar.  
   - *Production Replacement*: Debug Adapter Protocol (DAP) client for Node.js / V8 inspector.

---

## 3. Risk Assessment & Mitigation

| Area | Risk | Architectural Mitigation |
| :--- | :--- | :--- |
| **Renderer Compromise** | Malicious script in editor executing arbitrary native commands. | `contextIsolation: true`, `nodeIntegration: false`. The main process re-validates all parameters using `@ajson/contracts` Zod schemas and validates user approval tokens before executing terminal or file mutation tools. |
| **Path Traversal** | AI agent attempting to read or write sensitive host files (`/etc/passwd`, `~/.ssh`). | Canonical root checking: all paths resolved against active project root; symlinks outside root are rejected. |
| **Credential Storage** | Plaintext API keys saved to configuration files or Git repositories. | Electron `safeStorage` API encrypts keys using OS credentials (Windows DPAPI, macOS Keychain, Linux Secret Service). Keys never touch disk unencrypted. |
| **IPC Desync** | Outdated frontend sending mismatched parameters to updated backend. | Semantic version handshake on window initialization; versioned channel names and schema enforcement. |
