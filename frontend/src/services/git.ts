import * as Diff from 'diff';
import {
  GitService,
  GitFileStatus,
  GitCommit,
  GitDiffResult,
  GitDiffSummary,
  GitBranch,
  OutputService,
} from './types';
import { MockFileSystemService } from './fileSystem';

interface InternalCommit {
  hash: string;
  parents: string[];
  author: string;
  date: string;
  message: string;
  tree: Map<string, string>;
}

export class MockGitService implements GitService {
  private fs: MockFileSystemService;
  private output?: OutputService;
  private currentBranchName: string = 'development';
  private branchesMap: Map<string, string> = new Map(); // branchName -> commitHash
  private commits: Map<string, InternalCommit> = new Map();
  private index: Map<string, string> = new Map(); // Staged snapshot: path -> content (or null for staged delete)
  private stashes: { id: string; message: string; date: string; snapshot: Map<string, string> }[] = [];
  private listeners: Set<() => void> = new Set();
  private recomputeTimer: number | null = null;

  constructor(fs: MockFileSystemService, output?: OutputService) {
    this.fs = fs;
    this.output = output;
    this.seedInitialCommits();

    // Listen to filesystem changes to trigger status recompute
    this.fs.watch(() => {
      this.debounceNotify();
    });
  }

  private seedInitialCommits() {
    const baseFiles = this.fs.getAllFiles();

    // 1. Initial commit
    const tree1 = new Map<string, string>();
    tree1.set('README.md', '# Ajson Studio Workspace\n\nInitial repository baseline.\n');
    tree1.set('.gitignore', 'node_modules/\ndist/\n');
    const c1: InternalCommit = {
      hash: 'a1b2c3d',
      parents: [],
      author: 'Ritesh Verma <ritesh@ajson.dev>',
      date: '2026-10-01 10:00:00',
      message: 'chore: initialize project workspace and git configuration',
      tree: tree1,
    };
    this.commits.set(c1.hash, c1);

    // 2. Package configuration
    const tree2 = new Map(tree1);
    tree2.set('package.json', '{\n  "name": "sample-workspace",\n  "version": "0.1.0"\n}\n');
    tree2.set('tsconfig.json', '{\n  "compilerOptions": { "strict": true }\n}\n');
    const c2: InternalCommit = {
      hash: 'b2c3d4e',
      parents: [c1.hash],
      author: 'Ritesh Verma <ritesh@ajson.dev>',
      date: '2026-10-03 14:30:00',
      message: 'build: setup project manifests and build pipeline',
      tree: tree2,
    };
    this.commits.set(c2.hash, c2);

    // 3. Math utilities
    const tree3 = new Map(tree2);
    tree3.set('src/utils/math.ts', 'export function add(a: number, b: number) { return a + b; }\n');
    const c3: InternalCommit = {
      hash: 'c3d4e5f',
      parents: [c2.hash],
      author: 'Ajson Bot <agent@ajson.dev>',
      date: '2026-10-06 09:15:00',
      message: 'feat: implement core math and arithmetic helpers',
      tree: tree3,
    };
    this.commits.set(c3.hash, c3);

    // 4. Test fixtures
    const tree4 = new Map(tree3);
    tree4.set('fixtures/valid.json', '{\n  "title": "Valid Fixture",\n  "count": 42\n}\n');
    const c4: InternalCommit = {
      hash: 'd4e5f60',
      parents: [c3.hash],
      author: 'Ritesh Verma <ritesh@ajson.dev>',
      date: '2026-10-09 16:45:00',
      message: 'test: add test fixtures for JSON parsing verification',
      tree: tree4,
    };
    this.commits.set(c4.hash, c4);

    // 5. Main app entry
    const tree5 = new Map(tree4);
    tree5.set('src/main.tsx', 'import React from "react";\n');
    const c5: InternalCommit = {
      hash: 'e5f6071',
      parents: [c4.hash],
      author: 'Ritesh Verma <ritesh@ajson.dev>',
      date: '2026-10-12 11:20:00',
      message: 'feat: add React root mount point and client hydration',
      tree: tree5,
    };
    this.commits.set(c5.hash, c5);

    // 6. Complete current snapshot (HEAD of main)
    const tree6 = new Map(baseFiles);
    const c6: InternalCommit = {
      hash: 'f607182',
      parents: [c5.hash],
      author: 'Ritesh Verma <ritesh@ajson.dev>',
      date: '2026-10-15 18:00:00',
      message: 'feat: complete frontend workspace sample and fixtures',
      tree: tree6,
    };
    this.commits.set(c6.hash, c6);

    // 7. Feature branch commit
    const treeFeature = new Map(tree6);
    treeFeature.set('src/styles/theme.css', '/* Polish variables */\n');
    const c7: InternalCommit = {
      hash: '0718293',
      parents: [c6.hash],
      author: 'Ajson Bot <agent@ajson.dev>',
      date: '2026-10-20 13:00:00',
      message: 'feat(ui): refine visual theme transitions and spacing',
      tree: treeFeature,
    };
    this.commits.set(c7.hash, c7);

    // Set branch heads
    this.branchesMap.set('main', c6.hash);
    this.branchesMap.set('development', c6.hash);
    this.branchesMap.set('feature/ui-polish', c7.hash);

    // Index matches current HEAD initially (clean status)
    for (const [k, v] of tree6.entries()) {
      this.index.set(k, v);
    }
  }

