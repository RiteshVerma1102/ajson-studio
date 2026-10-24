import type { TerminalEvent } from '../types/electron'
import { parseNodeTestSummary, TestSummary } from '../utils/testSummary'

export interface TerminalLine {
  kind: 'command' | 'stdout' | 'stderr' | 'system'
  text: string
}

export interface RunLogEntry {
  id: string
  command: string
  startedAt: number
  endedAt?: number
  exitCode?: number | null
  reason?: 'completed' | 'killed' | 'timeout' | 'error'
}

export interface TestRun {
  command: string
  running: boolean
  summary: TestSummary | null
  exitCode: number | null
  at: number
}

export interface TerminalState {
  lines: TerminalLine[]
  runLog: RunLogEntry[]
  runningId: string | null
  lastTestRun: TestRun | null
  commandHistory: string[]
}

const MAX_LINES = 5000
let state: TerminalState = { lines: [], runLog: [], runningId: null, lastTestRun: null, commandHistory: [] }
const listeners = new Set<() => void>()
const buffers = new Map<string, { isTest: boolean; text: string }>()
let seq = 0
let unsubscribeIpc: (() => void) | null = null

function set(next: Partial<TerminalState>): void {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

function append(...lines: TerminalLine[]): void {
  const merged = [...state.lines, ...lines]
  set({ lines: merged.length > MAX_LINES ? merged.slice(merged.length - MAX_LINES) : merged })
}

function handleEvent(e: TerminalEvent): void {
  if (e.type === 'stdout' || e.type === 'stderr') {
    const buf = buffers.get(e.id)
    if (buf?.isTest) buf.text += e.data
    append({ kind: e.type, text: e.data })
    return
  }
  const buf = buffers.get(e.id)
  const summary = buf?.isTest ? parseNodeTestSummary(buf.text) : null
  buffers.delete(e.id)
  const label =
    e.reason === 'timeout' ? 'timed out' : e.reason === 'killed' ? 'cancelled' : e.reason === 'error' ? `failed to start: ${e.error ?? 'unknown error'}` : `exited with code ${e.code}`
  append({ kind: 'system', text: `\n[process ${label}]\n` })
  set({
    runningId: state.runningId === e.id ? null : state.runningId,
    runLog: state.runLog.map((r) => (r.id === e.id ? { ...r, endedAt: Date.now(), exitCode: e.code, reason: e.reason } : r)),
    lastTestRun:
      buf?.isTest && state.lastTestRun
        ? { ...state.lastTestRun, running: false, summary, exitCode: e.code }
        : state.lastTestRun,
  })
}

export const terminalStore = {
  subscribe(l: () => void): () => void {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  getState: (): TerminalState => state,

  /** Idempotent: attaches the single IPC listener. */
  init(): void {
    if (unsubscribeIpc || !window.ajsonAPI?.terminal) return
    unsubscribeIpc = window.ajsonAPI.terminal.onEvent(handleEvent)
  },

  async run(command: string, opts: { isTest?: boolean } = {}): Promise<void> {
    const api = window.ajsonAPI?.terminal
    const trimmed = command.trim()
    if (!trimmed) return
    if (!api) {
      append({ kind: 'stderr', text: 'Terminal is only available in the Ajson Studio desktop app.\n' })
      return
    }
    if (state.runningId) {
      append({ kind: 'stderr', text: 'A command is already running. Stop it first (Ctrl+C or the Stop button).\n' })
      return
    }
    this.init()
    const id = `cmd-${Date.now()}-${++seq}`
    buffers.set(id, { isTest: !!opts.isTest, text: '' })
    const history = state.commandHistory[state.commandHistory.length - 1] === trimmed ? state.commandHistory : [...state.commandHistory, trimmed].slice(-100)
    append({ kind: 'command', text: trimmed })
    set({
      runningId: id,
      commandHistory: history,
      runLog: [...state.runLog, { id, command: trimmed, startedAt: Date.now() }].slice(-200),
      lastTestRun: opts.isTest ? { command: trimmed, running: true, summary: null, exitCode: null, at: Date.now() } : state.lastTestRun,
    })
    const res = await api.run({ id, command: trimmed })
    if (!res.ok) {
      buffers.delete(id)
      append({ kind: 'stderr', text: `${res.error ?? 'Failed to start command'}\n` })
      set({
        runningId: null,
        runLog: state.runLog.map((r) => (r.id === id ? { ...r, endedAt: Date.now(), exitCode: null, reason: 'error' } : r)),
        lastTestRun: opts.isTest && state.lastTestRun ? { ...state.lastTestRun, running: false } : state.lastTestRun,
      })
    }
  },

  async stop(): Promise<void> {
    if (state.runningId) await window.ajsonAPI?.terminal.kill(state.runningId)
  },

  clear(): void {
    set({ lines: [] })
  },
}
