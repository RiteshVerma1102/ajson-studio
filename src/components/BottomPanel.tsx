import React, { useState, useRef, useEffect, useSyncExternalStore } from 'react'
import {
  Terminal as TerminalIcon,
  AlertCircle,
  FileTerminal,
  X,
  Trash2,
  CheckCircle2,
  XCircle,
  Square,
  Play,
} from 'lucide-react'
import { useMonaco } from '@monaco-editor/react'
import { BottomTab } from '../types/editor'
import { terminalStore } from '../services/terminalStore'
import type { GitStatusResult } from '../types/electron'

interface BottomPanelProps {
  activeTab: BottomTab
  onSelectTab: (tab: BottomTab) => void
  onClose: () => void
  height: number
  onHeightChange?: (h: number) => void
}

interface Problem {
  file: string
  line: number
  column: number
  message: string
  severity: 'error' | 'warning' | 'info'
}

const TAB_BASE = 'h-full px-3 flex items-center space-x-1.5 transition-colors border-b-2 text-[11.5px]'
const tabClass = (active: boolean) =>
  `${TAB_BASE} ${
    active
      ? 'border-[#007ACC] text-white font-medium bg-[#1E1E1E]'
      : 'border-transparent text-[#9DA3AE] hover:text-white hover:bg-[#252526]'
  }`

