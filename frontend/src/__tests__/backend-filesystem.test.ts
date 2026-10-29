import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { NativeFileSystemService } from '@ajson-studio/backend';
import { runFileSystemConformanceTests } from '@ajson/contracts/testing';
import { ErrorCode } from '@ajson/contracts';

describe('Backend NativeFileSystemService (Phase 2)', () => {
  let tempDir: string;
  let fsService: NativeFileSystemService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajson-backend-fs-'));
    fsService = new NativeFileSystemService(tempDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('passes the official @ajson/contracts conformance test suite', async () => {
    const result = await runFileSystemConformanceTests(() => fsService);
    expect(result).toBe(true);
  });

  it('performs atomic writes via temporary files without corrupting target', async () => {
    const targetFile = 'atomic-test.json';
    const content = JSON.stringify({ hello: 'world', version: 1 });

    await fsService.writeFile(targetFile, content);

    const read = await fsService.readFile(targetFile);
    expect(read).toBe(content);

    // Ensure no lingering .tmp files
    const entries = await fsService.readDir('');
    const tmpFiles = entries.filter((e) => e.name.endsWith('.tmp'));
    expect(tmpFiles.length).toBe(0);
  });

  it('sorts directories before files in readDir', async () => {
    await fsService.createFile('z-file.txt', '1');
    await fsService.createDir('b-folder');
    await fsService.createFile('a-file.txt', '2');
    await fsService.createDir('a-folder');

    const entries = await fsService.readDir('');
    expect(entries.map((e) => e.name)).toEqual([
      'a-folder',
      'b-folder',
      'a-file.txt',
      'z-file.txt',
    ]);
  });

  it('enforces maximum file size limit (5MB cap)', async () => {
    const largeFile = 'large.bin';
    const filePath = path.join(tempDir, largeFile);
    const largeBuffer = Buffer.alloc(5.5 * 1024 * 1024, 'A');
    fs.writeFileSync(filePath, largeBuffer);

    await expect(fsService.readFile(largeFile)).rejects.toThrowError(
      expect.objectContaining({ code: ErrorCode.PAYLOAD_TOO_LARGE })
    );
  });

  it('detects and rejects binary files with null bytes', async () => {
    const binaryFile = 'sample.wasm';
    const filePath = path.join(tempDir, binaryFile);
    const binData = Buffer.from([0x00, 0x61, 0x73, 0x6d]); // null byte
    fs.writeFileSync(filePath, binData);

    await expect(fsService.readFile(binaryFile)).rejects.toThrowError(
      expect.objectContaining({ code: ErrorCode.INVALID_PAYLOAD })
    );
  });

  describe('Workspace Security & Path Confinement', () => {
    it('blocks directory traversal attempts using ".."', async () => {
      await expect(fsService.readFile('../outside.txt')).rejects.toThrowError(
        expect.objectContaining({ code: ErrorCode.PATH_TRAVERSAL })
      );

      await expect(fsService.writeFile('../../malicious.sh', 'hack')).rejects.toThrowError(
        expect.objectContaining({ code: ErrorCode.PATH_TRAVERSAL })
      );

      await expect(fsService.delete('../target')).rejects.toThrowError(
        expect.objectContaining({ code: ErrorCode.PATH_TRAVERSAL })
      );
    });

    it('blocks null-byte injection attacks in paths', async () => {
      await expect(fsService.readFile('test.txt\0.exe')).rejects.toThrowError(
        expect.objectContaining({ code: ErrorCode.PATH_TRAVERSAL })
      );
    });

    it('blocks symlink escapes outside the workspace sandbox', async () => {
      // Create external directory and file
      const externalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajson-external-'));
      const secretFile = path.join(externalDir, 'secret.txt');
      fs.writeFileSync(secretFile, 'SUPER_SECRET_TOKEN');

      const symlinkPath = path.join(tempDir, 'escaped-link');
      try {
        fs.symlinkSync(secretFile, symlinkPath);

        // Attempt to read file through symlink
        await expect(fsService.readFile('escaped-link')).rejects.toThrowError(
          expect.objectContaining({ code: ErrorCode.PATH_TRAVERSAL })
        );
      } catch (err: unknown) {
        // Skip if OS restricts symlink creation without admin rights
        if ((err as { code?: string })?.code !== 'EPERM') {
          throw err;
        }
      } finally {
        fs.rmSync(externalDir, { recursive: true, force: true });
      }
    });

    it('prevents deleting the workspace root itself', async () => {
      await expect(fsService.delete('')).rejects.toThrowError(
        expect.objectContaining({ code: ErrorCode.PERMISSION_DENIED })
      );
    });
  });
});
