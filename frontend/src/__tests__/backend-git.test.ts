import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { NativeGitService } from '@ajson-studio/backend';
import { runGitConformanceTests } from '@ajson/contracts/testing';
import { ErrorCode } from '@ajson/contracts';

describe('Backend NativeGitService (Stage 4)', () => {
  let tempDir: string;
  let gitService: NativeGitService;

  const runGit = (args: string[]) => {
    return execFileSync('git', args, {
      cwd: tempDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        LC_ALL: 'C',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_TERMINAL_PROMPT: '0',
        GIT_AUTHOR_NAME: 'Test Developer',
        GIT_AUTHOR_EMAIL: 'test@ajson.dev',
        GIT_COMMITTER_NAME: 'Test Developer',
        GIT_COMMITTER_EMAIL: 'test@ajson.dev',
      },
    });
  };

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajson-backend-git-'));
    // Initialize git repo
    runGit(['init', '-b', 'main']);
    runGit(['config', 'user.name', 'Test Developer']);
    runGit(['config', 'user.email', 'test@ajson.dev']);
    runGit(['config', 'commit.gpgsign', 'false']);

    // Create an initial commit so branches and log work
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Initial Repo\n');
    runGit(['add', 'README.md']);
    runGit(['commit', '--no-gpg-sign', '-m', 'Initial baseline commit']);

    gitService = new NativeGitService(tempDir);
  });

  afterAll(() => {
    gitService.dispose();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error on Windows file locks
    }
  });

  it('passes the official @ajson/contracts Git conformance test suite', async () => {
    const passed = await runGitConformanceTests(() => gitService);
    expect(passed).toBe(true);
  });

  it('detects current branch and lists branches correctly', async () => {
    const branch = await gitService.currentBranch();
    expect(branch).toBe('main');

    const branches = await gitService.branches();
    expect(branches.length).toBeGreaterThanOrEqual(1);
    const mainBranch = branches.find((b) => b.name === 'main');
    expect(mainBranch).toBeDefined();
    expect(mainBranch?.isCurrent).toBe(true);
    expect(typeof mainBranch?.commitHash).toBe('string');
  });

  it('tracks status of untracked, staged, modified, and deleted files', async () => {
    // 1. Untracked file
    fs.writeFileSync(path.join(tempDir, 'new-file.txt'), 'hello world\n');
    let statuses = await gitService.status();
    const untracked = statuses.find((s) => s.path === 'new-file.txt');
    expect(untracked).toBeDefined();
    expect(untracked?.index).toBe('-');
    expect(untracked?.workTree).toBe('?');

    // 2. Stage file
    await gitService.stage(['new-file.txt']);
    statuses = await gitService.status();
    const staged = statuses.find((s) => s.path === 'new-file.txt');
    expect(staged).toBeDefined();
    expect(staged?.index).toBe('A');
    expect(staged?.workTree).toBe('-');

    // 3. Unstage file
    await gitService.unstage(['new-file.txt']);
    statuses = await gitService.status();
    const unstageCheck = statuses.find((s) => s.path === 'new-file.txt');
    expect(unstageCheck?.index).toBe('-');
    expect(unstageCheck?.workTree).toBe('?');

    // Clean up
    await gitService.discard(['new-file.txt']);
    statuses = await gitService.status();
    expect(statuses.find((s) => s.path === 'new-file.txt')).toBeUndefined();
  });

  it('creates commits and retrieves log history', async () => {
    fs.writeFileSync(path.join(tempDir, 'feature.ts'), 'export const val = 42;\n');
    await gitService.stage(['feature.ts']);
    const commit = await gitService.commit('feat: add core feature module');

    expect(commit.message).toBe('feat: add core feature module');
    expect(commit.author).toContain('Test Developer');
    expect(commit.hash.length).toBeGreaterThanOrEqual(7);

    const log = await gitService.log({ limit: 5 });
    expect(log.length).toBe(2);
    expect(log[0]?.message).toBe('feat: add core feature module');
    expect(log[1]?.message).toBe('Initial baseline commit');
  });

  it('computes working tree and staged diffs', async () => {
    // Modify existing file
    fs.appendFileSync(path.join(tempDir, 'README.md'), 'Line 2 modification\n');

    // Unstaged diff
    const unstagedDiff = await gitService.diff('README.md', { staged: false });
    expect(unstagedDiff.original).toBe('# Initial Repo\n');
    expect(unstagedDiff.modified).toContain('Line 2 modification');

    // Stage it
    await gitService.stage(['README.md']);

    // Staged diff
    const stagedDiff = await gitService.diff('README.md', { staged: true });
    expect(stagedDiff.original).toBe('# Initial Repo\n');
    expect(stagedDiff.modified).toContain('Line 2 modification');

    // Commit diff change to clean working tree
    await gitService.commit('chore: update readme');
  });

  it('manages branches: create, checkout, and delete', async () => {
    await gitService.createBranch('feature/auth');
    let branches = await gitService.branches();
    expect(branches.some((b) => b.name === 'feature/auth')).toBe(true);

    await gitService.checkout('feature/auth');
    expect(await gitService.currentBranch()).toBe('feature/auth');

    await gitService.checkout('main');
    expect(await gitService.currentBranch()).toBe('main');

    await gitService.deleteBranch('feature/auth');
    branches = await gitService.branches();
    expect(branches.some((b) => b.name === 'feature/auth')).toBe(false);
  });

  it('supports stashing changes and popping stash', async () => {
    fs.writeFileSync(path.join(tempDir, 'stash-test.txt'), 'stashed content\n');
    await gitService.stage(['stash-test.txt']);

    const stashId = await gitService.stashPush('work in progress');
    expect(stashId).toBe('stash@{0}');

    const stashes = await gitService.stashList();
    expect(stashes.length).toBeGreaterThanOrEqual(1);
    expect(stashes[0]?.message).toContain('work in progress');

    await gitService.stashPop(stashId);
    expect(fs.existsSync(path.join(tempDir, 'stash-test.txt'))).toBe(true);

    // Clean up
    await gitService.discard(['stash-test.txt']);
  });

  it('computes diff summary across changed files', async () => {
    fs.appendFileSync(path.join(tempDir, 'README.md'), 'added line\n');
    fs.writeFileSync(path.join(tempDir, 'extra.txt'), 'extra line\n');

    const summary = await gitService.getDiffSummary();
    expect(summary.files).toBeGreaterThanOrEqual(2);
    expect(summary.additions).toBeGreaterThanOrEqual(1);

    // Clean up
    await gitService.discard(['README.md', 'extra.txt']);
  });

  describe('Path Confinement & Security', () => {
    it('blocks directory traversal attempts in git operations', async () => {
      await expect(gitService.diff('../outside.txt')).rejects.toThrowError(
        expect.objectContaining({ code: ErrorCode.PATH_TRAVERSAL })
      );

      await expect(gitService.stage(['../../etc/passwd'])).rejects.toThrowError(
        expect.objectContaining({ code: ErrorCode.PATH_TRAVERSAL })
      );

      await expect(gitService.unstage(['../outside.txt'])).rejects.toThrowError(
        expect.objectContaining({ code: ErrorCode.PATH_TRAVERSAL })
      );

      await expect(gitService.discard(['../../malicious'])).rejects.toThrowError(
        expect.objectContaining({ code: ErrorCode.PATH_TRAVERSAL })
      );
    });
  });
});
