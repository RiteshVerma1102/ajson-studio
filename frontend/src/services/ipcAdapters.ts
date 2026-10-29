/**
 * IPC Service Adapters for Ajson Studio
 *
 * UNTESTED AGAINST A REAL BACKEND.
 * These thin adapters translate frontend service method calls into strongly typed
 * IPC messages across window.ajson. All payloads are validated at runtime against
 * the Zod schemas from @ajson/contracts before dispatch.
 */

import {
  FileSystemService,
  WorkspaceService,
  WorkspaceInfo,
  TerminalService,
  GitService,
  SearchService,
  DiagnosticsService,
  OutputService,
  AiService,
  AgentService,
  IndexService,
  IpcChannels,
  FileStat,
  FileEntry,
  TerminalSession,
  TerminalSessionOptions,
  GitFileStatus,
  GitCommit,
  GitDiffResult,
  GitDiffSummary,
  GitBranch,
  SearchQuery,
  SearchMatch,
  DiagnosticMarker,
  DiagnosticsFilter,
  OutputLine,
  OutputChannel,
  AiModelConfig,
  AiProviderId,
  AiChatMessage,
  AiContextItem,
  AIEvent,
  AgentMission,
  IndexSymbol,
  IndexStatus,
  // Zod Schemas
  FsReadDirRequestSchema,
  FsReadFileRequestSchema,
  FsWriteFileRequestSchema,
  FsCreateFileRequestSchema,
  FsCreateDirRequestSchema,
  FsRenameRequestSchema,
  FsDeleteRequestSchema,
  FsStatRequestSchema,
  FsExistsRequestSchema,
  WorkspaceOpenRequestSchema,
  TerminalCreateRequestSchema,
  TerminalWriteRequestSchema,
  TerminalResizeRequestSchema,
  TerminalKillRequestSchema,
  TerminalRunCommandRequestSchema,
  TerminalGetCwdRequestSchema,
  GitDiffRequestSchema,
  GitStageRequestSchema,
  GitUnstageRequestSchema,
  GitDiscardRequestSchema,
  GitCommitRequestSchema,
  GitLogRequestSchema,
  GitCreateBranchRequestSchema,
  GitCheckoutRequestSchema,
  GitDeleteBranchRequestSchema,
  GitStashPushRequestSchema,
  GitStashPopRequestSchema,
  SearchTextRequestSchema,
  AiSendMessageRequestSchema,
  AiCancelRequestSchema,
  AiSetKeyRequestSchema,
  AiHasKeyRequestSchema,
  AiClearKeyRequestSchema,
  AgentCreateMissionRequestSchema,
  AgentGetMissionRequestSchema,
  AgentCancelMissionRequestSchema,
  AgentApproveActionRequestSchema,
  AgentRejectActionRequestSchema,
  IndexSearchSymbolsRequestSchema,
  AjsonError,
  ErrorCode,
} from '@ajson/contracts';

interface PreloadBridge {
  invoke(channel: string, payload?: unknown): Promise<unknown>;
  on?(channel: string, listener: (event: unknown, data: unknown) => void): () => void;
  send?(channel: string, payload?: unknown): void;
}

function getBridge(): PreloadBridge {
  if (typeof window !== 'undefined' && (window as unknown as { ajson?: PreloadBridge }).ajson) {
    return (window as unknown as { ajson: PreloadBridge }).ajson;
  }
  throw new AjsonError(
    ErrorCode.SERVICE_UNAVAILABLE,
    'Electron IPC bridge (window.ajson) is not available'
  );
}

// ---------------------------------------------------------------------------
// File System IPC Adapter
// ---------------------------------------------------------------------------
export class IpcFileSystemService implements FileSystemService {
  async readDir(path: string): Promise<FileEntry[]> {
    const payload = FsReadDirRequestSchema.parse({ path });
    return (await getBridge().invoke(IpcChannels.FS_READ_DIR, payload)) as FileEntry[];
  }

  async readFile(path: string): Promise<string> {
    const payload = FsReadFileRequestSchema.parse({ path });
    const res = (await getBridge().invoke(IpcChannels.FS_READ_FILE, payload)) as { content: string };
    return res.content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const payload = FsWriteFileRequestSchema.parse({ path, content });
    await getBridge().invoke(IpcChannels.FS_WRITE_FILE, payload);
  }

