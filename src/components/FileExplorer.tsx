import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FolderPlus,
  FilePlus,
  FileCode,
  FileJson,
  FileType,
  FileText,
  RefreshCw,
  Edit2,
  Trash2,
  AlertTriangle,
  FolderTree,
  Search,
  X,
  Loader2,
} from 'lucide-react'
import { FileTreeNode, SupportedLanguage } from '../types/editor'
import { validateFileName } from '../utils/fileUtils'

export interface FileExplorerProps {
  projectRoot: { path: string; name: string } | null
  tree: FileTreeNode[]
  isLoadingTree?: boolean
  treeError?: string | null
  activeFilePath?: string
  onOpenFile: (file: { name: string; path: string; language: SupportedLanguage }) => void
  onOpenFolderDialog: () => void
  onRefresh: () => void
  onFileCreated?: (newPath: string) => void
  onItemRenamed?: (oldPath: string, newPath: string, newName: string) => void
  onItemDeleted?: (deletedPath: string) => void
  recentProjects?: Array<{ path: string; name: string; exists?: boolean }>
  onOpenRecentProject?: (path: string) => void
  onRemoveRecentProject?: (path: string) => void
}

interface InlineActionState {
  type: 'newFile' | 'newFolder' | 'rename'
  targetDir: string
  nodeId?: string
  currentName?: string
}

/**
 * Recursively filters tree nodes by name.
 * A directory is retained if it matches or has matching descendants.
 */
function filterTreeNodes(
  nodes: FileTreeNode[],
  query: string
): { filtered: FileTreeNode[]; matchedPaths: Set<string>; matchCount: number } {
  const q = query.trim().toLowerCase()
  if (!q) {
    return { filtered: nodes, matchedPaths: new Set(), matchCount: 0 }
  }

  const matchedPaths = new Set<string>()
  let matchCount = 0

  function filterList(list: FileTreeNode[]): FileTreeNode[] {
    const result: FileTreeNode[] = []

    for (const node of list) {
      const selfMatches = node.name.toLowerCase().includes(q)

      if (node.isDirectory) {
        const filteredChildren = node.children ? filterList(node.children) : []
        const hasMatchingChildren = filteredChildren.length > 0

        if (selfMatches || hasMatchingChildren) {
          if (selfMatches) matchCount++
          matchedPaths.add(node.path)
          result.push({
            ...node,
            children: filteredChildren,
          })
        }
      } else {
        if (selfMatches) {
          matchCount++
          result.push(node)
        }
      }
    }

    return result
  }

  const filtered = filterList(nodes)
  return { filtered, matchedPaths, matchCount }
}

/**
 * Returns a flattened array of visible nodes based on currently expanded folders.
 */
function getFlattenedVisibleNodes(
  nodes: FileTreeNode[],
  expandedNodes: Set<string>
): FileTreeNode[] {
  const result: FileTreeNode[] = []

  function traverse(list: FileTreeNode[]) {
    for (const node of list) {
      result.push(node)
      if (node.isDirectory && expandedNodes.has(node.path) && node.children) {
        traverse(node.children)
      }
    }
  }

  traverse(nodes)
  return result
}

/**
 * Finds the parent node of a target path in the tree.
 */
function findParentNode(nodes: FileTreeNode[], targetPath: string): FileTreeNode | null {
  for (const node of nodes) {
    if (node.children) {
      for (const child of node.children) {
        if (child.path === targetPath) return node
      }
      const deep = findParentNode(node.children, targetPath)
      if (deep) return deep
    }
  }
  return null
}

/**
 * Collects ancestor directory paths for a target path.
 */
