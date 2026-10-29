import {
  TerminalService,
  TerminalSession,
  TerminalSessionOptions,
  DiagnosticsService,
  GitService,
} from './types';
import { MockShell } from './shell/mockShell';
import { MockFileSystemService } from './fileSystem';

interface ActiveSession {
  info: TerminalSession;
  shell: MockShell;
  dataListeners: Set<(data: string) => void>;
  exitListeners: Set<(code: number) => void>;
  cmdStartListeners: Set<(cmd: string) => void>;
  cmdEndListeners: Set<(cmd: string, code: number) => void>;
}

export class MockTerminalService implements TerminalService {
  private sessions: Map<string, ActiveSession> = new Map();
  private fs: MockFileSystemService;
  private git: GitService;
  private diagnostics?: DiagnosticsService;

  constructor(fs: MockFileSystemService, git: GitService, diagnostics?: DiagnosticsService) {
    this.fs = fs;
    this.git = git;
    this.diagnostics = diagnostics;
  }

  async createSession(options?: TerminalSessionOptions): Promise<string> {
    const id = `term_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const shellType = options?.shell || 'bash';
    const cwd = options?.cwd || '';

    const shell = new MockShell({
      shell: shellType,
      cwd,
      fs: this.fs,
      git: this.git,
      diagnostics: this.diagnostics,
    });

    const active: ActiveSession = {
      info: {
        id,
        title: options?.title || `Terminal ${this.sessions.size + 1}`,
        cwd,
        shell: shellType,
        owner: options?.owner || 'user',
        readOnly: options?.readOnly || false,
        createdAt: Date.now(),
      },
      shell,
      dataListeners: new Set(),
      exitListeners: new Set(),
      cmdStartListeners: new Set(),
      cmdEndListeners: new Set(),
    };

    shell.onOutput = (data) => {
      for (const cb of active.dataListeners) {
        try {
          cb(data);
        } catch (err) {
          console.error('Error in terminal onData listener', err);
        }
      }
    };

    shell.onCommandStart = (cmd) => {
      for (const cb of active.cmdStartListeners) {
        try {
          cb(cmd);
        } catch (err) {
          console.error('Error in terminal onCommandStart listener', err);
        }
      }
    };

    shell.onCommandEnd = (cmd, code) => {
      for (const cb of active.cmdEndListeners) {
        try {
          cb(cmd, code);
        } catch (err) {
          console.error('Error in terminal onCommandEnd listener', err);
        }
      }
    };

    shell.onExit = (code) => {
      for (const cb of active.exitListeners) {
        try {
          cb(code);
        } catch (err) {
          console.error('Error in terminal onExit listener', err);
        }
      }
    };

    this.sessions.set(id, active);
    await shell.init();
    return id;
  }

  write(id: string, data: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    if (session.info.readOnly) return;
    session.shell.handleInput(data);
  }

  resize(_id: string, _cols: number, _rows: number): void {
    // Virtual shell handles auto line wrapping
  }

  kill(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.dataListeners.clear();
      session.exitListeners.clear();
      this.sessions.delete(id);
    }
  }

  onData(id: string, cb: (data: string) => void): () => void {
    const session = this.sessions.get(id);
    if (!session) return () => {};
    session.dataListeners.add(cb);
    return () => {
      session.dataListeners.delete(cb);
    };
  }

  onExit(id: string, cb: (code: number) => void): () => void {
    const session = this.sessions.get(id);
    if (!session) return () => {};
    session.exitListeners.add(cb);
    return () => {
      session.exitListeners.delete(cb);
    };
  }

  async runCommand(
    id: string,
    command: string,
    _opts?: { timeoutMs?: number }
  ): Promise<{ exitCode: number; output: string }> {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Terminal session not found: ${id}`);

    let captured = '';
    const unbind = this.onData(id, (chunk) => {
      captured += chunk;
    });

    try {
      const exitCode = await session.shell.executeCommandLine(command);
      return { exitCode, output: captured };
    } finally {
      unbind();
    }
  }

  onCommandStart(id: string, cb: (cmd: string) => void): () => void {
    const session = this.sessions.get(id);
    if (!session) return () => {};
    session.cmdStartListeners.add(cb);
    return () => {
      session.cmdStartListeners.delete(cb);
    };
  }

  onCommandEnd(id: string, cb: (cmd: string, code: number) => void): () => void {
    const session = this.sessions.get(id);
    if (!session) return () => {};
    session.cmdEndListeners.add(cb);
    return () => {
      session.cmdEndListeners.delete(cb);
    };
  }

  listSessions(): TerminalSession[] {
    return Array.from(this.sessions.values()).map((s) => s.info);
  }

  getCwd(id: string): string {
    const session = this.sessions.get(id);
    return session ? session.shell.getCwd() : '';
  }
}
