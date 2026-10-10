import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileCode,
  FileText,
  FileJson,
  FileType,
  RefreshCw,
  FolderOpen,
} from 'lucide-react'
import {
  ProjectSearchResult,
  SearchFileResult,
  SearchMatch,
} from '../types/editor'

export interface ProjectSearchProps {
  projectRoot: { path: string; name: string } | null
  unsavedBuffers: Array<{ path: string; content: string }>
  onOpenFileAtLocation: (file: {
    name: string
    path: string
    lineNumber: number
    column: number
    matchLength?: number
  }) => void
}

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
    case 'json':
      return <FileJson className="w-3.5 h-3.5 text-amber-400 shrink-0" />
    case 'html':
    case 'css':
    case 'scss':
      return <FileType className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
    case 'md':
    case 'txt':
      return <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
    default:
      return <FileCode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
  }
}

/**
 * Renders a snippet line with highlighted matching substring(s).
 */
function HighlightedSnippet({
  text,
  query,
  caseSensitive,
  isRegex,
}: {
  text: string
  query: string
  caseSensitive: boolean
  isRegex: boolean
}) {
  if (!query) return <span>{text}</span>

  try {
    let pattern = query
    if (!isRegex) {
      pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
    const regex = new RegExp(`(${pattern})`, caseSensitive ? 'g' : 'gi')
    const parts = text.split(regex)

    return (
      <span className="font-mono text-[11.5px] leading-relaxed text-slate-300">
        {parts.map((part, i) => {
          const isMatch = regex.test(part)
          regex.lastIndex = 0
          return isMatch ? (
            <mark
              key={i}
              className="bg-cyan-500/30 text-cyan-200 border-b border-cyan-400 font-semibold rounded-[2px] px-0.5"
            >
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        })}
      </span>
    )
  } catch {
    return <span>{text}</span>
  }
}

export const ProjectSearch: React.FC<ProjectSearchProps> = ({
  projectRoot,
  unsavedBuffers,
  onOpenFileAtLocation,
}) => {
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [isRegex, setIsRegex] = useState(false)

  const [isSearching, setIsSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<ProjectSearchResult | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Collapsed state for file groups (key = filePath)
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set())

  // Outdated search request tracking
  const searchIdRef = useRef(0)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const performSearch = useCallback(
    async (searchQuery: string) => {
      const trimmed = searchQuery.trim()
      if (!trimmed) {
        setSearchResult(null)
        setSearchError(null)
        setIsSearching(false)
        return
      }

      if (!projectRoot) {
        setSearchError('Open a project folder to search across workspace files.')
        setSearchResult(null)
        setIsSearching(false)
        return
      }

      if (!window.ajsonAPI) {
        setSearchError('Electron desktop bridge is unavailable.')
        setIsSearching(false)
        return
      }

      const reqId = ++searchIdRef.current
      setIsSearching(true)
      setSearchError(null)

      try {
        const res = await window.ajsonAPI.project.search(trimmed, {
          caseSensitive,
          wholeWord,
          isRegex,
          maxMatches: 500,
          unsavedBuffers,
        })

        // Ignore stale search response
        if (reqId !== searchIdRef.current) return

        if (res.success) {
          setSearchResult(res)
          setSearchError(null)
        } else {
          setSearchError(res.error || 'Search encountered an error.')
          setSearchResult(null)
        }
      } catch (err: unknown) {
        if (reqId !== searchIdRef.current) return
        const msg = err instanceof Error ? err.message : String(err)
        setSearchError(msg)
        setSearchResult(null)
      } finally {
        if (reqId === searchIdRef.current) {
          setIsSearching(false)
        }
      }
    },
    [projectRoot, caseSensitive, wholeWord, isRegex, unsavedBuffers]
  )

  // Debounced auto-search when query or toggles change
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (!query.trim()) {
      setSearchResult(null)
      setSearchError(null)
      setIsSearching(false)
      return
    }

    debounceTimerRef.current = setTimeout(() => {
      performSearch(query)
    }, 280)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [query, performSearch])

  const handleClear = () => {
    setQuery('')
    setSearchResult(null)
    setSearchError(null)
    searchIdRef.current++
    setIsSearching(false)
  }

  const toggleFileCollapse = (filePath: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(filePath)) {
        next.delete(filePath)
      } else {
        next.add(filePath)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1017] select-none text-xs">
      {/* Search Controls Header */}
      <div className="p-3 border-b border-[#1b2030] space-y-2">
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Search across files..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                performSearch(query)
              } else if (e.key === 'Escape') {
                handleClear()
              }
            }}
            className="w-full bg-[#121622] border border-[#20273b] rounded pl-8 pr-16 py-1.5 text-slate-200 placeholder-slate-500 text-xs focus:border-cyan-500 focus:outline-none transition-colors"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />

          {/* Quick Clear */}
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-1.5 p-1 text-slate-400 hover:text-white rounded hover:bg-[#1f283d] transition-colors"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Toggle options row */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
          <div className="flex items-center space-x-1">
            {/* Match Case */}
            <button
              onClick={() => setCaseSensitive(!caseSensitive)}
              className={`px-1.5 py-0.5 rounded font-mono font-bold transition-colors ${
                caseSensitive
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                  : 'bg-[#121622] hover:bg-[#1a2133] text-slate-400 border border-transparent'
              }`}
              title="Match Case (Alt+C)"
            >
              Aa
            </button>

            {/* Whole Word */}
            <button
              onClick={() => setWholeWord(!wholeWord)}
              className={`px-1.5 py-0.5 rounded font-mono font-bold transition-colors ${
                wholeWord
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                  : 'bg-[#121622] hover:bg-[#1a2133] text-slate-400 border border-transparent'
              }`}
              title="Match Whole Word (Alt+W)"
            >
              \b
            </button>

            {/* Regular Expression */}
            <button
              onClick={() => setIsRegex(!isRegex)}
              className={`px-1.5 py-0.5 rounded font-mono font-bold transition-colors ${
                isRegex
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                  : 'bg-[#121622] hover:bg-[#1a2133] text-slate-400 border border-transparent'
              }`}
              title="Use Regular Expression (Alt+R)"
            >
              .*
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {isSearching ? (
              <span className="flex items-center space-x-1 text-cyan-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Searching...</span>
              </span>
            ) : searchResult ? (
              <span className="text-[10px] text-slate-400">
                {searchResult.totalMatches} matches in {searchResult.totalFiles} files
              </span>
            ) : null}

            {query && (
              <button
                onClick={() => performSearch(query)}
                className="p-1 hover:text-cyan-400 text-slate-400 transition-colors"
                title="Refresh Search"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results Content Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* No active project state */}
        {!projectRoot && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-2 text-slate-500">
            <FolderOpen className="w-8 h-8 text-slate-600" />
            <p className="text-xs">No project currently open.</p>
            <p className="text-[11px] text-slate-600">
              Open a project folder to search across workspace files.
            </p>
          </div>
        )}

        {/* Empty query guide */}
        {projectRoot && !query && (
          <div className="text-[11px] text-slate-500 text-center py-10 px-4 space-y-1">
            <p className="text-slate-400 font-medium">Project Search</p>
            <p className="text-slate-600">
              Type keywords to search across files in{' '}
              <span className="text-slate-400">{projectRoot.name}</span>.
            </p>
          </div>
        )}

        {/* Error State */}
        {searchError && (
          <div className="p-3 bg-red-950/40 border border-red-800/40 rounded text-red-300 text-xs space-y-1">
            <p className="font-medium">Search Failed</p>
            <p className="text-[11px] text-red-400">{searchError}</p>
          </div>
        )}

        {/* Zero results */}
        {searchResult && searchResult.totalMatches === 0 && !isSearching && (
          <div className="text-center py-10 text-slate-500 text-xs space-y-1">
            <p>No results found for &quot;{query}&quot;.</p>
            <p className="text-[10.5px] text-slate-600">
              Check spelling or try adjusting case and regex filters.
            </p>
          </div>
        )}

        {/* Results List */}
        {searchResult && searchResult.results.length > 0 && (
          <div className="space-y-1.5">
            {searchResult.results.map((fileRes: SearchFileResult) => {
              const isCollapsed = collapsedFiles.has(fileRes.filePath)
              return (
                <div
                  key={fileRes.filePath}
                  className="border border-[#1a2133] rounded overflow-hidden bg-[#0e121b]"
                >
                  {/* File Header */}
                  <button
                    onClick={() => toggleFileCollapse(fileRes.filePath)}
                    className="w-full px-2 py-1.5 bg-[#121622] hover:bg-[#161c2b] flex items-center justify-between text-left transition-colors border-b border-[#192236]/40"
                  >
                    <div className="flex items-center space-x-1.5 min-w-0">
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      )}
                      {getFileIcon(fileRes.fileName)}
                      <span className="font-medium text-slate-200 truncate text-[11.5px]">
                        {fileRes.fileName}
                      </span>
                      <span className="text-[10.5px] text-slate-500 truncate">
                        {fileRes.relativePath.replace(fileRes.fileName, '')}
                      </span>
                    </div>

                    <span className="text-[10px] bg-[#1a2133] text-cyan-300 px-1.5 py-0.5 rounded font-mono shrink-0">
                      {fileRes.matches.length}
                    </span>
                  </button>

                  {/* Matches under file */}
                  {!isCollapsed && (
                    <div className="divide-y divide-[#151a29]">
                      {fileRes.matches.map((match: SearchMatch, idx: number) => (
                        <div
                          key={`${fileRes.filePath}-${match.lineNumber}-${match.column}-${idx}`}
                          onClick={() => {
                            onOpenFileAtLocation({
                              name: fileRes.fileName,
                              path: fileRes.filePath,
                              lineNumber: match.lineNumber,
                              column: match.column,
                              matchLength: match.matchLength,
                            })
                          }}
                          className="px-2.5 py-1.5 hover:bg-[#151c2e] cursor-pointer flex items-baseline space-x-2 transition-colors group"
                        >
                          <span className="font-mono text-[10px] text-slate-500 group-hover:text-cyan-400 shrink-0 w-8 text-right">
                            L{match.lineNumber}
                          </span>
                          <div className="truncate flex-1">
                            <HighlightedSnippet
                              text={match.lineContent}
                              query={searchResult.query}
                              caseSensitive={caseSensitive}
                              isRegex={isRegex}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {searchResult.truncated && (
              <div className="text-center py-2 text-[11px] text-amber-400 bg-amber-950/20 border border-amber-900/30 rounded">
                Search capped at 500 matches for performance.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
