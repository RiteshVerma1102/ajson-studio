import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { FsWatchEventType } from '@ajson/contracts';
import { PathGuard } from '../security/pathGuard';

export interface WatcherOptions {
  debounceMs?: number;
  ignoredPatterns?: (string | RegExp)[];
}

const DEFAULT_IGNORED: (string | RegExp)[] = [
  /(^|[/\\])\.git($|[/\\])/,
  /(^|[/\\])node_modules($|[/\\])/,
  /(^|[/\\])dist($|[/\\])/,
  /(^|[/\\])\.tempmediaStorage($|[/\\])/,
  /(^|[/\\])\.DS_Store$/,
  /\.tmp$/,
];

export class WorkspaceFileWatcher {
  private guard: PathGuard;
  private rootPath: string;
  private fsWatcher: fs.FSWatcher | null = null;
  private emitter = new EventEmitter();
  private debounceMs: number;
  private ignored: (string | RegExp)[];
  private pendingEvents = new Map<string, NodeJS.Timeout>();
  private knownPaths = new Map<string, boolean>(); // path -> isDirectory
  private isRunning = false;

  constructor(workspaceRoot: string, options?: WatcherOptions) {
    this.guard = new PathGuard(workspaceRoot);
    this.rootPath = this.guard.getWorkspaceRoot();
    this.debounceMs = options?.debounceMs ?? 50;
    this.ignored = options?.ignoredPatterns ?? DEFAULT_IGNORED;
  }

  public getRootPath(): string {
    return this.rootPath;
  }

  /**
   * Scans initial state and starts recursive file watcher.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Seed known paths cache
    this.seedKnownPaths(this.rootPath);

    try {
      this.fsWatcher = fs.watch(
        this.rootPath,
        { recursive: true },
        (rawEventType: string, rawFilename: string | Buffer | null) => {
          if (!rawFilename) return;
          const filename = rawFilename.toString('utf8');
          this.handleRawFsEvent(rawEventType, filename);
        }
      );

      this.fsWatcher.on('error', (err) => {
        // Emit error or log, and gracefully handle
        console.error(`[WorkspaceFileWatcher] Error:`, err);
      });
    } catch (err) {
      console.error(`[WorkspaceFileWatcher] Failed to start watch on ${this.rootPath}:`, err);
    }
  }

  /**
   * Stops the watcher and cleans up all timeouts and listeners.
   */
  public stop(): void {
    this.isRunning = false;

    // Clear all pending debounced timers
    for (const timer of this.pendingEvents.values()) {
      clearTimeout(timer);
    }
    this.pendingEvents.clear();

    if (this.fsWatcher) {
      try {
        this.fsWatcher.close();
      } catch {
        // Ignore close errors
      }
      this.fsWatcher = null;
    }

    this.knownPaths.clear();
    this.emitter.removeAllListeners();
  }

  /**
   * Subscribe to watcher events. Returns an unsubscribe function.
   */
  public onEvent(callback: (event: FsWatchEventType, path: string) => void): () => void {
    this.emitter.on('fs-event', callback);
    return () => {
      this.emitter.off('fs-event', callback);
    };
  }

  /**
   * Determines if a relative or absolute path should be ignored.
   */
  public isIgnored(targetPath: string): boolean {
    const normalized = targetPath.replace(/\\/g, '/');
    return this.ignored.some((pattern) => {
      if (typeof pattern === 'string') {
        return normalized.includes(pattern);
      }
      return pattern.test(normalized);
    });
  }

  /**
   * Handle raw event from fs.watch with debouncing and disambiguation.
   */
  private handleRawFsEvent(_rawEventType: string, relativeFilename: string): void {
    const normalizedRelPath = relativeFilename.replace(/\\/g, '/');

    if (this.isIgnored(normalizedRelPath)) return;

    // Clear existing timer for this path if bursting
    const existingTimer = this.pendingEvents.get(normalizedRelPath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.pendingEvents.delete(normalizedRelPath);
      this.processDebouncedEvent(normalizedRelPath);
    }, this.debounceMs);

    this.pendingEvents.set(normalizedRelPath, timer);
  }

  /**
   * Disambiguates add vs change vs unlink and emits typed event.
   */
  private processDebouncedEvent(relPath: string): void {
    if (!this.isRunning) return;

    let fullPath: string;
    try {
      fullPath = this.guard.resolveWithinWorkspace(relPath);
    } catch {
      // Path escaped workspace or was invalid
      return;
    }

    const exists = fs.existsSync(fullPath);
    const wasKnown = this.knownPaths.has(relPath);
    const wasDir = this.knownPaths.get(relPath);

    if (exists) {
      try {
        const stat = fs.statSync(fullPath);
        const isDir = stat.isDirectory();
        this.knownPaths.set(relPath, isDir);

        if (!wasKnown) {
          const evtType: FsWatchEventType = isDir ? 'addDir' : 'add';
          this.emitter.emit('fs-event', evtType, relPath);
        } else {
          this.emitter.emit('fs-event', 'change', relPath);
        }
      } catch {
        // If file disappeared between check and stat
        this.knownPaths.delete(relPath);
        this.emitter.emit('fs-event', wasDir ? 'unlinkDir' : 'unlink', relPath);
      }
    } else {
      // Path was deleted
      this.knownPaths.delete(relPath);
      const evtType: FsWatchEventType = wasDir ? 'unlinkDir' : 'unlink';
      this.emitter.emit('fs-event', evtType, relPath);
    }
  }

  /**
   * Recursively seeds cache of existing paths up to 3 levels to keep memory minimal.
   */
  private seedKnownPaths(dir: string, depth = 0): void {
    if (depth > 4) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = this.guard.toRelativePath(full);
        if (this.isIgnored(rel)) continue;

        const isDir = entry.isDirectory();
        this.knownPaths.set(rel, isDir);
        if (isDir) {
          this.seedKnownPaths(full, depth + 1);
        }
      }
    } catch {
      // Ignore unreadable dirs during seeding
    }
  }
}
