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
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    tab: EditorTab
  } | null>(null)

  const getTabIcon = (name: string) => {
    if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      return <FileType className="w-3.5 h-3.5 text-blue-400 shrink-0" />
    }
    if (name.endsWith('.js') || name.endsWith('.jsx') || name.endsWith('.mjs')) {
      return <FileCode className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
    }
    if (name.endsWith('.py')) {
      return <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
    }
    if (name.endsWith('.json')) {
      return <FileJson className="w-3.5 h-3.5 text-amber-400 shrink-0" />
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

  return (
    <div className="h-9 bg-[#0a0d13] border-b border-[#1b2030] flex items-center select-none overflow-x-auto text-xs">
      <div className="flex items-center h-full">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId
          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              onAuxClick={(e) => {
                // Middle click closes tab
                if (e.button === 1) {
                  e.preventDefault()
                  onCloseTab(tab.id, e)
                }
              }}
              onContextMenu={(e) => handleContextMenu(e, tab)}
              className={`group h-full flex items-center space-x-2 px-3 border-r border-[#1b2030] cursor-pointer transition-all ${
                isActive
                  ? 'bg-[#0f131d] text-cyan-300 border-t-2 border-t-cyan-400 font-medium'
                  : 'bg-[#090b10] text-slate-400 hover:bg-[#0d1017] hover:text-slate-200'
              }`}
            >
              {getTabIcon(tab.name)}
              <span className="truncate max-w-[140px] text-[11.5px] font-mono">{tab.name}</span>

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
                    className="w-2 h-2 rounded-full bg-cyan-400 group-hover:hidden"
                    title="Unsaved changes"
                  />
                ) : null}
                <button
                  onClick={(e) => onCloseTab(tab.id, e)}
                  className={`p-0.5 rounded hover:bg-[#20273c] text-slate-400 hover:text-white transition-colors ${
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
          className="h-full px-2.5 text-slate-500 hover:text-slate-300 hover:bg-[#121622] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab Context Menu */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 bg-[#121622] border border-[#252e46] rounded shadow-2xl py-1 w-48 text-slate-300 text-xs select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              onCloseTab(contextMenu.tab.id)
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1c2336] hover:text-slate-100 flex items-center justify-between"
          >
            <span>Close</span>
            <kbd className="text-[10px] text-slate-500">Ctrl+W</kbd>
          </button>
          <button
            onClick={() => {
              onCloseOtherTabs?.(contextMenu.tab.id)
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1c2336] hover:text-slate-100"
          >
            Close Other Tabs
          </button>
          <button
            onClick={() => {
              onCloseTabsToRight?.(contextMenu.tab.id)
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1c2336] hover:text-slate-100"
          >
            Close Tabs to the Right
          </button>
          <button
            onClick={() => {
              onCloseAllTabs?.()
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1c2336] hover:text-slate-100"
          >
            Close All Tabs
          </button>
          <div className="h-px bg-[#1f263b] my-1" />
          <button
            onClick={() => {
              onSaveTab?.(contextMenu.tab.id)
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1c2336] hover:text-cyan-400 flex items-center justify-between"
          >
            <span className="flex items-center space-x-1.5">
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </span>
            <kbd className="text-[10px] text-slate-500">Ctrl+S</kbd>
          </button>
          <button
            onClick={() => {
              onSaveTabAs?.(contextMenu.tab.id)
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1c2336] hover:text-cyan-400 flex items-center justify-between"
          >
            <span className="flex items-center space-x-1.5">
              <Copy className="w-3.5 h-3.5" />
              <span>Save As...</span>
            </span>
            <kbd className="text-[10px] text-slate-500">Ctrl+Shift+S</kbd>
          </button>
        </div>
      )}
    </div>
  )
}
