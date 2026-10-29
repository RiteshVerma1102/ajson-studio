# ADR-003: Architectural Contracts & IPC Protocol Versioning

- **Status:** Accepted
- **Date:** 2026-10-27
- **Author:** Ajson Studio Core Team
- **Deciders:** Architecture Review Board, Frontend Core, Backend Engineering
- **Consulted:** Desktop Shell Security Group

---

## 1. Context & Problem Statement

Ajson Studio separates the user-facing presentation layer (Chromium renderer process) from privileged local desktop operations (Node.js backend / Electron main process). Previously, interface definitions were duplicated or loosely typed across `src/types/electron.d.ts` and `frontend/src/services/types.ts`. 

As we approach backend integration, we need:
1. A **single source of truth** for all service interfaces, IPC channel identifiers, payload schemas, and error taxonomy.
2. An isolated package with **zero runtime dependencies** beyond Zod schema validation.
3. A strict **versioning and backward-compatibility strategy** between the renderer and main processes, preventing runtime desynchronization during upgrades.

---

## 2. Decision: Workspace Package `@ajson/contracts`

We establish `@ajson/contracts` as an independent workspace package within the monorepo.

### 2.1 Package Boundaries
- **Zero Heavy Runtime Dependencies**: The package depends strictly on `zod` for deterministic payload validation and type inference.
- **Bi-directional Invariant**:
  - The frontend MUST import service interfaces, domain models, and validation schemas ONLY from `@ajson/contracts`.
  - The backend and Electron main process MUST validate every incoming renderer IPC payload against `@ajson/contracts` Zod schemas before tool execution or disk mutation.
- **Exported Conformance Suite**: `contracts/testing/` exports automated conformance test suites that must pass identically against both frontend mock implementations and native backend IPC bridges.

---

## 3. IPC Channel Naming & Protocol Specification

### 3.1 Namespacing Scheme
Every IPC channel follows a strict hierarchical schema:
```text
ajson:<domain>:<operation>
```
Examples:
- `ajson:fs:readFile`
- `ajson:fs:writeFile`
- `ajson:terminal:create`
- `ajson:terminal:runCommand`
- `ajson:git:status`
- `ajson:ai:chat`
- `ajson:agent:approveAction`

### 3.2 Bidirectional Streaming & Events
- **Request / Response**: Unary calls invoke `window.ajson.invoke(channel, payload)`, resolving a Promise with the validated response payload or rejecting with a structured `AjsonError`.
- **Event Subscriptions**: Long-running asynchronous streams (terminal output, git status changes, AI generation deltas, agent thoughts) invoke `window.ajson.on(channel, callback)` and return an unsubscribe function.

---

## 4. Versioning & Evolution Strategy

### 4.1 Semantic Versioning of Contracts
The `@ajson/contracts` package adheres to Semantic Versioning (`MAJOR.MINOR.PATCH`):
- **PATCH** (`0.1.x`): Internal documentation updates, non-breaking schema refinements (e.g. tightening regex validators that do not reject valid data).
- **MINOR** (`0.x.0`): Additive changes — new IPC channels, optional fields on request schemas, new enum values for approval kinds or tool events. Both old and new renderers continue to function against newer main processes.
- **MAJOR** (`x.0.0`): Breaking changes — removed channels, changed required fields, altered serialization formats.

### 4.2 Protocol Handshake
During Electron window bootstrap, the renderer and main process exchange a protocol version header:
```typescript
interface ProtocolHandshake {
  contractVersion: string; // e.g. "0.1.0"
  supportedCapabilities: string[];
}
```
If the major version mismatches, the renderer enters a fallback safemode displaying an update prompt rather than invoking incompatible channels.

### 4.3 Field Deprecation Cycle
Fields are never deleted in a minor release. They follow a two-release deprecation cycle:
1. Marked `@deprecated` in TypeScript and made `.optional()` in Zod schemas.
2. Removed in the subsequent major version.

---

## 5. Security & Trust Model

The renderer process is **untrusted**:
1. All parameters received over IPC are re-validated in the main process using the Zod schema before invocation.
2. Paths are resolved and strictly confined to the active project root using canonical `fs.realpathSync`.
3. Agent approvals (`mcp`, `command`, `edit`, `browse`) must be cryptographically re-verified in the main process before privileged execution; the renderer cannot bypass approval checks.

---

## 6. Consequences

### Positive
- Strict type safety and runtime validation across the process boundary.
- Decouples frontend development from backend readiness via deterministic mock conformances.
- Clear upgrade path with zero breaking API surprises.

### Negative / Trade-offs
- Modest overhead of running Zod validation on IPC boundaries (measured < 0.2ms for typical payloads).
- Requires updating contracts before adding new frontend or backend capabilities.