  private debounceNotify() {
    if (this.recomputeTimer !== null) {
      clearTimeout(this.recomputeTimer);
    }
    this.recomputeTimer = window.setTimeout(() => {
      this.notify();
    }, 100);
  }

  private notify() {
    for (const cb of this.listeners) {
      try {
        cb();
      } catch (err) {
        console.error('Error in git onDidChange listener', err);
      }
    }
  }

  private getHeadTree(): Map<string, string> {
    const headHash = this.branchesMap.get(this.currentBranchName);
    if (!headHash) return new Map();
    const commit = this.commits.get(headHash);
    return commit ? commit.tree : new Map();
  }

  async status(): Promise<GitFileStatus[]> {
    const headTree = this.getHeadTree();
    const workTree = this.fs.getAllFiles();
    const statuses: GitFileStatus[] = [];

    const allPaths = new Set([
      ...Array.from(headTree.keys()),
      ...Array.from(this.index.keys()),
      ...Array.from(workTree.keys()),
    ]);

    for (const p of Array.from(allPaths).sort()) {
      // Respect .gitignore basic rules
      if (p.startsWith('node_modules/') || p.startsWith('dist/') || p.endsWith('.log')) {
        continue;
      }

      const headContent = headTree.get(p);
      const indexContent = this.index.get(p);
      const workContent = workTree.get(p);

      let indexStatus: GitFileStatus['index'] = '-';
      let workStatus: GitFileStatus['workTree'] = '-';

      // 1. Compare Index vs HEAD (Staged Changes)
      if (headContent === undefined && indexContent !== undefined) {
        indexStatus = 'A'; // Added in index
      } else if (headContent !== undefined && indexContent === undefined) {
        indexStatus = 'D'; // Deleted in index
      } else if (headContent !== undefined && indexContent !== undefined && headContent !== indexContent) {
        indexStatus = 'M'; // Modified in index
      }

      // 2. Compare WorkTree vs Index (Working Tree Changes)
      if (indexContent === undefined && workContent !== undefined && headContent === undefined) {
        workStatus = '?'; // Untracked
      } else if (indexContent !== undefined && workContent === undefined) {
        workStatus = 'D'; // Deleted in work tree
      } else if (indexContent !== undefined && workContent !== undefined && indexContent !== workContent) {
        workStatus = 'M'; // Modified in work tree
      }

      if (indexStatus !== '-' || workStatus !== '-') {
        statuses.push({ path: p, index: indexStatus, workTree: workStatus });
      }
    }

    return statuses;
  }

