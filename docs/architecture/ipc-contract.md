# Ajson Studio — IPC Interface Contract Specification

- **Contract Version:** `0.1.0`
- **Specification Date:** 2026-10-27
- **Target Implementation:** Electron 33+ `contextBridge` + Node.js Main Process Gateway
- **Schema Validation Library:** `zod` (`@ajson/contracts`)

---

## 1. Overview & Protocol Architecture

All communication between the Chromium renderer process and the Electron main process traverses a strongly typed, sandboxed IPC gateway exposed on `window.ajson`.

```
┌────────────────────────────────┐                 ┌────────────────────────────────┐
│        Renderer Process        │                 │          Main Process          │
│                                │                 │                                │
│   UI Components & Services     │                 │   Privileged System Gateway    │
│              │                 │                 │              ▲                 │
│              ▼                 │                 │              │                 │
│   IpcService Adapter           │                 │   Payload Validator (Zod)      │
│   (Schema Validation)          │                 │              │                 │
│              │                 │                 │              ▼                 │
│              ▼                 │  ipcRenderer    │   Native Host Handlers         │
│   window.ajson.invoke()        ├────────────────►│   (FS, PTY, Git, Model APIs)   │
│   window.ajson.on()            │◄────────────────┤                                │
└────────────────────────────────┘   ipcMain.send  └────────────────────────────────┘
```

### 1.1 Error Serialization
All IPC handlers catch exceptions and normalize them to `AjsonErrorPayload`:
```typescript
interface AjsonErrorPayload {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}
```
If a handler fails, the Promise in the renderer rejects with an instance of `AjsonError`.

### 1.2 Global Security Rules
1. **Renderer is Untrusted**: Main process re-validates all request bodies with `@ajson/contracts` Zod schemas.
2. **Path Confinement**: All file paths are strictly clamped to the active project root; attempts to escape via `..` or external symlinks reject with `PATH_TRAVERSAL`.
3. **Execution Approval**: Terminal commands, file deletions, and AI-initiated system mutations require main-process authorization check.

---

## 2. Service IPC Matrix

