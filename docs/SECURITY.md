# Security Policy — Ajson Studio

## 1. Core Security Principles

Security is a first-class architectural requirement for Ajson Studio. As an AI-native desktop application capable of interacting with the local operating system, terminal, and external AI services, rigorous security boundaries are enforced.

---

## 2. Secrets Management & Version Control

- **Zero Credentials in Git**: Never commit API keys, access tokens, passwords, database credentials, certificates, or private keys to the repository.
- **Environment Files**: The `.gitignore` policy strictly excludes `.env` and all `.env.*` variants. Only `.env.example` with non-functional placeholders may be committed.
- **Pre-Commit Verification**: All staged changes must be manually and programmatically audited for accidental secrets exposure before committing or pushing.

---

## 3. Dependency Security

- **Package Verification**: Use lockfiles (`package-lock.json`) to guarantee deterministic dependency resolution.
- **Vulnerability Audits**: Regular execution of `npm audit` and automated dependency checking in CI pipelines.
- **Minimal Surface**: Third-party packages are vetted for provenance, active maintenance, and permission scope before addition.

---

## 4. Code Review & Change Management

- All changes intended for the production-ready `main` branch must go through the `development` branch with code review and passing CI verification.
- Developer-controlled commits remain the single source of truth. Automated systems must never blindly commit code.

---

## 5. Safe AI Agent Execution Model

Ajson Studio prioritizes user consent and containment:

- **Human-in-the-Loop Approval**: Autonomous agents require explicit user authorization before running destructive file system modifications or irreversible shell commands.
- **Transparent Logging**: Every tool call, model prompt, and system execution is logged locally in human-readable records.

---

## 6. Implemented Security Controls (Day 2 & Day 3)

The following security controls are fully verified and enforced:

- **OS Credential Vault (`safeStorage`)**: User API keys are encrypted at rest using operating system primitives (Windows DPAPI, macOS Keychain, Linux Secret Service). Plaintext credentials never touch disk, configuration files, or logs.
- **Context Privacy Filter**: Outbound context fragment inspection automatically detects and blocks sensitive files (`.env*`, secrets, tokens, private keys `*.pem`/`id_rsa`) from being forwarded to AI providers.
- **Path Traversal & Symlink Escape Prevention**: Normalized realpath verification prevents directory traversal (`../`, `..\`) and symlink escapes outside the open project directory root.
- **Process Isolation**: Strict Electron sandbox model (`contextIsolation: true`, `nodeIntegration: false`) enforced across all renderer windows.
- **Request Boundary Limits**: Strict payload bounds (32k characters message, 64k characters context, 128k characters total request) preventing memory exhaustion and unintended token exfiltration.
- **Socket Cancellation**: Active `AbortController` cancellation terminates outbound network connections immediately when user stops or cancels an AI request.

---

## 7. Planned Security Capabilities (In Roadmap)

The following security features are **PLANNED** for future implementation phases:

- **Process Sandboxing [PLANNED]**: Isolating agent tool runners and background tasks within lightweight containers or OS-level sandboxes (e.g., Windows AppContainer / Linux namespaces).
- **Terminal Permission Controls [PLANNED]**: Granular command allowlists and path restrictions preventing agents from executing commands without explicit per-command authorization.
- **Network Outbound Egress Policies [PLANNED]**: Configurable domain allowlists restricting which external endpoints can be contacted during agent execution.
