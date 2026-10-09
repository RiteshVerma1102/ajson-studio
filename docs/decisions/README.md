# Architecture Decision Records (ADRs)

This directory maintains the immutable Architectural Decision Records (ADRs) for Ajson Studio. As significant design and engineering choices are evaluated and established, each decision will be documented here using standard ADR formatting.

---

## What is an ADR?
An Architectural Decision Record captures an important architectural decision made along with its context, options considered, trade-offs, and consequences.

---

## Planned Future ADRs (Pending Execution)
The following topics will be addressed and formally recorded as development progresses:

- **ADR-001** — Desktop application architecture (Electron vs alternatives, process isolation model)
- **ADR-002** — AI provider abstraction & streaming protocol
- **ADR-003** — Project indexing strategy (AST, Tree-sitter, embeddings, and vector store)
- **ADR-004** — Agent tool execution & permission gating
- **ADR-005** — Security model & process sandboxing

---

## ADR Template
When creating a new decision record, adhere to this structure:
```markdown
# ADR-XXX: Title of Decision

## Status
[Proposed | Accepted | Superseded | Deprecated]

## Context
What is the problem or architectural challenge being solved?

## Options Considered
1. Option A (Pros, Cons)
2. Option B (Pros, Cons)

## Decision
What is the selected approach and why?

## Consequences
What are the positive and negative implications of this decision?
```
