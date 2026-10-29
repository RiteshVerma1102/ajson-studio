import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  FileSystemService,
  FileEntry,
  FileStat,
  AjsonError,
  ErrorCode,
  FsWatchEventType,
} from '@ajson/contracts';
import { PathGuard } from '../security/pathGuard';
import { WorkspaceFileWatcher } from './fileWatcher';

const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export class NativeFileSystemService implements FileSystemService {
  private guard: PathGuard;
  private watcher: WorkspaceFileWatcher | null = null;

  constructor(workspaceRoot: string, watcher?: WorkspaceFileWatcher) {
    this.guard = new PathGuard(workspaceRoot);
    this.watcher = watcher || null;
  }

  public setWatcher(watcher: WorkspaceFileWatcher): void {
    this.watcher = watcher;
  }

  public getWorkspaceRoot(): string {
    return this.guard.getWorkspaceRoot();
  }

  /**
   * List contents of a directory within the workspace sandbox.
   */
  async readDir(targetPath: string): Promise<FileEntry[]> {
    const fullPath = this.guard.resolveWithinWorkspace(targetPath);

    if (!fs.existsSync(fullPath)) {
      throw new AjsonError(ErrorCode.NOT_FOUND, `Directory not found: "${targetPath}"`);
    }

    const stat = await fs.promises.stat(fullPath);
    if (!stat.isDirectory()) {
      throw new AjsonError(ErrorCode.INVALID_PAYLOAD, `Path is not a directory: "${targetPath}"`);
    }

    try {
      const dirEntries = await fs.promises.readdir(fullPath, { withFileTypes: true });

      const entries: FileEntry[] = await Promise.all(
        dirEntries.map(async (dirent) => {
          const itemFullPath = path.join(fullPath, dirent.name);
          const relativePath = this.guard.toRelativePath(itemFullPath);
          const isDir = dirent.isDirectory();

          let size: number | undefined = undefined;
          if (!isDir) {
            try {
              const fileStat = await fs.promises.stat(itemFullPath);
              size = fileStat.size;
            } catch {
              size = 0;
            }
          }

          return {
            name: dirent.name,
            path: relativePath,
            isDirectory: isDir,
            size,
          };
        })
      );

      // Sort directories first, then alphabetical
      return entries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });
    } catch (err: unknown) {
      if (err instanceof AjsonError) throw err;
      throw new AjsonError(
        ErrorCode.IO_ERROR,
        `Failed to read directory "${targetPath}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Read text file with 5MB protection limit and null-byte binary check.
   */
  async readFile(targetPath: string, maxBytes = DEFAULT_MAX_FILE_SIZE): Promise<string> {
    const fullPath = this.guard.resolveWithinWorkspace(targetPath);

    if (!fs.existsSync(fullPath)) {
      throw new AjsonError(ErrorCode.NOT_FOUND, `File not found: "${targetPath}"`);
    }

    const stat = await fs.promises.stat(fullPath);
    if (stat.isDirectory()) {
      throw new AjsonError(ErrorCode.INVALID_PAYLOAD, `Cannot read directory as file: "${targetPath}"`);
    }

    if (stat.size > maxBytes) {
      throw new AjsonError(
        ErrorCode.PAYLOAD_TOO_LARGE,
        `File "${targetPath}" size (${stat.size} bytes) exceeds maximum limit (${maxBytes} bytes)`
      );
    }

    // Binary file sniffing: check first 512 bytes for null byte
    let fileHandle: fs.promises.FileHandle | null = null;
    try {
      fileHandle = await fs.promises.open(fullPath, 'r');
      const sniffBuffer = Buffer.alloc(Math.min(512, stat.size));
      if (sniffBuffer.length > 0) {
        await fileHandle.read(sniffBuffer, 0, sniffBuffer.length, 0);
        if (sniffBuffer.includes(0)) {
          throw new AjsonError(
            ErrorCode.INVALID_PAYLOAD,
            `File "${targetPath}" is a binary file and cannot be opened as text`
          );
        }
      }
    } finally {
      if (fileHandle) {
        await fileHandle.close();
      }
    }

    try {
      return await fs.promises.readFile(fullPath, 'utf8');
    } catch (err: unknown) {
      if (err instanceof AjsonError) throw err;
      throw new AjsonError(
        ErrorCode.IO_ERROR,
        `Failed to read file "${targetPath}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Safe atomic file write: writes to temporary file then atomic rename.
   */
  async writeFile(targetPath: string, content: string): Promise<void> {
    const fullPath = this.guard.resolveWithinWorkspace(targetPath);
    const parentDir = path.dirname(fullPath);

    try {
      await fs.promises.mkdir(parentDir, { recursive: true });

      // Write to temp file in the same directory to ensure same filesystem partition for atomic rename
      const tempFileName = `.${path.basename(fullPath)}.${Date.now()}-${crypto.randomBytes(4).toString('hex')}.tmp`;
      const tempFilePath = path.join(parentDir, tempFileName);

      await fs.promises.writeFile(tempFilePath, content, 'utf8');
      await fs.promises.rename(tempFilePath, fullPath);
    } catch (err: unknown) {
      if (err instanceof AjsonError) throw err;
      throw new AjsonError(
        ErrorCode.IO_ERROR,
        `Failed to write file "${targetPath}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Create a new file. Fails if file already exists.
   */
  async createFile(targetPath: string, content = ''): Promise<void> {
    const fullPath = this.guard.resolveWithinWorkspace(targetPath);

    if (fs.existsSync(fullPath)) {
      throw new AjsonError(ErrorCode.ALREADY_EXISTS, `File already exists: "${targetPath}"`);
    }

    await this.writeFile(targetPath, content);
  }

  /**
   * Create a directory recursively.
   */
  async createDir(targetPath: string): Promise<void> {
    const fullPath = this.guard.resolveWithinWorkspace(targetPath);

    try {
      await fs.promises.mkdir(fullPath, { recursive: true });
    } catch (err: unknown) {
      throw new AjsonError(
        ErrorCode.IO_ERROR,
        `Failed to create directory "${targetPath}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Rename or move a file or directory within workspace sandbox.
   */
  async rename(oldPath: string, newPath: string): Promise<void> {
    const oldFullPath = this.guard.resolveWithinWorkspace(oldPath);
    const newFullPath = this.guard.resolveWithinWorkspace(newPath);

    if (!fs.existsSync(oldFullPath)) {
      throw new AjsonError(ErrorCode.NOT_FOUND, `Source path not found: "${oldPath}"`);
    }

    try {
      const newParent = path.dirname(newFullPath);
      await fs.promises.mkdir(newParent, { recursive: true });
      await fs.promises.rename(oldFullPath, newFullPath);
    } catch (err: unknown) {
      if (err instanceof AjsonError) throw err;
      throw new AjsonError(
        ErrorCode.IO_ERROR,
        `Failed to rename "${oldPath}" to "${newPath}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Delete a file or directory recursively.
   */
  async delete(targetPath: string): Promise<void> {
    const fullPath = this.guard.resolveWithinWorkspace(targetPath);

    // Prevent deleting the workspace root
    if (fullPath === this.guard.getWorkspaceRoot()) {
      throw new AjsonError(
        ErrorCode.PERMISSION_DENIED,
        'Cannot delete the workspace root directory'
      );
    }

    if (!fs.existsSync(fullPath)) {
      throw new AjsonError(ErrorCode.NOT_FOUND, `Path not found: "${targetPath}"`);
    }

    try {
      await fs.promises.rm(fullPath, { recursive: true, force: true });
    } catch (err: unknown) {
      if (err instanceof AjsonError) throw err;
      throw new AjsonError(
        ErrorCode.IO_ERROR,
        `Failed to delete "${targetPath}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Check stat of a file or directory. Returns null if not found.
   */
  async stat(targetPath: string): Promise<FileStat | null> {
    try {
      const fullPath = this.guard.resolveWithinWorkspace(targetPath);
      if (!fs.existsSync(fullPath)) return null;

      const s = await fs.promises.stat(fullPath);
      return {
        isDirectory: s.isDirectory(),
        size: s.size,
        mtime: s.mtimeMs,
      };
    } catch (err: unknown) {
      if (err instanceof AjsonError && err.code === ErrorCode.PATH_TRAVERSAL) {
        throw err;
      }
      return null;
    }
  }

  /**
   * Check if a path exists within workspace.
   */
  async exists(targetPath: string): Promise<boolean> {
    try {
      const fullPath = this.guard.resolveWithinWorkspace(targetPath);
      return fs.existsSync(fullPath);
    } catch (err: unknown) {
      if (err instanceof AjsonError && err.code === ErrorCode.PATH_TRAVERSAL) {
        throw err;
      }
      return false;
    }
  }

  /**
   * Subscribe to workspace file changes.
   */
  watch(cb: (event: FsWatchEventType, path: string) => void): () => void {
    if (!this.watcher) {
      // Lazy initialize watcher if not provided
      this.watcher = new WorkspaceFileWatcher(this.guard.getWorkspaceRoot());
      this.watcher.start();
    }
    return this.watcher.onEvent(cb);
  }
}
