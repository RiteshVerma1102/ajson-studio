# Ajson Studio

> AI-native software development environment for intelligent coding, project understanding, autonomous agents, testing, debugging, and deployment.

---

## 🌟 Project Vision

**Ajson Studio** is planned as a 12-month serious software product designed to be a premier AI-native desktop development environment. Rather than relying on patchwork extensions or superficial chat windows, Ajson Studio is architected from the ground up to integrate AI cognition directly into every stage of the software lifecycle:

```
Requirement
    ↓
Planning
    ↓
Project Understanding
    ↓
Coding
    ↓
Testing
    ↓
Debugging
    ↓
Security Analysis
    ↓
Browser Testing
    ↓
Code Review
    ↓
Deployment
```

The long-term vision synthesizes the strongest concepts from modern development environments (Visual Studio Code, Cursor, Claude Code, OpenAI Codex, and Google Antigravity) into an **original architecture, custom user interface, distinct branding, and proprietary implementation**.

---

## 🚦 Project Status

> **Phase 9: Frontend Complete & Backend Handoff Certified (v0.2.0-frontend-complete)**

| Module / Capability | Status | Description |
| :--- | :--- | :--- |
| **Monorepo Structure** | **Implemented** | Clean directory layout with `contracts`, `frontend`, `backend`, and `electron` |
| **Architectural Contracts (`@ajson/contracts`)** | **Implemented** | Universal service interfaces, Zod payload schemas, AIEvent union, error codes |
| **IDE Layout & Shell (AppShell)** | **Implemented** | Resizable multi-panel grid, custom TitleBar, ActivityBar, StatusBar, presets |
| **Code Editor & Explorer (Monaco)** | **Implemented** | Multi-tab editor, Monaco host, syntax highlighting, diff viewer, virtual file tree |
| **Integrated Terminal & Git Staging** | **Implemented** | Terminal container, xterm.js styling, commit creation, branch management |
| **AI Assistant & Agent Mission Control** | **Implemented** | Multi-model chat, context chips, Mission Control dashboard, visual approval cards |
| **Service Conformance Test Suite** | **Implemented** | 10 automated test suites in `@ajson/contracts/testing` ensuring mock/backend parity |
| **Desktop Shell (Electron Main/IPC Gateway)** | **Handoff Ready** | Specifications, schemas, and build order documented in `docs/backend-handoff.md` |
| **Autonomous Agent Execution Loop** | **Handoff Ready** | Multi-turn reasoning engine and server-side approval enforcement designed |


---

## 🎯 Long-Term Goals

1. **AI-Native Core**: Autonomous and collaborative agent workflows embedded natively inside the desktop engine.
2. **Deep Project Understanding**: Dynamic project knowledge graphing, AST parsing via Tree-sitter, semantic search, and context indexing.
3. **Safety & Sandboxing**: Strict human-in-the-loop permission model for terminal execution, tool use, and file mutations.
4. **Resilient Developer Experience**: Low-latency typing, fluid UI panels, offline resilience, and modular AI provider routing (OpenAI, Anthropic, Google, and local models).

---

## 🛠️ Technology Stack

- **Desktop Shell**: Electron (Main, Preload, Sandboxed IPC)
- **Frontend**: React, TypeScript, Modern CSS Layout Engine
- **Backend & Services**: Node.js / TypeScript micro-services for local operations, database, and process handling
- **AI Orchestration**: Custom AI Provider Abstraction layer supporting streaming responses, tool calling, and context memory
- **Version Control & DevOps**: Git, GitHub Actions CI

---

## 📂 Repository Structure

