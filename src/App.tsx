import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Header } from './components/Header'
import { ActivityBar } from './components/ActivityBar'
import { Sidebar } from './components/Sidebar'
import { EditorTabs } from './components/EditorTabs'
import { MonacoEditor, MonacoEditorHandle } from './editor/MonacoEditor'
import { BottomPanel } from './components/BottomPanel'
import { StatusBar } from './components/StatusBar'
import { AiPanel } from './components/AiPanel'
import { CommandPalette } from './components/CommandPalette'
import { IdeLayout } from './layouts/IdeLayout'
import { sampleFiles, sampleFileTree } from './editor/sampleFiles'
import { DiffReviewModal } from './components/DiffReviewModal'
import { AiCodeGenOverlay } from './components/AiCodeGenOverlay'
import { CodeExplanationModal } from './components/CodeExplanationModal'
import { MultiFileEditsModal } from './components/MultiFileEditsModal'
import { ModelSettingsModal } from './components/ModelSettingsModal'
import {
  EditorTab,
  ActivityView,
  BottomTab,
  CursorPosition,
  FileTreeNode,
  EditorLocation,
  CommandItem,
} from './types/editor'
import type { RecentProject } from './types/electron'
import { getLanguageFromPath, isBinaryExtension } from './utils/fileUtils'
import { FolderOpen, FileCode2, Plus, AlertCircle, CheckCircle2, X, Sparkles } from 'lucide-react'

