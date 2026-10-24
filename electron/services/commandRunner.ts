import { spawn, ChildProcess, execFile } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

export const MAX_OUTPUT_BYTES = 2 * 1024 * 1024
export const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000
export const MAX_TIMEOUT_MS = 30 * 60 * 1000
export const MAX_COMMAND_LENGTH = 8192

export type CommandEvent =
  | { id: string; type: 'stdout' | 'stderr'; data: string }
  | { id: string; type: 'exit'; code: number | null; signal: string | null; reason: 'completed' | 'killed' | 'timeout' | 'error'; error?: string }

export interface RunRequest {
  id: string
  command: string
  /** Working directory. Must be the project root or a directory inside it. */
  cwd: string
  projectRoot: string
  timeoutMs?: number
}

export function isInsideRoot(target: string, root: string): boolean {
  const t = path.resolve(target)
  const r = path.resolve(root)
  return t === r || t.startsWith(r.endsWith(path.sep) ? r : r + path.sep)
}

/** Returns an error string if the request is invalid, otherwise null. */
export function validateRunRequest(req: RunRequest): string | null {
  if (typeof req.id !== 'string' || !req.id) return 'Missing command id'
  if (typeof req.command !== 'string' || !req.command.trim()) return 'Empty command'
  if (req.command.length > MAX_COMMAND_LENGTH) return 'Command too long'
  if (req.command.includes('\0')) return 'Command contains a null byte'
  if (!req.projectRoot) return 'No project folder is open'
  if (!isInsideRoot(req.cwd, req.projectRoot)) return 'Working directory is outside the project root'
  try {
    // Resolve symlinks so a link inside the project cannot point the shell elsewhere.
    const real = fs.realpathSync(req.cwd)
    const realRoot = fs.realpathSync(req.projectRoot)
    if (!isInsideRoot(real, realRoot)) return 'Working directory resolves outside the project root'
    if (!fs.statSync(real).isDirectory()) return 'Working directory is not a directory'
  } catch {
    return 'Working directory does not exist'
  }
  return null
}

/**
 * Runs shell commands as child processes (pipes, not a PTY: interactive
 * full-screen programs are not supported). Commands run with the user's own
 * privileges, like any local terminal; the cwd is confined to the open project.
 */
export class CommandRunner {
  private procs = new Map<string, { child: ChildProcess; reason: 'completed' | 'killed' | 'timeout' }>()

  isRunning(id: string): boolean {
    return this.procs.has(id)
  }

  runningCount(): number {
    return this.procs.size
  }

  run(req: RunRequest, emit: (e: CommandEvent) => void): { ok: true } | { ok: false; error: string } {
    const err = validateRunRequest(req)
    if (err) return { ok: false, error: err }
    if (this.procs.has(req.id)) return { ok: false, error: 'A command with this id is already running' }

    const timeoutMs = Math.min(Math.max(req.timeoutMs ?? DEFAULT_TIMEOUT_MS, 1000), MAX_TIMEOUT_MS)
    const isWin = process.platform === 'win32'
    let child: ChildProcess
    try {
      child = spawn(req.command, {
        cwd: path.resolve(req.cwd),
        shell: true,
        detached: !isWin, // own process group so the whole tree can be killed
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '0', TERM: 'dumb' },
      })
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }

    const entry = { child, reason: 'completed' as 'completed' | 'killed' | 'timeout' }
    this.procs.set(req.id, entry)

    let bytes = 0
    let truncated = false
    const onChunk = (type: 'stdout' | 'stderr') => (buf: Buffer) => {
      if (truncated) return
      bytes += buf.length
      if (bytes > MAX_OUTPUT_BYTES) {
        truncated = true
        emit({ id: req.id, type: 'stderr', data: '\n[output truncated: exceeded 2 MB limit; process killed]\n' })
        entry.reason = 'killed'
        this.killTree(child)
        return
      }
      emit({ id: req.id, type, data: buf.toString('utf8') })
    }
    child.stdout?.on('data', onChunk('stdout'))
    child.stderr?.on('data', onChunk('stderr'))

    const timer = setTimeout(() => {
      entry.reason = 'timeout'
      this.killTree(child)
    }, timeoutMs)

    let finished = false
    const finish = (e: CommandEvent) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      this.procs.delete(req.id)
      emit(e)
    }
    child.on('error', (e) =>
      finish({ id: req.id, type: 'exit', code: null, signal: null, reason: 'error', error: e.message })
    )
    child.on('close', (code, signal) =>
      finish({ id: req.id, type: 'exit', code, signal, reason: entry.reason })
    )
    return { ok: true }
  }

  kill(id: string): boolean {
    const entry = this.procs.get(id)
    if (!entry) return false
    entry.reason = 'killed'
    this.killTree(entry.child)
    return true
  }

  killAll(): void {
    for (const id of [...this.procs.keys()]) this.kill(id)
  }

  private killTree(child: ChildProcess): void {
    if (!child.pid) return
    if (process.platform === 'win32') {
      execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => undefined)
      return
    }
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch {
      try { child.kill('SIGTERM') } catch { /* already gone */ }
    }
    const pid = child.pid
    setTimeout(() => {
      try { process.kill(-pid, 'SIGKILL') } catch { /* already gone */ }
    }, 2000).unref()
  }
}
