import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Search,
  Terminal,
  FolderOpen,
  FileCode,
  FilePlus,
  Save,
  SaveAll,
  X,
  Replace,
  SearchCheck,
  Sidebar,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react'
import { CommandItem } from '../types/editor'

export interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  commands: CommandItem[]
}

function getCommandIcon(id: string) {
  switch (id) {
    case 'open-folder':
      return <FolderOpen className="w-4 h-4 text-cyan-400" />
    case 'open-file':
      return <FileCode className="w-4 h-4 text-emerald-400" />
    case 'new-scratchpad':
      return <FilePlus className="w-4 h-4 text-indigo-400" />
    case 'save-file':
      return <Save className="w-4 h-4 text-sky-400" />
    case 'save-file-as':
      return <SaveAll className="w-4 h-4 text-sky-300" />
    case 'close-active-tab':
      return <X className="w-4 h-4 text-rose-400" />
    case 'find-in-file':
      return <Search className="w-4 h-4 text-amber-400" />
    case 'replace-in-file':
      return <Replace className="w-4 h-4 text-amber-300" />
    case 'search-in-project':
      return <SearchCheck className="w-4 h-4 text-teal-400" />
    case 'toggle-explorer':
      return <Sidebar className="w-4 h-4 text-purple-400" />
    case 'toggle-bottom-panel':
      return <Terminal className="w-4 h-4 text-violet-400" />
    case 'next-tab':
      return <ArrowRight className="w-4 h-4 text-blue-400" />
    case 'prev-tab':
      return <ArrowLeft className="w-4 h-4 text-blue-400" />
    case 'refresh-explorer':
      return <RefreshCw className="w-4 h-4 text-emerald-400" />
    default:
      return <SlidersHorizontal className="w-4 h-4 text-slate-400" />
  }
}

function getCategoryColor(category: string) {
  switch (category) {
    case 'File':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
    case 'Editor':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    case 'View':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30'
    case 'Navigation':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
    case 'Explorer':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30'
  }
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Filter commands by title, category or description
  const filteredCommands = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return commands

    return commands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q) ||
        (cmd.description && cmd.description.toLowerCase().includes(q))
    )
  }, [commands, searchQuery])

  // Reset query and selected index on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
      setSelectedIndex(0)
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 30)
    }
  }, [isOpen])

  // Clamp selected index when filter changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchQuery])

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-selected="true"]')
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  const executeCommand = (cmd: CommandItem) => {
    onClose()
    // Run action after closing modal
    setTimeout(() => {
      cmd.action()
    }, 10)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) =>
        filteredCommands.length > 0 ? (prev + 1) % filteredCommands.length : 0
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) =>
        filteredCommands.length > 0
          ? (prev - 1 + filteredCommands.length) % filteredCommands.length
          : 0
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredCommands.length > 0 && filteredCommands[selectedIndex]) {
        executeCommand(filteredCommands[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-start pt-[12vh] px-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-[580px] max-w-[94vw] bg-[#0c0f17] border border-[#232b40] rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs text-slate-200"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Command Input Header */}
        <div className="relative flex items-center px-3.5 py-3 border-b border-[#1b2235] bg-[#101421]">
          <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search... (e.g. Save, Open, Toggle)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent pl-7 pr-7 text-slate-100 placeholder-slate-500 text-xs focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Command List Area */}
        <div
          ref={listRef}
          className="max-h-[360px] overflow-y-auto p-1.5 space-y-0.5 divide-y divide-[#151b2a]/30"
        >
          {filteredCommands.length > 0 ? (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex
              return (
                <div
                  key={cmd.id}
                  data-selected={isSelected}
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-[#182035] text-white border border-cyan-500/30'
                      : 'hover:bg-[#121624] text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className="shrink-0">{getCommandIcon(cmd.id)}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${getCategoryColor(
                        cmd.category
                      )}`}
                    >
                      {cmd.category}
                    </span>
                    <span className="font-medium truncate text-xs">{cmd.title}</span>
                  </div>

                  {cmd.shortcut && (
                    <kbd className="ml-3 shrink-0 px-2 py-0.5 bg-[#101421] border border-[#232c42] rounded text-[10.5px] font-mono text-slate-400">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </div>
              )
            })
          ) : (
            <div className="py-8 text-center text-slate-500 space-y-1">
              <p className="text-xs">No commands matching &quot;{searchQuery}&quot;</p>
              <p className="text-[11px] text-slate-600">
                Try searching for general keywords like Save, File, or View.
              </p>
            </div>
          )}
        </div>

        {/* Keyboard Navigation Footer */}
        <div className="px-3.5 py-2 border-t border-[#1b2235] bg-[#090c13] flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <kbd className="bg-[#121622] px-1 rounded border border-[#20273a] text-[10px]">↑</kbd>
              <kbd className="bg-[#121622] px-1 rounded border border-[#20273a] text-[10px]">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="bg-[#121622] px-1.5 rounded border border-[#20273a] text-[10px]">↵</kbd>
              <span>to execute</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="bg-[#121622] px-1 rounded border border-[#20273a] text-[10px]">esc</kbd>
              <span>to close</span>
            </span>
          </div>

          <span>{filteredCommands.length} commands</span>
        </div>
      </div>
    </div>
  )
}
