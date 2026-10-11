# Architecture Decision Records (ADRs)

This directory maintains the immutable Architectural Decision Records (ADRs) for Ajson Studio. As significant design and engineering choices are evaluated and established, each decision will be documented here using standard ADR formatting.

---

## What is an ADR?
An Architectural Decision Record captures an important architectural decision made along with its context, options considered, trade-offs, and consequences.

---

## Architecture Decision Records

- **ADR-001** — Desktop application architecture (Electron, process isolation, Monaco integration) — *Accepted*
- **ADR-002** — [AI Provider Abstraction & Credential Security](adr-002-ai-provider-abstraction.md) — *Accepted*
- **ADR-003** — Project indexing strategy (AST, Tree-sitter, embeddings, and vector store) — *Planned*
- **ADR-004** — Agent tool execution & permission gating — *Planned*
- **ADR-005** — Security model & process sandboxing — *Planned*

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