```
ajson-studio/
├── frontend/             # User Interface & Editor Engine
│   ├── components/       # Reusable UI primitives
│   ├── layouts/          # IDE layout grids and split panels
│   ├── editor/           # Code editor integration
│   ├── panels/           # Terminal, output, AI chat, explorer panels
│   ├── services/         # Client-side API clients
│   ├── state/            # Reactive state management
│   └── styles/           # Design system tokens and styles
│
├── backend/              # Local Backend Services & Tool Execution
│   ├── api/              # Internal IPC and HTTP endpoints
│   ├── services/         # File, process, and workspace services
│   ├── agents/           # Backend task agents
│   ├── tools/            # Local execution tools (terminal, git, linter)
│   ├── database/         # Local SQLite / cache storage
│   └── utils/            # Shared helper functions
│
├── electron/             # Desktop Application Shell
│   ├── main/             # Electron main process lifecycle
│   ├── preload/          # Context bridge script (safe exposure)
│   └── ipc/              # Inter-Process Communication channels
│
├── ai/                   # AI Cognition & Orchestration Layer
│   ├── providers/        # LLM connectors (OpenAI, Anthropic, Google Gemini, Ollama)
│   ├── orchestrator/     # Agent loop, planning, and task dispatching
│   ├── context/          # Prompt assembling, file indexing, RAG
│   ├── memory/           # Short-term and long-term project memory
│   └── tools/            # AI tool definitions and schema validation
│
├── tests/                # Test Suites
│   ├── frontend/         # Component and layout unit tests
│   ├── backend/          # Service and utility tests
│   ├── ai/               # Model integration and prompt tests
│   ├── integration/      # End-to-end IPC integration tests
│   └── e2e/              # Desktop application E2E tests
│
├── docs/                 # Documentation & Engineering Records
│   ├── architecture/     # Architectural blueprints and diagrams
│   ├── development-log/  # Day-by-day progress logs (day-01.md, etc.)
│   ├── reports/          # Audit and performance reports
│   ├── decisions/        # Architecture Decision Records (ADRs)
│   ├── research/         # Domain research and benchmarks
│   └── SECURITY.md       # Security guidelines and threat model
│
├── scripts/              # Build, release, and automation scripts
├── .github/              # GitHub Actions workflows (CI/CD)
├── .env.example          # Environment variables template
├── .gitignore            # Secret & artifact exclusion rules
├── CONTRIBUTING.md       # Development rules and branch guidelines
├── package.json          # Monorepo configuration
└── README.md             # Project overview
```

---

## 🏗️ Architecture Summary

Responsibilities are strictly decoupled:

- **Frontend**: Exclusively responsible for user interaction, visual presentation, editor state, and UI responsiveness.
- **Backend**: Exclusively responsible for system-level operations, file manipulations, local database caches, and agent tool execution.
- **Electron**: Exclusively responsible for window lifecycle, secure native menus, desktop notifications, and strictly typed IPC.
- **AI Layer**: Exclusively responsible for provider abstraction, prompt management, context indexing, and agent orchestration.

For detailed architecture diagrams and design principles, see [docs/architecture/overview.md](docs/architecture/overview.md).

---

## 💻 Development Setup

### Prerequisites
- Node.js `20.x` or higher
- npm `10.x` or higher
- Git `2.40+`

### Initializing Environment
```bash
# Clone private repository
git clone https://github.com/RiteshVerma1102/ajson-studio.git
cd ajson-studio

# Copy environment variables template
cp .env.example .env
```

---

## 🧪 Testing

Testing will be implemented alongside feature development:
```bash
npm run test
```
The test suite spans unit testing (`tests/frontend`, `tests/backend`), AI routing validation (`tests/ai`), and full desktop interaction (`tests/e2e`).

---

## 🌿 Git Workflow

Development follows an enterprise trunk-and-branch model:

- `main`: Protected, production-ready, verified releases.
- `development`: Active integration branch.
- `feature/<feature-name>`: Feature branches created off `development`.
- `fix/<bug-name>`: Bug fixes created off `development` or `main`.

### Daily Development Loop
```
START DAY
    ↓
Read previous development log
    ↓
Define today's objective
    ↓
Implement
    ↓
Run tests
    ↓
Run build
    ↓
Inspect git diff
    ↓
Review changed files
    ↓
Commit verified changes
    ↓
Push to GitHub
    ↓
Update daily development log
    ↓
END DAY
```

---

## 🗺️ Roadmap (12-Month Plan)

- [x] **Day 0: Repository Setup & Infrastructure Baseline** (Current)
- [ ] **Phase 1: Native Desktop Shell & Core Layout** (Days 1–30)
- [ ] **Phase 2: Code Editor & Workspace Intelligence** (Days 31–90)
- [ ] **Phase 3: AI Provider Layer & Interactive Assistant** (Days 91–180)
- [ ] **Phase 4: Autonomous Multi-Agent Loop & Tool Execution** (Days 181–270)
- [ ] **Phase 5: Browser Agent, Security Sandboxing & Deployment** (Days 271–365)

---

## 📖 Documentation Index

- [Architecture Overview](docs/architecture/overview.md)
- [Security Policy](docs/SECURITY.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Architecture Decisions (ADRs)](docs/decisions/README.md)
- [Research Notes](docs/research/README.md)
- [Development Logs](docs/development-log/)