export const BottomPanel: React.FC<BottomPanelProps> = ({ activeTab, onSelectTab, onClose, height }) => {
  const term = useSyncExternalStore(terminalStore.subscribe, terminalStore.getState)
  const monaco = useMonaco()
  const isDesktop = typeof window !== 'undefined' && !!window.ajsonAPI?.terminal

  const [input, setInput] = useState('')
  const [historyIdx, setHistoryIdx] = useState<number | null>(null)
  const [problems, setProblems] = useState<Problem[]>([])
  const [folderName, setFolderName] = useState<string | null>(null)
  const [git, setGit] = useState<GitStatusResult | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    terminalStore.init()
  }, [])

  // Real project folder + git branch (refreshed whenever a command finishes)
  useEffect(() => {
    const api = window.ajsonAPI
    if (!api) return
    api.project.getRoot().then((r: { name: string } | null) => setFolderName(r?.name ?? null)).catch(() => setFolderName(null))
    api.git.status().then(setGit).catch(() => setGit(null))
  }, [term.runningId])

  // Real diagnostics from Monaco's language services
  useEffect(() => {
    if (!monaco) return
    const collect = () => {
      const list: Problem[] = monaco.editor.getModelMarkers({}).map((m) => ({
        file: m.resource.path.split('/').pop() || m.resource.toString(),
        line: m.startLineNumber,
        column: m.startColumn,
        message: m.message,
        severity: m.severity >= 8 ? 'error' : m.severity >= 4 ? 'warning' : 'info',
      }))
      setProblems(list)
    }
    collect()
    const sub = monaco.editor.onDidChangeMarkers(collect)
    return () => sub.dispose()
  }, [monaco])

  useEffect(() => {
    if (activeTab === 'terminal') endRef.current?.scrollIntoView({ block: 'end' })
  }, [term.lines, activeTab])

  const errorCount = problems.filter((p) => p.severity === 'error').length
  const prompt = `${folderName ?? 'no-folder'}${git?.isRepo && git.branch ? ` (${git.branch})` : ''} $`

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const cmd = input.trim()
    if (!cmd) return
    setInput('')
    setHistoryIdx(null)
    if (cmd === 'clear' || cmd === 'cls') {
      terminalStore.clear()
      return
    }
    void terminalStore.run(cmd)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const hist = term.commandHistory
    if (e.key === 'c' && e.ctrlKey && term.runningId) {
      e.preventDefault()
      void terminalStore.stop()
    } else if (e.key === 'ArrowUp' && hist.length) {
      e.preventDefault()
      const idx = historyIdx === null ? hist.length - 1 : Math.max(0, historyIdx - 1)
      setHistoryIdx(idx)
      setInput(hist[idx])
    } else if (e.key === 'ArrowDown' && historyIdx !== null) {
      e.preventDefault()
      const idx = historyIdx + 1
      if (idx >= hist.length) {
        setHistoryIdx(null)
        setInput('')
      } else {
        setHistoryIdx(idx)
        setInput(hist[idx])
      }
    }
  }

  const tr = term.lastTestRun

  return (
    <div
      style={{ height: `${height}px` }}
      className="bg-[#181818] border-t border-[#333333] flex flex-col select-none text-xs shrink-0 overflow-hidden"
    >
      <div className="h-8 px-2 bg-[#181818] border-b border-[#333333] flex items-center justify-between text-[#CCCCCC]">
        <div className="flex items-center space-x-1 h-full" role="tablist">
          <button role="tab" aria-selected={activeTab === 'terminal'} onClick={() => onSelectTab('terminal')} className={tabClass(activeTab === 'terminal')}>
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>
          <button role="tab" aria-selected={activeTab === 'problems'} onClick={() => onSelectTab('problems')} className={tabClass(activeTab === 'problems')}>
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Problems</span>
            {problems.length > 0 && (
              <span className="text-[10px] px-1.5 rounded-full bg-[#252526] text-amber-300 border border-[#333333] font-mono">
                {problems.length}
              </span>
            )}
          </button>
          <button role="tab" aria-selected={activeTab === 'output'} onClick={() => onSelectTab('output')} className={tabClass(activeTab === 'output')}>
            <FileTerminal className="w-3.5 h-3.5" />
            <span>Output</span>
          </button>
          <button role="tab" aria-selected={activeTab === 'tests'} onClick={() => onSelectTab('tests')} className={tabClass(activeTab === 'tests')}>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tests</span>
            {tr?.summary && (
              <span className={`text-[10px] px-1.5 rounded-full bg-[#252526] border border-[#333333] font-mono ${tr.summary.fail ? 'text-red-300' : 'text-emerald-300'}`}>
                {tr.summary.fail ? `${tr.summary.fail} failing` : `${tr.summary.pass} passing`}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center space-x-1 text-[#9DA3AE]">
          {activeTab === 'terminal' && (
            <>
              {term.runningId && (
                <button onClick={() => void terminalStore.stop()} title="Stop running command (Ctrl+C)" className="p-1 text-red-400 hover:text-red-300 hover:bg-[#2A2D2E] rounded-sm transition-colors">
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              )}
              <button onClick={() => terminalStore.clear()} title="Clear Terminal" className="p-1 hover:text-white hover:bg-[#2A2D2E] rounded-sm transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button onClick={onClose} title="Close Panel" className="p-1 hover:text-white hover:bg-[#2A2D2E] rounded-sm transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-2 font-mono text-[11.5px] bg-[#1E1E1E]">
        {activeTab === 'terminal' && (
          <div className="h-full flex flex-col overflow-y-auto px-2 select-text" onClick={() => inputRef.current?.focus()}>
            {!isDesktop && (
              <div className="text-amber-300 pb-1">
                The terminal needs the Ajson Studio desktop app (it runs real commands through the Electron backend). This browser preview cannot execute commands.
              </div>
            )}
            {isDesktop && !folderName && term.lines.length === 0 && (
              <div className="text-[#858585] pb-1">Open a project folder to run commands in it.</div>
            )}
            <div className="whitespace-pre-wrap break-words leading-relaxed">
              {term.lines.map((l, i) =>
                l.kind === 'command' ? (
                  <div key={i} className="text-white">
                    <span className="text-[#007ACC] font-semibold">{prompt} </span>
                    {l.text}
                  </div>
                ) : (
                  <span key={i} className={l.kind === 'stderr' ? 'text-[#F14C4C]' : l.kind === 'system' ? 'text-[#858585]' : 'text-[#CCCCCC]'}>
                    {l.text}
                  </span>
                )
              )}
            </div>
            <form onSubmit={submit} className="flex items-center space-x-2 pt-1">
              <span className="text-[#007ACC] font-semibold whitespace-nowrap">{prompt}</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                disabled={!isDesktop || !!term.runningId}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                aria-label="Terminal command input"
                placeholder={term.runningId ? 'Running… (Ctrl+C to stop)' : 'Type a command'}
                className="flex-1 bg-transparent text-[#CCCCCC] outline-none border-none font-mono text-[11.5px] placeholder:text-[#5a5a5a]"
                autoFocus
              />
            </form>
            <div ref={endRef} />
          </div>
        )}

        {activeTab === 'problems' && (
          <div className="h-full overflow-y-auto p-2 space-y-1">
            {problems.length === 0 ? (
              <div className="text-[#858585]">No problems detected in open files.</div>
            ) : (
              problems.map((p, i) => (
                <div key={i} className="flex items-start space-x-2 py-0.5">
                  {p.severity === 'error' ? <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" /> : <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />}
                  <div className="text-[#CCCCCC]">
                    {p.message} <span className="text-[#858585]">{p.file} [{p.line}, {p.column}]</span>
                  </div>
                </div>
              ))
            )}
            {errorCount > 0 && <div className="text-[#858585] pt-1">{errorCount} error(s)</div>}
          </div>
        )}

        {activeTab === 'output' && (
          <div className="h-full overflow-y-auto p-2 space-y-1 text-[#CCCCCC]">
            {term.runLog.length === 0 ? (
              <div className="text-[#858585]">No commands have been run yet.</div>
            ) : (
              term.runLog.map((r) => (
                <div key={r.id}>
                  <span className="text-[#858585]">{new Date(r.startedAt).toLocaleTimeString()} </span>
                  <span className="text-white">{r.command}</span>{' '}
                  {r.endedAt === undefined ? (
                    <span className="text-amber-300">running…</span>
                  ) : r.reason === 'completed' && r.exitCode === 0 ? (
                    <span className="text-emerald-400">✓ exit 0 ({r.endedAt - r.startedAt}ms)</span>
                  ) : (
                    <span className="text-red-400">✗ {r.reason === 'completed' ? `exit ${r.exitCode}` : r.reason}</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'tests' && (
          <div className="h-full overflow-y-auto p-2 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-[#333333]">
              <span className="font-semibold text-[#E6E6E6]">Test run</span>
              <button
                disabled={!isDesktop || !!term.runningId || !folderName}
                onClick={() => {
                  onSelectTab('terminal')
                  void terminalStore.run('npm test', { isTest: true })
                }}
                className="flex items-center space-x-1 px-2 py-0.5 rounded-sm bg-[#252526] border border-[#333333] text-[#CCCCCC] hover:bg-[#2A2D2E] disabled:opacity-40"
              >
                <Play className="w-3 h-3 text-emerald-400" />
                <span>Run npm test</span>
              </button>
            </div>
            {!tr ? (
              <div className="text-[#858585]">No test run yet. Results appear here after running <code>npm test</code>.</div>
            ) : tr.running ? (
              <div className="text-amber-300">Running {tr.command}…</div>
            ) : tr.summary ? (
              <div className={tr.summary.fail ? 'text-red-300' : 'text-emerald-400'}>
                {tr.summary.pass} passed, {tr.summary.fail} failed, {tr.summary.skipped} skipped of {tr.summary.tests}
                {tr.summary.durationMs !== null && ` (${Math.round(tr.summary.durationMs)}ms)`}
              </div>
            ) : (
              <div className="text-amber-300">
                {tr.command} exited with code {tr.exitCode ?? 'n/a'}; no test summary could be parsed from its output. See the Terminal tab.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
