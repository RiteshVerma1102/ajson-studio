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

## 6. Planned Security Capabilities (In Roadmap)

The following security features are **PLANNED** for future implementation phases and are **not yet implemented**:

- **Process Sandboxing [PLANNED]**: Isolating agent tool runners and background tasks within lightweight containers or OS-level sandboxes (e.g., Windows AppContainer / Linux namespaces).
- **Terminal Permission Controls [PLANNED]**: Granular command allowlists and path restrictions preventing agents from accessing files outside the open workspace directory.
- **Secret Vault Integration [PLANNED]**: Operating system credential store integration (Windows Credential Locker, macOS Keychain) for securely storing user API keys locally rather than plain text `.env` files.
- **Network Outbound Egress Policies [PLANNED]**: Configurable domain allowlists restricting which endpoints can be reached during agent execution.
