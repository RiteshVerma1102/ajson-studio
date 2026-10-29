import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron';
import {
  IpcChannels,
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
  AjsonError,
  ErrorCode,
  AjsonErrorPayload,
} from '@ajson/contracts';
import { DefaultWorkspaceService, NativeTerminalService } from '@ajson-studio/backend';

export class IpcGateway {
  private workspaceService: DefaultWorkspaceService;
  private terminalService: NativeTerminalService;
  private mainWindow: BrowserWindow;
  private unbindWatcher: (() => void) | null = null;
  private unbindWorkspace: (() => void) | null = null;
  private unbindGit: (() => void) | null = null;
  private terminalDataUnbinds = new Map<string, () => void>();
  private terminalExitUnbinds = new Map<string, () => void>();

  constructor(
    mainWindow: BrowserWindow,
    workspaceService: DefaultWorkspaceService,
    terminalService?: NativeTerminalService,
  ) {
    this.mainWindow = mainWindow;
    this.workspaceService = workspaceService;
    this.terminalService = terminalService ?? new NativeTerminalService();
  }

  public registerHandlers(): void {
    // -----------------------------------------------------------------------
    // Sender verification helper
    // -----------------------------------------------------------------------
    const verifySender = (event: IpcMainInvokeEvent) => {
      if (
        this.mainWindow &&
        !this.mainWindow.isDestroyed() &&
        event.sender.id !== this.mainWindow.webContents.id
      ) {
        throw new AjsonError(
          ErrorCode.PERMISSION_DENIED,
          'Unauthorized IPC invocation: untrusted sender'
        );
      }
    };

    // -----------------------------------------------------------------------
    // Helper to wrap IPC handlers with schema validation and error formatting
    // -----------------------------------------------------------------------
    const handle = <TReq, TRes>(
      channel: string,
      schema: { parse: (input: unknown) => TReq } | null,
      fn: (req: TReq, event: IpcMainInvokeEvent) => Promise<TRes>
    ) => {
      ipcMain.handle(channel, async (event, rawPayload: unknown) => {
        try {
          verifySender(event);
          const validated = schema ? schema.parse(rawPayload) : (rawPayload as TReq);
          return await fn(validated, event);
        } catch (err: unknown) {
          if (err instanceof AjsonError) {
            throw err.toJSON();
          }
          if (err && typeof err === 'object' && 'name' in err && err.name === 'ZodError') {
            const zodErr = err as { errors?: unknown[] };
            const payload: AjsonErrorPayload = {
              code: ErrorCode.INVALID_PAYLOAD,
              message: 'Invalid request payload schema',
              details: { zodErrors: zodErr.errors },
              timestamp: Date.now(),
            };
            throw payload;
          }
          const generic: AjsonErrorPayload = {
            code: ErrorCode.INTERNAL_ERROR,
            message: err instanceof Error ? err.message : String(err),
            timestamp: Date.now(),
          };
          throw generic;
        }
      });
    };

    // -----------------------------------------------------------------------
    // Workspace Channels
    // -----------------------------------------------------------------------
    handle(
      IpcChannels.WORKSPACE_OPEN,
      WorkspaceOpenRequestSchema,
      async (req) => {
        const ws = await this.workspaceService.open(req?.path);
        this.syncWatcherBridge();
        return ws;
      }
    );

    handle(
      IpcChannels.WORKSPACE_GET_CURRENT,
      null,
      async () => {
        return await this.workspaceService.getCurrent();
      }
    );

    handle(
      IpcChannels.WORKSPACE_CLOSE,
      null,
      async () => {
        await this.workspaceService.close();
        if (this.unbindWatcher) {
          this.unbindWatcher();
          this.unbindWatcher = null;
        }
        return { success: true };
      }
    );

    handle(
      IpcChannels.WORKSPACE_REFRESH,
      null,
      async () => {
        await this.workspaceService.refresh();
        return { success: true };
      }
    );

    // -----------------------------------------------------------------------
    // File System Channels (Delegated to active workspace FileSystemService)
    // -----------------------------------------------------------------------
    const getFs = () => {
      const fs = this.workspaceService.getFileSystem();
      if (!fs) {
        throw new AjsonError(
          ErrorCode.NOT_CONFIGURED,
          'No active workspace is open. Please open a workspace folder first.'
        );
      }
      return fs;
    };

    handle(
      IpcChannels.FS_READ_DIR,
      FsReadDirRequestSchema,
      async (req) => {
        return await getFs().readDir(req.path);
      }
    );

    handle(
      IpcChannels.FS_READ_FILE,
      FsReadFileRequestSchema,
      async (req) => {
        const content = await getFs().readFile(req.path, req.maxBytes);
        return { content };
      }
    );

    handle(
      IpcChannels.FS_WRITE_FILE,
      FsWriteFileRequestSchema,
      async (req) => {
        await getFs().writeFile(req.path, req.content);
        return { success: true };
      }
    );

    handle(
      IpcChannels.FS_CREATE_FILE,
      FsCreateFileRequestSchema,
      async (req) => {
        await getFs().createFile(req.path, req.content);
        return { success: true };
      }
    );

    handle(
      IpcChannels.FS_CREATE_DIR,
      FsCreateDirRequestSchema,
      async (req) => {
        await getFs().createDir(req.path);
        return { success: true };
      }
    );

    handle(
      IpcChannels.FS_RENAME,
      FsRenameRequestSchema,
      async (req) => {
        await getFs().rename(req.oldPath, req.newPath);
        return { success: true };
      }
    );

    handle(
      IpcChannels.FS_DELETE,
      FsDeleteRequestSchema,
      async (req) => {
        await getFs().delete(req.path);
        return { success: true };
      }
    );

    handle(
      IpcChannels.FS_STAT,
      FsStatRequestSchema,
      async (req) => {
        return await getFs().stat(req.path);
      }
    );

    handle(
      IpcChannels.FS_EXISTS,
      FsExistsRequestSchema,
      async (req) => {
        const exists = await getFs().exists(req.path);
        return { exists };
      }
    );

    // -----------------------------------------------------------------------
    // Terminal Channels
    // -----------------------------------------------------------------------
    handle(
      IpcChannels.TERMINAL_CREATE,
      TerminalCreateRequestSchema,
      async (req) => {
        const id = await this.terminalService.createSession(req.options);
        // Bridge data and exit events to renderer
        const dataUnbind = this.terminalService.onData(id, (data) => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(IpcChannels.TERMINAL_ON_DATA, { id, data });
          }
        });
        const exitUnbind = this.terminalService.onExit(id, (code) => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(IpcChannels.TERMINAL_ON_EXIT, { id, code });
          }
          this.terminalDataUnbinds.get(id)?.();
          this.terminalExitUnbinds.get(id)?.();
          this.terminalDataUnbinds.delete(id);
          this.terminalExitUnbinds.delete(id);
        });
        this.terminalDataUnbinds.set(id, dataUnbind);
        this.terminalExitUnbinds.set(id, exitUnbind);
        // Update workspace root so new sessions open in workspace cwd
        const ws = await this.workspaceService.getCurrent();
        if (ws) this.terminalService.setWorkspaceRoot(ws.rootPath);
        return { id };
      }
    );

    handle(
      IpcChannels.TERMINAL_WRITE,
      TerminalWriteRequestSchema,
      async (req) => {
        this.terminalService.write(req.id, req.data);
        return { success: true };
      }
    );

    handle(
      IpcChannels.TERMINAL_RESIZE,
      TerminalResizeRequestSchema,
      async (req) => {
        this.terminalService.resize(req.id, req.cols, req.rows);
        return { success: true };
      }
    );

    handle(
      IpcChannels.TERMINAL_KILL,
      TerminalKillRequestSchema,
      async (req) => {
        this.terminalDataUnbinds.get(req.id)?.();
        this.terminalExitUnbinds.get(req.id)?.();
        this.terminalDataUnbinds.delete(req.id);
        this.terminalExitUnbinds.delete(req.id);
        this.terminalService.kill(req.id);
        return { success: true };
      }
    );

    handle(
      IpcChannels.TERMINAL_RUN_COMMAND,
      TerminalRunCommandRequestSchema,
      async (req) => {
        return await this.terminalService.runCommand(req.id, req.command, {
          timeoutMs: req.timeoutMs,
        });
      }
    );

    handle(
      IpcChannels.TERMINAL_LIST,
      null,
      async () => {
        return this.terminalService.listSessions();
      }
    );

    handle(
      IpcChannels.TERMINAL_GET_CWD,
      TerminalGetCwdRequestSchema,
      async (req) => {
        return { cwd: this.terminalService.getCwd(req.id) };
      }
    );

    // -----------------------------------------------------------------------
    // Git Channels (Delegated to active workspace NativeGitService)
    // -----------------------------------------------------------------------
    const getGit = () => {
      const git = this.workspaceService.getGit();
      if (!git) {
        throw new AjsonError(
          ErrorCode.NOT_CONFIGURED,
          'No active workspace is open. Please open a workspace folder first.'
        );
      }
      return git;
    };

    handle(
      IpcChannels.GIT_STATUS,
      null,
      async () => {
        return await getGit().status();
      }
    );

    handle(
      IpcChannels.GIT_DIFF,
      GitDiffRequestSchema,
      async (req) => {
        return await getGit().diff(req.path, { staged: req.staged });
      }
    );

    handle(
      IpcChannels.GIT_STAGE,
      GitStageRequestSchema,
      async (req) => {
        await getGit().stage(req.paths);
        return { success: true };
      }
    );

    handle(
      IpcChannels.GIT_UNSTAGE,
      GitUnstageRequestSchema,
      async (req) => {
        await getGit().unstage(req.paths);
        return { success: true };
      }
    );

    handle(
      IpcChannels.GIT_DISCARD,
      GitDiscardRequestSchema,
      async (req) => {
        await getGit().discard(req.paths);
        return { success: true };
      }
    );

    handle(
      IpcChannels.GIT_COMMIT,
      GitCommitRequestSchema,
      async (req) => {
        return await getGit().commit(req.message, { amend: req.amend });
      }
    );

    handle(
      IpcChannels.GIT_LOG,
      GitLogRequestSchema,
      async (req) => {
        return await getGit().log({ limit: req.limit, branch: req.branch });
      }
    );

    handle(
      IpcChannels.GIT_BRANCHES,
      null,
      async () => {
        return await getGit().branches();
      }
    );

    handle(
      IpcChannels.GIT_CURRENT_BRANCH,
      null,
      async () => {
        const branch = await getGit().currentBranch();
        return { branch };
      }
    );

    handle(
      IpcChannels.GIT_CREATE_BRANCH,
      GitCreateBranchRequestSchema,
      async (req) => {
        await getGit().createBranch(req.name, req.from);
        return { success: true };
      }
    );

    handle(
      IpcChannels.GIT_CHECKOUT,
      GitCheckoutRequestSchema,
      async (req) => {
        await getGit().checkout(req.name);
        return { success: true };
      }
    );

    handle(
      IpcChannels.GIT_DELETE_BRANCH,
      GitDeleteBranchRequestSchema,
      async (req) => {
        await getGit().deleteBranch(req.name);
        return { success: true };
      }
    );

    handle(
      IpcChannels.GIT_STASH_PUSH,
      GitStashPushRequestSchema,
      async (req) => {
        const id = await getGit().stashPush(req.message);
        return { id };
      }
    );

    handle(
      IpcChannels.GIT_STASH_LIST,
      null,
      async () => {
        return await getGit().stashList();
      }
    );

    handle(
      IpcChannels.GIT_STASH_POP,
      GitStashPopRequestSchema,
      async (req) => {
        await getGit().stashPop(req.id);
        return { success: true };
      }
    );

    handle(
      IpcChannels.GIT_DIFF_SUMMARY,
      null,
      async () => {
        return await getGit().getDiffSummary();
      }
    );

    // -----------------------------------------------------------------------
    // Event Bridges (Workspace, Watcher & Git -> WebContents)
    // -----------------------------------------------------------------------
    this.unbindWorkspace = this.workspaceService.onDidChange((ws) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send(IpcChannels.WORKSPACE_EVENT, {
          event: ws ? 'opened' : 'closed',
          workspace: ws,
        });
      }
      // Keep terminal cwd root in sync with workspace
      this.terminalService.setWorkspaceRoot(ws?.rootPath);
      this.syncWatcherBridge();
      this.syncGitBridge();
    });

    this.syncWatcherBridge();
    this.syncGitBridge();
  }

  public unregisterHandlers(): void {
    if (this.unbindWatcher) {
      this.unbindWatcher();
      this.unbindWatcher = null;
    }
    if (this.unbindWorkspace) {
      this.unbindWorkspace();
      this.unbindWorkspace = null;
    }
    if (this.unbindGit) {
      this.unbindGit();
      this.unbindGit = null;
    }

    // Dispose all terminal bridges and PTY processes
    for (const [id, unbind] of this.terminalDataUnbinds) {
      unbind();
      this.terminalExitUnbinds.get(id)?.();
    }
    this.terminalDataUnbinds.clear();
    this.terminalExitUnbinds.clear();
    this.terminalService.disposeAll();

    const allChannels = [
      IpcChannels.WORKSPACE_OPEN,
      IpcChannels.WORKSPACE_GET_CURRENT,
      IpcChannels.WORKSPACE_CLOSE,
      IpcChannels.WORKSPACE_REFRESH,
      IpcChannels.FS_READ_DIR,
      IpcChannels.FS_READ_FILE,
      IpcChannels.FS_WRITE_FILE,
      IpcChannels.FS_CREATE_FILE,
      IpcChannels.FS_CREATE_DIR,
      IpcChannels.FS_RENAME,
      IpcChannels.FS_DELETE,
      IpcChannels.FS_STAT,
      IpcChannels.FS_EXISTS,
      IpcChannels.TERMINAL_CREATE,
      IpcChannels.TERMINAL_WRITE,
      IpcChannels.TERMINAL_RESIZE,
      IpcChannels.TERMINAL_KILL,
      IpcChannels.TERMINAL_RUN_COMMAND,
      IpcChannels.TERMINAL_LIST,
      IpcChannels.TERMINAL_GET_CWD,
      IpcChannels.GIT_STATUS,
      IpcChannels.GIT_DIFF,
      IpcChannels.GIT_STAGE,
      IpcChannels.GIT_UNSTAGE,
      IpcChannels.GIT_DISCARD,
      IpcChannels.GIT_COMMIT,
      IpcChannels.GIT_LOG,
      IpcChannels.GIT_BRANCHES,
      IpcChannels.GIT_CURRENT_BRANCH,
      IpcChannels.GIT_CREATE_BRANCH,
      IpcChannels.GIT_CHECKOUT,
      IpcChannels.GIT_DELETE_BRANCH,
      IpcChannels.GIT_STASH_PUSH,
      IpcChannels.GIT_STASH_LIST,
      IpcChannels.GIT_STASH_POP,
      IpcChannels.GIT_DIFF_SUMMARY,
    ];

    for (const ch of allChannels) {
      ipcMain.removeHandler(ch);
    }
  }

  private syncWatcherBridge(): void {
    if (this.unbindWatcher) {
      this.unbindWatcher();
      this.unbindWatcher = null;
    }

    const watcher = this.workspaceService.getWatcher();
    if (watcher) {
      this.unbindWatcher = watcher.onEvent((event, changedPath) => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send(IpcChannels.FS_EVENT, {
            event,
            path: changedPath,
          });
        }
      });
    }
  }

  private syncGitBridge(): void {
    if (this.unbindGit) {
      this.unbindGit();
      this.unbindGit = null;
    }

    const git = this.workspaceService.getGit();
    if (git) {
      this.unbindGit = git.onDidChange(() => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send(IpcChannels.GIT_ON_CHANGE, {});
        }
      });
    }
  }
}
