import { describe, it, expect } from 'vitest';
import {
  IpcChannels,
  FsReadDirRequestSchema,
  FsReadFileRequestSchema,
  FsWriteFileRequestSchema,
  FsCreateFileRequestSchema,
  FsRenameRequestSchema,
  WorkspaceOpenRequestSchema,
  AjsonError,
  ErrorCode,
} from '@ajson/contracts';

describe('Backend IPC Validation & Gateway Contracts (Phase 1)', () => {
  it('validates FsReadDirRequestSchema correctly', () => {
    expect(() => FsReadDirRequestSchema.parse({ path: 'src' })).not.toThrow();
    expect(() => FsReadDirRequestSchema.parse({ path: '' })).not.toThrow();
    expect(() => FsReadDirRequestSchema.parse({ path: 123 })).toThrow();
    expect(() => FsReadDirRequestSchema.parse({})).toThrow();
  });

  it('validates FsWriteFileRequestSchema correctly', () => {
    expect(() =>
      FsWriteFileRequestSchema.parse({ path: 'src/index.ts', content: 'export *;' })
    ).not.toThrow();
    expect(() => FsWriteFileRequestSchema.parse({ path: 'test.ts' })).toThrow();
    expect(() => FsWriteFileRequestSchema.parse({ content: 'data' })).toThrow();
  });

  it('validates FsReadFile, FsCreateFile, and FsRename schemas correctly', () => {
    expect(() => FsReadFileRequestSchema.parse({ path: 'file.txt' })).not.toThrow();
    expect(() => FsReadFileRequestSchema.parse({ path: 456 })).toThrow();

    expect(() => FsCreateFileRequestSchema.parse({ path: 'new.txt', content: 'hello' })).not.toThrow();
    expect(() => FsCreateFileRequestSchema.parse({})).toThrow();

    expect(() => FsRenameRequestSchema.parse({ oldPath: 'a.txt', newPath: 'b.txt' })).not.toThrow();
    expect(() => FsRenameRequestSchema.parse({ oldPath: 'a.txt' })).toThrow();
  });

  it('validates WorkspaceOpenRequestSchema correctly', () => {
    expect(() => WorkspaceOpenRequestSchema.parse({})).not.toThrow();
    expect(() => WorkspaceOpenRequestSchema.parse({ path: '/tmp/project' })).not.toThrow();
    expect(() => WorkspaceOpenRequestSchema.parse({ path: 999 })).toThrow();
  });

  it('serializes AjsonError into standardized AjsonErrorPayload', () => {
    const error = new AjsonError(
      ErrorCode.PATH_TRAVERSAL,
      'Access denied: path escapes sandbox',
      { attemptedPath: '../../etc/passwd' }
    );

    const payload = error.toJSON();
    expect(payload.code).toBe(ErrorCode.PATH_TRAVERSAL);
    expect(payload.message).toBe('Access denied: path escapes sandbox');
    expect(payload.details).toEqual({ attemptedPath: '../../etc/passwd' });
    expect(payload.timestamp).toBeTypeOf('number');

    const reconstructed = AjsonError.fromJSON(payload);
    expect(reconstructed.code).toBe(ErrorCode.PATH_TRAVERSAL);
    expect(reconstructed.message).toBe('Access denied: path escapes sandbox');
  });

  it('contains consistent, collision-free IPC channel constants', () => {
    const channels = Object.values(IpcChannels);
    const unique = new Set(channels);
    expect(channels.length).toBe(unique.size);

    expect(IpcChannels.WORKSPACE_OPEN).toBe('ajson:workspace:open');
    expect(IpcChannels.FS_READ_DIR).toBe('ajson:fs:readDir');
    expect(IpcChannels.FS_READ_FILE).toBe('ajson:fs:readFile');
    expect(IpcChannels.FS_WRITE_FILE).toBe('ajson:fs:writeFile');
    expect(IpcChannels.FS_EVENT).toBe('ajson:fs:event');
  });
});