  async createFile(path: string, content?: string): Promise<void> {
    const payload = FsCreateFileRequestSchema.parse({ path, content });
    await getBridge().invoke(IpcChannels.FS_CREATE_FILE, payload);
  }

  async createDir(path: string): Promise<void> {
    const payload = FsCreateDirRequestSchema.parse({ path });
    await getBridge().invoke(IpcChannels.FS_CREATE_DIR, payload);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const payload = FsRenameRequestSchema.parse({ oldPath, newPath });
    await getBridge().invoke(IpcChannels.FS_RENAME, payload);
  }

  async delete(path: string): Promise<void> {
    const payload = FsDeleteRequestSchema.parse({ path });
    await getBridge().invoke(IpcChannels.FS_DELETE, payload);
  }

  async stat(path: string): Promise<FileStat | null> {
    const payload = FsStatRequestSchema.parse({ path });
    return (await getBridge().invoke(IpcChannels.FS_STAT, payload)) as FileStat | null;
  }

  async exists(path: string): Promise<boolean> {
    const payload = FsExistsRequestSchema.parse({ path });
    const res = (await getBridge().invoke(IpcChannels.FS_EXISTS, payload)) as { exists: boolean };
    return res.exists;
  }

  watch(cb: (event: 'change' | 'add' | 'unlink', path: string) => void): () => void {
    const bridge = getBridge();
    if (bridge.on) {
      return bridge.on(IpcChannels.FS_EVENT, (_evt, data: unknown) => {
        const parsed = data as { event: 'change' | 'add' | 'unlink'; path: string };
        cb(parsed.event, parsed.path);
      });
    }
    return () => {};
  }
}

// ---------------------------------------------------------------------------
// Terminal IPC Adapter
// ---------------------------------------------------------------------------
export class IpcTerminalService implements TerminalService {
  async createSession(options?: TerminalSessionOptions): Promise<string> {
    const payload = TerminalCreateRequestSchema.parse({ options });
    const res = (await getBridge().invoke(IpcChannels.TERMINAL_CREATE, payload)) as { id: string };
    return res.id;
  }

  write(id: string, data: string): void {
    const payload = TerminalWriteRequestSchema.parse({ id, data });
    getBridge().invoke(IpcChannels.TERMINAL_WRITE, payload).catch(() => {});
  }

  resize(id: string, cols: number, rows: number): void {
    const payload = TerminalResizeRequestSchema.parse({ id, cols, rows });
    getBridge().invoke(IpcChannels.TERMINAL_RESIZE, payload).catch(() => {});
  }

  kill(id: string): void {
    const payload = TerminalKillRequestSchema.parse({ id });
    getBridge().invoke(IpcChannels.TERMINAL_KILL, payload).catch(() => {});
  }

  async runCommand(
    id: string,
    command: string,
    opts?: { timeoutMs?: number }
  ): Promise<{ exitCode: number; output: string }> {
    const payload = TerminalRunCommandRequestSchema.parse({ id, command, timeoutMs: opts?.timeoutMs });
    return (await getBridge().invoke(IpcChannels.TERMINAL_RUN_COMMAND, payload)) as {
      exitCode: number;
      output: string;
    };
  }

  listSessions(): TerminalSession[] {
    return [];
  }

  getCwd(id: string): string {
    const payload = TerminalGetCwdRequestSchema.parse({ id });
    getBridge().invoke(IpcChannels.TERMINAL_GET_CWD, payload).catch(() => {});
    return '';
  }

  onData(id: string, cb: (data: string) => void): () => void {
    const bridge = getBridge();
    if (bridge.on) {
      return bridge.on(IpcChannels.TERMINAL_ON_DATA, (_evt, payload: unknown) => {
        const p = payload as { id: string; data: string };
        if (p.id === id) cb(p.data);
      });
    }
    return () => {};
  }

  onExit(id: string, cb: (code: number) => void): () => void {
    const bridge = getBridge();
    if (bridge.on) {
      return bridge.on(IpcChannels.TERMINAL_ON_EXIT, (_evt, payload: unknown) => {
        const p = payload as { id: string; code: number };
        if (p.id === id) cb(p.code);
      });
    }
    return () => {};
  }

  onCommandStart(_id: string, _cb: (cmd: string) => void): () => void {
    return () => {};
  }

