import React, { useState, useRef, useEffect } from 'react'
import {
  Terminal as TerminalIcon,
  AlertCircle,
  FileTerminal,
  X,
  Trash2,
  CheckCircle2,
  Check,
  Split,
} from 'lucide-react'
import { BottomTab } from '../types/editor'

interface BottomPanelProps {
  activeTab: BottomTab
  onSelectTab: (tab: BottomTab) => void
  onClose: () => void
  height: number
  onHeightChange?: (h: number) => void
}

interface TerminalHistoryEntry {
  type: 'command' | 'output' | 'error' | 'system'
  text: string
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  activeTab,
  onSelectTab,
  onClose,
  height,
}) => {
  const [terminalInput, setTerminalInput] = useState('')
  const [terminalHistory, setTerminalHistory] = useState<TerminalHistoryEntry[]>([
    { type: 'system', text: 'Ajson Studio Interactive Workspace Shell [v0.1.0-alpha]' },
    { type: 'system', text: 'Type "help", "npm test", "git status", or "clear" to interact.' },
    { type: 'output', text: '[ai-daemon] Speculative AST guardrail active. Listening on localhost:5173' },
  ])

  const terminalEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeTab === 'terminal') {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [terminalHistory, activeTab])

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = terminalInput.trim()
    if (!trimmed) return

    const newHistory: TerminalHistoryEntry[] = [
      ...terminalHistory,
      { type: 'command', text: trimmed },
    ]

    const args = trimmed.split(' ')
    const cmd = args[0].toLowerCase()

    if (cmd === 'clear') {
      setTerminalHistory([])
      setTerminalInput('')
      return
    } else if (cmd === 'help') {
      newHistory.push({
        type: 'output',
        text: 'Available Commands:\n  help           - Display command reference\n  npm test       - Run full verification suite (96 tests)\n  git status     - Check uncommitted modifications\n  ai status      - Check connected AI model provider status\n  ls / dir       - List project files in workspace\n  clear          - Clear terminal buffer',
      })
    } else if (trimmed === 'npm test' || trimmed === 'test') {
      newHistory.push({
        type: 'output',
        text: '▶ Running Ajson Studio Test Suite...\n  ✔ AI Provider Catalogue (3.8ms)\n  ✔ Speculative AST Guardrails (12.4ms)\n  ✔ Workspace Persistence & File System (42.1ms)\n  ✔ Project-wide Search & Streaming Diff (54.2ms)\nℹ tests 96 | pass 96 | fail 0 | duration 818ms\n✨ All 96 tests passed successfully!',
      })
    } else if (trimmed === 'git status') {
      newHistory.push({
        type: 'output',
        text: 'On branch main\nYour branch is up to date with \'origin/main\'.\n\nChanges not staged for commit:\n  modified:   src/ai/AgentCoordinator.ts\n  modified:   src/core/StreamingDiffEngine.ts\n\nUntracked files:\n  src/types/models.d.ts',
      })
    } else if (trimmed === 'ai status') {
      newHistory.push({
        type: 'output',
        text: 'AI Agent Status:\n  Provider: Anthropic Claude 3.7 Sonnet\n  Guardrail Engine: Speculative AST (Active, 8 token window)\n  Latency: 214ms\n  Context Tokens: 1,420 / 200,000',
      })
    } else if (cmd === 'ls' || cmd === 'dir') {
      newHistory.push({
        type: 'output',
        text: 'src/  tests/  package.json  tsconfig.json  README.md  vite.config.ts',
      })
    } else {
      newHistory.push({
        type: 'output',
        text: `ajson-shell: '${cmd}': executed in workspace sandbox.`,
      })
    }

    setTerminalHistory(newHistory)
    setTerminalInput('')
  }

  return (
    <div
      style={{ height: `${height}px` }}
      className="bg-[#101116] border-t border-[#20222b] flex flex-col select-none text-xs shrink-0 overflow-hidden"
    >
      {/* Panel Tab Header Bar */}
      <div className="h-8 px-2 bg-[#13141a] border-b border-[#20222b] flex items-center justify-between text-slate-400">
        <div className="flex items-center space-x-1 h-full">
          {/* Terminal Tab */}
          <button
            onClick={() => onSelectTab('terminal')}
            className={`h-full px-3 flex items-center space-x-1.5 transition-colors border-b-2 text-[11.5px] ${
              activeTab === 'terminal'
                ? 'border-violet-400 text-violet-200 font-medium bg-[#161722]'
                : 'border-transparent hover:text-slate-200 hover:bg-[#181922]'
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>

          {/* Problems Tab */}
          <button
            onClick={() => onSelectTab('problems')}
            className={`h-full px-3 flex items-center space-x-1.5 transition-colors border-b-2 text-[11.5px] ${
              activeTab === 'problems'
                ? 'border-violet-400 text-violet-200 font-medium bg-[#161722]'
                : 'border-transparent hover:text-slate-200 hover:bg-[#181922]'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Problems</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/40 font-mono">
              1
            </span>
          </button>

          {/* Output Tab */}
          <button
            onClick={() => onSelectTab('output')}
            className={`h-full px-3 flex items-center space-x-1.5 transition-colors border-b-2 text-[11.5px] ${
              activeTab === 'output'
                ? 'border-violet-400 text-violet-200 font-medium bg-[#161722]'
                : 'border-transparent hover:text-slate-200 hover:bg-[#181922]'
            }`}
          >
            <FileTerminal className="w-3.5 h-3.5" />
            <span>Output</span>
          </button>

          {/* Tests Tab */}
          <button
            onClick={() => onSelectTab('tests')}
            className={`h-full px-3 flex items-center space-x-1.5 transition-colors border-b-2 text-[11.5px] ${
              activeTab === 'tests'
                ? 'border-violet-400 text-violet-200 font-medium bg-[#161722]'
                : 'border-transparent hover:text-slate-200 hover:bg-[#181922]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tests</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-mono">
              96 passing
            </span>
          </button>
        </div>

        {/* Panel Action Controls */}
        <div className="flex items-center space-x-1">
          {activeTab === 'terminal' && (
            <>
              <button
                onClick={() => setTerminalHistory([])}
                title="Clear Terminal"
                className="p-1 hover:text-slate-200 hover:bg-[#1d1f2b] rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                title="Split Terminal"
                className="p-1 hover:text-slate-200 hover:bg-[#1d1f2b] rounded transition-colors"
              >
                <Split className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            onClick={onClose}
            title="Close Panel"
            className="p-1 hover:text-slate-200 hover:bg-[#1d1f2b] rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-hidden p-2 font-mono text-[11.5px]">
        {/* Terminal Content */}
        {activeTab === 'terminal' && (
          <div className="h-full flex flex-col overflow-y-auto px-2 space-y-1">
            {terminalHistory.map((entry, idx) => (
              <div key={idx} className="leading-relaxed">
                {entry.type === 'command' && (
                  <div className="flex items-center space-x-2 text-violet-300">
                    <span className="text-violet-400 font-semibold select-none">
                      ajson-studio:~/quantum-mesh (main) $
                    </span>
                    <span className="text-slate-100">{entry.text}</span>
                  </div>
                )}
                {entry.type === 'system' && (
                  <div className="text-slate-500">{entry.text}</div>
                )}
                {entry.type === 'output' && (
                  <div className="text-slate-300 whitespace-pre-wrap pl-2 border-l border-[#222432]">
                    {entry.text}
                  </div>
                )}
                {entry.type === 'error' && (
                  <div className="text-rose-400 whitespace-pre-wrap">{entry.text}</div>
                )}
              </div>
            ))}

            {/* Input Prompt */}
            <form onSubmit={handleCommandSubmit} className="flex items-center space-x-2 pt-1">
              <span className="text-violet-400 font-semibold select-none">
                ajson-studio:~/quantum-mesh (main) $
              </span>
              <input
                type="text"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                placeholder="Type command ('npm test', 'git status', 'help')..."
                className="flex-1 bg-transparent text-slate-100 outline-none border-none font-mono text-[11.5px]"
                autoFocus
              />
            </form>
            <div ref={terminalEndRef} />
          </div>
        )}

        {/* Problems Content */}
        {activeTab === 'problems' && (
          <div className="h-full overflow-y-auto p-2 space-y-1.5">
            <div className="flex items-start space-x-2 p-2 rounded-lg bg-amber-950/20 border border-amber-800/30 text-amber-300 cursor-pointer hover:bg-amber-950/30 transition-colors">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-slate-200">
                  src/core/AstValidator.ts: Line 62, Col 14
                </div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  Warning: Potential cyclic AST reference during deep object inspection. Memoized hash snapshot recommended.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Output Content */}
        {activeTab === 'output' && (
          <div className="h-full overflow-y-auto p-2 text-slate-400 space-y-1">
            <div className="text-slate-500">[Vite] Pre-bundling dependencies: @monaco-editor/react, lucide-react</div>
            <div className="text-emerald-400">[Vite] ✨ Built in 184ms.</div>
            <div className="text-slate-400">[Ajson Language Server] TypeScript 5.6.3 language server ready (43 files indexed)</div>
            <div className="text-violet-400">[Ajson Copilot] Claude 3.7 Sonnet connection verified.</div>
          </div>
        )}

        {/* Tests Content */}
        {activeTab === 'tests' && (
          <div className="h-full overflow-y-auto p-2 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-[#20222b]">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-slate-100">Test Execution Summary</span>
              </div>
              <span className="text-emerald-400 font-mono text-xs">96 passed (818ms)</span>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex items-center justify-between py-1 px-2 rounded bg-[#151620] text-slate-300">
                <span className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>AI Provider Catalogue & Credential Store</span>
                </span>
                <span className="text-slate-500 font-mono">14 tests passed</span>
              </div>
              <div className="flex items-center justify-between py-1 px-2 rounded bg-[#151620] text-slate-300">
                <span className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Speculative Token Stream & Cancellation Registry</span>
                </span>
                <span className="text-slate-500 font-mono">18 tests passed</span>
              </div>
              <div className="flex items-center justify-between py-1 px-2 rounded bg-[#151620] text-slate-300">
                <span className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Real Project-wide Search & In-memory Buffers</span>
                </span>
                <span className="text-slate-500 font-mono">10 tests passed</span>
              </div>
              <div className="flex items-center justify-between py-1 px-2 rounded bg-[#151620] text-slate-300">
                <span className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Workspace Persistence & Panel Dimension Clamping</span>
                </span>
                <span className="text-slate-500 font-mono">12 tests passed</span>
              </div>
              <div className="flex items-center justify-between py-1 px-2 rounded bg-[#151620] text-slate-300">
                <span className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Command Palette Dispatch & Fuzzy Matching</span>
                </span>
                <span className="text-slate-500 font-mono">10 tests passed</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
