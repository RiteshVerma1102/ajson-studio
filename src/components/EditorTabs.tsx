import React, { useState, useEffect } from 'react'
import {
  X,
  FileType,
  FileCode,
  FileJson,
  FileText,
  Plus,
  AlertCircle,
  Save,
  Copy,
  ChevronRight,
  Braces,
  Sparkles,
  GitCompare,
  BookOpen,
  Split,
} from 'lucide-react'
import { EditorTab } from '../types/editor'

export interface EditorTabsProps {
  tabs: EditorTab[]
  activeTabId: string
  onSelectTab: (id: string) => void
  onCloseTab: (id: string, e?: React.MouseEvent) => void
  onCloseOtherTabs?: (id: string) => void
  onCloseTabsToRight?: (id: string) => void
  onCloseAllTabs?: () => void
  onSaveTab?: (id: string) => void
  onSaveTabAs?: (id: string) => void
  onNewTab: () => void
  onOpenCodeExplain?: () => void
  onOpenDiffReview?: () => void
  onOpenAiCodeGen?: () => void
  isSplitView?: boolean
  onToggleSplitView?: () => void
}

export const EditorTabs: React.FC<EditorTabsProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCloseAllTabs,
  onSaveTab,
  onSaveTabAs,
  onNewTab,
  onOpenCodeExplain,
  onOpenDiffReview,
  onOpenAiCodeGen,
  isSplitView = false,
  onToggleSplitView,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    tab: EditorTab
  } | null>(null)

  const activeTab = tabs.find((t) => t.id === activeTabId)

  const getTabIcon = (name: string) => {
    if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      return <FileType className="w-3.5 h-3.5 text-blue-400 shrink-0" />
    }
    if (name.endsWith('.js') || name.endsWith('.jsx') || name.endsWith('.mjs')) {
      return <FileCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />
    }
    if (name.endsWith('.py')) {
      return <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
    }
    if (name.endsWith('.json')) {
      return <FileJson className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
    }
    if (name.endsWith('.css') || name.endsWith('.scss')) {
      return <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
    }
    if (name.endsWith('.html')) {
      return <FileCode className="w-3.5 h-3.5 text-orange-400 shrink-0" />
    }
    if (name.endsWith('.md')) {
      return <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
    }
    return <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
  }

  // Handle right-click context menu on tab
  const handleContextMenu = (e: React.MouseEvent, tab: EditorTab) => {
    e.preventDefault()
    e.stopPropagation()

    const menuWidth = 180
    const menuHeight = 190
    const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
    const winHeight = typeof window !== 'undefined' ? window.innerHeight : 800

    const x = Math.min(Math.max(8, e.clientX), winWidth - menuWidth - 8)
    const y = Math.min(Math.max(8, e.clientY), winHeight - menuHeight - 8)

    setContextMenu({ x, y, tab })
  }

  // Dismiss context menu on click or Escape
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu) setContextMenu(null)
    }
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && contextMenu) setContextMenu(null)
    }
    window.addEventListener('click', handleGlobalClick)
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => {
      window.removeEventListener('click', handleGlobalClick)
      window.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [contextMenu])

  // Compute breadcrumbs path
  const breadcrumbSegments = React.useMemo(() => {
    if (!activeTab) return ['quantum-mesh-core', 'Welcome']
    const parts = activeTab.path.split(/[/\\]/)
    return parts
  }, [activeTab])

  return (
    <div className="flex flex-col bg-[#181818] border-b border-[#252526] select-none text-xs">
      {/* Tabs Row */}
      <div className="h-9 flex items-center overflow-x-auto border-b border-[#252526] bg-[#181818]">
        <div className="flex items-center h-full">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId
            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault()
                    onCloseTab(tab.id, e)
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, tab)}
                className={`group h-full flex items-center space-x-2 px-3.5 border-r border-[#252526] cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-[#1E1E1E] text-white border-t-2 border-t-[#007ACC] font-medium'
                    : 'bg-[#181818] text-[#9DA3AE] hover:bg-[#1E1E1E]/60 hover:text-[#CCCCCC]'
                }`}
              >
                {getTabIcon(tab.name)}
                <span className="truncate max-w-[140px] text-[11.5px] font-sans">{tab.name}</span>

                {/* External change indicator */}
                {tab.hasExternalChange && (
                  <span title="File changed externally on disk" className="text-amber-400">
                    <AlertCircle className="w-3 h-3" />
                  </span>
                )}

                {/* Dirty indicator or close button */}
                <div className="w-4 h-4 flex items-center justify-center">
                  {tab.isDirty ? (
                    <div
                      onClick={(e) => onCloseTab(tab.id, e)}
                      className="w-2 h-2 rounded-full bg-white group-hover:hidden"
                      title="Unsaved changes"
                    />
                  ) : null}
                  <button
                    onClick={(e) => onCloseTab(tab.id, e)}
                    className={`p-0.5 rounded-sm hover:bg-[#37373D] text-[#9DA3AE] hover:text-white transition-colors ${
                      tab.isDirty ? 'hidden group-hover:flex' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    title="Close tab (Ctrl+W)"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          })}

          {/* Add new tab button */}
          <button
            onClick={onNewTab}
            title="New Scratchpad Document (Ctrl+N)"
            className="h-full px-2.5 text-[#9DA3AE] hover:text-white hover:bg-[#252526] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Monaco Breadcrumbs & CodeLens Bar */}
      {activeTab && (
        <div className="h-6 px-3 bg-[#1E1E1E] flex items-center justify-between text-[11px] font-sans text-[#9DA3AE] border-b border-[#252526]">
          <div className="flex items-center space-x-1.5 truncate">
            {breadcrumbSegments.map((segment, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight className="w-3 h-3 text-[#6E7681] shrink-0" />}
                <span className={`hover:text-white cursor-pointer ${idx === breadcrumbSegments.length - 1 ? 'text-[#CCCCCC] font-medium' : 'text-[#9DA3AE]'}`}>
                  {segment}
                </span>
              </React.Fragment>
            ))}
            {activeTab.name.endsWith('.ts') && (
              <>
                <ChevronRight className="w-3 h-3 text-[#6E7681] shrink-0" />
                <span className="text-[#9DA3AE] flex items-center space-x-1">
                  <Braces className="w-3 h-3 text-[#007ACC]" />
                  <span className="text-[#CCCCCC]">AgentCoordinator</span>
                </span>
                <ChevronRight className="w-3 h-3 text-[#6E7681] shrink-0" />
                <span className="text-amber-400 font-medium">generatePatchStream()</span>
              </>
            )}
          </div>

          {/* Inline Action Controls */}
          <div className="hidden sm:flex items-center space-x-1 shrink-0">
            <button
              onClick={onOpenCodeExplain}
              className="flex items-center space-x-1 text-[10.5px] px-1.5 py-0.5 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] text-[#CCCCCC] border border-[#333333] transition-colors"
              title="Explain active symbol with AI"
            >
              <BookOpen className="w-3 h-3 text-[#007ACC]" />
              <span>Explain</span>
            </button>

            <button
              onClick={onOpenDiffReview}
              className="flex items-center space-x-1 text-[10.5px] px-1.5 py-0.5 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] text-[#CCCCCC] border border-[#333333] transition-colors"
              title="Review proposed AI diff"
            >
              <GitCompare className="w-3 h-3 text-emerald-400" />
              <span>Diff</span>
            </button>

            {onToggleSplitView && (
              <button
                onClick={onToggleSplitView}
                className={`flex items-center space-x-1 text-[10.5px] px-1.5 py-0.5 rounded-sm border transition-colors ${
                  isSplitView
                    ? 'bg-[#37373D] text-white border-[#007ACC]'
                    : 'bg-[#252526] hover:bg-[#2A2D2E] text-[#CCCCCC] border-[#333333]'
                }`}
                title={isSplitView ? 'Close Split Editor' : 'Split Editor Right (Ctrl+\\)'}
              >
                <Split className="w-3 h-3 text-[#007ACC]" />
                <span>Split</span>
              </button>
            )}
          </div>
      )}

      {/* Tab Context Menu */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 bg-[#141620] border border-[#252838] rounded-xl shadow-2xl py-1 w-48 text-slate-300 text-xs select-none animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              onCloseTab(contextMenu.tab.id)
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1f2232] hover:text-slate-100 flex items-center justify-between"
          >
            <span>Close</span>
            <kbd className="text-[10px] text-slate-500 font-mono">Ctrl+W</kbd>
          </button>
          <button
            onClick={() => {
              onCloseOtherTabs?.(contextMenu.tab.id)
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1f2232] hover:text-slate-100"
          >
            Close Other Tabs
          </button>
          <button
            onClick={() => {
              onCloseTabsToRight?.(contextMenu.tab.id)
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1f2232] hover:text-slate-100"
          >
            Close Tabs to the Right
          </button>
          <button
            onClick={() => {
              onCloseAllTabs?.()
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1f2232] hover:text-slate-100"
          >
            Close All Tabs
          </button>
          <div className="h-px bg-[#202434] my-1" />
          <button
            onClick={() => {
              onSaveTab?.(contextMenu.tab.id)
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1f2232] hover:text-violet-300 flex items-center justify-between"
          >
            <span className="flex items-center space-x-1.5">
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </span>
            <kbd className="text-[10px] text-slate-500 font-mono">Ctrl+S</kbd>
          </button>
          <button
            onClick={() => {
              onSaveTabAs?.(contextMenu.tab.id)
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1f2232] hover:text-violet-300 flex items-center justify-between"
          >
            <span className="flex items-center space-x-1.5">
              <Copy className="w-3.5 h-3.5" />
              <span>Save As...</span>
            </span>
            <kbd className="text-[10px] text-slate-500 font-mono">Ctrl+Shift+S</kbd>
          </button>
        </div>
      )}
    </div>
  )
}