| Domain | Service Method | IPC Channel | Request Schema | Response Schema | Pattern | Cancellation | Default Timeout |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **FS** | `readDir(path)` | `ajson:fs:readDir` | `FsReadDirRequestSchema` | `FsReadDirResponseSchema` | Request / Response | N/A | 10,000ms |
| **FS** | `readFile(path)` | `ajson:fs:readFile` | `FsReadFileRequestSchema` | `FsReadFileResponseSchema` | Request / Response | N/A | 15,000ms |
| **FS** | `writeFile(path, content)` | `ajson:fs:writeFile` | `FsWriteFileRequestSchema` | `FsWriteFileResponseSchema` | Request / Response | N/A | 15,000ms |
| **FS** | `createFile(path, content?)` | `ajson:fs:createFile` | `FsCreateFileRequestSchema` | `FsCreateFileResponseSchema` | Request / Response | N/A | 10,000ms |
| **FS** | `createDir(path)` | `ajson:fs:createDir` | `FsCreateDirRequestSchema` | `FsCreateDirResponseSchema` | Request / Response | N/A | 10,000ms |
| **FS** | `rename(oldPath, newPath)` | `ajson:fs:rename` | `FsRenameRequestSchema` | `FsRenameResponseSchema` | Request / Response | N/A | 10,000ms |
| **FS** | `delete(path)` | `ajson:fs:delete` | `FsDeleteRequestSchema` | `FsDeleteResponseSchema` | Request / Response | N/A | 15,000ms |
| **FS** | `stat(path)` | `ajson:fs:stat` | `FsStatRequestSchema` | `FsStatResponseSchema` | Request / Response | N/A | 5,000ms |
| **FS** | `exists(path)` | `ajson:fs:exists` | `FsExistsRequestSchema` | `FsExistsResponseSchema` | Request / Response | N/A | 5,000ms |
| **FS** | `watch(cb)` | `ajson:fs:watch` + `ajson:fs:event` | None | None | Event Stream | Unsubscribe | Lifecycle |
| **Terminal** | `createSession(options?)` | `ajson:terminal:create` | `TerminalCreateRequestSchema` | `TerminalCreateResponseSchema` | Request / Response | N/A | 10,000ms |
| **Terminal** | `write(id, data)` | `ajson:terminal:write` | `TerminalWriteRequestSchema` | `TerminalWriteResponseSchema` | Fire & Forget | N/A | 5,000ms |
| **Terminal** | `resize(id, cols, rows)` | `ajson:terminal:resize` | `TerminalResizeRequestSchema` | `TerminalResizeResponseSchema` | Fire & Forget | N/A | 2,000ms |
| **Terminal** | `kill(id)` | `ajson:terminal:kill` | `TerminalKillRequestSchema` | `TerminalKillResponseSchema` | Request / Response | N/A | 5,000ms |
| **Terminal** | `runCommand(id, cmd, opts?)` | `ajson:terminal:runCommand` | `TerminalRunCommandRequestSchema` | `TerminalRunCommandResponseSchema` | Request / Response | SIGINT / Kill | 60,000ms |
| **Terminal** | `listSessions()` | `ajson:terminal:list` | None | `TerminalListResponseSchema` | Request / Response | N/A | 5,000ms |
| **Terminal** | `getCwd(id)` | `ajson:terminal:getCwd` | `TerminalGetCwdRequestSchema` | `TerminalGetCwdResponseSchema` | Request / Response | N/A | 2,000ms |
| **Terminal** | `onData(id, cb)` | `ajson:terminal:onData` | None | None | Event Stream | Unsubscribe | Lifecycle |
| **Terminal** | `onExit(id, cb)` | `ajson:terminal:onExit` | None | None | Event Stream | Unsubscribe | Lifecycle |
| **Git** | `status()` | `ajson:git:status` | None | `GitStatusResponseSchema` | Request / Response | N/A | 15,000ms |
| **Git** | `diff(path, opts?)` | `ajson:git:diff` | `GitDiffRequestSchema` | `GitDiffResponseSchema` | Request / Response | N/A | 15,000ms |
| **Git** | `stage(paths)` | `ajson:git:stage` | `GitStageRequestSchema` | `GitStageResponseSchema` | Request / Response | N/A | 15,000ms |
| **Git** | `unstage(paths)` | `ajson:git:unstage` | `GitUnstageRequestSchema` | `GitUnstageResponseSchema` | Request / Response | N/A | 15,000ms |
| **Git** | `discard(paths)` | `ajson:git:discard` | `GitDiscardRequestSchema` | `GitDiscardResponseSchema` | Request / Response | N/A | 15,000ms |
| **Git** | `commit(msg, opts?)` | `ajson:git:commit` | `GitCommitRequestSchema` | `GitCommitResponseSchema` | Request / Response | N/A | 20,000ms |
| **Git** | `log(opts?)` | `ajson:git:log` | `GitLogRequestSchema` | `GitLogResponseSchema` | Request / Response | N/A | 15,000ms |
| **Git** | `branches()` | `ajson:git:branches` | None | `GitBranchesResponseSchema` | Request / Response | N/A | 10,000ms |
| **Git** | `currentBranch()` | `ajson:git:currentBranch` | None | `GitCurrentBranchResponseSchema` | Request / Response | N/A | 5,000ms |
| **Git** | `createBranch(name, from?)` | `ajson:git:createBranch` | `GitCreateBranchRequestSchema` | `GitCreateBranchResponseSchema` | Request / Response | N/A | 10,000ms |
| **Git** | `checkout(name)` | `ajson:git:checkout` | `GitCheckoutRequestSchema` | `GitCheckoutResponseSchema` | Request / Response | N/A | 20,000ms |
| **Git** | `deleteBranch(name)` | `ajson:git:deleteBranch` | `GitDeleteBranchRequestSchema` | `GitDeleteBranchResponseSchema` | Request / Response | N/A | 10,000ms |
| **Git** | `stashPush(msg?)` | `ajson:git:stashPush` | `GitStashPushRequestSchema` | `GitStashPushResponseSchema` | Request / Response | N/A | 15,000ms |
| **Git** | `stashList()` | `ajson:git:stashList` | None | `GitStashListResponseSchema` | Request / Response | N/A | 10,000ms |
| **Git** | `stashPop(id?)` | `ajson:git:stashPop` | `GitStashPopRequestSchema` | `GitStashPopResponseSchema` | Request / Response | N/A | 15,000ms |
| **Git** | `getDiffSummary()` | `ajson:git:diffSummary` | None | `GitDiffSummaryResponseSchema` | Request / Response | N/A | 15,000ms |
| **Git** | `onDidChange(cb)` | `ajson:git:onChange` | None | None | Event Stream | Unsubscribe | Lifecycle |
| **Search** | `searchText(query)` | `ajson:search:query` | `SearchTextRequestSchema` | `SearchTextResponseSchema` | Request / Response | AbortSignal | 30,000ms |
| **AI** | `sendMessage(params)` | `ajson:ai:chat` | `AiSendMessageRequestSchema` | `AiSendMessageResponseSchema` | Request / Response + Stream | `cancelRequest()` | 120,000ms |
| **AI** | `cancelRequest(reqId)` | `ajson:ai:cancel` | `AiCancelRequestSchema` | `AiCancelResponseSchema` | Request / Response | N/A | 5,000ms |
| **AI** | `setApiKey(provider, key)`| `ajson:ai:setKey` | `AiSetKeyRequestSchema` | `AiSetKeyResponseSchema` | Request / Response | N/A | 5,000ms |
| **AI** | `hasApiKey(provider)` | `ajson:ai:hasKey` | `AiHasKeyRequestSchema` | `AiHasKeyResponseSchema` | Request / Response | N/A | 5,000ms |
| **AI** | `clearApiKey(provider)` | `ajson:ai:clearKey` | `AiClearKeyRequestSchema` | `AiClearKeyResponseSchema` | Request / Response | N/A | 5,000ms |
| **AI** | `getProviders()` | `ajson:ai:getProviders` | None | `AiGetProvidersResponseSchema` | Request / Response | N/A | 5,000ms |
| **AI** | Stream Events | `ajson:ai:streamEvent` | None | `AIEventSchema` | Event Stream | Unsubscribe | Per-request |
| **Agent** | `createMission(goal, opts?)` | `ajson:agent:createMission` | `AgentCreateMissionRequestSchema` | `AgentCreateMissionResponseSchema` | Request / Response | `cancelMission()` | 30,000ms |
| **Agent** | `listMissions()` | `ajson:agent:listMissions` | None | `AgentListMissionsResponseSchema` | Request / Response | N/A | 10,000ms |
| **Agent** | `getMission(id)` | `ajson:agent:getMission` | `AgentGetMissionRequestSchema` | `AgentGetMissionResponseSchema` | Request / Response | N/A | 5,000ms |
| **Agent** | `cancelMission(id)` | `ajson:agent:cancelMission` | `AgentCancelMissionRequestSchema` | `AgentCancelMissionResponseSchema` | Request / Response | N/A | 5,000ms |
| **Agent** | `approveAction(approvalId)` | `ajson:agent:approveAction` | `AgentApproveActionRequestSchema` | `AgentApproveActionResponseSchema` | Request / Response | N/A | 10,000ms |
| **Agent** | `rejectAction(approvalId, reason?)` | `ajson:agent:rejectAction` | `AgentRejectActionRequestSchema` | `AgentRejectActionResponseSchema` | Request / Response | N/A | 10,000ms |
| **Agent** | Mission Events | `ajson:agent:event` | None | `AgentEventPayloadSchema` | Event Stream | Unsubscribe | Per-mission |
| **Index** | `indexWorkspace()` | `ajson:index:workspace` | None | `IndexWorkspaceResponseSchema` | Request / Response | N/A | 60,000ms |
| **Index** | `searchSymbols(query, limit?)` | `ajson:index:searchSymbols` | `IndexSearchSymbolsRequestSchema` | `IndexSearchSymbolsResponseSchema` | Request / Response | N/A | 10,000ms |
| **Index** | `getStatus()` | `ajson:index:getStatus` | None | `IndexGetStatusResponseSchema` | Request / Response | N/A | 5,000ms |

---

## 3. Preload Context Bridge Type (`window.ajson`)

```typescript
export interface AjsonPreloadBridge {
  invoke(channel: string, payload?: unknown): Promise<unknown>;
  on(channel: string, listener: (event: unknown, data: unknown) => void): () => void;
  send(channel: string, payload?: unknown): void;
}

declare global {
  interface Window {
    ajson?: AjsonPreloadBridge;
  }
}
```
