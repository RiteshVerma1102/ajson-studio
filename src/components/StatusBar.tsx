import React from 'react'
import { GitBranch, Sparkles, CheckCheck } from 'lucide-react'
import { SupportedLanguage, CursorPosition } from '../types/editor'

interface StatusBarProps {
  cursorPosition: CursorPosition
  language: SupportedLanguage
  onToggleAiPanel: () => void
  aiPanelOpen: boolean
  onOpenModelSettings?: () => void
}

export const StatusBar: React.FC<StatusBarProps> = ({
  cursorPosition,
  language,
  onToggleAiPanel,
  aiPanelOpen,
  onOpenModelSettings,
}) => {
  const formatLanguageName = (lang: SupportedLanguage) => {
    switch (lang) {
      case 'typescript':
        return 'TypeScript'
      case 'javascript':
        return 'JavaScript'
      case 'python':
        return 'Python'
      case 'json':
        return 'JSON'
      case 'html':
        return 'HTML'
      case 'css':
        return 'CSS'
      case 'markdown':
        return 'Markdown'
      default:
        return 'Plain Text'
    }
  }

  return (
    <footer className="h-6 bg-[#0c0d10] border-t border-[#1e2029] flex items-center justify-between px-3 select-none text-[11px] font-mono text-slate-400 z-50">
      {/* Left items */}
      <div className="flex items-center space-x-3">
        {/* Git branch */}
        <div className="flex items-center space-x-1.5 hover:text-slate-200 cursor-pointer">
          <GitBranch className="w-3 h-3 text-violet-400" />
          <span className="font-medium text-slate-300">main</span>
          <span className="text-slate-600">⎇ 0↓ 1↑</span>
        </div>

        {/* Diagnostic counters */}
        <div className="flex items-center space-x-2 text-slate-400">
          <span className="flex items-center space-x-0.5 hover:text-slate-200 cursor-pointer text-slate-500">
            <span className="text-[10px]">⊗</span>
            <span>0</span>
          </span>
          <span className="flex items-center space-x-0.5 hover:text-amber-300 cursor-pointer text-amber-400/80">
            <span className="text-[10px]">△</span>
            <span>1</span>
          </span>
        </div>

        {/* AI Agent Connection Status */}
        <button
          onClick={onToggleAiPanel}
          className={`flex items-center space-x-1.5 px-2 py-0.2 rounded-md transition-all ${
            aiPanelOpen
              ? 'bg-violet-950/60 text-violet-300 border border-violet-700/50 shadow-sm shadow-violet-600/20'
              : 'hover:bg-[#161722] text-violet-300/90'
          }`}
          title="Toggle Ajson AI Panel"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
          </span>
          <Sparkles className="w-3 h-3 text-violet-400" />
          <span
            onClick={(e) => {
              if (onOpenModelSettings) {
                e.stopPropagation()
                onOpenModelSettings()
              }
            }}
            className="font-sans font-medium text-[11px] hover:underline"
            title="Configure AI Models & Keys"
          >
            Claude 3.7 Sonnet (Online)
          </span>
        </button>
      </div>

      {/* Right items */}
      <div className="flex items-center space-x-3 text-slate-400">
        <span className="hover:text-slate-200 cursor-default">
          Ln {cursorPosition.lineNumber}, Col {cursorPosition.column}
        </span>
        <span className="hover:text-slate-200 cursor-default">Spaces: 2</span>
        <span className="hover:text-slate-200 cursor-default">UTF-8</span>
        <span className="hover:text-slate-200 cursor-default">LF</span>
        <span className="hover:text-violet-300 text-slate-300 font-semibold cursor-pointer">
          {formatLanguageName(language)}
        </span>
        <span className="flex items-center space-x-0.5 text-emerald-400 font-sans cursor-pointer">
          <CheckCheck className="w-3 h-3 text-emerald-400" />
          <span>Prettier</span>
        </span>
        <span className="text-slate-700 font-sans">|</span>
        <span className="text-violet-400/90 font-sans font-medium text-[10.5px]">
          Ajson Studio
        </span>
      </div>
    </footer>
  )
}