  onCommandEnd(_id: string, _cb: (cmd: string, code: number) => void): () => void {
    return () => {};
  }
}

// ---------------------------------------------------------------------------
// Git IPC Adapter
// ---------------------------------------------------------------------------
export class IpcGitService implements GitService {
  async status(): Promise<GitFileStatus[]> {
    return (await getBridge().invoke(IpcChannels.GIT_STATUS)) as GitFileStatus[];
  }

  async diff(path: string, opts?: { staged?: boolean }): Promise<GitDiffResult> {
    const payload = GitDiffRequestSchema.parse({ path, staged: opts?.staged });
    return (await getBridge().invoke(IpcChannels.GIT_DIFF, payload)) as GitDiffResult;
  }

  async stage(paths: string[]): Promise<void> {
    const payload = GitStageRequestSchema.parse({ paths });
    await getBridge().invoke(IpcChannels.GIT_STAGE, payload);
  }

  async unstage(paths: string[]): Promise<void> {
    const payload = GitUnstageRequestSchema.parse({ paths });
    await getBridge().invoke(IpcChannels.GIT_UNSTAGE, payload);
  }

  async discard(paths: string[]): Promise<void> {
    const payload = GitDiscardRequestSchema.parse({ paths });
    await getBridge().invoke(IpcChannels.GIT_DISCARD, payload);
  }

  async commit(message: string, opts?: { amend?: boolean }): Promise<GitCommit> {
    const payload = GitCommitRequestSchema.parse({ message, amend: opts?.amend });
    return (await getBridge().invoke(IpcChannels.GIT_COMMIT, payload)) as GitCommit;
  }

  async log(opts?: { limit?: number; branch?: string }): Promise<GitCommit[]> {
    const payload = GitLogRequestSchema.parse({ limit: opts?.limit, branch: opts?.branch });
    return (await getBridge().invoke(IpcChannels.GIT_LOG, payload)) as GitCommit[];
  }

  async branches(): Promise<GitBranch[]> {
    return (await getBridge().invoke(IpcChannels.GIT_BRANCHES)) as GitBranch[];
  }

  async currentBranch(): Promise<string> {
    const res = (await getBridge().invoke(IpcChannels.GIT_CURRENT_BRANCH)) as { branch: string };
    return res.branch;
  }

  async createBranch(name: string, from?: string): Promise<void> {
    const payload = GitCreateBranchRequestSchema.parse({ name, from });
    await getBridge().invoke(IpcChannels.GIT_CREATE_BRANCH, payload);
  }

  async checkout(name: string): Promise<void> {
    const payload = GitCheckoutRequestSchema.parse({ name });
    await getBridge().invoke(IpcChannels.GIT_CHECKOUT, payload);
  }

  async deleteBranch(name: string): Promise<void> {
    const payload = GitDeleteBranchRequestSchema.parse({ name });
    await getBridge().invoke(IpcChannels.GIT_DELETE_BRANCH, payload);
  }

  async stashPush(message?: string): Promise<string> {
    const payload = GitStashPushRequestSchema.parse({ message });
    const res = (await getBridge().invoke(IpcChannels.GIT_STASH_PUSH, payload)) as { id: string };
    return res.id;
  }

  async stashList(): Promise<{ id: string; message: string; date: string }[]> {
    return (await getBridge().invoke(IpcChannels.GIT_STASH_LIST)) as {
      id: string;
      message: string;
      date: string;
    }[];
  }

  async stashPop(id?: string): Promise<void> {
    const payload = GitStashPopRequestSchema.parse({ id });
    await getBridge().invoke(IpcChannels.GIT_STASH_POP, payload);
  }

  async getDiffSummary(): Promise<GitDiffSummary> {
    return (await getBridge().invoke(IpcChannels.GIT_DIFF_SUMMARY)) as GitDiffSummary;
  }

  onDidChange(cb: () => void): () => void {
    const bridge = getBridge();
    if (bridge.on) {
      return bridge.on(IpcChannels.GIT_ON_CHANGE, () => cb());
    }
    return () => {};
  }
}

// ---------------------------------------------------------------------------
// Search IPC Adapter
// ---------------------------------------------------------------------------
export class IpcSearchService implements SearchService {
  async searchText(query: SearchQuery): Promise<SearchMatch[]> {
    const payload = SearchTextRequestSchema.parse(query);
    return (await getBridge().invoke(IpcChannels.SEARCH_QUERY, payload)) as SearchMatch[];
  }
}

