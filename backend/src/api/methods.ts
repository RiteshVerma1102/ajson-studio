/**
 * RPC method registrations: wires all service methods into the RpcRouter.
 *
 * Naming convention: `<service>.<method>`
 * e.g. "workspace.open", "fs.readFile", "git.status"
 */
import { z } from 'zod';
import { RpcRouter } from './router';
import {
  // Workspace
  WorkspaceOpenRequestSchema,
  // FS
  FsReadDirRequestSchema,
  FsReadFileRequestSchema,
  FsWriteFileRequestSchema,
  FsCreateFileRequestSchema,
  FsCreateDirRequestSchema,
  FsRenameRequestSchema,
  FsDeleteRequestSchema,
  FsStatRequestSchema,
  FsExistsRequestSchema,
  // Git
  GitDiffRequestSchema,
  GitCommitRequestSchema,
  GitStageRequestSchema,
  GitUnstageRequestSchema,
  GitDiscardRequestSchema,
  GitLogRequestSchema,
  GitCreateBranchRequestSchema,
  GitCheckoutRequestSchema,
  GitDeleteBranchRequestSchema,
  GitStashPushRequestSchema,
  GitStashPopRequestSchema,
  // Terminal
  TerminalCreateRequestSchema,
  TerminalWriteRequestSchema,
  TerminalResizeRequestSchema,
  TerminalKillRequestSchema,
  TerminalRunCommandRequestSchema,
  TerminalGetCwdRequestSchema,
  // Search
  SearchTextRequestSchema,
} from '@ajson/contracts';
import { type DefaultWorkspaceService } from '../services/workspaceService';
import { type NativeSearchService } from '../services/nativeSearch';
import { type SettingsService } from '../services/settingsService';
import { type NativeTerminalService } from '../services/nativeTerminal';

// Settings schemas (inline — not in contracts yet)
const SettingsGetSchema = z.object({
  key: z.string(),
  namespace: z.string().optional(),
  defaultValue: z.unknown().optional(),
});
const SettingsSetSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  namespace: z.string().optional(),
});
const SettingsDeleteSchema = z.object({
  key: z.string(),
  namespace: z.string().optional(),
});
const SettingsKeysSchema = z.object({
  namespace: z.string().optional(),
});

type Services = {
  workspace: DefaultWorkspaceService;
  /** Returns the current search service (changes when workspace opens/closes). */
  getSearch: () => NativeSearchService | null;
  settings: SettingsService;
  terminal: NativeTerminalService;
};

