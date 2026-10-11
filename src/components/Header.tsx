import React, { useState, useEffect } from 'react'
import {
  Minus,
  Square,
  X,
  Sidebar as SidebarIcon,
  PanelBottom,
  Sparkles,
  Layers,
  Play,
  Settings,
  Search,
  GitCompare,
  BookOpen,
  Sliders,
} from 'lucide-react'

interface HeaderProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  bottomPanelOpen: boolean
  onToggleBottomPanel: () => void
  aiPanelOpen: boolean
  onToggleAiPanel: () => void
  activeFileName?: string
  projectName?: string
  onCloseWindow?: () => void
  onOpenCommandPalette?: () => void
  onRunProject?: () => void
  onOpenSettings?: () => void
  onOpenModelSettings?: () => void
  onOpenAiCodeGen?: () => void
  onOpenDiffReview?: () => void
  onOpenCodeExplain?: () => void
  onOpenMultiFileEdits?: () => void
  activeStateView?: string
  onSelectStateView?: (view: string) => void
}

export const Header: React.FC<HeaderProps> = ({
  sidebarOpen,
  onToggleSidebar,
  bottomPanelOpen,
  onToggleBottomPanel,
  aiPanelOpen,
  onToggleAiPanel,
  activeFileName: _activeFileName,
  projectName = 'quantum-mesh-core',
  onCloseWindow,
  onOpenCommandPalette,
  onRunProject,
  onOpenSettings,
  onOpenModelSettings,
  onOpenAiCodeGen,
  onOpenDiffReview,
  onOpenCodeExplain,
  onOpenMultiFileEdits,
  activeStateView: _activeStateView = 'workspace',
  onSelectStateView: _onSelectStateView,
}) => {
  const [isMaximized, setIsMaximized] = useState(false)
  const isElectron = typeof window !== 'undefined' && !!window.ajsonAPI

  useEffect(() => {
    if (window.ajsonAPI) {
      window.ajsonAPI.window.isMaximized().then(setIsMaximized)
    }
  }, [])

  const handleMinimize = () => {
    window.ajsonAPI?.window.minimize()
  }

  const handleMaximize = async () => {
    if (window.ajsonAPI) {
      const state = await window.ajsonAPI.window.maximize()
      setIsMaximized(state)
    }
  }

  const handleClose = () => {
    if (onCloseWindow) {
      onCloseWindow()
    } else {
      window.ajsonAPI?.window.close()
    }
  }

  return (
    <header className="window-drag-region h-10 bg-[#121318] border-b border-[#21232d] flex items-center justify-between px-3 select-none z-50 text-xs">
      {/* Left: Branding & App Identity */}
      <div className="window-no-drag flex items-center space-x-3">
        <div className="flex items-center space-x-2 pl-0.5">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-violet-600 via-indigo-600 to-violet-400 flex items-center justify-center shadow-md shadow-violet-600/30 border border-violet-400/30">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold tracking-wider text-slate-100 text-[12px] font-sans">
            Ajson Studio
          </span>
          <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-violet-950/60 text-violet-300 border border-violet-800/50 font-mono font-medium">
            AI-Native
          </span>
        </div>

        {/* Project Badge */}
        <div className="hidden sm:flex items-center space-x-1.5 px-2 py-0.5 rounded bg-[#181a22] border border-[#262835] text-[11px] font-mono text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-200 font-medium">{projectName}</span>
        </div>

        {/* Menu Bar Items */}
        <nav className="hidden lg:flex items-center space-x-0.5 text-slate-400 text-[11px]">
          {['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'AI', 'Help'].map((item) => (
            <button
              key={item}
              className="px-2 py-0.5 rounded hover:bg-[#1c1e28] hover:text-slate-200 transition-colors"
            >
              {item}
            </button>
          ))}
        </nav>
      </div>

      {/* Center: Command Search Bar */}
      <div className="window-no-drag flex items-center max-w-md w-full mx-4">
        <button
          onClick={onOpenCommandPalette}
          className="w-full h-7 px-3 bg-[#171821] hover:bg-[#1d1f2b] border border-[#262835] hover:border-violet-500/50 rounded-lg text-slate-400 hover:text-slate-200 text-xs flex items-center justify-between transition-all group shadow-sm"
          title="Open Command Palette (Ctrl+K / ⌘K)"
        >
          <div className="flex items-center space-x-2 truncate">
            <Search className="w-3.5 h-3.5 text-slate-500 group-hover:text-violet-400 transition-colors" />
            <span className="text-[11.5px] truncate">Search files, symbols, commands...</span>
          </div>
          <div className="flex items-center space-x-1 shrink-0 font-mono text-[10px] text-slate-400 bg-[#12131a] px-1.5 py-0.5 rounded border border-[#232533]">
            <span>⌘K</span>
          </div>
        </button>
      </div>

      {/* Right: Quick State Access Buttons, Run, Settings, Layout Controls */}
      <div className="window-no-drag flex items-center space-x-1.5 shrink-0">
        {/* Direct State View Action Pills */}
        <div className="flex items-center space-x-1 bg-[#161720] p-0.5 rounded-lg border border-[#242634]">
          <button
            id="header-btn-diff-review"
            onClick={onOpenDiffReview}
            title="Side-by-Side Diff Review"
            className="flex items-center space-x-1 px-2 py-1 rounded hover:bg-[#1f212c] text-slate-300 hover:text-emerald-300 text-[11px] transition-colors"
          >
            <GitCompare className="w-3 h-3 text-emerald-400" />
            <span>Diff Review</span>
          </button>

          <button
            id="header-btn-ai-codegen"
            onClick={onOpenAiCodeGen}
            title="Inline AI Code Generation (⌘K)"
            className="flex items-center space-x-1 px-2 py-1 rounded hover:bg-[#1f212c] text-slate-300 hover:text-violet-300 text-[11px] transition-colors"
          >
            <Sparkles className="w-3 h-3 text-violet-400" />
            <span>AI Gen</span>
          </button>

          <button
            id="header-btn-code-explain"
            onClick={onOpenCodeExplain}
            title="Deep Code Explanation"
            className="flex items-center space-x-1 px-2 py-1 rounded hover:bg-[#1f212c] text-slate-300 hover:text-indigo-300 text-[11px] transition-colors"
          >
            <BookOpen className="w-3 h-3 text-indigo-400" />
            <span>Explain</span>
          </button>

          <button
            id="header-btn-multi-file"
            onClick={onOpenMultiFileEdits}
            title="Multi-File Edits (Composer)"
            className="flex items-center space-x-1 px-2 py-1 rounded hover:bg-[#1f212c] text-slate-300 hover:text-amber-300 text-[11px] transition-colors"
          >
            <Layers className="w-3 h-3 text-amber-400" />
            <span>Multi-File</span>
          </button>

          <button
            id="header-btn-model-settings"
            onClick={onOpenModelSettings}
            title="Model & Provider Settings"
            className="flex items-center space-x-1 px-2 py-1 rounded hover:bg-[#1f212c] text-slate-300 hover:text-violet-300 text-[11px] transition-colors"
          >
            <Sliders className="w-3 h-3 text-violet-400" />
            <span>Models</span>
          </button>
        </div>

        {/* Run Button */}
        <button
          id="header-btn-run"
          onClick={onRunProject}
          title="Run Active Target (F5)"
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-800/50 text-xs font-medium transition-all"
        >
          <Play className="w-3 h-3 fill-emerald-400" />
          <span className="hidden md:inline text-[11px]">Run</span>
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenModelSettings || onOpenSettings}
          title="AI & Editor Settings"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1a1c26] transition-colors border border-transparent hover:border-[#272938]"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {/* Layout action toggles */}
        <div className="flex items-center space-x-0.5 bg-[#171821] p-0.5 rounded-lg border border-[#242633]">
          <button
            onClick={onToggleSidebar}
            title={sidebarOpen ? 'Hide Explorer (Ctrl+B)' : 'Show Explorer (Ctrl+B)'}
            className={`p-1 rounded transition-colors ${
              sidebarOpen ? 'bg-violet-950/50 text-violet-300 border border-violet-800/40' : 'text-slate-400 hover:text-slate-200 hover:bg-[#1c1e28]'
            }`}
          >
            <SidebarIcon className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onToggleBottomPanel}
            title={bottomPanelOpen ? 'Hide Terminal / Bottom Dock' : 'Show Terminal / Bottom Dock'}
            className={`p-1 rounded transition-colors ${
              bottomPanelOpen ? 'bg-violet-950/50 text-violet-300 border border-violet-800/40' : 'text-slate-400 hover:text-slate-200 hover:bg-[#1c1e28]'
            }`}
          >
            <PanelBottom className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onToggleAiPanel}
            title={aiPanelOpen ? 'Hide Ajson AI Panel' : 'Show Ajson AI Panel'}
            className={`p-1 rounded transition-colors ${
              aiPanelOpen ? 'bg-violet-950/60 text-violet-300 border border-violet-700/60 shadow-sm shadow-violet-600/20' : 'text-slate-400 hover:text-slate-200 hover:bg-[#1c1e28]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Window controls (Minimize, Maximize, Close) */}
        {isElectron && (
          <div className="flex items-center space-x-0.5 pl-1">
            <button
              onClick={handleMinimize}
              className="w-7 h-6 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-[#1e202b] rounded transition-colors"
              title="Minimize"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              onClick={handleMaximize}
              className="w-7 h-6 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-[#1e202b] rounded transition-colors"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              <Square className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={handleClose}
              className="w-7 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-600 rounded transition-colors"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
