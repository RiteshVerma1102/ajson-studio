import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { DefaultWorkspaceService } from '@ajson-studio/backend';
import { WorkspaceInfo, ErrorCode } from '@ajson/contracts';

describe('Backend WorkspaceService (Phases 1-3)', () => {
  let ws1Dir: string;
  let ws2Dir: string;
  let service: DefaultWorkspaceService;

  beforeEach(() => {
    ws1Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajson-ws1-'));
    ws2Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajson-ws2-'));
    service = new DefaultWorkspaceService();
  });

  afterEach(async () => {
    await service.close();
    try {
      fs.rmSync(ws1Dir, { recursive: true, force: true });
      fs.rmSync(ws2Dir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('opens a workspace folder and canonicalizes path', async () => {
    const ws = await service.open(ws1Dir);
    expect(ws).not.toBeNull();
    expect(ws?.rootPath).toBe(fs.realpathSync(ws1Dir));
    expect(ws?.name).toBe(path.basename(fs.realpathSync(ws1Dir)));

    const current = await service.getCurrent();
    expect(current).toEqual(ws);

    const fsService = service.getFileSystem();
    expect(fsService).not.toBeNull();
    expect(fsService?.getWorkspaceRoot()).toBe(ws?.rootPath);
  });

  it('rejects opening non-existent workspace path', async () => {
    await expect(service.open(path.join(ws1Dir, 'does-not-exist'))).rejects.toThrowError(
      expect.objectContaining({ code: ErrorCode.NOT_FOUND })
    );
  });

  it('switches workspaces cleanly, updating watcher and filesystem', async () => {
    const ws1 = await service.open(ws1Dir);
    expect(service.getFileSystem()?.getWorkspaceRoot()).toBe(ws1?.rootPath);

    const ws2 = await service.open(ws2Dir);
    expect(service.getFileSystem()?.getWorkspaceRoot()).toBe(ws2?.rootPath);
    expect(ws2?.rootPath).not.toBe(ws1?.rootPath);
  });

  it('closes workspace, cleans up watcher and emits event', async () => {
    await service.open(ws1Dir);
    expect(await service.getCurrent()).not.toBeNull();

    let eventEmitted: WorkspaceInfo | null | undefined = undefined;
    service.onDidChange((ws) => {
      eventEmitted = ws;
    });

    await service.close();

    expect(await service.getCurrent()).toBeNull();
    expect(service.getFileSystem()).toBeNull();
    expect(service.getWatcher()).toBeNull();
    expect(eventEmitted).toBeNull();
  });
});
