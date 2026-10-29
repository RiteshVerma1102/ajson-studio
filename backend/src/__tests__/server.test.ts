import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { startServer } from '../server/index';

describe('Backend Server Integration', () => {
  let tmpWorkspace: string;
  let tmpDataDir: string;

  beforeEach(() => {
    tmpWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ajson-ws-'));
    tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajson-data-'));
    process.env.AJSON_DATA_DIR = tmpDataDir;
  });

  afterEach(() => {
    delete process.env.AJSON_DATA_DIR;
    fs.rmSync(tmpWorkspace, { recursive: true, force: true });
    fs.rmSync(tmpDataDir, { recursive: true, force: true });
  });

  it('boots in-process server, runs migrations, and handles RPC calls', async () => {
    const server = await startServer({
      inProcessOnly: true,
      workspaceRoot: tmpWorkspace,
    });

    try {
      // 1. Health check
      const health = await server.client.call<{ status: string; methods: string[] }>('health', {});
      expect(health.status).toBe('ok');
      expect(health.methods).toContain('workspace.open');
      expect(health.methods).toContain('fs.readFile');
      expect(health.methods).toContain('settings.get');

      // 2. Settings persistence
      await server.client.call('settings.set', { key: 'app.theme', value: 'midnight' });
      const theme = await server.client.call('settings.get', { key: 'app.theme' });
      expect(theme).toBe('midnight');

      // 3. Workspace info
      const current = await server.client.call<{ rootPath: string } | null>('workspace.getCurrent', {});
      expect(current?.rootPath).toBe(path.resolve(tmpWorkspace));

      // 4. File operations through RPC
      await server.client.call('fs.writeFile', {
        path: 'greeting.txt',
        content: 'Hello Ajson Studio',
      });

      const readBack = await server.client.call<string>('fs.readFile', {
        path: 'greeting.txt',
      });
      expect(readBack).toBe('Hello Ajson Studio');

      // 5. Search text through RPC
      const searchMatches = await server.client.call<Array<{ path: string; lineContent: string }>>(
        'search.text',
        { query: 'Ajson Studio' }
      );
      expect(searchMatches.length).toBeGreaterThanOrEqual(1);
      expect(searchMatches[0]?.path).toBe('greeting.txt');
    } finally {
      // Clean up server
      try {
        server.db.close();
      } catch {
        /* ignore */
      }
    }
  });
});