export function registerAllMethods(router: RpcRouter, svc: Services): void {
  const { workspace, settings, terminal } = svc;
  const getSearch = () => svc.getSearch();

  // -------------------------------------------------------------------------
  // Health / meta
  // -------------------------------------------------------------------------
  router.register('health', z.object({}), async () => ({
    status: 'ok',
    methods: router.methods(),
  }));

  router.register('version', z.object({}), async () => ({
    version: process.env.npm_package_version ?? '0.1.0',
    node: process.version,
    platform: process.platform,
  }));

  // -------------------------------------------------------------------------
  // Workspace
  // -------------------------------------------------------------------------
  router.register('workspace.open', WorkspaceOpenRequestSchema, async ({ path }) =>
    workspace.open(path)
  );

  router.register('workspace.getCurrent', z.object({}), async () =>
    workspace.getCurrent()
  );

  router.register('workspace.close', z.object({}), async () => {
    await workspace.close();
    return { success: true };
  });

  router.register('workspace.refresh', z.object({}), async () => {
    await workspace.refresh();
    return { success: true };
  });

  // -------------------------------------------------------------------------
  // File System
  // -------------------------------------------------------------------------
  const getFs = () => {
    const fsvc = workspace.getFileSystem();
    if (!fsvc) throw new Error('No workspace open');
    return fsvc;
  };

  router.register('fs.readDir', FsReadDirRequestSchema, async ({ path }) =>
    getFs().readDir(path)
  );

  router.register('fs.readFile', FsReadFileRequestSchema, async ({ path }) =>
    getFs().readFile(path)
  );

  router.register('fs.writeFile', FsWriteFileRequestSchema, async ({ path, content }) => {
    await getFs().writeFile(path, content);
    return { success: true };
  });

  router.register('fs.createFile', FsCreateFileRequestSchema, async ({ path, content }) => {
    await getFs().createFile(path, content);
    return { success: true };
  });

  router.register('fs.createDir', FsCreateDirRequestSchema, async ({ path }) => {
    await getFs().createDir(path);
    return { success: true };
  });

  router.register('fs.rename', FsRenameRequestSchema, async ({ oldPath, newPath }) => {
    await getFs().rename(oldPath, newPath);
    return { success: true };
  });

  router.register('fs.delete', FsDeleteRequestSchema, async ({ path }) => {
    await getFs().delete(path);
    return { success: true };
  });

  router.register('fs.stat', FsStatRequestSchema, async ({ path }) =>
    getFs().stat(path)
  );

  router.register('fs.exists', FsExistsRequestSchema, async ({ path }) => ({
    exists: await getFs().exists(path),
  }));

  // -------------------------------------------------------------------------
  // Git
  // -------------------------------------------------------------------------
  const getGit = () => {
    const g = workspace.getGit();
    if (!g) throw new Error('No workspace open');
    return g;
  };

  router.register('git.status', z.object({}), async () =>
    getGit().status()
  );

  router.register('git.diff', GitDiffRequestSchema, async ({ path: p, staged }) =>
    getGit().diff(p, { staged })
  );

  router.register('git.stage', GitStageRequestSchema, async ({ paths }) => {
    await getGit().stage(paths);
    return { success: true };
  });

  router.register('git.unstage', GitUnstageRequestSchema, async ({ paths }) => {
    await getGit().unstage(paths);
    return { success: true };
  });

  router.register('git.discard', GitDiscardRequestSchema, async ({ paths }) => {
    await getGit().discard(paths);
    return { success: true };
  });

  router.register('git.commit', GitCommitRequestSchema, async ({ message, amend }) =>
    getGit().commit(message, { amend })
  );

  router.register('git.log', GitLogRequestSchema, async ({ limit, branch }) =>
    getGit().log({ limit, branch })
  );

  router.register('git.branches', z.object({}), async () =>
    getGit().branches()
  );

  router.register('git.currentBranch', z.object({}), async () => ({
    branch: await getGit().currentBranch(),
  }));

  router.register('git.createBranch', GitCreateBranchRequestSchema, async ({ name, from }) => {
    await getGit().createBranch(name, from);
    return { success: true };
  });

  router.register('git.checkout', GitCheckoutRequestSchema, async ({ name }) => {
    await getGit().checkout(name);
    return { success: true };
  });

  router.register('git.deleteBranch', GitDeleteBranchRequestSchema, async ({ name }) => {
    await getGit().deleteBranch(name);
    return { success: true };
  });

  router.register('git.stashPush', GitStashPushRequestSchema, async ({ message }) => ({
    id: await getGit().stashPush(message),
  }));

  router.register('git.stashList', z.object({}), async () =>
    getGit().stashList()
  );

  router.register('git.stashPop', GitStashPopRequestSchema, async ({ id }) => {
    await getGit().stashPop(id);
    return { success: true };
  });

  router.register('git.diffSummary', z.object({}), async () =>
    getGit().getDiffSummary()
  );

  // -------------------------------------------------------------------------
  // Terminal
  // -------------------------------------------------------------------------
  router.register('terminal.createSession', TerminalCreateRequestSchema, async ({ options }) => ({
    id: await terminal.createSession(options),
  }));

  router.register('terminal.write', TerminalWriteRequestSchema, ({ id, data }) => {
    terminal.write(id, data);
    return { success: true };
  });

  router.register('terminal.resize', TerminalResizeRequestSchema, ({ id, cols, rows }) => {
    terminal.resize(id, cols, rows);
    return { success: true };
  });

  router.register('terminal.kill', TerminalKillRequestSchema, ({ id }) => {
    terminal.kill(id);
    return { success: true };
  });

  router.register('terminal.runCommand', TerminalRunCommandRequestSchema, async ({ id, command, timeoutMs }) =>
    terminal.runCommand(id, command, { timeoutMs })
  );

  router.register('terminal.listSessions', z.object({}), () =>
    terminal.listSessions()
  );

  router.register('terminal.getCwd', TerminalGetCwdRequestSchema, ({ id }) => ({
    cwd: terminal.getCwd(id),
  }));

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------
  router.register('search.text', SearchTextRequestSchema, async (query) => {
    const search = getSearch();
    if (!search) throw new Error('Search service not available (no workspace open)');
    return search.searchText(query);
  });

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------
  router.register('settings.get', SettingsGetSchema, ({ key, namespace, defaultValue }) =>
    settings.get(key, defaultValue ?? null, namespace)
  );

  router.register('settings.set', SettingsSetSchema, ({ key, value, namespace }) => {
    settings.set(key, value, namespace);
    return { success: true };
  });

  router.register('settings.delete', SettingsDeleteSchema, ({ key, namespace }) => {
    settings.delete(key, namespace);
    return { success: true };
  });

  router.register('settings.keys', SettingsKeysSchema, ({ namespace }) =>
    settings.keys(namespace)
  );

  router.register('settings.getAll', SettingsKeysSchema, ({ namespace }) =>
    settings.getAll(namespace)
  );
}
