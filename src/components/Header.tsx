import React, { useState, useEffect } from 'react'
import {
  Minus,
  Square,
  X,
  Sidebar as SidebarIcon,
  PanelBottom,
  Sparkles,
  Layers,
  Code2,
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
}

export const Header: React.FC<HeaderProps> = ({
  sidebarOpen,
  onToggleSidebar,
  bottomPanelOpen,
  onToggleBottomPanel,
  aiPanelOpen,
  onToggleAiPanel,
  activeFileName,
  projectName,
  onCloseWindow,
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
    <header className="window-drag-region h-9 bg-[#0b0e14] border-b border-[#1b2030] flex items-center justify-between px-2 select-none z-50 text-xs">
      {/* Left: Branding & App Identity */}
      <div className="window-no-drag flex items-center space-x-3">
        <div className="flex items-center space-x-1.5 pl-1.5">
          <div className="w-5 h-5 rounded bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center shadow-sm shadow-cyan-500/20">
            <Code2 className="w-3.5 h-3.5 text-black font-bold" />
          </div>
          <span className="font-semibold tracking-wider text-slate-100 text-[11.5px] uppercase font-mono">
            AJSON STUDIO
          </span>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-mono font-medium">
            v0.2-DEV
          </span>
        </div>

        {/* Menu Bar Items */}
        <nav className="hidden md:flex items-center space-x-0.5 text-slate-400 text-[11px] ml-2">
          {['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal', 'Help'].map((item) => (
            <button
              key={item}
              className="px-2 py-0.5 rounded hover:bg-[#181d2a] hover:text-slate-200 transition-colors"
            >
              {item}
            </button>
          ))}
        </nav>
      </div>

      {/* Center: Workspace / Active Document Breadcrumb */}
      <div className="flex items-center space-x-1 text-slate-400 text-[11px] font-mono pointer-events-none truncate max-w-md">
        <Layers className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-slate-500">{projectName || 'Ajson Studio'}</span>
        <span className="text-slate-600">/</span>
        <span className="text-slate-300 font-medium">{activeFileName || 'Welcome'}</span>
      </div>

      {/* Right: Layout Toggles & Window Controls */}
      <div className="window-no-drag flex items-center space-x-1">
        {/* Layout action toggles */}
        <div className="flex items-center space-x-0.5 mr-2 bg-[#121622] p-0.5 rounded border border-[#1d2335]">
          <button
            onClick={onToggleSidebar}
            title={sidebarOpen ? 'Hide Primary Sidebar (Ctrl+B)' : 'Show Primary Sidebar (Ctrl+B)'}
            className={`p-1 rounded transition-colors ${
              sidebarOpen ? 'bg-[#1e2538] text-cyan-400' : 'text-slate-400 hover:text-slate-200 hover:bg-[#181d2c]'
            }`}
          >
            <SidebarIcon className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onToggleBottomPanel}
            title={bottomPanelOpen ? 'Hide Bottom Panel' : 'Show Bottom Panel'}
            className={`p-1 rounded transition-colors ${
              bottomPanelOpen ? 'bg-[#1e2538] text-cyan-400' : 'text-slate-400 hover:text-slate-200 hover:bg-[#181d2c]'
            }`}
          >
            <PanelBottom className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onToggleAiPanel}
            title={aiPanelOpen ? 'Hide Ajson AI Panel' : 'Show Ajson AI Panel'}
            className={`p-1 rounded transition-colors ${
              aiPanelOpen ? 'bg-indigo-950/70 text-indigo-400 border border-indigo-700/50' : 'text-slate-400 hover:text-slate-200 hover:bg-[#181d2c]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Window controls (Minimize, Maximize, Close) */}
        {isElectron && (
          <div className="flex items-center space-x-0.5">
            <button
              onClick={handleMinimize}
              className="w-7 h-6 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-[#1e2538] rounded-sm transition-colors"
              title="Minimize"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              onClick={handleMaximize}
              className="w-7 h-6 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-[#1e2538] rounded-sm transition-colors"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              <Square className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={handleClose}
              className="w-7 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-600 rounded-sm transition-colors"
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
