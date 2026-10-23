import React, { useState, useEffect } from 'react'
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
  const [isAiConfigured, setIsAiConfigured] = useState<boolean>(false)

  useEffect(() => {
    async function checkAiConfig() {
      if (window.ajsonAPI?.ai?.getConfig) {
        try {
          const cfg = await window.ajsonAPI.ai.getConfig()
          const anyConfigured = Object.values(cfg || {}).some(
            (p: { configured?: boolean }) => Boolean(p?.configured)
          )
          setIsAiConfigured(Boolean(anyConfigured))
        } catch {
          setIsAiConfigured(false)
        }
      }
    }

    checkAiConfig()
    const interval = setInterval(checkAiConfig, 5000)
    return () => clearInterval(interval)
  }, [])

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
    <footer className="h-6 bg-[#181818] border-t border-[#333333] flex items-center justify-between px-0 select-none text-[11px] font-sans text-[#CCCCCC] z-50">
      {/* Left items */}
      <div className="flex items-center space-x-2 h-full">
        {/* Antigravity Blue Branch Block */}
        <div className="flex items-center space-x-1 px-2.5 h-full bg-[#007ACC] text-white hover:bg-[#0098FF] cursor-pointer font-sans transition-colors">
          <GitBranch className="w-3 h-3 text-white" />
          <span className="font-medium text-[11px]">feature/json-tools-ui*</span>
          <span className="text-white/80 text-[10px] ml-1">↻ 0↓ 0↑</span>
        </div>

        {/* Diagnostics */}
        <div className="flex items-center space-x-2 pl-1 text-[#CCCCCC]">
          <span className="flex items-center space-x-0.5 hover:text-white cursor-pointer text-[#CCCCCC]">
            <span className="text-[10.5px]">⊗</span>
            <span>0</span>
          </span>
          <span className="flex items-center space-x-0.5 hover:text-amber-300 cursor-pointer text-amber-400">
            <span className="text-[10.5px]">⚠</span>
            <span>0</span>
          </span>
        </div>

        {/* AI Agent Status */}
        <button
          onClick={onToggleAiPanel}
          className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-sm transition-colors ml-1 ${
            aiPanelOpen
              ? 'text-white bg-[#252526]'
              : 'hover:bg-[#252526] text-[#9DA3AE]'
          }`}
          title="Toggle AI Companion (⌘L)"
        >
          <Sparkles className="w-3 h-3 text-[#007ACC]" />
          <span
            onClick={(e) => {
              if (onOpenModelSettings) {
                e.stopPropagation()
                onOpenModelSettings()
              }
            }}
            className="font-medium text-[10.5px] hover:text-white"
          >
            Gemini 3.8 Flash High
          </span>
        </button>
      </div>

      {/* Right items */}
      <div className="flex items-center space-x-3 px-3 text-[#9DA3AE]">
        <span className="hover:text-white cursor-default">
          Ln {cursorPosition.lineNumber}, Col {cursorPosition.column}
        </span>
        <span className="hover:text-white cursor-default">Spaces: 2</span>
        <span className="hover:text-white cursor-default">UTF-8</span>
        <span className="hover:text-white cursor-default">LF</span>
        <span className="hover:text-white text-[#CCCCCC] font-medium cursor-pointer">
          {formatLanguageName(language)}
        </span>
        <span className="hover:text-white cursor-pointer">
          Antigravity - Settings
        </span>
        <span className="flex items-center space-x-0.5 text-emerald-400 cursor-pointer">
          <CheckCheck className="w-3 h-3 text-emerald-400" />
          <span>Prettier</span>
        </span>
      </div>
    </footer>
  )
}

