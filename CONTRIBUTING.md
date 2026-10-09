# Contributing to Ajson Studio

Welcome to **Ajson Studio**. This repository is private and adheres to strict software engineering standards to maintain architecture integrity, high performance, and security across the 12-month development cycle.

---

## 🌿 Branching Strategy

The repository follows a structured branch workflow:

| Branch | Purpose | Protection |
| :--- | :--- | :--- |
| `main` | Production-ready, verified releases | Direct pushes restricted. Merge only from `development` after passing checks. |
| `development` | Active development and daily integration | Primary target for feature branches and bug fixes. |
| `feature/<name>` | New capabilities and modules | Created off `development`. E.g., `feature/monaco-editor`, `feature/ai-orchestrator`. |
| `fix/<name>` | Defect and regression fixes | Created off `development`. E.g., `fix/terminal-crash`, `fix/ipc-serialization`. |

*Do NOT create unnecessary, unformatted, or ambiguous branches.*

---

## ✍️ Commit Conventions

We follow Conventional Commits formatting:

```
<type>: <short description>
```

### Allowed Types
- `chore:` Maintenance tasks, dependency bumps, repository setup (e.g., `chore: initialize Ajson Studio repository`)
- `feat:` New features or capabilities (e.g., `feat: implement project explorer panel`)
- `fix:` Bug fixes (e.g., `fix: resolve terminal startup issue`)
- `refactor:` Code improvements that do not change external behavior (e.g., `refactor: improve agent tool dispatching`)
- `test:` Adding or updating test suites (e.g., `test: add agent integration tests`)
- `docs:` Documentation updates (e.g., `docs: update architecture overview`)

### Anti-Patterns to Avoid
Do not use non-descriptive messages such as: `update`, `changes`, `final`, `test`, `new code`, or `wip`.

---

## 🔄 Daily Development Lifecycle

Every development day follows this disciplined process:

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

## 🛡️ Security & Quality Gates Before Merging

Before pushing any commit or merging a branch:
1. **Secret Check**: Verify that no API keys, tokens, or credentials exist in staged changes.
2. **Build Verification**: Run `npm run build` (or equivalent) to ensure zero compilation or bundling errors.
3. **Type Checking**: Run `npm run typecheck` to verify TypeScript type soundness.
4. **Test Suite**: Run `npm run test` to verify that existing test suites pass.
5. **No Broken Commits**: Never push broken code to `main` or `development`. Fix the problem or revert safely.

---

## 📝 Documentation Requirements

Every new feature or architectural pivot must update:
- The relevant section in `README.md` (distinguishing Implemented vs Planned).
- The daily log in `docs/development-log/`.
- Architectural documents in `docs/architecture/` or `docs/decisions/` if a major structural decision was made.

---

## ⚖️ Licensing

*Note: This repository is private. Licensing terms and open-source distribution remain reserved as future decisions.*