function getAncestorPaths(nodes: FileTreeNode[], targetPath: string): string[] {
  const ancestors: string[] = []

  function search(currentList: FileTreeNode[], currentPath: string[]): boolean {
    for (const node of currentList) {
      if (node.path === targetPath) {
        ancestors.push(...currentPath)
        return true
      }
      if (node.isDirectory && node.children) {
        if (search(node.children, [...currentPath, node.path])) {
          return true
        }
      }
    }
    return false
  }

  search(nodes, [])
  return ancestors
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  projectRoot,
  tree,
  isLoadingTree = false,
  treeError = null,
  activeFilePath,
  onOpenFile,
  onOpenFolderDialog,
  onRefresh,
  onFileCreated,
  onItemRenamed,
  onItemDeleted,
  recentProjects = [],
  onOpenRecentProject,
  onRemoveRecentProject,
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [selectedNodePath, setSelectedNodePath] = useState<string | null>(null)
  const [inlineAction, setInlineAction] = useState<InlineActionState | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; name: string; isDir: boolean } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileTreeNode } | null>(null)

  // Filter state
  const [filterQuery, setFilterQuery] = useState('')
  const [isFilterVisible, setIsFilterVisible] = useState(false)
  const filterInputRef = useRef<HTMLInputElement | null>(null)
  const treeContainerRef = useRef<HTMLDivElement | null>(null)

  // Auto-expand ancestors when activeFilePath changes
  useEffect(() => {
    if (activeFilePath && tree.length > 0) {
      const ancestors = getAncestorPaths(tree, activeFilePath)
      if (ancestors.length > 0) {
        setExpandedNodes((prev) => {
          const next = new Set(prev)
          ancestors.forEach((p) => next.add(p))
          return next
        })
      }
      setSelectedNodePath(activeFilePath)
    }
  }, [activeFilePath, tree])

  // Filter computation
  const { filteredTree, matchedPaths, matchCount } = useMemo(() => {
    if (!filterQuery.trim()) {
      return { filteredTree: tree, matchedPaths: new Set<string>(), matchCount: 0 }
    }
    const { filtered, matchedPaths, matchCount } = filterTreeNodes(tree, filterQuery)
    return { filteredTree: filtered, matchedPaths, matchCount }
  }, [tree, filterQuery])

  // Effective expanded nodes (include matched ancestor paths while searching)
  const effectiveExpandedNodes = useMemo(() => {
    if (!filterQuery.trim()) return expandedNodes
    const combined = new Set(expandedNodes)
    matchedPaths.forEach((p) => combined.add(p))
    return combined
  }, [expandedNodes, filterQuery, matchedPaths])

  // Visible nodes flattened for keyboard navigation
  const visibleNodes = useMemo(() => {
    return getFlattenedVisibleNodes(filteredTree, effectiveExpandedNodes)
  }, [filteredTree, effectiveExpandedNodes])

  // Expand / collapse single directory
  const toggleExpand = useCallback((nodePath: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodePath)) {
        next.delete(nodePath)
      } else {
        next.add(nodePath)
      }
      return next
    })
  }, [])

  // Collapse all directories
  const handleCollapseAll = () => {
    setExpandedNodes(new Set())
  }

  // File icons matching file type
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    if (ext === 'ts' || ext === 'tsx') return <FileType className="w-3.5 h-3.5 text-blue-400 shrink-0" />
    if (ext === 'js' || ext === 'jsx' || ext === 'mjs') return <FileCode className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
    if (ext === 'py') return <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
    if (ext === 'json') return <FileJson className="w-3.5 h-3.5 text-amber-400 shrink-0" />
    if (ext === 'css' || ext === 'scss') return <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
    if (ext === 'html') return <FileCode className="w-3.5 h-3.5 text-orange-400 shrink-0" />
    if (ext === 'md') return <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
    return <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
  }

  // Trigger inline creation of a file
  const startCreateFile = (targetDir?: string) => {
    const dir = targetDir || (selectedNodePath && !treeFindIsFile(selectedNodePath) ? selectedNodePath : projectRoot?.path)
    if (!dir) return
    setExpandedNodes((prev) => new Set(prev).add(dir))
    setInlineAction({ type: 'newFile', targetDir: dir })
    setInputValue('')
    setInputError(null)
    setContextMenu(null)
  }

  // Trigger inline creation of a folder
  const startCreateFolder = (targetDir?: string) => {
    const dir = targetDir || (selectedNodePath && !treeFindIsFile(selectedNodePath) ? selectedNodePath : projectRoot?.path)
    if (!dir) return
    setExpandedNodes((prev) => new Set(prev).add(dir))
    setInlineAction({ type: 'newFolder', targetDir: dir })
    setInputValue('')
    setInputError(null)
    setContextMenu(null)
  }

  // Trigger rename
  const startRename = (node: FileTreeNode) => {
    setInlineAction({
      type: 'rename',
      targetDir: node.path,
      nodeId: node.id,
      currentName: node.name,
    })
    setInputValue(node.name)
    setInputError(null)
    setContextMenu(null)
  }

  // Confirm inline action
  const handleCommitInlineAction = async () => {
    if (!inlineAction) return

    const validation = validateFileName(inputValue.trim())
    if (validation) {
      setInputError(validation)
      return
    }

    if (!window.ajsonAPI) {
      alert('Native filesystem API is only available in the Electron desktop environment.')
      setInlineAction(null)
      return
    }

    try {
      if (inlineAction.type === 'newFile') {
        const result = await window.ajsonAPI.fs.createFile(inlineAction.targetDir, inputValue.trim())
        if (!result.success) {
          setInputError(result.error || 'Failed to create file')
          return
        }
        setInlineAction(null)
        onRefresh()
        if (result.path) {
          onFileCreated?.(result.path)
          onOpenFile({
            name: inputValue.trim(),
            path: result.path,
            language: 'plaintext',
          })
        }
      } else if (inlineAction.type === 'newFolder') {
        const result = await window.ajsonAPI.fs.createFolder(inlineAction.targetDir, inputValue.trim())
        if (!result.success) {
          setInputError(result.error || 'Failed to create folder')
          return
        }
        setInlineAction(null)
        onRefresh()
      } else if (inlineAction.type === 'rename') {
        const result = await window.ajsonAPI.fs.rename(inlineAction.targetDir, inputValue.trim())
        if (!result.success) {
          setInputError(result.error || 'Failed to rename')
          return
        }
        setInlineAction(null)
        onRefresh()
        if (result.oldPath && result.newPath && result.newName) {
          onItemRenamed?.(result.oldPath, result.newPath, result.newName)
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setInputError(msg)
    }
  }

  // Cancel inline action
  const handleCancelInlineAction = () => {
    setInlineAction(null)
    setInputValue('')
    setInputError(null)
  }

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deleteTarget || !window.ajsonAPI) return

    try {
      const result = await window.ajsonAPI.fs.delete(deleteTarget.path)
      if (!result.success) {
        alert(result.error || 'Failed to delete item')
      } else {
        onItemDeleted?.(deleteTarget.path)
        onRefresh()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      alert(`Delete failed: ${msg}`)
    } finally {
      setDeleteTarget(null)
    }
  }

  // Helper to find if path is a file in the tree
  const treeFindIsFile = (targetPath: string): boolean => {
    const search = (nodes: FileTreeNode[]): boolean => {
      for (const n of nodes) {
        if (n.path === targetPath) return !n.isDirectory
        if (n.children && search(n.children)) return true
      }
      return false
    }
    return search(tree)
  }

  // Helper to find a node by path
  const findNodeByPath = (targetPath: string): FileTreeNode | null => {
    const search = (nodes: FileTreeNode[]): FileTreeNode | null => {
      for (const n of nodes) {
        if (n.path === targetPath) return n
        if (n.children) {
          const res = search(n.children)
          if (res) return res
        }
      }
      return null
    }
    return search(tree)
  }

  // Handle right click context menu with boundary clamping
  const handleContextMenu = (e: React.MouseEvent, node: FileTreeNode) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedNodePath(node.path)

    const menuWidth = 180
    const menuHeight = node.isDirectory ? 160 : 100
    const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
    const winHeight = typeof window !== 'undefined' ? window.innerHeight : 800

    const x = Math.min(Math.max(8, e.clientX), winWidth - menuWidth - 8)
    const y = Math.min(Math.max(8, e.clientY), winHeight - menuHeight - 8)

    setContextMenu({
      x,
      y,
      node,
    })
  }

  // Keyboard navigation handler for the tree
  const handleTreeKeyDown = (e: React.KeyboardEvent) => {
    if (inlineAction) return // Don't intercept while typing in input

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (visibleNodes.length === 0) return
      const currentIndex = visibleNodes.findIndex((n) => n.path === selectedNodePath)
      const nextIndex = currentIndex < visibleNodes.length - 1 ? currentIndex + 1 : 0
      setSelectedNodePath(visibleNodes[nextIndex].path)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (visibleNodes.length === 0) return
      const currentIndex = visibleNodes.findIndex((n) => n.path === selectedNodePath)
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : visibleNodes.length - 1
      setSelectedNodePath(visibleNodes[prevIndex].path)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (!selectedNodePath) return
      const current = visibleNodes.find((n) => n.path === selectedNodePath)
      if (current?.isDirectory) {
        if (!effectiveExpandedNodes.has(current.path)) {
          setExpandedNodes((prev) => new Set(prev).add(current.path))
        } else if (current.children && current.children.length > 0) {
          setSelectedNodePath(current.children[0].path)
        }
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (!selectedNodePath) return
      const current = visibleNodes.find((n) => n.path === selectedNodePath)
      if (current?.isDirectory && effectiveExpandedNodes.has(current.path)) {
        setExpandedNodes((prev) => {
          const next = new Set(prev)
          next.delete(current.path)
          return next
        })
      } else {
        const parent = findParentNode(tree, selectedNodePath)
        if (parent) {
          setSelectedNodePath(parent.path)
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (!selectedNodePath) return
      const current = visibleNodes.find((n) => n.path === selectedNodePath)
      if (current) {
        if (current.isDirectory) {
          toggleExpand(current.path)
        } else {
          onOpenFile({
            name: current.name,
            path: current.path,
            language: 'plaintext',
          })
        }
      }
    } else if (e.key === 'F2') {
      e.preventDefault()
      if (!selectedNodePath) return
      const node = findNodeByPath(selectedNodePath)
      if (node) startRename(node)
    } else if (e.key === 'Delete') {
      e.preventDefault()
      if (!selectedNodePath) return
      const node = findNodeByPath(selectedNodePath)
      if (node) {
        setDeleteTarget({
          path: node.path,
          name: node.name,
          isDir: node.isDirectory,
        })
      }
    } else if (e.key === 'Escape') {
      if (contextMenu) {
        e.preventDefault()
        setContextMenu(null)
      } else if (filterQuery) {
        e.preventDefault()
        setFilterQuery('')
      }
    }
  }

  // Dismiss context menu when clicking anywhere else or pressing Escape
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu) setContextMenu(null)
    }
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (contextMenu) setContextMenu(null)
      }
    }
    window.addEventListener('click', handleGlobalClick)
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => {
      window.removeEventListener('click', handleGlobalClick)
      window.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [contextMenu])

  // Focus filter input when toggled
  useEffect(() => {
    if (isFilterVisible) {
      filterInputRef.current?.focus()
    }
  }, [isFilterVisible])

  // Render tree node recursive
  const renderNodes = (nodes: FileTreeNode[], depth = 0) => {
    return (
      <div className="flex flex-col">
        {nodes.map((node) => {
          const isSelected = selectedNodePath === node.path || activeFilePath === node.path
          const isExpanded = effectiveExpandedNodes.has(node.path)
          const isBeingRenamed = inlineAction?.type === 'rename' && inlineAction.nodeId === node.id
          const paddingLeft = `${depth * 14 + 12}px`

          if (isBeingRenamed) {
            return (
              <div
                key={node.id}
                style={{ paddingLeft }}
                className="py-1 px-2 bg-[#161c2c] border-l-2 border-cyan-400 flex flex-col space-y-1"
              >
                <div className="flex items-center space-x-1.5">
                  {node.isDirectory ? (
                    <Folder className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  ) : (
                    getFileIcon(node.name)
                  )}
                  <input
                    type="text"
                    autoFocus
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value)
                      setInputError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCommitInlineAction()
                      if (e.key === 'Escape') handleCancelInlineAction()
                    }}
                    onBlur={handleCommitInlineAction}
                    className="flex-1 bg-[#0b0e14] text-slate-100 text-[12px] px-1 py-0.5 rounded border border-cyan-500/80 outline-none"
                  />
                </div>
                {inputError && (
                  <span className="text-[10px] text-rose-400 pl-5">{inputError}</span>
                )}
              </div>
            )
          }

          if (node.isDirectory) {
            const isTargetForCreation =
              (inlineAction?.type === 'newFile' || inlineAction?.type === 'newFolder') &&
              inlineAction.targetDir === node.path

            return (
              <div key={node.id} className="group/dir">
                <div
                  onClick={(e) => {
                    setSelectedNodePath(node.path)
                    toggleExpand(node.path, e)
                  }}
                  onContextMenu={(e) => handleContextMenu(e, node)}
                  style={{ paddingLeft }}
                  className={`flex items-center justify-between py-1 px-2 cursor-pointer select-none text-[12px] transition-colors ${
                    isSelected
                      ? 'bg-[#37373D] text-white font-medium'
                      : 'text-[#CCCCCC] hover:bg-[#2A2D2E] hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 truncate">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    )}
                    {isExpanded ? (
                      <FolderOpen className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    ) : (
                      <Folder className="w-3.5 h-3.5 text-sky-400/80 shrink-0" />
                    )}
                    <span className="truncate">{node.name}</span>
                  </div>

                  {/* Directory Hover Actions */}
                  <div className="hidden group-hover/dir:flex items-center space-x-1 text-slate-500">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        startCreateFile(node.path)
                      }}
                      title="New File Inside Folder"
                      className="p-0.5 hover:text-cyan-400 hover:bg-[#1e2538] rounded"
                    >
                      <FilePlus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        startCreateFolder(node.path)
                      }}
                      title="New Folder Inside Folder"
                      className="p-0.5 hover:text-cyan-400 hover:bg-[#1e2538] rounded"
                    >
                      <FolderPlus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        startRename(node)
                      }}
                      title="Rename Folder (F2)"
                      className="p-0.5 hover:text-slate-300 hover:bg-[#1e2538] rounded"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget({ path: node.path, name: node.name, isDir: true })
                      }}
                      title="Delete Folder (Del)"
                      className="p-0.5 hover:text-rose-400 hover:bg-[#1e2538] rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Sub-tree expansion */}
                {isExpanded && (
                  <div>
                    {/* Inline file/folder creation inside this directory */}
                    {isTargetForCreation && (
                      <div
                        style={{ paddingLeft: `${(depth + 1) * 14 + 12}px` }}
                        className="py-1 px-2 bg-[#161c2c] border-l-2 border-cyan-400 flex flex-col space-y-1"
                      >
                        <div className="flex items-center space-x-1.5">
                          {inlineAction.type === 'newFolder' ? (
                            <Folder className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          )}
                          <input
                            type="text"
                            autoFocus
                            placeholder={inlineAction.type === 'newFolder' ? 'Folder name...' : 'File name...'}
                            value={inputValue}
                            onChange={(e) => {
                              setInputValue(e.target.value)
                              setInputError(null)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCommitInlineAction()
                              if (e.key === 'Escape') handleCancelInlineAction()
                            }}
                            onBlur={handleCommitInlineAction}
                            className="flex-1 bg-[#0b0e14] text-slate-100 text-[12px] px-1 py-0.5 rounded border border-cyan-500/80 outline-none"
                          />
                        </div>
                        {inputError && (
                          <span className="text-[10px] text-rose-400 pl-5">{inputError}</span>
                        )}
                      </div>
                    )}

                    {node.children && node.children.length > 0 ? (
                      renderNodes(node.children, depth + 1)
                    ) : !isTargetForCreation ? (
                      <div
                        style={{ paddingLeft: `${(depth + 1) * 14 + 12}px` }}
                        className="py-1 text-[11px] text-slate-600 italic select-none"
                      >
                        (Empty directory)
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )
          }

          // File node
          return (
            <div
              key={node.id}
              onClick={() => {
                setSelectedNodePath(node.path)
                onOpenFile({
                  name: node.name,
                  path: node.path,
                  language: 'plaintext',
                })
              }}
              onContextMenu={(e) => handleContextMenu(e, node)}
              style={{ paddingLeft }}
              className={`group/file flex items-center justify-between py-1 px-2 cursor-pointer select-none text-[12px] transition-colors ${
                isSelected
                  ? 'bg-[#37373D] text-white font-medium border-l-2 border-[#007ACC]'
                  : 'text-[#CCCCCC] hover:bg-[#2A2D2E] hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                {getFileIcon(node.name)}
                <span className="truncate">{node.name}</span>
              </div>

              {/* File Hover Actions */}
              <div className="hidden group-hover/file:flex items-center space-x-1 text-slate-500">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    startRename(node)
                  }}
                  title="Rename File (F2)"
                  className="p-0.5 hover:text-slate-300 hover:bg-[#1e2538] rounded"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteTarget({ path: node.path, name: node.name, isDir: false })
                  }}
                  title="Delete File (Del)"
                  className="p-0.5 hover:text-rose-400 hover:bg-[#1e2538] rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div
      ref={treeContainerRef}
      tabIndex={0}
      onKeyDown={handleTreeKeyDown}
      className="flex flex-col h-full select-none text-xs outline-none bg-[#181818]"
    >
      {/* Explorer Action Toolbar */}
      <div className="h-8 px-2.5 bg-[#181818] border-b border-[#333333] flex items-center justify-between text-[#CCCCCC]">
        <span
          className="font-semibold uppercase tracking-wider text-[11px] text-[#BBBBBB] truncate max-w-[120px]"
          title={projectRoot ? `${projectRoot.name} (${projectRoot.path})` : 'No Project Open'}
        >
          {projectRoot ? projectRoot.name : 'No Project'}
        </span>
        <div className="flex items-center space-x-0.5 text-[#9DA3AE]">
          {projectRoot && (
            <>
              <button
                onClick={() => startCreateFile()}
                title="New File in Project Root"
                className="p-1 hover:text-white hover:bg-[#2A2D2E] rounded-sm transition-colors"
              >
                <FilePlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => startCreateFolder()}
                title="New Folder in Project Root"
                className="p-1 hover:text-white hover:bg-[#2A2D2E] rounded-sm transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsFilterVisible((prev) => !prev)}
                title="Filter Explorer Files"
                className={`p-1 rounded-sm transition-colors ${
                  isFilterVisible || filterQuery
                    ? 'text-white bg-[#2A2D2E]'
                    : 'hover:text-white hover:bg-[#2A2D2E]'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onRefresh}
                title="Refresh File Tree"
                className="p-1 hover:text-white hover:bg-[#2A2D2E] rounded-sm transition-colors"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isLoadingTree ? 'animate-spin text-[#007ACC]' : ''}`}
                />
              </button>
              <button
                onClick={handleCollapseAll}
                title="Collapse All Folders"
                className="p-1 hover:text-white hover:bg-[#2A2D2E] rounded-sm transition-colors"
              >
                <FolderTree className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            onClick={onOpenFolderDialog}
            title="Open Another Project Folder"
            className="p-1 hover:text-white hover:bg-[#2A2D2E] rounded-sm transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Explorer Filename Filtering Input Bar */}
      {projectRoot && isFilterVisible && (
        <div className="p-1.5 bg-[#181818] border-b border-[#333333] flex items-center space-x-1.5">
          <div className="relative flex-1">
            <input
              ref={filterInputRef}
              type="text"
              placeholder="Filter by name..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  if (filterQuery) {
                    setFilterQuery('')
                  } else {
                    setIsFilterVisible(false)
                  }
                }
              }}
              className="w-full bg-[#252526] text-[#CCCCCC] placeholder-[#6E7681] text-[11px] pl-6 pr-6 py-1 rounded-sm border border-[#333333] focus:border-[#007ACC] outline-none"
            />
            <Search className="w-3 h-3 text-[#9DA3AE] absolute left-2 top-2 pointer-events-none" />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="absolute right-1.5 top-1.5 text-[#9DA3AE] hover:text-white"
                title="Clear filter (Esc)"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {filterQuery && (
            <span className="text-[10px] text-[#007ACC] px-1 font-mono">
              {matchCount}
            </span>
          )}
        </div>
      )}

      {/* Error state banner */}
      {treeError && (
        <div className="p-2.5 bg-rose-950/40 border-b border-rose-900/60 text-rose-300 flex items-start space-x-2 text-[11px]">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-rose-200">Error reading workspace</div>
            <div className="text-[10.5px] text-rose-300/80 mt-0.5">{treeError}</div>
            <button
              onClick={onRefresh}
              className="mt-1.5 px-2 py-0.5 bg-rose-900/60 hover:bg-rose-800 text-white rounded text-[10px]"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Loading state indicator */}
      {isLoadingTree && (
        <div className="py-2 px-3 bg-[#111624] border-b border-[#1d2438] flex items-center space-x-2 text-cyan-400 text-[11px]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Updating workspace structure...</span>
        </div>
      )}

      {/* Main Explorer Tree or Empty State */}
      <div className="flex-1 overflow-y-auto py-1">
        {projectRoot ? (
          <div>
            {/* Inline creation at root level */}
            {inlineAction && inlineAction.targetDir === projectRoot.path && (
              <div className="py-1 px-3 bg-[#161c2c] border-l-2 border-cyan-400 flex flex-col space-y-1 mb-1">
                <div className="flex items-center space-x-1.5">
                  {inlineAction.type === 'newFolder' ? (
                    <Folder className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  )}
                  <input
                    type="text"
                    autoFocus
                    placeholder={inlineAction.type === 'newFolder' ? 'Folder name...' : 'File name...'}
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value)
                      setInputError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCommitInlineAction()
                      if (e.key === 'Escape') handleCancelInlineAction()
                    }}
                    onBlur={handleCommitInlineAction}
                    className="flex-1 bg-[#0b0e14] text-slate-100 text-[12px] px-1 py-0.5 rounded border border-cyan-500/80 outline-none"
                  />
                </div>
                {inputError && (
                  <span className="text-[10px] text-rose-400 pl-5">{inputError}</span>
                )}
              </div>
            )}

            {filteredTree.length > 0 ? (
              renderNodes(filteredTree)
            ) : filterQuery ? (
              <div className="p-4 text-center text-slate-500 text-xs space-y-2">
                <div>No files matching <span className="text-cyan-400 font-mono">"{filterQuery}"</span></div>
                <button
                  onClick={() => setFilterQuery('')}
                  className="px-2 py-1 bg-[#182033] hover:bg-[#202940] text-cyan-400 rounded text-[11px]"
                >
                  Clear Filter
                </button>
              </div>
            ) : (
              <div className="p-4 text-center text-slate-500 text-xs">
                This project folder is empty.
                <div className="mt-2 flex justify-center space-x-2">
                  <button
                    onClick={() => startCreateFile()}
                    className="px-2 py-1 bg-[#182033] hover:bg-[#202940] text-cyan-400 rounded text-[11px]"
                  >
                    + New File
                  </button>
                  <button
                    onClick={() => startCreateFolder()}
                    className="px-2 py-1 bg-[#182033] hover:bg-[#202940] text-cyan-400 rounded text-[11px]"
                  >
                    + New Folder
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty State: No Project Opened */
          <div className="p-4 text-center flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#141926] border border-[#20283c] flex items-center justify-center text-cyan-400 shadow-md">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="font-semibold text-slate-200 text-xs">No Folder Opened</div>
              <div className="text-[11px] text-slate-500 mt-0.5 max-w-[180px]">
                Open a project folder from your local disk to start developing.
              </div>
            </div>
            <button
              onClick={onOpenFolderDialog}
              className="w-full py-2 px-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-medium rounded shadow transition-all text-xs flex items-center justify-center space-x-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Open Project Folder</span>
            </button>

            {recentProjects && recentProjects.length > 0 && (
              <div className="w-full pt-3 border-t border-[#1a2133] mt-2 space-y-1.5 text-left">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1">
                  Recent Projects
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                  {recentProjects.map((proj) => (
                    <div
                      key={proj.path}
                      onClick={() => onOpenRecentProject?.(proj.path)}
                      className={`group p-1.5 rounded bg-[#111624] hover:bg-[#182035] border border-[#1b2236] hover:border-cyan-500/30 flex items-center justify-between cursor-pointer transition-colors ${
                        proj.exists === false ? 'opacity-60' : ''
                      }`}
                      title={proj.path}
                    >
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <Folder className={`w-3 h-3 shrink-0 ${proj.exists === false ? 'text-amber-500' : 'text-cyan-400'}`} />
                        <span className="text-slate-300 text-[11px] truncate">{proj.name}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemoveRecentProject?.(proj.path)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-rose-400"
                        title="Remove from recents"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context Menu Modal / Dropdown */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 bg-[#121622] border border-[#252e46] rounded shadow-2xl py-1 w-44 text-slate-300 text-xs select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.node.isDirectory && (
            <>
              <button
                onClick={() => startCreateFile(contextMenu.node.path)}
                className="w-full px-3 py-1.5 text-left hover:bg-[#1c2336] hover:text-cyan-400 flex items-center space-x-2"
              >
                <FilePlus className="w-3.5 h-3.5" />
                <span>New File</span>
              </button>
              <button
                onClick={() => startCreateFolder(contextMenu.node.path)}
                className="w-full px-3 py-1.5 text-left hover:bg-[#1c2336] hover:text-cyan-400 flex items-center space-x-2"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>New Folder</span>
              </button>
              <div className="h-px bg-[#1f263b] my-1" />
            </>
          )}
          <button
            onClick={() => startRename(contextMenu.node)}
            className="w-full px-3 py-1.5 text-left hover:bg-[#1c2336] hover:text-slate-100 flex items-center justify-between"
          >
            <div className="flex items-center space-x-2">
              <Edit2 className="w-3.5 h-3.5" />
              <span>Rename...</span>
            </div>
            <kbd className="text-[10px] text-slate-500">F2</kbd>
          </button>
          <button
            onClick={() => {
              setDeleteTarget({
                path: contextMenu.node.path,
                name: contextMenu.node.name,
                isDir: contextMenu.node.isDirectory,
              })
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-rose-950/60 text-rose-400 hover:text-rose-300 flex items-center justify-between"
          >
            <div className="flex items-center space-x-2">
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </div>
            <kbd className="text-[10px] text-rose-500/70">Del</kbd>
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-[#263048] rounded-lg p-4 max-w-sm w-full shadow-2xl space-y-3">
            <div className="flex items-center space-x-2 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-semibold text-slate-100 text-sm">
                Delete {deleteTarget.isDir ? 'Folder' : 'File'}?
              </h3>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              Are you sure you want to delete{' '}
              <strong className="text-white font-mono bg-[#1c2234] px-1 py-0.5 rounded">
                {deleteTarget.name}
              </strong>
              ?
              {deleteTarget.isDir && ' All contents within this folder will be permanently deleted.'}
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 rounded bg-[#1c2336] hover:bg-[#252f48] text-slate-300 hover:text-white text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition-colors shadow"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