  async diff(filePath: string, opts?: { staged?: boolean }): Promise<GitDiffResult> {
    const headTree = this.getHeadTree();
    const headContent = headTree.get(filePath) || '';
    const indexContent = this.index.get(filePath) || '';
    let workContent = '';
    try {
      workContent = await this.fs.readFile(filePath);
    } catch {
      workContent = '';
    }

    if (opts?.staged) {
      return {
        original: headContent,
        modified: indexContent,
      };
    }

    return {
      original: indexContent || headContent,
      modified: workContent,
    };
  }

  async stage(paths: string[]): Promise<void> {
    const workTree = this.fs.getAllFiles();
    for (const p of paths) {
      const content = workTree.get(p);
      if (content !== undefined) {
        this.index.set(p, content);
      } else {
        this.index.delete(p);
      }
    }
    this.output?.append('Git', `git add ${paths.join(' ')}`);
    this.notify();
  }

  async unstage(paths: string[]): Promise<void> {
    const headTree = this.getHeadTree();
    for (const p of paths) {
      const headContent = headTree.get(p);
      if (headContent !== undefined) {
        this.index.set(p, headContent);
      } else {
        this.index.delete(p);
      }
    }
    this.output?.append('Git', `git restore --staged ${paths.join(' ')}`);
    this.notify();
  }

  async discard(paths: string[]): Promise<void> {
    const headTree = this.getHeadTree();
    for (const p of paths) {
      const targetContent = this.index.get(p) ?? headTree.get(p);
      if (targetContent !== undefined) {
        await this.fs.writeFile(p, targetContent);
      } else {
        try {
          await this.fs.delete(p);
        } catch {
          // Ignore
        }
      }
    }
    this.output?.append('Git', `git restore ${paths.join(' ')}`);
    this.notify();
  }

  async commit(message: string, opts?: { amend?: boolean }): Promise<GitCommit> {
    if (!message || !message.trim()) {
      throw new Error('Commit message cannot be empty');
    }

    const currentHeadHash = this.branchesMap.get(this.currentBranchName);
    const parentHashes = opts?.amend
      ? (this.commits.get(currentHeadHash || '')?.parents || [])
      : currentHeadHash ? [currentHeadHash] : [];

    const newTree = new Map(this.index);
    const hash = Math.random().toString(16).slice(2, 9);
    const commitObj: InternalCommit = {
      hash,
      parents: parentHashes,
      author: 'Ritesh Verma <ritesh@ajson.dev>',
      date: new Date().toISOString().replace('T', ' ').slice(0, 19),
      message: message.trim(),
      tree: newTree,
    };

    this.commits.set(hash, commitObj);
    this.branchesMap.set(this.currentBranchName, hash);

    this.output?.append('Git', `[${this.currentBranchName} ${hash}] ${message.trim()}`);
    this.notify();

    return {
      hash: commitObj.hash,
      parents: commitObj.parents,
      author: commitObj.author,
      date: commitObj.date,
      message: commitObj.message,
    };
  }

  async log(opts?: { limit?: number; branch?: string }): Promise<GitCommit[]> {
    const targetBranch = opts?.branch || this.currentBranchName;
    const startHash = this.branchesMap.get(targetBranch);
    if (!startHash) return [];

    const result: GitCommit[] = [];
    const queue = [startHash];
    const visited = new Set<string>();

    while (queue.length > 0 && (!opts?.limit || result.length < opts.limit)) {
      const currentHash = queue.shift()!;
      if (visited.has(currentHash)) continue;
      visited.add(currentHash);

      const commit = this.commits.get(currentHash);
      if (commit) {
        result.push({
          hash: commit.hash,
          parents: commit.parents,
          author: commit.author,
          date: commit.date,
          message: commit.message,
        });
        queue.push(...commit.parents);
      }
    }

    return result;
  }

  async branches(): Promise<GitBranch[]> {
    const list: GitBranch[] = [];
    for (const [name, commitHash] of this.branchesMap.entries()) {
      list.push({
        name,
        isCurrent: name === this.currentBranchName,
        commitHash,
      });
    }
    return list;
  }

  async currentBranch(): Promise<string> {
    return this.currentBranchName;
  }

