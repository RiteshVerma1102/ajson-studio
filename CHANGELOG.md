# Changelog — Ajson Studio

All notable changes to the Ajson Studio project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0-frontend-complete] — 2026-10-27

### Added
- **Architectural Contracts (`@ajson/contracts`)**:
  - Independent workspace package defining strongly typed interfaces for FileSystem, Terminal, Git, Search, Diagnostics, Output, AI, Agent, and Index services.
  - Complete `AIEvent` discriminated union with approval kinds including `'mcp'`, `'command'`, `'edit'`, `'browse'`, and `'delete'`.
  - Comprehensive runtime Zod validation schemas for all request, response, and event payloads across every IPC channel.
  - Standardized `AjsonError` class and `ErrorCode` taxonomy.
  - Reusable service conformance test suite in `@ajson/contracts/testing` ensuring 100% behavioral parity between mock services and future native backend bridges.
- **IPC Architecture & Adapters**:
  - Dynamic preload bridge detection in `frontend/src/services/index.ts` selecting typed `IpcService` adapters when `window.ajson` is present, with automatic fallback to mock suite in browser environments.
  - Complete IPC interface contract specification (`docs/architecture/ipc-contract.md`).
  - Architecture Decision Record on contracts and versioning (`docs/decisions/adr-003-contracts-and-ipc-versioning.md`).
  - Backend handoff guide with recommended 10-stage build order (`docs/backend-handoff.md`).
  - Detailed service audit and risk analysis (`docs/reports/frontend-audit.md`).
  - Comprehensive frontend completion matrix covering sections A through O (`docs/reports/frontend-completion-matrix.md`).
- **Quality & Hardening**:
  - 10 automated conformance tests passing against mock implementations.
  - SafeStorage resilience against quota errors, corrupted JSON, and null storage targets.
  - WCAG AA contrast compliance across Dark, Light, and High-Contrast themes.
- **Mission Control & Approvals**:
  - Agent mission management and approval cards for human-in-the-loop security.

---

## [0.1.0] — 2026-10-24

### Added
- Initial monorepo layout separating frontend, backend, electron, ai, tests, and docs.
- AppShell foundation with resizable multi-panel grid layout.
- Design token system with Dark, Light, and High-Contrast themes.
- Base UI component primitives (Button, Input, Badge, Tooltip, Modal, Tabs, Dropdown, Toast, Spinner, Kbd, Splitter).
- Monaco Editor host and multi-tab state management.
- Fuzzy Command Palette (`Ctrl+Shift+P` / `F1`).
- Virtual File System mock service and Project Explorer tree.
- Git service with in-memory commit graph, status tracking, and staging.
- Integrated terminal container and task output viewer.
- AI assistant chat interface with provider configuration.
