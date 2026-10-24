import React, { useState, useEffect, useRef } from 'react'
import {
  Minus,
  Square,
  X,
  Sidebar as SidebarIcon,
  PanelBottom,
  Sparkles,
  Play,
  Search,
  GitCompare,
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
  activeFileName,
  projectName = 'No folder open',
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

  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!openMenu) {
      return
    }
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null)
      }
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [openMenu])

  interface MenuItem {
    label: string
    shortcut?: string
    action?: () => void
  }
  const menus: { label: string; items: MenuItem[] }[] = [
    { label: 'File', items: [{ label: 'Settings', action: onOpenSettings }, { label: 'Close Window', action: () => handleClose() }] },
    { label: 'Edit', items: [{ label: 'Command Palette…', shortcut: 'Ctrl+Shift+P', action: onOpenCommandPalette }] },
    { label: 'Selection', items: [{ label: 'Review Diff Changes', action: onOpenDiffReview }, { label: 'Multi-file Edits…', action: onOpenMultiFileEdits }] },
    {
      label: 'View',
      items: [
        { label: sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar', shortcut: 'Ctrl+B', action: onToggleSidebar },
        { label: bottomPanelOpen ? 'Hide Panel' : 'Show Panel', shortcut: 'Ctrl+J', action: onToggleBottomPanel },
        { label: aiPanelOpen ? 'Hide AI Assistant' : 'Show AI Assistant', shortcut: 'Ctrl+L', action: onToggleAiPanel },
      ],
    },
    { label: 'Go', items: [{ label: 'Quick Open…', shortcut: 'Ctrl+P', action: onOpenCommandPalette }] },
    { label: 'Run', items: [{ label: 'Run Project', shortcut: 'F5', action: onRunProject }] },
    { label: 'Terminal', items: [{ label: bottomPanelOpen ? 'Hide Terminal Panel' : 'Show Terminal Panel', action: onToggleBottomPanel }] },
    {
      label: 'Help',
      items: [
        { label: 'AI Model Settings…', action: onOpenModelSettings },
        { label: 'Explain Code with AI…', action: onOpenCodeExplain },
      ],
    },
  ]

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
    <header className="window-drag-region h-9 bg-[#181818] border-b border-[#333333] flex items-center justify-between px-2.5 select-none z-50 text-xs text-[#CCCCCC]">
      {/* Left: App Identity & Main Menus */}
      <div className="window-no-drag flex items-center space-x-2">
        <div className="flex items-center space-x-1.5 pr-2">
          <div className="w-4 h-4 rounded bg-[#007ACC] flex items-center justify-center text-white font-bold text-[10px]">
            A
          </div>
          <span className="font-semibold text-[11.5px] text-[#E6E6E6] hidden sm:inline">
            Ajson
          </span>
        </div>

        {/* Standard IDE Menu Bar */}
        <nav ref={menuRef} className="flex items-center space-x-0.5 text-[#CCCCCC] text-[11.5px]" aria-label="Main menu">
          {menus.map((menu) => (
            <div key={menu.label} className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
                onMouseEnter={() => openMenu && setOpenMenu(menu.label)}
                aria-haspopup="menu"
                aria-expanded={openMenu === menu.label}
                className={`px-2 py-0.5 rounded-sm hover:bg-[#2A2D2E] hover:text-white transition-colors ${
                  openMenu === menu.label ? 'bg-[#2A2D2E] text-white' : ''
                }`}
              >
                {menu.label}
              </button>
              {openMenu === menu.label && (
                <div role="menu" className="absolute left-0 top-full mt-0.5 min-w-[220px] bg-[#1F1F1F] border border-[#333333] rounded-md shadow-xl py-1 z-[60]">
                  {menu.items.map((item) => (
                    <button
                      key={item.label}
                      role="menuitem"
                      disabled={!item.action}
                      onClick={() => {
                        setOpenMenu(null)
                        item.action?.()
                      }}
                      className="w-full flex items-center justify-between px-3 py-1 text-left text-[11.5px] text-[#CCCCCC] hover:bg-[#04395E] hover:text-white disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <span>{item.label}</span>
                      {item.shortcut && <span className="text-[10px] text-[#8B8B8B] ml-6">{item.shortcut}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Center: Window & Document Title */}
      <div className="window-no-drag flex items-center justify-center flex-1 mx-4 max-w-xl">
        <button
          onClick={onOpenCommandPalette}
          className="px-3 py-1 hover:bg-[#252526] rounded-md transition-colors text-[11.5px] text-[#9DA3AE] hover:text-[#CCCCCC] flex items-center space-x-2 truncate border border-transparent hover:border-[#333333]"
          title="Command Palette & Quick Open (Ctrl+P / ⌘P)"
        >
          <Search className="w-3.5 h-3.5 text-[#9DA3AE]" />
          <span className="truncate">
            Ajson — Antigravity IDE {activeFileName ? `— ${activeFileName}` : `— ${projectName}`}
          </span>
          <kbd className="text-[10px] bg-[#252526] border border-[#333333] px-1 py-0.2 rounded text-[#9DA3AE] font-mono">
            ⌘P
          </kbd>
        </button>
      </div>

      {/* Right: Layout Controls, Quick Actions & Window Buttons */}
      <div className="window-no-drag flex items-center space-x-1.5 shrink-0">
        {/* Quick Tools */}
        <div className="flex items-center space-x-0.5">
          <button
            id="header-btn-run"
            onClick={onRunProject}
            title="Run Project (F5)"
            className="p-1 rounded-sm text-[#CCCCCC] hover:bg-[#2A2D2E] hover:text-white transition-colors"
          >
            <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/30" />
          </button>

          <button
            id="header-btn-diff-review"
            onClick={onOpenDiffReview}
            title="Review Diff Changes"
            className="p-1 rounded-sm text-[#CCCCCC] hover:bg-[#2A2D2E] hover:text-white transition-colors"
          >
            <GitCompare className="w-3.5 h-3.5" />
          </button>

          <button
            id="header-btn-ai-codegen"
            onClick={onOpenAiCodeGen}
            title="AI Code Generator"
            className="p-1 rounded-sm text-[#CCCCCC] hover:bg-[#2A2D2E] hover:text-white transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#007ACC]" />
          </button>
        </div>

        {/* Panel Layout Toggles */}
        <div className="flex items-center space-x-0.5 border-l border-[#333333] pl-1.5">
          <button
            onClick={onToggleSidebar}
            title={sidebarOpen ? 'Hide Primary Sidebar (⌘B)' : 'Show Primary Sidebar (⌘B)'}
            className={`p-1 rounded-sm transition-colors ${
              sidebarOpen ? 'bg-[#37373D] text-white' : 'text-[#9DA3AE] hover:text-white hover:bg-[#2A2D2E]'
            }`}
          >
            <SidebarIcon className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onToggleBottomPanel}
            title={bottomPanelOpen ? 'Hide Bottom Panel (⌘J)' : 'Show Bottom Panel (⌘J)'}
            className={`p-1 rounded-sm transition-colors ${
              bottomPanelOpen ? 'bg-[#37373D] text-white' : 'text-[#9DA3AE] hover:text-white hover:bg-[#2A2D2E]'
            }`}
          >
            <PanelBottom className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onToggleAiPanel}
            title={aiPanelOpen ? 'Hide AI Assistant (⌘L)' : 'Show AI Assistant (⌘L)'}
            className={`p-1 rounded-sm transition-colors ${
              aiPanelOpen ? 'bg-[#37373D] text-[#007ACC]' : 'text-[#9DA3AE] hover:text-white hover:bg-[#2A2D2E]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* User Profile Avatar */}
        <div className="w-5 h-5 rounded-full bg-[#37373D] border border-[#3E3E42] text-[10px] font-semibold text-white flex items-center justify-center ml-1">
          R
        </div>

        {/* Electron Window Controls */}
        {isElectron && (
          <div className="flex items-center space-x-0.5 border-l border-[#333333] pl-1 ml-1">
            <button
              onClick={handleMinimize}
              className="w-7 h-6 flex items-center justify-center text-[#9DA3AE] hover:text-white hover:bg-[#2A2D2E] rounded-sm transition-colors"
              title="Minimize"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              onClick={handleMaximize}
              className="w-7 h-6 flex items-center justify-center text-[#9DA3AE] hover:text-white hover:bg-[#2A2D2E] rounded-sm transition-colors"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              <Square className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={handleClose}
              className="w-7 h-6 flex items-center justify-center text-[#9DA3AE] hover:text-white hover:bg-[#E81123] rounded-sm transition-colors"
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