// ---------------------------------------------------------------------------
// Diagnostics IPC Adapter (Renderer-Hosted with Bridge Fallback)
// ---------------------------------------------------------------------------
export class IpcDiagnosticsService implements DiagnosticsService {
  private markers: DiagnosticMarker[] = [];
  private listeners: Set<() => void> = new Set();

  list(filter?: DiagnosticsFilter): DiagnosticMarker[] {
    let result = [...this.markers];
    if (filter?.currentFileOnly && filter.activeUri) {
      result = result.filter((m) => m.uri === filter.activeUri);
    }
    if (filter?.severity && filter.severity.length > 0) {
      result = result.filter((m) => filter.severity?.includes(m.severity));
    }
    return result;
  }

  publish(source: string, uri: string, markers: DiagnosticMarker[]): void {
    this.markers = this.markers.filter((m) => !(m.source === source && m.uri === uri));
    this.markers.push(...markers);
    this.notify();
  }

  clearSource(source: string): void {
    this.markers = this.markers.filter((m) => m.source !== source);
    this.notify();
  }

  clearUri(uri: string): void {
    this.markers = this.markers.filter((m) => m.uri !== uri);
    this.notify();
  }

  onDidChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    for (const cb of this.listeners) {
      try {
        cb();
      } catch (err) {
        console.error('Error in diagnostics listener', err);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Output IPC Adapter (Renderer-Hosted with Bridge Fallback)
// ---------------------------------------------------------------------------
export class IpcOutputService implements OutputService {
  private lines: Map<OutputChannel, OutputLine[]> = new Map();
  private listeners: Set<(line: OutputLine) => void> = new Set();

  append(channel: OutputChannel, text: string, level: OutputLine['level'] = 'info'): void {
    const line: OutputLine = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      channel,
      text,
      level,
      timestamp: Date.now(),
    };
    const list = this.lines.get(channel) || [];
    list.push(line);
    this.lines.set(channel, list);
    for (const cb of this.listeners) {
      try {
        cb(line);
      } catch (err) {
        console.error('Error in output listener', err);
      }
    }
  }

  clear(channel: OutputChannel): void {
    this.lines.set(channel, []);
  }

  list(channel: OutputChannel): OutputLine[] {
    return this.lines.get(channel) || [];
  }

  onDidAppend(cb: (line: OutputLine) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
}

// ---------------------------------------------------------------------------
// AI IPC Adapter
// ---------------------------------------------------------------------------
export class IpcAiService implements AiService {
  async sendMessage(params: {
    messages: AiChatMessage[];
    provider?: AiProviderId;
    model?: string;
    context?: AiContextItem[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> {
    const payload = AiSendMessageRequestSchema.parse(params);
    const res = (await getBridge().invoke(IpcChannels.AI_CHAT, payload)) as { text: string };
    return res.text;
  }

  async cancelRequest(requestId: string): Promise<void> {
    const payload = AiCancelRequestSchema.parse({ requestId });
    await getBridge().invoke(IpcChannels.AI_CANCEL, payload);
  }

  async setApiKey(provider: AiProviderId, key: string): Promise<void> {
    const payload = AiSetKeyRequestSchema.parse({ provider, key });
    await getBridge().invoke(IpcChannels.AI_SET_KEY, payload);
  }

  async hasApiKey(provider: AiProviderId): Promise<boolean> {
    const payload = AiHasKeyRequestSchema.parse({ provider });
    const res = (await getBridge().invoke(IpcChannels.AI_HAS_KEY, payload)) as { hasKey: boolean };
    return res.hasKey;
  }

  async clearApiKey(provider: AiProviderId): Promise<void> {
    const payload = AiClearKeyRequestSchema.parse({ provider });
    await getBridge().invoke(IpcChannels.AI_CLEAR_KEY, payload);
  }

  async getProviders(): Promise<AiModelConfig[]> {
    return (await getBridge().invoke(IpcChannels.AI_GET_PROVIDERS)) as AiModelConfig[];
  }

  async getActiveProvider(): Promise<AiProviderId> {
    return 'anthropic';
  }

  async setActiveProvider(_provider: AiProviderId): Promise<void> {
    // Stored in settings
  }

  onStreamEvent(cb: (event: AIEvent) => void): () => void {
    const bridge = getBridge();
    if (bridge.on) {
      return bridge.on(IpcChannels.AI_STREAM_EVENT, (_evt, data: unknown) => {
        cb(data as AIEvent);
      });
    }
    return () => {};
  }
}

// ---------------------------------------------------------------------------
// Agent IPC Adapter
// ---------------------------------------------------------------------------
export class IpcAgentService implements AgentService {
  async createMission(goal: string, options?: { model?: string }): Promise<AgentMission> {
    const payload = AgentCreateMissionRequestSchema.parse({ goal, model: options?.model });
    return (await getBridge().invoke(IpcChannels.AGENT_CREATE_MISSION, payload)) as AgentMission;
  }

  async listMissions(): Promise<AgentMission[]> {
    return (await getBridge().invoke(IpcChannels.AGENT_LIST_MISSIONS)) as AgentMission[];
  }

  async getMission(id: string): Promise<AgentMission | null> {
    const payload = AgentGetMissionRequestSchema.parse({ id });
    return (await getBridge().invoke(IpcChannels.AGENT_GET_MISSION, payload)) as AgentMission | null;
  }

  async cancelMission(id: string): Promise<void> {
    const payload = AgentCancelMissionRequestSchema.parse({ id });
    await getBridge().invoke(IpcChannels.AGENT_CANCEL_MISSION, payload);
  }

  async approveAction(approvalId: string): Promise<void> {
    const payload = AgentApproveActionRequestSchema.parse({ approvalId });
    await getBridge().invoke(IpcChannels.AGENT_APPROVE_ACTION, payload);
  }

  async rejectAction(approvalId: string, reason?: string): Promise<void> {
    const payload = AgentRejectActionRequestSchema.parse({ approvalId, reason });
    await getBridge().invoke(IpcChannels.AGENT_REJECT_ACTION, payload);
  }

  onAgentEvent(cb: (missionId: string, event: AIEvent) => void): () => void {
    const bridge = getBridge();
    if (bridge.on) {
      return bridge.on(IpcChannels.AGENT_EVENT, (_evt, data: unknown) => {
        const p = data as { missionId: string; event: AIEvent };
        cb(p.missionId, p.event);
      });
    }
    return () => {};
  }
}

// ---------------------------------------------------------------------------
// Index IPC Adapter
// ---------------------------------------------------------------------------
export class IpcIndexService implements IndexService {
  async indexWorkspace(): Promise<void> {
    await getBridge().invoke(IpcChannels.INDEX_WORKSPACE);
  }

  async searchSymbols(query: string, limit?: number): Promise<IndexSymbol[]> {
    const payload = IndexSearchSymbolsRequestSchema.parse({ query, limit });
    return (await getBridge().invoke(IpcChannels.INDEX_SEARCH_SYMBOLS, payload)) as IndexSymbol[];
  }

  async getStatus(): Promise<IndexStatus> {
    return (await getBridge().invoke(IpcChannels.INDEX_GET_STATUS)) as IndexStatus;
  }
}

// ---------------------------------------------------------------------------
// Workspace IPC Adapter
// ---------------------------------------------------------------------------
export class IpcWorkspaceService implements WorkspaceService {
  async open(path?: string): Promise<WorkspaceInfo | null> {
    const payload = WorkspaceOpenRequestSchema.parse({ path });
    return (await getBridge().invoke(IpcChannels.WORKSPACE_OPEN, payload)) as WorkspaceInfo | null;
  }

  async getCurrent(): Promise<WorkspaceInfo | null> {
    return (await getBridge().invoke(IpcChannels.WORKSPACE_GET_CURRENT)) as WorkspaceInfo | null;
  }

  async close(): Promise<void> {
    await getBridge().invoke(IpcChannels.WORKSPACE_CLOSE);
  }

  async refresh(): Promise<void> {
    await getBridge().invoke(IpcChannels.WORKSPACE_REFRESH);
  }

  onDidChange(cb: (workspace: WorkspaceInfo | null) => void): () => void {
    const bridge = getBridge();
    if (bridge.on) {
      return bridge.on(IpcChannels.WORKSPACE_EVENT, (_evt, data: unknown) => {
        const parsed = data as { event: string; workspace: WorkspaceInfo | null };
        cb(parsed.workspace);
      });
    }
    return () => {};
  }
}