  async createBranch(name: string, from?: string): Promise<void> {
    const sourceBranch = from || this.currentBranchName;
    const sourceHash = this.branchesMap.get(sourceBranch);
    if (!sourceHash) {
      throw new Error(`Source branch not found: ${sourceBranch}`);
    }
    if (this.branchesMap.has(name)) {
      throw new Error(`Branch already exists: ${name}`);
    }
    this.branchesMap.set(name, sourceHash);
    this.output?.append('Git', `git branch ${name} (from ${sourceBranch})`);
    this.notify();
  }

  async checkout(name: string): Promise<void> {
    const targetHash = this.branchesMap.get(name);
    if (!targetHash) {
      throw new Error(`Branch not found: ${name}`);
    }

    // Refuse if uncommitted changes exist
    const currentStatus = await this.status();
    if (currentStatus.length > 0) {
      throw new Error(
        `Your local changes would be overwritten by checkout: ${currentStatus.map((s) => s.path).join(', ')}. Please commit or stash them first.`
      );
    }

    const targetCommit = this.commits.get(targetHash);
    if (!targetCommit) {
      throw new Error(`Target commit not found for branch: ${name}`);
    }

    // Apply snapshot to work tree and index
    this.index = new Map(targetCommit.tree);
    for (const [fPath, content] of targetCommit.tree.entries()) {
      await this.fs.writeFile(fPath, content);
    }

    this.currentBranchName = name;
    this.output?.append('Git', `Switched to branch '${name}'`);
    this.notify();
  }

  async deleteBranch(name: string): Promise<void> {
    if (name === this.currentBranchName) {
      throw new Error(`Cannot delete checked-out branch: ${name}`);
    }
    if (name === 'main') {
      throw new Error(`Cannot delete protected branch: main`);
    }
    if (!this.branchesMap.has(name)) {
      throw new Error(`Branch not found: ${name}`);
    }
    this.branchesMap.delete(name);
    this.output?.append('Git', `Deleted branch ${name}`);
    this.notify();
  }

  async stashPush(message?: string): Promise<string> {
    const workTree = this.fs.getAllFiles();
    const id = `stash@{${this.stashes.length}}`;
    const stashItem = {
      id,
      message: message || `WIP on ${this.currentBranchName}`,
      date: new Date().toISOString(),
      snapshot: new Map(workTree),
    };
    this.stashes.unshift(stashItem);

    // Revert work tree to HEAD
    const headTree = this.getHeadTree();
    for (const [p, content] of headTree.entries()) {
      await this.fs.writeFile(p, content);
    }
    this.index = new Map(headTree);

    this.output?.append('Git', `Saved working directory state: ${stashItem.message}`);
    this.notify();
    return id;
  }

  async stashList(): Promise<{ id: string; message: string; date: string }[]> {
    return this.stashes.map((s) => ({ id: s.id, message: s.message, date: s.date }));
  }

  async stashPop(id?: string): Promise<void> {
    if (this.stashes.length === 0) {
      throw new Error('No stash found to pop');
    }
    const idx = id ? this.stashes.findIndex((s) => s.id === id) : 0;
    if (idx === -1) {
      throw new Error(`Stash entry not found: ${id}`);
    }
    const [popped] = this.stashes.splice(idx, 1);
    if (!popped) return;

    for (const [p, content] of popped.snapshot.entries()) {
      await this.fs.writeFile(p, content);
    }

    this.output?.append('Git', `Dropped ${popped.id} and applied state`);
    this.notify();
  }

  async getDiffSummary(): Promise<GitDiffSummary> {
    const statuses = await this.status();
    let additions = 0;
    let deletions = 0;

    for (const s of statuses) {
      const d = await this.diff(s.path, { staged: s.index !== '-' });
      const patches = Diff.diffLines(d.original, d.modified);
      for (const p of patches) {
        if (p.added) additions += p.count || 0;
        if (p.removed) deletions += p.count || 0;
      }
    }

    return {
      files: statuses.length,
      additions,
      deletions,
    };
  }

  onDidChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
}
