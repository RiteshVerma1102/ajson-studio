import { TerminalService } from '../services/terminal';

export async function runTerminalConformanceTests(
  createService: () => Promise<TerminalService> | TerminalService
) {
  const terminal = await createService();

  // 1. Create session
  const sessionId = await terminal.createSession({ title: 'Conformance Terminal' });
  if (!sessionId) {
    throw new Error('createSession did not return a session id');
  }

  // 2. List sessions
  const sessions = terminal.listSessions();
  const found = sessions.find((s) => s.id === sessionId);
  if (!found) {
    throw new Error(`listSessions did not include session ${sessionId}`);
  }

  // 3. Run basic command
  const res = await terminal.runCommand(sessionId, 'echo "conformance-output"');
  if (res.exitCode !== 0) {
    throw new Error(`runCommand returned non-zero exit code: ${res.exitCode}`);
  }

  // 4. Kill session
  terminal.kill(sessionId);
  const remaining = terminal.listSessions().find((s) => s.id === sessionId);
  if (remaining) {
    throw new Error(`kill failed to terminate session ${sessionId}`);
  }

  return true;
}
