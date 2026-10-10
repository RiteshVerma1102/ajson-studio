import React from 'react'
import { GitBranch, AlertCircle, Sparkles, Check } from 'lucide-react'
import { SupportedLanguage, CursorPosition } from '../types/editor'

interface StatusBarProps {
  cursorPosition: CursorPosition
  language: SupportedLanguage
  onToggleAiPanel: () => void
  aiPanelOpen: boolean
}

export const StatusBar: React.FC<StatusBarProps> = ({
  cursorPosition,
  language,
  onToggleAiPanel,
  aiPanelOpen,
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
    <footer className="h-6 bg-[#080a0f] border-t border-[#181d2a] flex items-center justify-between px-3 select-none text-[11px] font-mono text-slate-400 z-50">
      {/* Left items */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1 hover:text-slate-200 cursor-pointer">
          <GitBranch className="w-3 h-3 text-cyan-400" />
          <span>main*</span>
        </div>

        <div className="flex items-center space-x-2 text-slate-500">
          <span className="flex items-center space-x-0.5 hover:text-slate-300 cursor-pointer">
            <AlertCircle className="w-3 h-3 text-slate-500" />
            <span>0</span>
          </span>
          <span className="flex items-center space-x-0.5 hover:text-slate-300 cursor-pointer">
            <Check className="w-3 h-3 text-emerald-500/70" />
            <span>0</span>
          </span>
        </div>

        {/* AI Engine Status Button */}
        <button
          onClick={onToggleAiPanel}
          className={`flex items-center space-x-1 px-1.5 py-0.2 rounded transition-colors ${
            aiPanelOpen
              ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/60'
              : 'hover:bg-[#151a28] text-indigo-400/90'
          }`}
          title="Toggle Ajson AI Architecture Panel"
        >
          <Sparkles className="w-3 h-3" />
          <span>Ajson AI: Standby</span>
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
        <span className="hover:text-cyan-300 text-slate-300 font-semibold cursor-pointer">
          {formatLanguageName(language)}
        </span>
        <span className="text-slate-600 font-sans">|</span>
        <span className="text-cyan-500/80 font-sans font-medium text-[10.5px]">
          Ajson Studio
        </span>
      </div>
    </footer>
  )
}
