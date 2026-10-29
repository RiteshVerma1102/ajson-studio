import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import {
  WorkspaceService,
  WorkspaceInfo,
  AjsonError,
  ErrorCode,
} from '@ajson/contracts';
import { NativeFileSystemService } from './nativeFileSystem';
import { WorkspaceFileWatcher } from './fileWatcher';
import { NativeGitService } from './nativeGit';

export type NativeFolderPicker = () => Promise<string | null>;

export class DefaultWorkspaceService implements WorkspaceService {
  private currentWorkspace: WorkspaceInfo | null = null;
  private currentFs: NativeFileSystemService | null = null;
  private currentWatcher: WorkspaceFileWatcher | null = null;
  private currentGit: NativeGitService | null = null;
  private emitter = new EventEmitter();
  private folderPicker?: NativeFolderPicker;

  constructor(initialWorkspaceRoot?: string, folderPicker?: NativeFolderPicker) {
    this.folderPicker = folderPicker;
    if (initialWorkspaceRoot) {
      this.setWorkspaceSync(initialWorkspaceRoot);
    }
  }

  public setFolderPicker(picker: NativeFolderPicker): void {
    this.folderPicker = picker;
  }

  public getFileSystem(): NativeFileSystemService | null {
    return this.currentFs;
  }

  public getWatcher(): WorkspaceFileWatcher | null {
    return this.currentWatcher;
  }

  public getGit(): NativeGitService | null {
    return this.currentGit;
  }

  /**
   * Open workspace by path, or prompt via folder picker dialog.
   */
  async open(targetPath?: string): Promise<WorkspaceInfo | null> {
    let chosenPath = targetPath;

    if (!chosenPath && this.folderPicker) {
      chosenPath = (await this.folderPicker()) ?? undefined;
    }

    if (!chosenPath) {
      return this.currentWorkspace;
    }

    const resolved = path.resolve(chosenPath);
    if (!fs.existsSync(resolved)) {
      throw new AjsonError(ErrorCode.NOT_FOUND, `Directory does not exist: "${chosenPath}"`);
    }

    const stat = await fs.promises.stat(resolved);
    if (!stat.isDirectory()) {
      throw new AjsonError(ErrorCode.INVALID_PAYLOAD, `Selected path is not a directory: "${chosenPath}"`);
    }

    const canonicalRoot = fs.realpathSync(resolved);
    const name = path.basename(canonicalRoot) || 'workspace';

    // Stop existing watcher and git service if running
    if (this.currentWatcher) {
      this.currentWatcher.stop();
    }
    if (this.currentGit) {
      this.currentGit.dispose();
    }

    const watcher = new WorkspaceFileWatcher(canonicalRoot);
    const fsService = new NativeFileSystemService(canonicalRoot, watcher);
    const gitService = new NativeGitService(canonicalRoot);
    watcher.start();

    this.currentWatcher = watcher;
    this.currentFs = fsService;
    this.currentGit = gitService;
    this.currentWorkspace = {
      rootPath: canonicalRoot,
      name,
    };

    this.emitter.emit('change', this.currentWorkspace);
    return this.currentWorkspace;
  }

  async getCurrent(): Promise<WorkspaceInfo | null> {
    return this.currentWorkspace;
  }

  async close(): Promise<void> {
    if (this.currentWatcher) {
      this.currentWatcher.stop();
      this.currentWatcher = null;
    }
    if (this.currentGit) {
      this.currentGit.dispose();
      this.currentGit = null;
    }
    this.currentFs = null;
    this.currentWorkspace = null;

    this.emitter.emit('change', null);
  }

  async refresh(): Promise<void> {
    if (!this.currentWorkspace) return;
    this.emitter.emit('change', this.currentWorkspace);
  }

  onDidChange(cb: (workspace: WorkspaceInfo | null) => void): () => void {
    this.emitter.on('change', cb);
    return () => {
      this.emitter.off('change', cb);
    };
  }

  private setWorkspaceSync(rootPath: string): void {
    const resolved = path.resolve(rootPath);
    if (fs.existsSync(resolved)) {
      const canonical = fs.realpathSync(resolved);
      const name = path.basename(canonical) || 'workspace';
      const watcher = new WorkspaceFileWatcher(canonical);
      const fsService = new NativeFileSystemService(canonical, watcher);
      const gitService = new NativeGitService(canonical);
      watcher.start();

      this.currentWatcher = watcher;
      this.currentFs = fsService;
      this.currentGit = gitService;
      this.currentWorkspace = { rootPath: canonical, name };
    }
  }
}

