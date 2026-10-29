import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { outputService, fileSystemService, gitService, terminalService, aiService, agentService } from '../index';
import { setupGlobalErrorLogging } from '../globalErrorLogger';
import { safeStorage } from '../../state/storage';

describe('Service Resilience & Failure Injection', () => {
  let cleanupLogging: () => void;

  beforeEach(() => {
    outputService.clear('Ajson');
    cleanupLogging = setupGlobalErrorLogging();
  });

  afterEach(() => {
    cleanupLogging();
    vi.restoreAllMocks();
  });

  it('captures unhandled promise rejections and logs to Output panel (Ajson channel)', () => {
    const errorEvent = new Event('unhandledrejection') as any;
    errorEvent.reason = new Error('Network disconnected or IPC gateway timeout');
    window.dispatchEvent(errorEvent);

    const lines = outputService.list('Ajson');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]!.level).toBe('error');
    expect(lines[0]!.text).toContain('Network disconnected or IPC gateway timeout');
  });

  it('captures global window error events and preserves emergency buffer snapshot', () => {
    safeStorage.setItem('ajson_editor_tabs_v1', JSON.stringify({ tabs: [{ id: 'unsaved.ts', content: 'draft code' }] }));

    const errorEvent = new ErrorEvent('error', {
      message: 'Uncaught TypeError: Cannot read properties of undefined',
      error: new Error('Uncaught TypeError: Cannot read properties of undefined'),
    });

    window.dispatchEvent(errorEvent);

    const snapshot = safeStorage.getItem('ajson_emergency_unsaved_buffer_v1');
    expect(snapshot).toBeDefined();
    expect(snapshot).toContain('draft code');

    const lines = outputService.list('Ajson');
    expect(lines.some((l) => l.text.includes('Cannot read properties of undefined'))).toBe(true);
  });

  it('handles simulated service failures gracefully without crashing caller execution flow', async () => {
    // Inject rejection into file system read
    const readSpy = vi.spyOn(fileSystemService, 'readFile').mockRejectedValueOnce(new Error('EACCES: permission denied'));
    await expect(fileSystemService.readFile('/restricted/root.key')).rejects.toThrow('permission denied');
    readSpy.mockRestore();

    // Inject rejection into git commit
    const commitSpy = vi.spyOn(gitService, 'commit').mockRejectedValueOnce(new Error('Git lockfile exists'));
    await expect(gitService.commit('WIP')).rejects.toThrow('Git lockfile exists');
    commitSpy.mockRestore();

    // Inject rejection into terminal session creation
    const termSpy = vi.spyOn(terminalService, 'createSession').mockRejectedValueOnce(new Error('pty process spawn failure'));
    await expect(terminalService.createSession()).rejects.toThrow('pty process spawn failure');
    termSpy.mockRestore();

    // Inject rejection into AI send
    const aiSpy = vi.spyOn(aiService, 'sendMessage').mockRejectedValueOnce(new Error('Rate limit exceeded (429)'));
    await expect(aiService.sendMessage({ messages: [{ role: 'user', content: 'Hello' }] } as any)).rejects.toThrow('Rate limit exceeded');
    aiSpy.mockRestore();

    // Inject rejection into Agent createMission
    const agentSpy = vi.spyOn(agentService, 'createMission').mockRejectedValueOnce(new Error('Agent orchestrator offline'));
    await expect(agentService.createMission('Refactor')).rejects.toThrow('Agent orchestrator offline');
    agentSpy.mockRestore();
  });
});
