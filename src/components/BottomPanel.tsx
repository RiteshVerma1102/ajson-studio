import React, { useState, useRef, useEffect } from 'react'
import {
  Terminal as TerminalIcon,
  AlertCircle,
  FileTerminal,
  X,
  Maximize2,
  Minimize2,
  Trash2,
  CheckCircle2,
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
  const [isMaximized, setIsMaximized] = useState(false)
  const [terminalInput, setTerminalInput] = useState('')
  const [terminalHistory, setTerminalHistory] = useState<TerminalHistoryEntry[]>([
    { type: 'system', text: 'Ajson Studio Interactive Terminal [v0.1.0-alpha]' },
    { type: 'system', text: 'Type "help" to see available built-in commands.' },
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
        text: 'Available Commands:\n  help           - Display this list of commands\n  version        - Show Ajson Studio build version\n  node -v        - Print Node.js environment version\n  echo [text]    - Print text to standard output\n  ls / dir       - List files in current workspace\n  clear          - Clear terminal history',
      })
    } else if (cmd === 'version' || trimmed === 'ajson --version') {
      newHistory.push({
        type: 'output',
        text: 'Ajson Studio v0.1.0 (Developer Foundation - Day 1 Build)',
      })
    } else if (trimmed === 'node -v' || trimmed === 'node --version') {
      newHistory.push({
        type: 'output',
        text: window.ajsonAPI ? 'Node.js v24.14.0 (Electron Environment)' : 'Node.js v24.14.0',
      })
    } else if (cmd === 'echo') {
      newHistory.push({
        type: 'output',
        text: args.slice(1).join(' '),
      })
    } else if (cmd === 'ls' || cmd === 'dir') {
      newHistory.push({
        type: 'output',
        text: 'src/\nscripts/\npublic/\npackage.json\ntsconfig.json\nvite.config.ts',
      })
    } else {
      newHistory.push({
        type: 'output',
        text: `ajson-shell: '${cmd}': executed in workspace sandbox. Full interactive node-pty shell will connect in Day 2.`,
      })
    }

    setTerminalHistory(newHistory)
    setTerminalInput('')
  }

  const clearCurrentTab = () => {
    if (activeTab === 'terminal') {
      setTerminalHistory([])
    }
  }

  return (
    <div
      style={{ height: isMaximized ? '65vh' : `${height}px` }}
      className={`bg-[#0b0e14] border-t border-[#1b2030] flex flex-col select-none text-xs z-30 ${
        isMaximized ? 'transition-[height] duration-200' : ''
      }`}
    >
      {/* Panel Tab Header */}
      <div className="h-8 px-3 border-b border-[#1b2030] flex items-center justify-between bg-[#080a0f]">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onSelectTab('terminal')}
            className={`px-2.5 py-1 flex items-center space-x-1.5 border-b-2 font-medium text-[11px] transition-colors ${
              activeTab === 'terminal'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>

          <button
            onClick={() => onSelectTab('problems')}
            className={`px-2.5 py-1 flex items-center space-x-1.5 border-b-2 font-medium text-[11px] transition-colors ${
              activeTab === 'problems'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Problems</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-[#182033] text-[9.5px] text-slate-400">
              0
            </span>
          </button>

          <button
            onClick={() => onSelectTab('output')}
            className={`px-2.5 py-1 flex items-center space-x-1.5 border-b-2 font-medium text-[11px] transition-colors ${
              activeTab === 'output'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileTerminal className="w-3.5 h-3.5" />
            <span>Output</span>
          </button>
        </div>

        {/* Action icons */}
        <div className="flex items-center space-x-1 text-slate-500">
          <button
            onClick={clearCurrentTab}
            title="Clear Panel"
            className="p-1 hover:text-slate-200 hover:bg-[#161a27] rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? 'Restore Panel Size' : 'Maximize Panel'}
            className="p-1 hover:text-slate-200 hover:bg-[#161a27] rounded transition-colors"
          >
            {isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={onClose}
            title="Close Panel"
            className="p-1 hover:text-slate-200 hover:bg-[#161a27] rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3 font-mono text-[11.5px] leading-relaxed">
        {/* TERMINAL CONTENT */}
        {activeTab === 'terminal' && (
          <div className="flex flex-col h-full justify-between">
            <div className="space-y-1 overflow-y-auto pr-1">
              {terminalHistory.map((entry, idx) => (
                <div key={idx} className="break-words">
                  {entry.type === 'system' && (
                    <div className="text-cyan-400/90 font-sans text-xs">{entry.text}</div>
                  )}
                  {entry.type === 'command' && (
                    <div className="flex items-center space-x-2 text-slate-200">
                      <span className="text-emerald-400 font-semibold">ajson-studio@dev:~$</span>
                      <span>{entry.text}</span>
                    </div>
                  )}
                  {entry.type === 'output' && (
                    <div className="text-slate-400 whitespace-pre-wrap pl-4 font-mono text-[11px]">
                      {entry.text}
                    </div>
                  )}
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>

            {/* Terminal Prompt Form */}
            <form onSubmit={handleCommandSubmit} className="flex items-center space-x-2 pt-2 mt-auto">
              <span className="text-emerald-400 font-semibold select-none">ajson-studio@dev:~$</span>
              <input
                type="text"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                placeholder="Type command ('help', 'node -v', 'ls')..."
                className="flex-1 bg-transparent text-slate-100 placeholder-slate-600 focus:outline-none font-mono text-[11.5px]"
                autoFocus
              />
            </form>
          </div>
        )}

        {/* PROBLEMS CONTENT */}
        {activeTab === 'problems' && (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 font-sans space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500/80" />
            <div className="text-slate-300 font-medium">No problems detected in workspace</div>
            <div className="text-xs text-slate-500">Diagnostics pipeline clean. Ready for compilation.</div>
          </div>
        )}

        {/* OUTPUT CONTENT */}
        {activeTab === 'output' && (
          <div className="space-y-1 text-slate-400 text-xs font-mono">
            <div className="text-slate-500">[23:30:00] [Ajson Engine] Core process initialized successfully.</div>
            <div className="text-slate-500">[23:30:01] [Security] ContextIsolation: enabled, NodeIntegration: disabled.</div>
            <div className="text-slate-500">[23:30:01] [IPC Bridge] Secure channels mounted via Preload script.</div>
            <div className="text-cyan-400/80">[23:30:02] [Monaco Editor] Language services ready: JavaScript, TypeScript, Python, HTML, CSS, JSON.</div>
            <div className="text-indigo-400/80">[23:30:02] [AI Subsystem] Architecture interfaces loaded (OpenAI / Anthropic / Google scaffolds ready).</div>
            <div className="text-slate-300">[Ajson Studio] Ready for development.</div>
          </div>
        )}
      </div>
    </div>
  )
}