export const App: React.FC = () => {
  // Project Workspace State
  const [projectRoot, setProjectRoot] = useState<{ path: string; name: string } | null>({
    path: 'ajson-studio',
    name: 'ajson-studio',
  })
  const [tree, setTree] = useState<FileTreeNode[]>(sampleFileTree)
  const [isLoadingTree, setIsLoadingTree] = useState<boolean>(false)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])
  const persistTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialLoadDoneRef = useRef<boolean>(false)

  // Editor Tabs State
  const [tabs, setTabs] = useState<EditorTab[]>(sampleFiles)
  const [activeTabId, setActiveTabId] = useState<string>('sample/user-profile.json')
  const [isSplitView, setIsSplitView] = useState<boolean>(false)
  const [secondaryTabId, setSecondaryTabId] = useState<string | null>(null)
  const [revealLocation, setRevealLocation] = useState<(EditorLocation & { timestamp?: number }) | null>(null)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false)
  const monacoEditorRef = useRef<MonacoEditorHandle>(null)

  // Additional Screen/State Modals
  const [isDiffReviewOpen, setIsDiffReviewOpen] = useState<boolean>(false)
  const [isAiCodeGenOpen, setIsAiCodeGenOpen] = useState<boolean>(false)
  const [isCodeExplainOpen, setIsCodeExplainOpen] = useState<boolean>(false)
  const [isMultiFileEditsOpen, setIsMultiFileEditsOpen] = useState<boolean>(false)
  const [isModelSettingsOpen, setIsModelSettingsOpen] = useState<boolean>(false)
  const [activeStateView, setActiveStateView] = useState<string>('workspace')

  // Map open in-memory tab buffers for project-wide search
  const unsavedBuffers = useMemo(() => {
    return tabs.map((t) => ({ path: t.path, content: t.content }))
  }, [tabs])

  // Layout Panels State
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true)
  const [sidebarWidth, setSidebarWidth] = useState<number>(260)
  const [activeActivityView, setActiveActivityView] = useState<ActivityView>('explorer')
  const [bottomPanelOpen, setBottomPanelOpen] = useState<boolean>(true)
  const [bottomPanelHeight, setBottomPanelHeight] = useState<number>(200)
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>('terminal')
  const [aiPanelOpen, setAiPanelOpen] = useState<boolean>(true)
  const [aiPanelWidth, setAiPanelWidth] = useState<number>(390)

  // Editor selection state for AI code context
  const [editorSelection, setEditorSelection] = useState<{
    text: string
    language: string
    filePath: string
    startLine: number
    endLine: number
    startCol: number
    endCol: number
  } | null>(null)

  // Cursor state
  const [cursorPosition, setCursorPosition] = useState<CursorPosition>({
    lineNumber: 1,
    column: 1,
  })

  // Unsaved Changes Modal State
  const [tabClosePrompt, setTabClosePrompt] = useState<{
    tab: EditorTab
  } | null>(null)

  // Toast notification state
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev))
    }, 3500)
  }

  // Get current active tab
  const activeTab = tabs.find((t) => t.id === activeTabId) || null
  const secondaryTab = isSplitView
    ? tabs.find((t) => t.id === secondaryTabId) ||
      tabs.find((t) => t.id !== activeTabId) ||
      activeTab
    : null

  // Initial Workspace & Preferences Load
  useEffect(() => {
    let isMounted = true

    async function initializeWorkspace() {
      if (!window.ajsonAPI) return

      try {
        setIsLoadingTree(true)
        const stateRes = await window.ajsonAPI.workspace.getState()
        if (!isMounted) return

        if (stateRes.success && stateRes.data) {
          const ws = stateRes.data
          if (Array.isArray(ws.recentProjects)) {
            setRecentProjects(ws.recentProjects)
          }

          // Restore layout preferences
          if (typeof ws.sidebarOpen === 'boolean') setSidebarOpen(ws.sidebarOpen)
          if (typeof ws.sidebarWidth === 'number') setSidebarWidth(ws.sidebarWidth)
          if (typeof ws.bottomPanelOpen === 'boolean') setBottomPanelOpen(ws.bottomPanelOpen)
          if (typeof ws.bottomPanelHeight === 'number') setBottomPanelHeight(ws.bottomPanelHeight)
          if (ws.activeBottomTab) setActiveBottomTab(ws.activeBottomTab)
          if (ws.activeActivityView) setActiveActivityView(ws.activeActivityView)

          // Restore project root if valid and exists
          let loadedProject = false
          if (ws.lastProjectRoot && ws.lastProjectRoot.path) {
            try {
              const openRes = await window.ajsonAPI.project.openPath(ws.lastProjectRoot.path)
              if (openRes && openRes.path && openRes.tree) {
                setProjectRoot({ path: openRes.path, name: openRes.name })
                setTree(openRes.tree)
                loadedProject = true
              }
            } catch (err) {
              console.warn('[Workspace] Could not restore previous project root:', err)
            }
          }

          if (!loadedProject) {
            const root = await window.ajsonAPI.project.getRoot()
            if (root) {
              setProjectRoot(root)
              const treeRes = await window.ajsonAPI.project.getTree()
              if (treeRes.success && treeRes.tree) {
                setTree(treeRes.tree)
              }
            }
          }

          // Restore open editor tabs (only valid files that still exist on disk)
          if (Array.isArray(ws.openTabs) && ws.openTabs.length > 0) {
            const restoredTabs: EditorTab[] = []
            for (const tabInfo of ws.openTabs) {
              try {
                const fileRes = await window.ajsonAPI.fs.readFile(tabInfo.path)
                if (fileRes.success && typeof fileRes.content === 'string') {
                  restoredTabs.push({
                    id: tabInfo.path,
                    name: tabInfo.name || fileRes.name || tabInfo.path.split(/[/\\]/).pop() || 'file',
                    path: tabInfo.path,
                    content: fileRes.content,
                    originalContent: fileRes.content,
                    language: getLanguageFromPath(tabInfo.path),
                    isDirty: false,
                    lastSavedMtime: fileRes.lastModified,
                  })
                }
              } catch (e) {
                console.warn(`[Workspace] Could not restore tab ${tabInfo.path}:`, e)
              }
            }

            if (restoredTabs.length > 0) {
              setTabs(restoredTabs)
              const targetActive =
                ws.activeTabPath && restoredTabs.some((t) => t.path === ws.activeTabPath)
                  ? ws.activeTabPath
                  : restoredTabs[0].id
              setActiveTabId(targetActive)
            }
          }
        }
      } catch (err) {
        console.error('Failed to initialize workspace state:', err)
        setTreeError(String(err))
      } finally {
        if (isMounted) {
          setIsLoadingTree(false)
          isInitialLoadDoneRef.current = true
        }
      }
    }

    initializeWorkspace()

    return () => {
      isMounted = false
    }
  }, [])

  // Auto-save workspace layout and open tabs (debounced)
  useEffect(() => {
    if (!window.ajsonAPI || !isInitialLoadDoneRef.current) return

    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current)
    }

    persistTimeoutRef.current = setTimeout(() => {
      const persistedTabs = tabs
        .filter((t) => !t.path.startsWith('untitled:') && t.path.trim().length > 0)
        .map((t) => ({ path: t.path, name: t.name }))

      const activeTabObj = tabs.find((t) => t.id === activeTabId)
      const activeTabPath =
        activeTabObj && !activeTabObj.path.startsWith('untitled:') ? activeTabObj.path : null

      window.ajsonAPI?.workspace.saveState({
        lastProjectRoot: projectRoot,
        openTabs: persistedTabs,
        activeTabPath,
        sidebarOpen,
        sidebarWidth,
        bottomPanelOpen,
        bottomPanelHeight,
        activeBottomTab,
        activeActivityView,
      })
    }, 600)

    return () => {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current)
    }
  }, [tabs, activeTabId, sidebarOpen, sidebarWidth, bottomPanelOpen, bottomPanelHeight, activeBottomTab, activeActivityView, projectRoot])

  // Open Project Folder Action
  const handleOpenFolderDialog = async () => {
    if (!window.ajsonAPI) {
      showToast('Project folder dialog requires Electron desktop runtime.', 'error')
      return
    }

    // Protect against silent loss of unsaved changes
    if (tabs.some((t) => t.isDirty)) {
      const confirmDiscard = window.confirm(
        'You have unsaved changes in current editor tabs. Opening another project will switch workspace. Do you wish to proceed?'
      )
      if (!confirmDiscard) return
    }

    try {
      setIsLoadingTree(true)
      setTreeError(null)
      const result = await window.ajsonAPI.project.openFolder()
      if (result) {
        setProjectRoot({ path: result.path, name: result.name })
        setTree(result.tree)
        showToast(`Opened project: ${result.name}`, 'success')
        const recentsRes = await window.ajsonAPI.workspace.getRecentProjects()
        if (recentsRes.success && recentsRes.recentProjects) {
          setRecentProjects(recentsRes.recentProjects)
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setTreeError(msg)
      showToast(`Failed to open project folder: ${msg}`, 'error')
    } finally {
      setIsLoadingTree(false)
    }
  }

  // Open Recent Project
  const handleOpenRecentProject = async (projectPath: string) => {
    if (!window.ajsonAPI) return

    // Protect against silent loss of unsaved changes
    if (tabs.some((t) => t.isDirty)) {
      const confirmDiscard = window.confirm(
        'You have unsaved changes in current editor tabs. Opening another project will switch workspace. Do you wish to proceed?'
      )
      if (!confirmDiscard) return
    }

    try {
      setIsLoadingTree(true)
      setTreeError(null)
      const res = await window.ajsonAPI.project.openPath(projectPath)
      if (res && res.path && res.tree) {
        setProjectRoot({ path: res.path, name: res.name })
        setTree(res.tree)
        showToast(`Opened project: ${res.name}`, 'success')
        const recentsRes = await window.ajsonAPI.workspace.getRecentProjects()
        if (recentsRes.success && recentsRes.recentProjects) {
          setRecentProjects(recentsRes.recentProjects)
        }
      } else {
        const errorMsg = (res as any)?.error || 'Could not open project directory'
        showToast(errorMsg, 'error')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast(`Failed to open project: ${msg}`, 'error')
    } finally {
      setIsLoadingTree(false)
    }
  }

  // Remove Recent Project
  const handleRemoveRecentProject = async (projectPath: string) => {
    if (!window.ajsonAPI) return
    try {
      const res = await window.ajsonAPI.workspace.removeRecentProject(projectPath)
      if (res.success && res.recentProjects) {
        setRecentProjects(res.recentProjects)
        showToast('Removed from recent projects', 'info')
      }
    } catch (err) {
      console.warn('Failed to remove recent project:', err)
    }
  }

  // Clear Recent Projects
  const handleClearRecentProjects = async () => {
    if (!window.ajsonAPI) return
    try {
      const res = await window.ajsonAPI.workspace.clearRecentProjects()
      if (res.success) {
        setRecentProjects([])
        showToast('Recent projects cleared', 'info')
      }
    } catch (err) {
      console.warn('Failed to clear recent projects:', err)
    }
  }

  // Safe Window Close with Unsaved Changes Guard
  const handleCloseWindow = () => {
    if (tabs.some((t) => t.isDirty)) {
      const proceed = window.confirm(
        'You have unsaved changes in your editor tabs. Are you sure you want to close Ajson Studio?'
      )
      if (!proceed) return
    }
    window.ajsonAPI?.window.close()
  }

  // Refresh Project Tree Action
  const handleRefreshProject = async () => {
    if (!window.ajsonAPI) return
    try {
      setIsLoadingTree(true)
      setTreeError(null)
      const result = await window.ajsonAPI.project.getTree()
      if (result.success) {
        setTree(result.tree)
        showToast('Workspace refreshed', 'info')
      } else if (result.error) {
        setTreeError(result.error)
        showToast(result.error, 'error')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setTreeError(msg)
      showToast(`Refresh error: ${msg}`, 'error')
    } finally {
      setIsLoadingTree(false)
    }
  }

  // Open a real file from filesystem
  const handleOpenFile = async (file: { name: string; path: string }) => {
    // Check if tab is already open
    const existing = tabs.find((t) => t.path === file.path)
    if (existing) {
      setActiveTabId(existing.id)
      return
    }

    // Binary extension check before reading
    if (isBinaryExtension(file.path)) {
      showToast(`Binary file (${file.name}) cannot be opened in the code editor.`, 'info')
      return
    }

    if (!window.ajsonAPI) {
      // Fallback in web preview
      const fallbackTab: EditorTab = {
        id: file.path,
        name: file.name,
        path: file.path,
        language: getLanguageFromPath(file.path),
        content: `// Preview for ${file.name}\n`,
        originalContent: `// Preview for ${file.name}\n`,
        isDirty: false,
      }
      setTabs((prev) => [...prev, fallbackTab])
      setActiveTabId(fallbackTab.id)
      return
    }

    try {
      const result = await window.ajsonAPI.fs.readFile(file.path)
      if (!result.success) {
        showToast(result.error || `Could not read ${file.name}`, 'error')
        return
      }

      const content = result.content ?? ''
      const lang = getLanguageFromPath(file.path)

      const newTab: EditorTab = {
        id: file.path,
        name: file.name,
        path: file.path,
        language: lang,
        content,
        originalContent: content,
        isDirty: false,
      }

      setTabs((prev) => [...prev, newTab])
      setActiveTabId(newTab.id)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast(`Error opening file: ${msg}`, 'error')
    }
  }

  // Open a file from search results and navigate to matching location
  const handleOpenFileAtLocation = async (target: {
    name: string
    path: string
    lineNumber: number
    column: number
    matchLength?: number
  }) => {
    const existing = tabs.find((t) => t.path === target.path)
    if (existing) {
      setActiveTabId(existing.id)
    } else {
      await handleOpenFile({ name: target.name, path: target.path })
    }
    setRevealLocation({
      lineNumber: target.lineNumber,
      column: target.column,
      matchLength: target.matchLength,
      timestamp: Date.now(),
    })
  }

  // Open Single Local File via Native Dialog
  const handleOpenLocalFileDialog = async () => {
    if (!window.ajsonAPI) {
      showToast('Native file dialog is only available in Electron desktop window.', 'error')
      return
    }

    try {
      const result = await window.ajsonAPI.fs.openFileDialog()
      if (!result) return

      const existing = tabs.find((t) => t.path === result.path)
      if (existing) {
        setActiveTabId(existing.id)
        return
      }

      const lang = getLanguageFromPath(result.path)
      const newTab: EditorTab = {
        id: result.path,
        name: result.name,
        path: result.path,
        language: lang,
        content: result.content,
        originalContent: result.content,
        isDirty: false,
      }

      setTabs((prev) => [...prev, newTab])
      setActiveTabId(newTab.id)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast(`Error opening file: ${msg}`, 'error')
    }
  }

  // Update in-memory tab content & accurate unsaved dirty tracking
  const handleContentChange = (newContent: string, targetTabId?: string) => {
    const idToUpdate = targetTabId || activeTab?.id
    if (!idToUpdate) return
    const targetTab = tabs.find((t) => t.id === idToUpdate)
    if (!targetTab) return
    const isNowDirty = newContent !== targetTab.originalContent

    setTabs((prev) =>
      prev.map((t) =>
        t.id === idToUpdate
          ? {
              ...t,
              content: newContent,
              isDirty: isNowDirty,
            }
          : t
      )
    )
  }

  // External change conflict modal state
  const [conflictModal, setConflictModal] = useState<{ tab: EditorTab } | null>(null)

  // Save active tab to disk (with untitled delegation and conflict detection)
  const handleSave = useCallback(async () => {
    if (!activeTab) return

    // Untitled buffer: delegate to Save As
    if (activeTab.path.startsWith('untitled:')) {
      handleSaveAs()
      return
    }

    if (!window.ajsonAPI) {
      // In mock environment
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTab.id ? { ...t, originalContent: t.content, isDirty: false } : t))
      )
      showToast(`Saved ${activeTab.name}`, 'success')
      return
    }

    try {
      const result = await window.ajsonAPI.fs.saveFile(activeTab.path, activeTab.content, {
        expectedLastModified: activeTab.lastSavedMtime,
      })

      if (result.conflict) {
        setConflictModal({ tab: activeTab })
        return
      }

      if (result.success) {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTab.id
              ? {
                  ...t,
                  originalContent: t.content,
                  isDirty: false,
                  lastSavedMtime: result.lastModified,
                  hasExternalChange: false,
                }
              : t
          )
        )
        showToast(`Saved ${activeTab.name}`, 'success')
      } else {
        showToast(result.error || `Failed to save ${activeTab.name}`, 'error')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast(`Save error: ${msg}`, 'error')
    }
  }, [activeTab])

  // Save As with native file dialog
  const handleSaveAs = useCallback(async () => {
    if (!activeTab) return

    if (!window.ajsonAPI) {
      showToast('Save As requires Electron desktop environment.', 'info')
      return
    }

    try {
      const result = await window.ajsonAPI.fs.saveFileAs(
        activeTab.content,
        activeTab.name.replace(/^Untitled-\d+\./, 'new-file.'),
        activeTab.path
      )

      if (result.canceled || !result.path) return

      if (result.success) {
        const newLang = getLanguageFromPath(result.path)
        const updatedTab: EditorTab = {
          id: result.path,
          name: result.name || result.path.split(/[/\\]/).pop() || 'file',
          path: result.path,
          language: newLang,
          content: activeTab.content,
          originalContent: activeTab.content,
          isDirty: false,
          lastSavedMtime: result.lastModified,
          hasExternalChange: false,
        }

        setTabs((prev) => prev.map((t) => (t.id === activeTab.id ? updatedTab : t)))
        setActiveTabId(updatedTab.id)
        if (projectRoot) {
          handleRefreshProject()
        }
        showToast(`Saved as ${updatedTab.name}`, 'success')
      } else {
        showToast(result.error || 'Failed to save file as', 'error')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast(`Save As error: ${msg}`, 'error')
    }
  }, [activeTab, projectRoot])

  // Force overwrite disk with current editor content
  const handleForceSave = async (tabToSave: EditorTab) => {
    if (!window.ajsonAPI) return
    try {
      const res = await window.ajsonAPI.fs.saveFile(tabToSave.path, tabToSave.content, {
        forceOverwrite: true,
      })
      if (res.success) {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tabToSave.id
              ? {
                  ...t,
                  originalContent: tabToSave.content,
                  isDirty: false,
                  lastSavedMtime: res.lastModified,
                  hasExternalChange: false,
                }
              : t
          )
        )
        showToast(`Overwrote disk with current changes for ${tabToSave.name}`, 'success')
      } else {
        showToast(res.error || 'Failed to force save', 'error')
      }
    } catch (err) {
      showToast('Force save failed', 'error')
    } finally {
      setConflictModal(null)
    }
  }

  // Reload file content from disk, discarding in-editor edits
  const handleReloadFromDisk = async (tabToReload: EditorTab) => {
    if (!window.ajsonAPI || tabToReload.path.startsWith('untitled:')) return
    try {
      const res = await window.ajsonAPI.fs.readFile(tabToReload.path)
      if (res.success && res.content !== undefined) {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tabToReload.id
              ? {
                  ...t,
                  content: res.content!,
                  originalContent: res.content!,
                  isDirty: false,
                  lastSavedMtime: res.lastModified,
                  hasExternalChange: false,
                }
              : t
          )
        )
        showToast(`Reloaded ${tabToReload.name} from disk`, 'info')
      } else {
        showToast(res.error || 'Failed to reload file from disk', 'error')
      }
    } catch (err) {
      showToast('Error reloading file from disk', 'error')
    } finally {
      setConflictModal(null)
    }
  }

  // Check for external file modifications when window regains focus
  useEffect(() => {
    const checkExternalModifications = async () => {
      if (!window.ajsonAPI) return

      for (const tab of tabs) {
        if (tab.path.startsWith('untitled:') || !tab.lastSavedMtime) continue
        try {
          const res = await window.ajsonAPI.fs.checkModified(tab.path, tab.lastSavedMtime)
          if (res.exists && res.modified) {
            if (!tab.isDirty) {
              // Safe auto-reload for clean tabs
              const readRes = await window.ajsonAPI.fs.readFile(tab.path)
              if (readRes.success && readRes.content !== undefined) {
                setTabs((prev) =>
                  prev.map((t) =>
                    t.id === tab.id
                      ? {
                          ...t,
                          content: readRes.content!,
                          originalContent: readRes.content!,
                          isDirty: false,
                          lastSavedMtime: readRes.lastModified,
                          hasExternalChange: false,
                        }
                      : t
                  )
                )
                showToast(`Auto-reloaded ${tab.name} (updated externally)`, 'info')
              }
            } else {
              // Preserve user edits and flag external change
              setTabs((prev) =>
                prev.map((t) => (t.id === tab.id ? { ...t, hasExternalChange: true } : t))
              )
            }
          }
        } catch {
          // ignore stat error
        }
      }
    }

    window.addEventListener('focus', checkExternalModifications)
    return () => window.removeEventListener('focus', checkExternalModifications)
  }, [tabs])

  // Close a tab (checks for unsaved changes)
  const handleCloseTab = (tabIdToClose: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const targetTab = tabs.find((t) => t.id === tabIdToClose)
    if (!targetTab) return

    if (targetTab.isDirty) {
      // Prompt user with Save / Don't Save / Cancel modal
      setTabClosePrompt({ tab: targetTab })
      return
    }

    executeCloseTab(tabIdToClose)
  }

  // Close other tabs
  const handleCloseOtherTabs = (currentTabId: string) => {
    const dirtyOther = tabs.find((t) => t.id !== currentTabId && t.isDirty)
    if (dirtyOther) {
      setTabClosePrompt({ tab: dirtyOther })
      return
    }
    setTabs((prev) => prev.filter((t) => t.id === currentTabId))
    setActiveTabId(currentTabId)
  }

  // Close tabs to right
  const handleCloseTabsToRight = (currentTabId: string) => {
    const index = tabs.findIndex((t) => t.id === currentTabId)
    if (index === -1) return
    const tabsToRight = tabs.slice(index + 1)
    const dirtyRight = tabsToRight.find((t) => t.isDirty)
    if (dirtyRight) {
      setTabClosePrompt({ tab: dirtyRight })
      return
    }
    setTabs((prev) => prev.slice(0, index + 1))
  }

  // Close all tabs
  const handleCloseAllTabs = () => {
    const dirty = tabs.find((t) => t.isDirty)
    if (dirty) {
      setTabClosePrompt({ tab: dirty })
      return
    }
    setTabs([])
    setActiveTabId('')
  }

  // Finalize tab closure
  const executeCloseTab = (tabIdToClose: string) => {
    const index = tabs.findIndex((t) => t.id === tabIdToClose)
    if (index === -1) return

    const remaining = tabs.filter((t) => t.id !== tabIdToClose)
    setTabs(remaining)

    if (secondaryTabId === tabIdToClose) {
      setSecondaryTabId(null)
    }

    if (activeTabId === tabIdToClose) {
      if (remaining.length > 0) {
        const nextIndex = Math.min(index, remaining.length - 1)
        setActiveTabId(remaining[nextIndex].id)
      } else {
        setActiveTabId('')
      }
    }
  }

  // Save prompt confirmation: Save
  const handlePromptSaveAndClose = async () => {
    if (!tabClosePrompt) return
    const tab = tabClosePrompt.tab

    if (tab.path.startsWith('untitled:')) {
      if (window.ajsonAPI) {
        const res = await window.ajsonAPI.fs.saveFileAs(tab.content, tab.name, tab.path)
        if (!res.success || res.canceled) {
          return // User canceled saving, do not close tab
        }
      }
    } else if (window.ajsonAPI) {
      try {
        const res = await window.ajsonAPI.fs.saveFile(tab.path, tab.content, { forceOverwrite: true })
        if (!res.success) {
          showToast(res.error || 'Failed to save before closing', 'error')
          return
        }
      } catch (err) {
        showToast('Save failed before closing tab', 'error')
        return
      }
    }

    executeCloseTab(tab.id)
    setTabClosePrompt(null)
  }

  // Save prompt confirmation: Discard (Don't Save)
  const handlePromptDiscardAndClose = () => {
    if (!tabClosePrompt) return
    executeCloseTab(tabClosePrompt.tab.id)
    setTabClosePrompt(null)
  }

  // Save prompt confirmation: Cancel
  const handlePromptCancel = () => {
    setTabClosePrompt(null)
  }

  // Create new untitled scratchpad
  const handleNewTab = () => {
    const newTabNum = tabs.length + 1
    const untitledId = `untitled:${Date.now()}`
    const newTab: EditorTab = {
      id: untitledId,
      name: `Untitled-${newTabNum}.ts`,
      path: untitledId,
      language: 'typescript',
      content: `// Ajson Studio - Untitled Document ${newTabNum}\n`,
      originalContent: `// Ajson Studio - Untitled Document ${newTabNum}\n`,
      isDirty: false,
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
  }

  // Next and Previous tab cycling
  const handleNextTab = useCallback(() => {
    if (tabs.length <= 1) return
    const idx = tabs.findIndex((t) => t.id === activeTabId)
    const nextIdx = (idx + 1) % tabs.length
    setActiveTabId(tabs[nextIdx].id)
  }, [tabs, activeTabId])

  const handlePrevTab = useCallback(() => {
    if (tabs.length <= 1) return
    const idx = tabs.findIndex((t) => t.id === activeTabId)
    const prevIdx = (idx - 1 + tabs.length) % tabs.length
    setActiveTabId(tabs[prevIdx].id)
  }, [tabs, activeTabId])

  // Rename synchronization from Explorer
  const handleItemRenamed = (oldPath: string, newPath: string, newName: string) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.path === oldPath) {
          return {
            ...t,
            id: newPath,
            path: newPath,
            name: newName,
            language: getLanguageFromPath(newPath),
          }
        }
        return t
      })
    )
    if (activeTabId === oldPath) {
      setActiveTabId(newPath)
    }
    showToast(`Renamed to ${newName}`, 'success')
  }

  // Delete synchronization from Explorer
  const onItemDeleted = (deletedPath: string) => {
    // If deleted item matches an open tab or is a parent directory of it, close affected tabs
    const affectedTabs = tabs.filter(
      (t) => t.path === deletedPath || t.path.startsWith(deletedPath + '/') || t.path.startsWith(deletedPath + '\\')
    )
    affectedTabs.forEach((t) => executeCloseTab(t.id))
    showToast('Deleted item removed from workspace', 'info')
  }

  // Toggle activity view
  const handleSelectActivityView = (view: ActivityView) => {
    if (activeActivityView === view && sidebarOpen) {
      setSidebarOpen(false)
    } else {
      setActiveActivityView(view)
      setSidebarOpen(true)
    }
  }

  // Registered Application Commands
  const commandList = useMemo<CommandItem[]>(() => {
    return [
      {
        id: 'open-folder',
        title: 'File: Open Folder',
        category: 'File',
        shortcut: 'Ctrl+O',
        action: handleOpenFolderDialog,
      },
      {
        id: 'open-file',
        title: 'File: Open File',
        category: 'File',
        shortcut: 'Ctrl+P',
        action: handleOpenLocalFileDialog,
      },
      {
        id: 'new-scratchpad',
        title: 'File: New Scratchpad',
        category: 'File',
        shortcut: 'Ctrl+N',
        action: handleNewTab,
      },
      {
        id: 'save-file',
        title: 'File: Save',
        category: 'File',
        shortcut: 'Ctrl+S',
        action: () => {
          if (activeTab?.path.startsWith('untitled:')) {
            handleSaveAs()
          } else {
            handleSave()
          }
        },
      },
      {
        id: 'save-file-as',
        title: 'File: Save As...',
        category: 'File',
        shortcut: 'Ctrl+Shift+S',
        action: handleSaveAs,
      },
      {
        id: 'close-active-tab',
        title: 'View: Close Active Tab',
        category: 'View',
        shortcut: 'Ctrl+W',
        action: () => {
          if (activeTabId) handleCloseTab(activeTabId)
        },
      },
      {
        id: 'find-in-file',
        title: 'Editor: Find in Current File',
        category: 'Editor',
        shortcut: 'Ctrl+F',
        action: () => {
          monacoEditorRef.current?.triggerFind()
        },
      },
      {
        id: 'replace-in-file',
        title: 'Editor: Replace in Current File',
        category: 'Editor',
        shortcut: 'Ctrl+H',
        action: () => {
          monacoEditorRef.current?.triggerReplace()
        },
      },
      {
        id: 'search-in-project',
        title: 'View: Search in Project',
        category: 'View',
        shortcut: 'Ctrl+Shift+F',
        action: () => {
          setActiveActivityView('search')
          setSidebarOpen(true)
        },
      },
      {
        id: 'toggle-explorer',
        title: 'View: Toggle Explorer',
        category: 'View',
        shortcut: 'Ctrl+B',
        action: () => {
          if (activeActivityView === 'explorer') {
            setSidebarOpen((prev) => !prev)
          } else {
            setActiveActivityView('explorer')
            setSidebarOpen(true)
          }
        },
      },
      {
        id: 'toggle-bottom-panel',
        title: 'View: Toggle Bottom Panel',
        category: 'View',
        shortcut: 'Ctrl+J',
        action: () => {
          setBottomPanelOpen((prev) => !prev)
        },
      },
      {
        id: 'next-tab',
        title: 'Navigation: Switch to Next Tab',
        category: 'Navigation',
        shortcut: 'Ctrl+Tab',
        action: handleNextTab,
      },
      {
        id: 'prev-tab',
        title: 'Navigation: Switch to Previous Tab',
        category: 'Navigation',
        shortcut: 'Ctrl+Shift+Tab',
        action: handlePrevTab,
      },
      {
        id: 'refresh-explorer',
        title: 'Explorer: Refresh Workspace',
        category: 'Explorer',
        shortcut: 'F5',
        action: handleRefreshProject,
      },
      {
        id: 'clear-recent-projects',
        title: 'Workspace: Clear Recent Projects',
        category: 'Workspace',
        action: handleClearRecentProjects,
        description: 'Remove all project folders from recent projects history',
      },
    ]
  }, [
    handleOpenFolderDialog,
    handleOpenLocalFileDialog,
    handleNewTab,
    activeTab,
    activeTabId,
    handleSave,
    handleSaveAs,
    handleCloseTab,
    activeActivityView,
    handleNextTab,
    handlePrevTab,
    handleRefreshProject,
    handleClearRecentProjects,
  ])

  // Keyboard shortcuts (Ctrl+Shift+P, Ctrl+P, Ctrl+S, Ctrl+Shift+S, Ctrl+W, Ctrl+B, Ctrl+O, Ctrl+N, Ctrl+Shift+F, Ctrl+J, Ctrl+Tab)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey

      // Ctrl+Shift+P: Command Palette
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setIsCommandPaletteOpen((prev) => !prev)
        return
      }

      // Ctrl+P: Open File Dialog
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        handleOpenLocalFileDialog()
        return
      }

      // Ctrl+Shift+F: Project Search
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setActiveActivityView('search')
        setSidebarOpen(true)
        return
      }

      // Ctrl+J: Toggle Bottom Panel
      if (isCmdOrCtrl && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        setBottomPanelOpen((prev) => !prev)
        return
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (e.shiftKey) {
          handleSaveAs()
        } else {
          handleSave()
        }
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'w') {
        e.preventDefault()
        if (activeTabId) {
          handleCloseTab(activeTabId)
        }
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setSidebarOpen((prev) => !prev)
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        handleOpenFolderDialog()
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        handleNewTab()
      } else if (isCmdOrCtrl && e.key === 'Tab') {
        e.preventDefault()
        if (e.shiftKey) {
          handlePrevTab()
        } else {
          handleNextTab()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    handleSave,
    handleSaveAs,
    activeTabId,
    handleNextTab,
    handlePrevTab,
    handleOpenLocalFileDialog,
    handleOpenFolderDialog,
    handleNewTab,
  ])

  return (
    <>
      <IdeLayout
        sidebarOpen={sidebarOpen}
        sidebarWidth={sidebarWidth}
        onSidebarWidthChange={setSidebarWidth}
        bottomPanelOpen={bottomPanelOpen}
        bottomPanelHeight={bottomPanelHeight}
        onBottomPanelHeightChange={setBottomPanelHeight}
        aiPanelOpen={aiPanelOpen}
        aiPanelWidth={aiPanelWidth}
        onAiPanelWidthChange={setAiPanelWidth}
        header={
          <Header
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
            bottomPanelOpen={bottomPanelOpen}
            onToggleBottomPanel={() => setBottomPanelOpen((prev) => !prev)}
            aiPanelOpen={aiPanelOpen}
            onToggleAiPanel={() => setAiPanelOpen((prev) => !prev)}
            activeFileName={activeTab?.name}
            projectName={projectRoot?.name || 'ajson-studio'}
            onCloseWindow={handleCloseWindow}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onRunProject={() => {
              showToast('Running verification test suite (96 tests)...', 'success')
              setActiveBottomTab('tests')
              setBottomPanelOpen(true)
            }}
            onOpenSettings={() => setIsModelSettingsOpen(true)}
            onOpenModelSettings={() => setIsModelSettingsOpen(true)}
            onOpenAiCodeGen={() => setIsAiCodeGenOpen(true)}
            onOpenDiffReview={() => setIsDiffReviewOpen(true)}
            onOpenCodeExplain={() => setIsCodeExplainOpen(true)}
            onOpenMultiFileEdits={() => setIsMultiFileEditsOpen(true)}
            activeStateView={activeStateView}
            onSelectStateView={setActiveStateView}
          />
        }
        activityBar={
          <ActivityBar
            activeView={activeActivityView}
            onSelectView={handleSelectActivityView}
            aiPanelOpen={aiPanelOpen}
            onToggleAiPanel={() => setAiPanelOpen((prev) => !prev)}
            onOpenSettings={() => setIsModelSettingsOpen(true)}
          />
        }
        sidebar={
          <Sidebar
            width={sidebarWidth}
            activeView={activeActivityView}
            onOpenFile={handleOpenFile}
            onOpenLocalFileDialog={handleOpenLocalFileDialog}
            activeFilePath={activeTab?.path}
            projectRoot={projectRoot}
            tree={tree}
            isLoadingTree={isLoadingTree}
            treeError={treeError}
            onOpenFolderDialog={handleOpenFolderDialog}
            onRefreshProject={handleRefreshProject}
            onFileCreated={(p) => handleOpenFile({ name: p.split(/[/\\]/).pop() || '', path: p })}
            onItemRenamed={handleItemRenamed}
            onItemDeleted={onItemDeleted}
            recentProjects={recentProjects}
            onOpenRecentProject={handleOpenRecentProject}
            onRemoveRecentProject={handleRemoveRecentProject}
            unsavedBuffers={unsavedBuffers}
            onOpenFileAtLocation={handleOpenFileAtLocation}
          />
        }
        editorTabs={
          <EditorTabs
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={setActiveTabId}
            onCloseTab={handleCloseTab}
            onCloseOtherTabs={handleCloseOtherTabs}
            onCloseTabsToRight={handleCloseTabsToRight}
            onCloseAllTabs={handleCloseAllTabs}
            onSaveTab={(tabId) => {
              const target = tabs.find((t) => t.id === tabId)
              if (target) {
                if (target.path.startsWith('untitled:')) {
                  handleSaveAs()
                } else {
                  handleSave()
                }
              }
            }}
            onSaveTabAs={() => handleSaveAs()}
            onNewTab={handleNewTab}
            onOpenCodeExplain={() => setIsCodeExplainOpen(true)}
            onOpenDiffReview={() => setIsDiffReviewOpen(true)}
            onOpenAiCodeGen={() => setIsAiCodeGenOpen(true)}
            isSplitView={isSplitView}
            onToggleSplitView={() => setIsSplitView((prev) => !prev)}
          />
        }
        editor={
          activeTab ? (
            <div className="w-full h-full flex flex-col overflow-hidden">
              {activeTab.hasExternalChange && (
                <div className="bg-amber-950/70 border-b border-amber-600/50 px-3 py-1.5 flex items-center justify-between text-amber-200 text-xs shrink-0 select-none">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      <strong>External Change:</strong> The file <code className="font-mono text-white bg-amber-900/50 px-1 py-0.5 rounded">{activeTab.name}</code> has been modified on disk by another program. Your unsaved edits are preserved.
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleReloadFromDisk(activeTab)}
                      className="px-2.5 py-1 rounded bg-amber-900/80 hover:bg-amber-800 text-amber-100 text-[11px] font-medium transition-colors"
                    >
                      Reload from Disk
                    </button>
                    <button
                      onClick={() => handleForceSave(activeTab)}
                      className="px-2.5 py-1 rounded bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-medium shadow transition-colors"
                    >
                      Overwrite Disk
                    </button>
                  </div>
                </div>
              )}
              {isSplitView && secondaryTab && secondaryTab.id !== activeTab.id ? (
                <div className="flex-1 min-h-0 flex flex-row overflow-hidden divide-x divide-[#1f212a]">
                  {/* Left Pane (Primary Active Tab) */}
                  <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                    <div className="h-7 px-3 bg-[#131419] border-b border-[#1f212a] flex items-center justify-between text-xs text-slate-300 select-none shrink-0 font-mono">
                      <div className="flex items-center space-x-1.5 min-w-0 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                        <span className="truncate text-slate-200 font-medium text-[11.5px]">{activeTab.name}</span>
                        <span className="text-slate-500 text-[10px]">({activeTab.language})</span>
                      </div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-sans">Primary</span>
                    </div>
                    <div className="flex-1 min-h-0">
                      <MonacoEditor
                        ref={monacoEditorRef}
                        key={activeTab.id}
                        value={activeTab.content}
                        language={activeTab.language}
                        path={activeTab.path}
                        onChange={(val) => handleContentChange(val, activeTab.id)}
                        onCursorChange={setCursorPosition}
                        onSelectionChange={(sel) => {
                          if (!sel || !activeTab) {
                            setEditorSelection(null)
                          } else {
                            setEditorSelection({
                              text: sel.text,
                              startLine: sel.startLine,
                              endLine: sel.endLine,
                              startCol: sel.startCol,
                              endCol: sel.endCol,
                              language: activeTab.language,
                              filePath: activeTab.path || activeTab.name,
                            })
                          }
                        }}
                        revealLocation={revealLocation}
                      />
                    </div>
                  </div>

                  {/* Right Pane (Secondary Tab) */}
                  <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                    <div className="h-7 px-2.5 bg-[#131419] border-b border-[#1f212a] flex items-center justify-between text-xs text-slate-300 select-none shrink-0 font-mono">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <select
                          value={secondaryTab.id}
                          onChange={(e) => setSecondaryTabId(e.target.value)}
                          className="bg-[#171822] border border-[#252837] text-slate-200 text-[11px] px-2 py-0.5 rounded focus:outline-none cursor-pointer max-w-[200px] truncate"
                        >
                          {tabs.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <span className="text-slate-500 text-[10px]">({secondaryTab.language})</span>
                      </div>
                      <button
                        onClick={() => setIsSplitView(false)}
                        title="Close Split Editor"
                        className="p-1 text-slate-400 hover:text-slate-200 hover:bg-[#1f212d] rounded transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex-1 min-h-0">
                      <MonacoEditor
                        key={`secondary-${secondaryTab.id}`}
                        value={secondaryTab.content}
                        language={secondaryTab.language}
                        path={secondaryTab.path}
                        onChange={(val) => handleContentChange(val, secondaryTab.id)}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0">
                  <MonacoEditor
                    ref={monacoEditorRef}
                    key={activeTab.id}
                    value={activeTab.content}
                    language={activeTab.language}
                    path={activeTab.path}
                    onChange={(val) => handleContentChange(val, activeTab.id)}
                    onCursorChange={setCursorPosition}
                    onSelectionChange={(sel) => {
                      if (!sel || !activeTab) {
                        setEditorSelection(null)
                      } else {
                        setEditorSelection({
                          text: sel.text,
                          startLine: sel.startLine,
                          endLine: sel.endLine,
                          startCol: sel.startCol,
                          endCol: sel.endCol,
                          language: activeTab.language,
                          filePath: activeTab.path || activeTab.name,
                        })
                      }
                    }}
                    revealLocation={revealLocation}
                  />
                </div>
              )}
            </div>
          ) : (
            /* Cursor-style Empty State */
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d0e12] text-slate-400 font-sans text-xs select-none p-6">
              {/* Subtle logo */}
              <div className="w-14 h-14 rounded-2xl bg-[#14151e] border border-[#232635] flex items-center justify-center text-violet-400 shadow-xl mb-4">
                <Sparkles className="w-7 h-7" />
              </div>

              <div className="text-center space-y-1 mb-6">
                <h2 className="text-slate-100 text-base font-semibold tracking-wide flex items-center justify-center space-x-2">
                  <span>Ajson Studio</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-950/60 text-violet-300 border border-violet-800/40 font-mono">v1.0</span>
                </h2>
                <p className="text-slate-500 text-xs">
                  {projectRoot ? projectRoot.name : 'AI-Native Desktop Development Environment'}
                </p>
              </div>

              {/* Fast Action Shortcuts Card */}
              <div className="w-80 max-w-full bg-[#13141a] border border-[#1f212a] rounded-xl p-3 shadow-lg space-y-2 mb-4">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1">
                  Quick Actions
                </div>
                <button
                  onClick={handleOpenFolderDialog}
                  className="w-full px-2.5 py-1.5 bg-[#171822] hover:bg-[#1d1f2c] border border-[#232635] hover:border-violet-500/40 rounded-lg flex items-center justify-between text-slate-200 transition-colors"
                >
                  <span className="flex items-center space-x-2">
                    <FolderOpen className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-[11.5px]">Open Folder</span>
                  </span>
                  <kbd className="text-[10px] bg-[#111218] border border-[#232635] px-1.5 py-0.5 rounded text-slate-400 font-mono">⌘O</kbd>
                </button>
                <button
                  onClick={() => setIsCommandPaletteOpen(true)}
                  className="w-full px-2.5 py-1.5 bg-[#171822] hover:bg-[#1d1f2c] border border-[#232635] hover:border-violet-500/40 rounded-lg flex items-center justify-between text-slate-200 transition-colors"
                >
                  <span className="flex items-center space-x-2">
                    <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[11.5px]">Quick Open & Commands</span>
                  </span>
                  <kbd className="text-[10px] bg-[#111218] border border-[#232635] px-1.5 py-0.5 rounded text-slate-400 font-mono">⌘P</kbd>
                </button>
                <button
                  onClick={handleNewTab}
                  className="w-full px-2.5 py-1.5 bg-[#171822] hover:bg-[#1d1f2c] border border-[#232635] hover:border-violet-500/40 rounded-lg flex items-center justify-between text-slate-200 transition-colors"
                >
                  <span className="flex items-center space-x-2">
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[11.5px]">New Scratchpad</span>
                  </span>
                  <kbd className="text-[10px] bg-[#111218] border border-[#232635] px-1.5 py-0.5 rounded text-slate-400 font-mono">⌘N</kbd>
                </button>
              </div>

              {/* Keyboard Shortcuts Reference */}
              <div className="w-80 max-w-full text-[11px] text-slate-400 space-y-1.5 px-2">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">AI Composer / Inline Edit</span>
                  <kbd className="font-mono text-[10px] bg-[#14151d] border border-[#232635] px-1.5 py-0.5 rounded text-slate-300">⌘K</kbd>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">Toggle AI Chat</span>
                  <kbd className="font-mono text-[10px] bg-[#14151d] border border-[#232635] px-1.5 py-0.5 rounded text-slate-300">⌘L</kbd>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">Toggle Primary Sidebar</span>
                  <kbd className="font-mono text-[10px] bg-[#14151d] border border-[#232635] px-1.5 py-0.5 rounded text-slate-300">⌘B</kbd>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">Toggle Terminal Panel</span>
                  <kbd className="font-mono text-[10px] bg-[#14151d] border border-[#232635] px-1.5 py-0.5 rounded text-slate-300">⌘J</kbd>
                </div>
              </div>

              {/* Recent Projects Section */}
              {recentProjects.length > 0 && (
                <div className="w-80 max-w-full pt-3 border-t border-[#1f212a] mt-4 space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Recent Projects
                    </span>
                    <button
                      onClick={handleClearRecentProjects}
                      className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors"
                      title="Clear recent projects"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                    {recentProjects.map((proj) => (
                      <div
                        key={proj.path}
                        onClick={() => handleOpenRecentProject(proj.path)}
                        className={`group px-2.5 py-1.5 rounded-lg bg-[#14151c] hover:bg-[#1a1c26] border border-[#1f222d] hover:border-violet-500/30 flex items-center justify-between cursor-pointer transition-all ${
                          proj.exists === false ? 'opacity-65' : ''
                        }`}
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <FolderOpen
                            className={`w-3.5 h-3.5 shrink-0 ${
                              proj.exists === false ? 'text-amber-500' : 'text-violet-400'
                            }`}
                          />
                          <div className="min-w-0 flex flex-col text-left">
                            <span className="text-slate-200 text-xs font-medium truncate group-hover:text-violet-300">
                              {proj.name}
                            </span>
                            <span className="text-slate-500 text-[10px] truncate max-w-[190px] font-mono">
                              {proj.path}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1.5 shrink-0">
                          {proj.exists === false && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-amber-950/70 text-amber-400 border border-amber-900 rounded font-sans">
                              Missing
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveRecentProject(proj.path)
                            }}
                            title="Remove from recents"
                            className="p-1 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        }
        bottomPanel={
          <BottomPanel
            activeTab={activeBottomTab}
            onSelectTab={setActiveBottomTab}
            onClose={() => setBottomPanelOpen(false)}
            height={bottomPanelHeight}
            onHeightChange={setBottomPanelHeight}
          />
        }
        aiPanel={
          <AiPanel
            isOpen={aiPanelOpen}
            onClose={() => setAiPanelOpen(false)}
            activeFilePath={activeTab?.path || activeTab?.name || null}
            activeFileLanguage={activeTab?.language}
            activeFileContent={activeTab?.content}
            editorSelection={editorSelection}
            onInsertCode={(code) => {
              monacoEditorRef.current?.insertText(code)
              showToast('Code inserted at cursor', 'success')
            }}
            onOpenDiffReview={() => setIsDiffReviewOpen(true)}
            onOpenCodeExplain={() => setIsCodeExplainOpen(true)}
            onOpenModelSettings={() => setIsModelSettingsOpen(true)}
          />
        }
        statusBar={
          <StatusBar
            cursorPosition={cursorPosition}
            language={activeTab?.language || 'plaintext'}
            aiPanelOpen={aiPanelOpen}
            onToggleAiPanel={() => setAiPanelOpen((prev) => !prev)}
            onOpenModelSettings={() => setIsModelSettingsOpen(true)}
          />
        }
      />

      {/* External Modification Conflict Modal */}
      {conflictModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-amber-600/40 rounded-lg p-4 max-w-md w-full shadow-2xl space-y-3">
            <div className="flex items-center space-x-2 text-amber-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="font-semibold text-slate-100 text-sm">
                External Modification Conflict
              </h3>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              The file{' '}
              <strong className="text-white font-mono bg-[#1c2234] px-1 py-0.5 rounded">
                {conflictModal.tab.name}
              </strong>{' '}
              has been modified on disk by another program.
              <span className="block text-slate-400 text-[11px] mt-1.5">
                Overwriting will replace disk contents with your current editor content. Reloading will discard your unsaved changes and load the disk version.
              </span>
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setConflictModal(null)}
                className="px-3 py-1.5 rounded bg-[#1c2336] hover:bg-[#252f48] text-slate-300 hover:text-white text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReloadFromDisk(conflictModal.tab)}
                className="px-3 py-1.5 rounded bg-amber-900/60 hover:bg-amber-800 text-amber-200 text-xs transition-colors"
              >
                Reload from Disk
              </button>
              <button
                onClick={() => handleForceSave(conflictModal.tab)}
                className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow transition-colors"
              >
                Overwrite Disk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Confirmation Modal */}
      {tabClosePrompt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-[#263048] rounded-lg p-4 max-w-sm w-full shadow-2xl space-y-3">
            <div className="flex items-center space-x-2 text-amber-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="font-semibold text-slate-100 text-sm">
                Unsaved Changes
              </h3>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              Do you want to save the changes you made to{' '}
              <strong className="text-cyan-300 font-mono bg-[#1c2234] px-1 py-0.5 rounded">
                {tabClosePrompt.tab.name}
              </strong>
              ?
              <span className="block text-slate-400 text-[11px] mt-1">
                Your changes will be lost if you close without saving.
              </span>
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={handlePromptCancel}
                className="px-3 py-1.5 rounded bg-[#1c2336] hover:bg-[#252f48] text-slate-300 hover:text-white text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePromptDiscardAndClose}
                className="px-3 py-1.5 rounded bg-[#2a1b24] hover:bg-[#3d2432] text-rose-300 hover:text-rose-100 text-xs transition-colors border border-rose-900/60"
              >
                Don't Save
              </button>
              <button
                onClick={handlePromptSaveAndClose}
                className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition-colors shadow"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={commandList}
      />

      {/* Side-by-Side Diff Review Modal */}
      <DiffReviewModal
        isOpen={isDiffReviewOpen}
        onClose={() => setIsDiffReviewOpen(false)}
        fileName={activeTab?.path || 'src/ai/AgentCoordinator.ts'}
        onApplyChanges={() => showToast('Diff changes applied to AgentCoordinator.ts', 'success')}
      />

      {/* AI Code Generation Inline Overlay */}
      <AiCodeGenOverlay
        isOpen={isAiCodeGenOpen}
        onClose={() => setIsAiCodeGenOpen(false)}
        onAccept={(code) => {
          monacoEditorRef.current?.insertText(code)
          showToast('Generated code inserted into buffer', 'success')
        }}
      />

      {/* Code Explanation Modal */}
      <CodeExplanationModal
        isOpen={isCodeExplainOpen}
        onClose={() => setIsCodeExplainOpen(false)}
        symbolName="generatePatchStream()"
        filePath={activeTab?.path || 'src/ai/AgentCoordinator.ts'}
      />

      {/* Multi-File Edits (Composer) Modal */}
      <MultiFileEditsModal
        isOpen={isMultiFileEditsOpen}
        onClose={() => setIsMultiFileEditsOpen(false)}
        onApplyAll={() => showToast('Batch applied changes across 3 files', 'success')}
      />

      {/* Model & AI Provider Settings Modal */}
      <ModelSettingsModal
        isOpen={isModelSettingsOpen}
        onClose={() => setIsModelSettingsOpen(false)}
        onSave={() => showToast('Model provider settings updated', 'success')}
      />

      {/* Global Notification Toast */}
      {toast && (
        <div className="fixed bottom-8 right-6 z-50 flex items-center space-x-2 py-2 px-3.5 rounded-lg shadow-2xl border text-xs select-none animate-in fade-in slide-in-from-bottom-2 bg-[#10141f] border-[#222a40] text-slate-200">
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          {toast.type === 'info' && <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0" />}
          <span className="text-[11.5px]">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-slate-500 hover:text-slate-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  )
}
