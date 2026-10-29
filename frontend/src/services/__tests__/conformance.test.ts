import { describe, it, expect } from 'vitest';
import {
  runFileSystemConformanceTests,
  runTerminalConformanceTests,
  runGitConformanceTests,
  runSearchConformanceTests,
  runDiagnosticsConformanceTests,
  runOutputConformanceTests,
  runAiConformanceTests,
  runAgentConformanceTests,
  runIndexConformanceTests,
} from '@ajson/contracts/testing';

import {
  MockFileSystemService,
  MockTerminalService,
  MockGitService,
  MockSearchService,
  DefaultDiagnosticsService,
  DefaultOutputService,
  MockAiService,
  MockAgentService,
  MockIndexService,
  isDesktopBridgeAvailable,
  IpcFileSystemService,
} from '../index';

describe('Contracts Service Conformance Test Suite (Mock Implementations)', () => {
  it('FileSystemService passes conformance tests', async () => {
    const res = await runFileSystemConformanceTests(() => new MockFileSystemService());
    expect(res).toBe(true);
  });

  it('TerminalService passes conformance tests', async () => {
    const fs = new MockFileSystemService();
    const git = new MockGitService(fs);
    const terminal = new MockTerminalService(fs, git);
    const res = await runTerminalConformanceTests(() => terminal);
    expect(res).toBe(true);
  });

  it('GitService passes conformance tests', async () => {
    const fs = new MockFileSystemService();
    const git = new MockGitService(fs);
    const res = await runGitConformanceTests(() => git);
    expect(res).toBe(true);
  });

  it('SearchService passes conformance tests', async () => {
    const fs = new MockFileSystemService();
    const search = new MockSearchService(fs);
    const res = await runSearchConformanceTests(() => search);
    expect(res).toBe(true);
  });

  it('DiagnosticsService passes conformance tests', async () => {
    const diagnostics = new DefaultDiagnosticsService();
    const res = await runDiagnosticsConformanceTests(() => diagnostics);
    expect(res).toBe(true);
  });

  it('OutputService passes conformance tests', async () => {
    const output = new DefaultOutputService();
    const res = await runOutputConformanceTests(() => output);
    expect(res).toBe(true);
  });

  it('AiService passes conformance tests', async () => {
    const ai = new MockAiService();
    const res = await runAiConformanceTests(() => ai);
    expect(res).toBe(true);
  });

  it('AgentService passes conformance tests', async () => {
    const agent = new MockAgentService();
    const res = await runAgentConformanceTests(() => agent);
    expect(res).toBe(true);
  });

  it('IndexService passes conformance tests', async () => {
    const fs = new MockFileSystemService();
    const indexer = new MockIndexService(fs);
    const res = await runIndexConformanceTests(() => indexer);
    expect(res).toBe(true);
  });

  it('Bridge detection logic correctly differentiates browser vs electron', () => {
    // When window.ajson is undefined, returns false
    expect(isDesktopBridgeAvailable()).toBe(false);

    // When window.ajson is present, returns true
    const fakeBridge = {
      invoke: async () => ({ success: true }),
      on: () => () => {},
    };
    (window as unknown as { ajson: typeof fakeBridge }).ajson = fakeBridge;
    expect(isDesktopBridgeAvailable()).toBe(true);

    const ipcFs = new IpcFileSystemService();
    expect(ipcFs).toBeDefined();

    // Cleanup
    delete (window as unknown as { ajson?: unknown }).ajson;
    expect(isDesktopBridgeAvailable()).toBe(false);
  });
});
