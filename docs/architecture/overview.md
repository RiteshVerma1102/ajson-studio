# Ajson Studio — Architectural Overview

## 1. Project Vision
Ajson Studio is an AI-native desktop software development environment. It is architected to seamlessly embed AI assistance, autonomous coding agents, testing verification, and deployment orchestration directly into the core editor workflows, rather than presenting AI as an external sidebar plugin.

---

## 2. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Ajson Studio Desktop Shell                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │               FRONTEND LAYER (Renderer)             │   │
│   │  - IDE Layout Grid (Header, Activity Bar, Panels)   │   │
│   │  - Editor Component (Monaco / Custom buffer engine) │   │
│   │  - UI State Management & Event Dispatchers          │   │
│   └─────────────────────────┬───────────────────────────┘   │
│                             │ Secure Typed IPC              │
│   ┌─────────────────────────▼───────────────────────────┐   │
│   │              ELECTRON SHELL (Main Process)          │   │
│   │  - Window Management & Native Dialogs               │   │
│   │  - Sandboxed IPC Gateway & Security Policies        │   │
│   └─────────────────────────┬───────────────────────────┘   │
│                             │ Node.js Internal Bindings     │
│   ┌─────────────────────────▼───────────────────────────┐   │
│   │                 BACKEND SERVICES LAYER              │   │
│   │  - File System Access & File Watcher                │   │
│   │  - Process Management (Integrated Terminal)         │   │
│   │  - Tool Execution Engine (Git, Linters, Test Runners)│  │
│   │  - Local Database / Project Index Cache             │   │
│   └─────────────────────────┬───────────────────────────┘   │
│                             │ Agent Dispatch                │
│   ┌─────────────────────────▼───────────────────────────┐   │
│   │               AI ORCHESTRATION LAYER                │   │
│   │  - Model Provider Abstraction (OpenAI, Anthropic,   │   │
│   │    Google Gemini, Local LLMs)                       │   │
│   │  - Agent Loop (Planner, Actor, Evaluator)           │   │
│   │  - Project Context & AST Code Indexer               │   │
│   │  - Memory & Context Pruning                         │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Major Modules & Status

### 3.1 Frontend (`frontend/`) — [PLANNED]
- **Role**: Presentation and interaction layer running in the Chromium renderer process.
- **Components**:
  - `components/`: UI primitives (buttons, modals, badges, inputs).
  - `layouts/`: IDE grid architecture, resizable split panels, tabs.
  - `editor/`: High-performance code editor component.
  - `panels/`: Terminal container, AI conversation stream, file tree, test runner.
  - `services/`: Client-side IPC communication wrappers.
  - `state/`: Global editor state, active buffers, cursor tracking.
  - `styles/`: Clean design tokens, dark themes, and responsive CSS.
- **Status**: Structural foundation established in Day 0. Code implementation will commence in Phase 1 (Day 1+).

### 3.2 Backend (`backend/`) — [PLANNED]
- **Role**: Local server-side business logic and protected system operations.
- **Components**:
  - `api/`: Strongly typed IPC request/response handlers.
  - `services/`: File I/O, search indexers, language server bindings.
  - `agents/`: Local agent runner, subagent life-cycle management.
  - `tools/`: Deterministic execution tools with permission checks (terminal, git, file read/write).
  - `database/`: Embedded storage (e.g. SQLite) for project metadata and conversation transcripts.
  - `utils/`: Common sanitization, formatting, and path resolution helpers.
- **Status**: Planned for progressive implementation across Phases 1 to 4.

### 3.3 Electron (`electron/`) — [PLANNED]
- **Role**: Desktop application lifecycle and host system interface.
- **Components**:
  - `main/`: Main process bootstrap, window state persistence, crash handling.
  - `preload/`: Isolated preload script exposing narrow, authenticated APIs to renderer.
  - `ipc/`: Channel definitions, payload validation, and access control.
- **Status**: Planned for integration starting in Phase 1 (Day 1+).

### 3.4 AI Layer (`ai/` & `electron/ipc/aiHandlers.ts`) — [IMPLEMENTED FOUNDATION]
- **Role**: Cognitive engine powering conversational assistance and future agentic development workflows.
- **Implemented Capabilities**:
  - `providers/`: Provider-agnostic interfaces in `src/types/ai.ts` and dispatchers in `electron/ipc/aiHandlers.ts` supporting Anthropic Claude, OpenAI, Google Gemini, and local Ollama.
  - `credentials/`: Hardware-backed OS vault encryption (`safeStorage`) for user API keys with in-memory fallback.
  - `context/`: Monaco editor in-memory buffer synchronization, selection capturing, and privacy filtering blocking sensitive files.
  - `cancellation/`: Request-level `AbortController` cancellation registry.
- **Planned Capabilities**:
  - `orchestrator/`: Multi-turn reasoning loops, reflection, and automated tool dispatch (Scheduled: Day 4+).
  - `tools/`: Schema definitions and parameter validators for model tool calling (Scheduled: Day 4+).

---

## 4. Testing Strategy (`tests/`) — [IMPLEMENTED & PASSING]
The testing suite guarantees stability across desktop file operations, workspace state, project search, and the AI subsystem:
- `tests/fileOperations.test.mjs`: Filesystem CRUD operations, path traversal rejection, safe deletion.
- `tests/projectSearch.test.mjs`: Real project-wide text search, live buffer precedence, binary skipping.
- `tests/day2WorkflowVerification.mjs`: 10-step full workflow verification.
- `tests/commandPalette.test.mjs`: Command palette registry, fuzzy searching, keyboard execution.
- `tests/workspacePersistence.test.mjs`: Workspace atomic storage, recent projects, panel dimensions.
- `tests/aiIntegration.test.mjs`: AI provider catalogue, schema validation, safeStorage credential store, cancellation, error normalization, and context privacy filtering.
- **Current Status**: 85 passing tests (100% pass rate).

---

## 5. Documentation (`docs/`) — [IMPLEMENTED & ONGOING]
Engineering discipline requires transparent tracking:
- `docs/architecture/`: Module blueprints and system designs.
- `docs/development-log/`: Daily development log files (`day-01.md`, `day-02.md`, etc.).
- `docs/reports/`: Security audits, test coverage reports, and performance benchmarks.
- `docs/decisions/`: Architectural Decision Records (ADRs).
- `docs/research/`: Competitive analyses, technical whitepapers, and experiment notes.
- `docs/SECURITY.md`: Security policies and responsible disclosure.

---

## 6. Future Cloud Services — [PLANNED]
In later development phases (post-Phase 5), optional cloud services may include:
- Remote compute sandboxes for executing untrusted code safely off-device.
- Team collaboration and shared project knowledge syncing.
- Multi-model cloud gateway with unified telemetry and billing.
- Managed browser testing clusters for heavy E2E verification.
