import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  GitService,
  GitFileStatus,
  GitCommit,
  GitDiffResult,
  GitDiffSummary,
  GitBranch,
  GitIndexStatus,
  GitWorkTreeStatus,
  AjsonError,
  ErrorCode,
} from '@ajson/contracts';
import { PathGuard } from '../security/pathGuard';

export class NativeGitService implements GitService {
  private workspaceRoot: string;
  private pathGuard: PathGuard;
  private listeners: Set<() => void> = new Set();
  private gitWatcher: fs.FSWatcher | null = null;
  private notifyDebounceTimer: NodeJS.Timeout | null = null;

  constructor(workspaceRoot: string) {
    this.pathGuard = new PathGuard(workspaceRoot);
    this.workspaceRoot = this.pathGuard.getWorkspaceRoot();
    this.setupGitWatcher();
  }

  public getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  public isGitRepo(): boolean {
    try {
      const gitPath = path.join(this.workspaceRoot, '.git');
      return fs.existsSync(gitPath);
    } catch {
      return false;
    }
  }

  private execGit(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        'git',
        args,
        {
          cwd: this.workspaceRoot,
          maxBuffer: 20 * 1024 * 1024,
          env: {
            ...process.env,
            LC_ALL: 'C',
            GIT_TERMINAL_PROMPT: '0',
            GIT_CONFIG_NOSYSTEM: '1',
            ...(process.env.GIT_AUTHOR_NAME ? { GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME } : {}),
            ...(process.env.GIT_AUTHOR_EMAIL ? { GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL } : {}),
            ...(process.env.GIT_COMMITTER_NAME ? { GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME } : {}),
            ...(process.env.GIT_COMMITTER_EMAIL ? { GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL } : {}),
          },
        },
        (error, stdout, stderr) => {
          if (error) {
            const msg = stderr ? stderr.trim() : error.message;
            reject(new AjsonError(ErrorCode.INTERNAL_ERROR, msg));
          } else {
            resolve(stdout);
          }
        }
      );
    });
  }

  async currentBranch(): Promise<string> {
    try {
      const out = await this.execGit(['branch', '--show-current']);
      const trimmed = out.trim();
      if (trimmed) return trimmed;

      // In detached HEAD or initial commit state, check symbolic-ref
      try {
        const sym = await this.execGit(['symbolic-ref', '--short', 'HEAD']);
        if (sym.trim()) return sym.trim();
      } catch {
        // Fallback to rev-parse
      }

      const rev = await this.execGit(['rev-parse', '--short', 'HEAD']);
      return rev.trim() || 'HEAD (detached)';
    } catch {
      return 'main';
    }
  }

  async status(): Promise<GitFileStatus[]> {
    try {
      const out = await this.execGit(['status', '--porcelain=v1', '-uall']);
      if (!out.trim()) return [];

      const lines = out.split(/\r?\n/).filter((l) => l.length >= 3);
      const result: GitFileStatus[] = [];

      for (const line of lines) {
        const x = line[0];
        const y = line[1];
        let filePath = line.slice(3).trim();

        if (filePath.startsWith('"') && filePath.endsWith('"')) {
          filePath = filePath.slice(1, -1);
        }

        if (filePath.includes(' -> ')) {
          const parts = filePath.split(' -> ');
          filePath = parts[1]?.trim() || filePath;
        }

        let indexStatus: GitIndexStatus = '-';
        if (x === 'M') indexStatus = 'M';
        else if (x === 'A') indexStatus = 'A';
        else if (x === 'D') indexStatus = 'D';
        else if (x === 'R') indexStatus = 'R';
        else indexStatus = '-';

        let workTreeStatus: GitWorkTreeStatus = '-';
        if (y === 'M') workTreeStatus = 'M';
        else if (y === 'D') workTreeStatus = 'D';
        else if (x === '?' && y === '?') workTreeStatus = '?';
        else workTreeStatus = '-';

        const normalizedPath = filePath.replace(/\\/g, '/');

        result.push({
          path: normalizedPath,
          index: indexStatus,
          workTree: workTreeStatus,
        });
      }

      return result;
    } catch {
      return [];
    }
  }

  async diff(filePath: string, opts?: { staged?: boolean }): Promise<GitDiffResult> {
    const safeRelative = this.pathGuard.toRelativePath(
      this.pathGuard.resolveWithinWorkspace(filePath)
    );
    const fullDiskPath = this.pathGuard.resolveWithinWorkspace(filePath);

    let original = '';
    let modified = '';

    if (opts?.staged) {
      try {
        original = await this.execGit(['show', `HEAD:${safeRelative}`]);
      } catch {
        original = '';
      }
      try {
        modified = await this.execGit(['show', `:${safeRelative}`]);
      } catch {
        modified = '';
      }
    } else {
      try {
        modified = fs.existsSync(fullDiskPath)
          ? await fs.promises.readFile(fullDiskPath, 'utf8')
          : '';
      } catch {
        modified = '';
      }

      try {
        original = await this.execGit(['show', `:${safeRelative}`]);
      } catch {
        try {
          original = await this.execGit(['show', `HEAD:${safeRelative}`]);
        } catch {
          original = '';
        }
      }
    }

    return { original, modified };
  }

  async stage(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const safePaths = paths.map((p) =>
      this.pathGuard.toRelativePath(this.pathGuard.resolveWithinWorkspace(p))
    );
    await this.execGit(['add', '-A', '--', ...safePaths]);
    this.notify();
  }

  async unstage(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const safePaths = paths.map((p) =>
      this.pathGuard.toRelativePath(this.pathGuard.resolveWithinWorkspace(p))
    );
    try {
      await this.execGit(['restore', '--staged', '--', ...safePaths]);
    } catch {
      await this.execGit(['reset', 'HEAD', '--', ...safePaths]);
    }
    this.notify();
  }

  async discard(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const safePaths = paths.map((p) =>
      this.pathGuard.toRelativePath(this.pathGuard.resolveWithinWorkspace(p))
    );

    try {
      await this.execGit(['restore', '--', ...safePaths]);
    } catch {
      try {
        await this.execGit(['checkout', '--', ...safePaths]);
      } catch {
        // Continue to clean untracked
      }
    }

    try {
      await this.execGit(['clean', '-f', '-d', '--', ...safePaths]);
    } catch {
      // Ignore
    }
    this.notify();
  }

  async commit(message: string, opts?: { amend?: boolean }): Promise<GitCommit> {
    if (!message || message.trim().length === 0) {
      throw new AjsonError(ErrorCode.INVALID_PAYLOAD, 'Commit message cannot be empty');
    }

    const args = ['commit', '--no-gpg-sign', '-m', message.trim()];
    if (opts?.amend) {
      args.push('--amend');
    }

    await this.execGit(args);
    const [latest] = await this.log({ limit: 1 });
    if (!latest) {
      throw new AjsonError(
        ErrorCode.INTERNAL_ERROR,
        'Commit succeeded but unable to read back latest commit'
      );
    }
    this.notify();
    return latest;
  }

  async log(opts?: { limit?: number; branch?: string }): Promise<GitCommit[]> {
    const limit = opts?.limit ?? 50;
    const branch = opts?.branch ?? 'HEAD';

    try {
      const out = await this.execGit([
        'log',
        `-n`,
        String(limit),
        branch,
        '--format=%H%x00%P%x00%an <%ae>%x00%ad%x00%s',
        '--date=iso',
      ]);

      if (!out.trim()) return [];

      const lines = out.split(/\r?\n/).filter(Boolean);
      const commits: GitCommit[] = [];

      for (const line of lines) {
        const parts = line.split('\0');
        if (parts.length >= 5) {
          const hash = parts[0] ?? '';
          const parentsStr = parts[1] ?? '';
          const author = parts[2] ?? '';
          const date = parts[3] ?? '';
          const message = parts[4] ?? '';
          commits.push({
            hash: hash.trim(),
            parents: parentsStr.trim() ? parentsStr.trim().split(/\s+/) : [],
            author: author.trim(),
            date: date.trim(),
            message: message.trim(),
          });
        }
      }

      return commits;
    } catch {
      return [];
    }
  }

  async branches(): Promise<GitBranch[]> {
    try {
      const out = await this.execGit([
        'for-each-ref',
        '--format=%(refname:short)%00%(objectname:short)%00%(HEAD)',
        'refs/heads',
      ]);

      if (!out.trim()) {
        const current = await this.currentBranch();
        return [{ name: current, isCurrent: true, commitHash: '' }];
      }

      const lines = out.split(/\r?\n/).filter(Boolean);
      const branches: GitBranch[] = [];

      for (const line of lines) {
        const [name, commitHash, headFlag] = line.split('\0');
        if (name) {
          branches.push({
            name: name.trim(),
            commitHash: (commitHash || '').trim(),
            isCurrent: headFlag?.trim() === '*',
          });
        }
      }

      if (branches.length > 0 && !branches.some((b) => b.isCurrent)) {
        const cur = await this.currentBranch();
        const found = branches.find((b) => b.name === cur);
        if (found) found.isCurrent = true;
      }

      return branches;
    } catch {
      const current = await this.currentBranch();
      return [{ name: current, isCurrent: true, commitHash: '' }];
    }
  }

  async createBranch(name: string, from?: string): Promise<void> {
    if (!name || name.trim().length === 0) {
      throw new AjsonError(ErrorCode.INVALID_PAYLOAD, 'Branch name cannot be empty');
    }
    const args = ['branch', name.trim()];
    if (from && from.trim()) {
      args.push(from.trim());
    }
    await this.execGit(args);
    this.notify();
  }

  async checkout(name: string): Promise<void> {
    if (!name || name.trim().length === 0) {
      throw new AjsonError(ErrorCode.INVALID_PAYLOAD, 'Branch name cannot be empty');
    }
    await this.execGit(['checkout', name.trim()]);
    this.notify();
  }

  async deleteBranch(name: string): Promise<void> {
    if (!name || name.trim().length === 0) {
      throw new AjsonError(ErrorCode.INVALID_PAYLOAD, 'Branch name cannot be empty');
    }
    await this.execGit(['branch', '-D', name.trim()]);
    this.notify();
  }

  async stashPush(message?: string): Promise<string> {
    const args = ['stash', 'push'];
    if (message && message.trim()) {
      args.push('-m', message.trim());
    }
    await this.execGit(args);
    this.notify();
    return 'stash@{0}';
  }

  async stashList(): Promise<{ id: string; message: string; date: string }[]> {
    try {
      const out = await this.execGit(['stash', 'list', '--format=%gd%x00%gs%x00%ci']);
      if (!out.trim()) return [];

      const lines = out.split(/\r?\n/).filter(Boolean);
      const result: { id: string; message: string; date: string }[] = [];

      for (const line of lines) {
        const [id, msg, date] = line.split('\0');
        if (id) {
          result.push({
            id: id.trim(),
            message: (msg || '').trim(),
            date: (date || '').trim(),
          });
        }
      }
      return result;
    } catch {
      return [];
    }
  }

  async stashPop(id?: string): Promise<void> {
    const args = ['stash', 'pop'];
    if (id && id.trim()) {
      args.push(id.trim());
    }
    await this.execGit(args);
    this.notify();
  }

  async getDiffSummary(): Promise<GitDiffSummary> {
    try {
      const unstagedOut = await this.execGit(['diff', '--numstat']).catch(() => '');
      const stagedOut = await this.execGit(['diff', '--staged', '--numstat']).catch(() => '');

      const changedFiles = new Set<string>();
      let additions = 0;
      let deletions = 0;

      const parseNumstat = (text: string) => {
        const lines = text.split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          const parts = line.split(/\t/);
          if (parts.length >= 3) {
            const added = parseInt(parts[0] ?? '0', 10);
            const deleted = parseInt(parts[1] ?? '0', 10);
            const filename = (parts[2] ?? '').trim();
            if (!isNaN(added)) additions += added;
            if (!isNaN(deleted)) deletions += deleted;
            if (filename) changedFiles.add(filename);
          }
        }
      };

      parseNumstat(unstagedOut);
      parseNumstat(stagedOut);

      const statuses = await this.status();
      for (const s of statuses) {
        if (s.workTree === '?') {
          changedFiles.add(s.path);
        }
      }

      return {
        files: changedFiles.size,
        additions,
        deletions,
      };
    } catch {
      return { files: 0, additions: 0, deletions: 0 };
    }
  }

  onDidChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify(): void {
    if (this.notifyDebounceTimer) {
      clearTimeout(this.notifyDebounceTimer);
    }
    this.notifyDebounceTimer = setTimeout(() => {
      for (const cb of this.listeners) {
        try {
          cb();
        } catch {
          // Ignore
        }
      }
    }, 100);
  }

  private setupGitWatcher(): void {
    const gitDir = path.join(this.workspaceRoot, '.git');
    if (!fs.existsSync(gitDir)) return;

    try {
      this.gitWatcher = fs.watch(gitDir, { recursive: true }, (_eventType, filename) => {
        if (
          filename &&
          (filename.includes('index') ||
            filename.includes('HEAD') ||
            filename.includes('refs'))
        ) {
          this.notify();
        }
      });
    } catch {
      // Ignore if watching .git fails on some OS/permissions
    }
  }

  public dispose(): void {
    if (this.gitWatcher) {
      this.gitWatcher.close();
      this.gitWatcher = null;
    }
    if (this.notifyDebounceTimer) {
      clearTimeout(this.notifyDebounceTimer);
      this.notifyDebounceTimer = null;
    }
    this.listeners.clear();
  }
}
