import path from 'node:path';
import fs from 'node:fs';
import { AjsonError, ErrorCode } from '@ajson/contracts';

export class PathGuard {
  private canonicalRoot: string;

  constructor(workspaceRoot: string) {
    if (!workspaceRoot || typeof workspaceRoot !== 'string') {
      throw new AjsonError(ErrorCode.INVALID_PAYLOAD, 'Workspace root must be a non-empty string');
    }
    // Resolve absolute path and canonicalize if it exists
    const resolved = path.resolve(workspaceRoot);
    try {
      this.canonicalRoot = fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved;
    } catch {
      this.canonicalRoot = resolved;
    }
  }

  public getWorkspaceRoot(): string {
    return this.canonicalRoot;
  }

  /**
   * Validates and resolves a user-supplied relative or absolute path against the workspace root.
   * Throws AjsonError with PATH_TRAVERSAL if the path escapes the sandbox.
   */
  public resolveWithinWorkspace(targetPath: string): string {
    if (typeof targetPath !== 'string') {
      throw new AjsonError(ErrorCode.INVALID_PAYLOAD, 'Path must be a string');
    }

    // Reject null byte injection
    if (targetPath.includes('\0')) {
      throw new AjsonError(ErrorCode.PATH_TRAVERSAL, 'Null bytes are forbidden in paths');
    }

    // Normalize slashes for consistency across platforms
    const normalizedInput = targetPath.replace(/\\/g, '/');

    // Resolve target path against canonical workspace root
    const resolved = path.resolve(this.canonicalRoot, normalizedInput);

    // Enforce root containment: resolved must equal root or start with root + sep
    const rootWithSep = this.canonicalRoot.endsWith(path.sep)
      ? this.canonicalRoot
      : this.canonicalRoot + path.sep;

    if (resolved !== this.canonicalRoot && !resolved.startsWith(rootWithSep)) {
      throw new AjsonError(
        ErrorCode.PATH_TRAVERSAL,
        `Access denied: path "${targetPath}" resolves outside workspace sandbox`
      );
    }

    // Check symlink realpath safety if path exists on disk
    if (fs.existsSync(resolved)) {
      try {
        const real = fs.realpathSync(resolved);
        if (real !== this.canonicalRoot && !real.startsWith(rootWithSep)) {
          throw new AjsonError(
            ErrorCode.PATH_TRAVERSAL,
            `Access denied: symlink "${targetPath}" resolves outside workspace sandbox`
          );
        }
        return real;
      } catch (err: unknown) {
        if (err instanceof AjsonError) throw err;
        // If realpath fails, fallback to resolved if safely bounded
      }
    }

    return resolved;
  }

  /**
   * Converts an absolute path within the workspace to a normalized relative path (forward-slash).
   */
  public toRelativePath(absolutePath: string): string {
    const rel = path.relative(this.canonicalRoot, absolutePath);
    return rel.replace(/\\/g, '/');
  }

  /**
   * Validates filename to prevent directory separators or illegal characters.
   */
  public static validateFileName(name: string): void {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new AjsonError(ErrorCode.INVALID_PAYLOAD, 'Filename cannot be empty');
    }
    if (name.includes('/') || name.includes('\\') || name.includes('\0')) {
      throw new AjsonError(
        ErrorCode.INVALID_PAYLOAD,
        `Filename "${name}" cannot contain path separators or null bytes`
      );
    }
    // Disallow reserved names or control characters
    if (/[\x00-\x1f\x7f:*?"<>|]/.test(name)) {
      throw new AjsonError(
        ErrorCode.INVALID_PAYLOAD,
        `Filename "${name}" contains illegal characters`
      );
    }
  }
}
