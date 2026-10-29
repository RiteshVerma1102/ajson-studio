import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { WorkspaceFileWatcher } from '@ajson-studio/backend';
import { FsWatchEventType } from '@ajson/contracts';

describe('Backend WorkspaceFileWatcher (Phase 3)', () => {
  let tempDir: string;
  let watcher: WorkspaceFileWatcher;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajson-backend-watcher-'));
    watcher = new WorkspaceFileWatcher(tempDir, { debounceMs: 20 });
    watcher.start();
  });

  afterEach(() => {
    watcher.stop();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('detects external file creation and emits "add"', async () => {
    const received: { event: FsWatchEventType; path: string }[] = [];
    const unbind = watcher.onEvent((event, p) => {
      received.push({ event, path: p });
    });

    const newFilePath = path.join(tempDir, 'external-created.txt');
    fs.writeFileSync(newFilePath, 'hello from external process');

    // Wait for debounced event
    await new Promise((resolve) => setTimeout(resolve, 150));
    unbind();

    const addEvent = received.find(
      (e) => e.path === 'external-created.txt' && (e.event === 'add' || e.event === 'change')
    );
    expect(addEvent).toBeDefined();
  });

  it('detects external file modification and emits "change"', async () => {
    const filePath = path.join(tempDir, 'to-modify.txt');
    fs.writeFileSync(filePath, 'v1');

    // Let initial add settle
    await new Promise((resolve) => setTimeout(resolve, 80));

    const received: { event: FsWatchEventType; path: string }[] = [];
    const unbind = watcher.onEvent((event, p) => {
      received.push({ event, path: p });
    });

    fs.appendFileSync(filePath, '\nv2-modified');

    await new Promise((resolve) => setTimeout(resolve, 150));
    unbind();

    const changeEvent = received.find(
      (e) => e.path === 'to-modify.txt' && e.event === 'change'
    );
    expect(changeEvent).toBeDefined();
  });

  it('detects external file deletion and emits "unlink"', async () => {
    const filePath = path.join(tempDir, 'to-delete.txt');
    fs.writeFileSync(filePath, 'doomed');

    await new Promise((resolve) => setTimeout(resolve, 80));

    const received: { event: FsWatchEventType; path: string }[] = [];
    const unbind = watcher.onEvent((event, p) => {
      received.push({ event, path: p });
    });

    fs.unlinkSync(filePath);

    await new Promise((resolve) => setTimeout(resolve, 150));
    unbind();

    const unlinkEvent = received.find(
      (e) => e.path === 'to-delete.txt' && e.event === 'unlink'
    );
    expect(unlinkEvent).toBeDefined();
  });

  it('filters out ignored paths (.git, node_modules, .tmp)', async () => {
    expect(watcher.isIgnored('.git/HEAD')).toBe(true);
    expect(watcher.isIgnored('node_modules/package.json')).toBe(true);
    expect(watcher.isIgnored('dist/index.js')).toBe(true);
    expect(watcher.isIgnored('.file.tmp')).toBe(true);
    expect(watcher.isIgnored('src/components/Button.tsx')).toBe(false);
  });

  it('cleans up all resources on stop', async () => {
    const received: { event: FsWatchEventType; path: string }[] = [];
    watcher.onEvent((event, p) => received.push({ event, path: p }));

    watcher.stop();

    fs.writeFileSync(path.join(tempDir, 'after-stop.txt'), 'data');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(received.length).toBe(0);
  });
});
