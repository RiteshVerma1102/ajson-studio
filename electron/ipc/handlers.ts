import { ipcMain, BrowserWindow, dialog, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import {
  WorkspaceStateDTO,
  loadWorkspaceState,
  saveWorkspaceState,
  addRecentProject,
  removeRecentProject,
  checkRecentProjectsExistence,
  filterValidTabsToRestore,
} from './workspaceState'

function getWorkspaceStoragePath(): string {
  try {
    return path.join(app.getPath('userData'), 'workspace-state.json')
  } catch {
    return path.join(process.cwd(), 'workspace-state.json')
  }
}

// Structure representing nodes in the project file explorer
export interface FileNodeDTO {
  id: string
  name: string
  path: string
  isDirectory: boolean
  extension?: string
  children?: FileNodeDTO[]
  size?: number
  lastModified?: number
}

// Global active project root tracked by the main process
let activeProjectRoot: string | null = null

// Directories to ignore by default for performance and clean view
const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'dist-electron',
  'build',
  'out',
  '.vscode',
  '.idea',
  '.cache',
  '.next',
  '.nuxt',
  'coverage',
])

// Common binary extensions that should not be loaded directly into Monaco
const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'tiff',
  'zip', 'tar', 'gz', '7z', 'rar', 'bz2',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'exe', 'dll', 'so', 'dylib', 'bin', 'iso', 'node', 'wasm',
  'mp3', 'wav', 'ogg', 'flac', 'aac',
  'mp4', 'mkv', 'avi', 'mov', 'webm',
  'ttf', 'otf', 'woff', 'woff2', 'eot',
  'class', 'pyc', 'pyo', 'obj', 'o',
])

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB text file size threshold

/**
 * Normalizes a path and resolves it to an absolute path with native separators.
 */
function normalizePath(p: string): string {
  return path.normalize(path.resolve(p))
}

/**
 * Validates that targetPath is strictly inside allowedRoot to prevent path traversal attacks.
 * Also verifies that symbolic links do not resolve outside allowedRoot.
 */
function isPathInsideRoot(targetPath: string, allowedRoot: string): boolean {
  const normTarget = normalizePath(targetPath)
  const normRoot = normalizePath(allowedRoot)

  // Target must be equal to root or start with root + path.sep
  if (normTarget !== normRoot && !normTarget.startsWith(normRoot + path.sep)) {
    return false
  }

  // If target exists, inspect realpath to prevent symlink traversal breakouts
  try {
    if (fs.existsSync(normTarget)) {
      const realTarget = fs.realpathSync(normTarget)
      const realRoot = fs.realpathSync(normRoot)
      if (realTarget !== realRoot && !realTarget.startsWith(realRoot + path.sep)) {
        return false
      }
    }
  } catch {
    // If realpath fails (e.g. path doesn't exist yet for creation), rely on normalized check
  }

  return true
}

/**
 * Checks whether a filename contains invalid filesystem characters.
 */
function isValidFileName(name: string): boolean {
  if (!name || name.trim() === '') return false
  // Disallow path separators, null bytes and Windows illegal characters
  const illegalRe = /[<>:"/\\|?*\x00-\x1F]/
  return !illegalRe.test(name)
}

/**
 * Checks if a buffer contains binary data by sniffing the first 512 bytes for null characters.
 */
function isBinaryContent(buffer: Buffer): boolean {
  const checkLength = Math.min(buffer.length, 512)
  for (let i = 0; i < checkLength; i++) {
    if (buffer[i] === 0) return true
  }
  return false
}

/**
 * Reads a directory recursively to build a FileNodeDTO tree.
 */
async function buildDirectoryTree(
  dirPath: string,
  rootPath: string,
  maxDepth = 10,
  currentDepth = 0
): Promise<FileNodeDTO[]> {
  if (currentDepth > maxDepth) return []

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    const nodes: FileNodeDTO[] = []

    // Sort entries: directories first, then alphabetical
    const sortedEntries = entries.sort((a, b) => {
      if (a.isDirectory() === b.isDirectory()) {
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      }
      return a.isDirectory() ? -1 : 1
    })

    for (const entry of sortedEntries) {
      if (entry.isDirectory() && DEFAULT_IGNORED_DIRS.has(entry.name)) {
        continue
      }

      const fullPath = path.join(dirPath, entry.name)

      // Guard against symbolic links escaping the root
      if (!isPathInsideRoot(fullPath, rootPath)) {
        continue
      }

      if (entry.isDirectory()) {
        const children = await buildDirectoryTree(fullPath, rootPath, maxDepth, currentDepth + 1)
        nodes.push({
          id: fullPath,
          name: entry.name,
          path: fullPath,
          isDirectory: true,
          children,
        })
      } else {
        const ext = path.extname(entry.name).replace('.', '').toLowerCase()
        nodes.push({
          id: fullPath,
          name: entry.name,
          path: fullPath,
          isDirectory: false,
          extension: ext,
        })
      }
    }

    return nodes
  } catch (err) {
    console.warn(`Could not read directory ${dirPath}:`, err)
    return []
  }
}

export interface SearchMatchDTO {
  lineNumber: number
  column: number
  lineContent: string
  matchLength: number
}

export interface SearchFileResultDTO {
  filePath: string
  fileName: string
  relativePath: string
  matches: SearchMatchDTO[]
}

export interface ProjectSearchResultDTO {
  success: boolean
  query: string
  results: SearchFileResultDTO[]
  totalMatches: number
  totalFiles: number
  truncated?: boolean
  error?: string
}

export interface SearchOptionsDTO {
  caseSensitive?: boolean
  wholeWord?: boolean
  isRegex?: boolean
  maxMatches?: number
  unsavedBuffers?: Array<{ path: string; content: string }>
}

/**
 * Recursively collects candidate text file paths in the workspace.
 */
async function collectSearchableFiles(
  dirPath: string,
  rootPath: string,
  fileList: string[],
  maxFiles = 3000,
  maxDepth = 15,
  currentDepth = 0
): Promise<void> {
  if (currentDepth > maxDepth || fileList.length >= maxFiles) return

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (fileList.length >= maxFiles) break

      if (entry.isDirectory()) {
        if (DEFAULT_IGNORED_DIRS.has(entry.name)) continue
        const subDir = path.join(dirPath, entry.name)
        if (!isPathInsideRoot(subDir, rootPath)) continue
        await collectSearchableFiles(subDir, rootPath, fileList, maxFiles, maxDepth, currentDepth + 1)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).replace('.', '').toLowerCase()
        if (BINARY_EXTENSIONS.has(ext)) continue
        const fullPath = path.join(dirPath, entry.name)
        if (!isPathInsideRoot(fullPath, rootPath)) continue
        fileList.push(fullPath)
      }
    }
  } catch {
    // Ignore inaccessible directories
  }
}

/**
 * Searches text content line-by-line for matches against query string or regex.
 */
function searchContentLines(
  content: string,
  query: string,
  caseSensitive: boolean,
  wholeWord: boolean,
  isRegex: boolean,
  remainingQuota: number
): { matches: SearchMatchDTO[]; reachedQuota: boolean } {
  const matches: SearchMatchDTO[] = []
  if (!query || remainingQuota <= 0) return { matches, reachedQuota: false }

  let regex: RegExp
  try {
    let pattern = query
    if (!isRegex) {
      pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
    if (wholeWord) {
      pattern = `\\b${pattern}\\b`
    }
    const flags = caseSensitive ? 'g' : 'gi'
    regex = new RegExp(pattern, flags)
  } catch {
    return { matches, reachedQuota: false }
  }

  const lines = content.split(/\r?\n/)
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]
    regex.lastIndex = 0

    let match: RegExpExecArray | null
    while ((match = regex.exec(line)) !== null) {
      const matchLen = Math.max(match[0].length, 1)

      matches.push({
        lineNumber: lineIdx + 1,
        column: match.index + 1,
        lineContent: line.length > 300 ? line.slice(0, 300) : line,
        matchLength: matchLen,
      })

      if (matches.length >= remainingQuota) {
        return { matches, reachedQuota: true }
      }

      if (match[0].length === 0) {
        regex.lastIndex++
      }
    }
  }

  return { matches, reachedQuota: false }
}

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // Window management IPC
  ipcMain.handle('window:minimize', () => {
    mainWindow.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
      return false
    } else {
      mainWindow.maximize()
      return true
    }
  })

  ipcMain.handle('window:close', () => {
    mainWindow.close()
  })

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow.isMaximized()
  })

  // App & Environment metadata
  ipcMain.handle('app:getInfo', () => {
    return {
      appName: 'Ajson Studio',
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.versions.node,
      chromeVersion: process.versions.chrome,
      electronVersion: process.versions.electron,
    }
  })

  // ===========================================================================
  // PROJECT FOLDER IPC (Day 2)
  // ===========================================================================

  // Open directory selection dialog and load project
  ipcMain.handle('project:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open Project Folder — Ajson Studio',
      properties: ['openDirectory', 'createDirectory'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const selectedPath = normalizePath(result.filePaths[0])
    activeProjectRoot = selectedPath
    const projectName = path.basename(selectedPath) || selectedPath

    // Automatically record to recent projects and persist state
    try {
      const storagePath = getWorkspaceStoragePath()
      const currentState = await loadWorkspaceState(storagePath)
      const updated = addRecentProject(currentState, { path: selectedPath, name: projectName })
      await saveWorkspaceState(storagePath, updated)
    } catch (e) {
      console.warn('[Workspace] Could not update recent project:', e)
    }

    const tree = await buildDirectoryTree(selectedPath, selectedPath)

    return {
      path: selectedPath,
      name: projectName,
      tree,
    }
  })

  // Open directory directly by path (e.g. from Recent Projects or startup restore)
  ipcMain.handle('project:openPath', async (_event, folderPath: string) => {
    try {
      if (!folderPath || typeof folderPath !== 'string') {
        return { success: false, error: 'Invalid folder path provided' }
      }

      const selectedPath = normalizePath(folderPath)
      if (!fs.existsSync(selectedPath)) {
        return { success: false, error: `Project folder does not exist: ${selectedPath}` }
      }

      const stats = await fs.promises.stat(selectedPath)
      if (!stats.isDirectory()) {
        return { success: false, error: `Path is not a directory: ${selectedPath}` }
      }

      activeProjectRoot = selectedPath
      const projectName = path.basename(selectedPath) || selectedPath

      // Update recent projects
      try {
        const storagePath = getWorkspaceStoragePath()
        const currentState = await loadWorkspaceState(storagePath)
        const updated = addRecentProject(currentState, { path: selectedPath, name: projectName })
        await saveWorkspaceState(storagePath, updated)
      } catch (e) {
        console.warn('[Workspace] Could not update recent project:', e)
      }

      const tree = await buildDirectoryTree(selectedPath, selectedPath)
      return {
        success: true,
        path: selectedPath,
        name: projectName,
        tree,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Failed to open project path: ${msg}` }
    }
  })

  // Refresh or get tree for currently active project
  ipcMain.handle('project:getTree', async () => {
    if (!activeProjectRoot) {
      return { success: false, error: 'No project currently open', tree: [] }
    }

    try {
      const tree = await buildDirectoryTree(activeProjectRoot, activeProjectRoot)
      return {
        success: true,
        path: activeProjectRoot,
        name: path.basename(activeProjectRoot),
        tree,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg, tree: [] }
    }
  })

  // Get currently active project root info
  ipcMain.handle('project:getRoot', () => {
    if (!activeProjectRoot) return null
    return {
      path: activeProjectRoot,
      name: path.basename(activeProjectRoot),
    }
  })

  // ===========================================================================
  // WORKSPACE PERSISTENCE IPC (Phase 5)
  // ===========================================================================

  // Load and validate persisted workspace state
  ipcMain.handle('workspace:getState', async () => {
    try {
      const storagePath = getWorkspaceStoragePath()
      const state = await loadWorkspaceState(storagePath)
      const recentProjectsWithExistence = await checkRecentProjectsExistence(state.recentProjects)
      const validTabs = await filterValidTabsToRestore(state.openTabs)

      // Also verify if lastProjectRoot still exists
      let validatedLastProject = state.lastProjectRoot
      if (validatedLastProject) {
        try {
          if (
            !fs.existsSync(validatedLastProject.path) ||
            !fs.statSync(validatedLastProject.path).isDirectory()
          ) {
            validatedLastProject = null
          }
        } catch {
          validatedLastProject = null
        }
      }

      return {
        success: true,
        data: {
          ...state,
          lastProjectRoot: validatedLastProject,
          recentProjects: recentProjectsWithExistence,
          openTabs: validTabs,
        },
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  // Save workspace state atomically
  ipcMain.handle('workspace:saveState', async (_event, partialState: Partial<WorkspaceStateDTO>) => {
    try {
      const storagePath = getWorkspaceStoragePath()
      const currentState = await loadWorkspaceState(storagePath)
      const merged: WorkspaceStateDTO = {
        ...currentState,
        ...partialState,
      }
      const saved = await saveWorkspaceState(storagePath, merged)
      return { success: saved }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  // Get recent projects with disk existence check
  ipcMain.handle('workspace:getRecentProjects', async () => {
    try {
      const storagePath = getWorkspaceStoragePath()
      const state = await loadWorkspaceState(storagePath)
      const list = await checkRecentProjectsExistence(state.recentProjects)
      return { success: true, recentProjects: list }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg, recentProjects: [] }
    }
  })

  // Add a recent project
  ipcMain.handle('workspace:addRecentProject', async (_event, project: { path: string; name?: string }) => {
    try {
      const storagePath = getWorkspaceStoragePath()
      const state = await loadWorkspaceState(storagePath)
      const updated = addRecentProject(state, project)
      await saveWorkspaceState(storagePath, updated)
      const list = await checkRecentProjectsExistence(updated.recentProjects)
      return { success: true, recentProjects: list }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  // Remove a project from recents
  ipcMain.handle('workspace:removeRecentProject', async (_event, projectPath: string) => {
    try {
      const storagePath = getWorkspaceStoragePath()
      const state = await loadWorkspaceState(storagePath)
      const updated = removeRecentProject(state, projectPath)
      await saveWorkspaceState(storagePath, updated)
      const list = await checkRecentProjectsExistence(updated.recentProjects)
      return { success: true, recentProjects: list }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  // Clear all recent projects
  ipcMain.handle('workspace:clearRecentProjects', async () => {
    try {
      const storagePath = getWorkspaceStoragePath()
      const state = await loadWorkspaceState(storagePath)
      const updated: WorkspaceStateDTO = {
        ...state,
        recentProjects: [],
      }
      await saveWorkspaceState(storagePath, updated)
      return { success: true, recentProjects: [] }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  // Project-wide multi-file search with unsaved editor buffer precedence
  ipcMain.handle(
    'project:search',
    async (
      _event,
      query: string,
      options?: SearchOptionsDTO
    ): Promise<ProjectSearchResultDTO> => {
      try {
        if (!activeProjectRoot) {
          return {
            success: false,
            query: query || '',
            results: [],
            totalMatches: 0,
            totalFiles: 0,
            error: 'No project currently open',
          }
        }

        const trimmedQuery = (query || '').trim()
        if (!trimmedQuery) {
          return {
            success: true,
            query: '',
            results: [],
            totalMatches: 0,
            totalFiles: 0,
          }
        }

        const maxMatches = options?.maxMatches || 500
        const caseSensitive = !!options?.caseSensitive
        const wholeWord = !!options?.wholeWord
        const isRegex = !!options?.isRegex

        // Map unsaved in-memory buffers
        const unsavedMap = new Map<string, string>()
        if (Array.isArray(options?.unsavedBuffers)) {
          for (const item of options.unsavedBuffers) {
            if (item && item.path && typeof item.content === 'string') {
              unsavedMap.set(normalizePath(item.path), item.content)
            }
          }
        }

        // Collect searchable disk files
        const fileList: string[] = []
        await collectSearchableFiles(activeProjectRoot, activeProjectRoot, fileList)

        const results: SearchFileResultDTO[] = []
        let totalMatches = 0
        let truncated = false
        const processedFiles = new Set<string>()

        // 1. Process files from disk (or unsaved buffer if open and modified)
        for (const filePath of fileList) {
          if (truncated) break

          const normPath = normalizePath(filePath)
          processedFiles.add(normPath)

          let content = ''
          if (unsavedMap.has(normPath)) {
            // Live unsaved editor buffer takes precedence over disk!
            content = unsavedMap.get(normPath)!
          } else {
            try {
              const stats = await fs.promises.stat(normPath)
              if (stats.size > MAX_FILE_SIZE) continue

              const buffer = await fs.promises.readFile(normPath)
              if (isBinaryContent(buffer)) continue
              content = buffer.toString('utf-8')
            } catch {
              continue
            }
          }

          const quota = maxMatches - totalMatches
          const searchRes = searchContentLines(
            content,
            trimmedQuery,
            caseSensitive,
            wholeWord,
            isRegex,
            quota
          )

          if (searchRes.matches.length > 0) {
            totalMatches += searchRes.matches.length
            results.push({
              filePath: normPath,
              fileName: path.basename(normPath),
              relativePath: path.relative(activeProjectRoot, normPath),
              matches: searchRes.matches,
            })
          }

          if (searchRes.reachedQuota || totalMatches >= maxMatches) {
            truncated = true
            break
          }
        }

        // 2. Also check any unsaved buffers that are inside project root but not yet on disk
        if (!truncated) {
          for (const [bufPath, bufContent] of unsavedMap.entries()) {
            if (processedFiles.has(bufPath)) continue
            if (!isPathInsideRoot(bufPath, activeProjectRoot)) continue

            const quota = maxMatches - totalMatches
            const searchRes = searchContentLines(
              bufContent,
              trimmedQuery,
              caseSensitive,
              wholeWord,
              isRegex,
              quota
            )

            if (searchRes.matches.length > 0) {
              totalMatches += searchRes.matches.length
              results.push({
                filePath: bufPath,
                fileName: path.basename(bufPath),
                relativePath: path.relative(activeProjectRoot, bufPath),
                matches: searchRes.matches,
              })
            }

            if (searchRes.reachedQuota || totalMatches >= maxMatches) {
              truncated = true
              break
            }
          }
        }

        return {
          success: true,
          query: trimmedQuery,
          results,
          totalMatches,
          totalFiles: results.length,
          truncated,
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return {
          success: false,
          query: query || '',
          results: [],
          totalMatches: 0,
          totalFiles: 0,
          error: `Search error: ${msg}`,
        }
      }
    }
  )

  // ===========================================================================
  // FILE READ & WRITE IPC (Day 2)
  // ===========================================================================

  // Read text file with strict security and size checks
  ipcMain.handle('file:read', async (_event, filePath: string) => {
    try {
      const normPath = normalizePath(filePath)

      // Path traversal security check
      if (activeProjectRoot && !isPathInsideRoot(normPath, activeProjectRoot)) {
        return {
          success: false,
          error: 'Access denied: Path is outside the permitted project workspace.',
        }
      }

      if (!fs.existsSync(normPath)) {
        return { success: false, error: `File not found: ${path.basename(normPath)}` }
      }

      const stats = await fs.promises.stat(normPath)

      if (stats.isDirectory()) {
        return { success: false, error: 'Cannot open a directory as a file.' }
      }

      if (stats.size > MAX_FILE_SIZE) {
        return {
          success: false,
          error: `File size (${(stats.size / 1024 / 1024).toFixed(2)} MB) exceeds 5 MB limit for text editing.`,
        }
      }

      const ext = path.extname(normPath).replace('.', '').toLowerCase()
      if (BINARY_EXTENSIONS.has(ext)) {
        return {
          success: false,
          isBinary: true,
          error: `Unsupported file type (.${ext}). Binary files cannot be edited in the text editor.`,
        }
      }

      const buffer = await fs.promises.readFile(normPath)
      if (isBinaryContent(buffer)) {
        return {
          success: false,
          isBinary: true,
          error: 'Binary file detected. File cannot be displayed in text editor.',
        }
      }

      const content = buffer.toString('utf-8')

      return {
        success: true,
        path: normPath,
        name: path.basename(normPath),
        content,
        size: stats.size,
        lastModified: stats.mtimeMs,
        extension: ext,
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Failed to read file: ${errorMessage}` }
    }
  })

  // Save text file to disk with external change conflict detection
  ipcMain.handle(
    'file:write',
    async (
      _event,
      filePath: string,
      content: string,
      options?: { expectedLastModified?: number; forceOverwrite?: boolean }
    ) => {
      try {
        const normPath = normalizePath(filePath)

        // Path traversal security check
        if (activeProjectRoot && !isPathInsideRoot(normPath, activeProjectRoot)) {
          return {
            success: false,
            error: 'Access denied: Path is outside the permitted project workspace.',
          }
        }

        // Check for external modifications on disk
        if (fs.existsSync(normPath)) {
          const stats = await fs.promises.stat(normPath)
          if (
            options?.expectedLastModified &&
            !options.forceOverwrite &&
            stats.mtimeMs > options.expectedLastModified + 100 // 100ms tolerance for clock jitter
          ) {
            return {
              success: false,
              conflict: true,
              lastModified: stats.mtimeMs,
              error: 'Conflict: This file has been modified on disk by another program.',
            }
          }
        }

        await fs.promises.writeFile(normPath, content, 'utf-8')
        const stats = await fs.promises.stat(normPath)

        return {
          success: true,
          path: normPath,
          lastModified: stats.mtimeMs,
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        return { success: false, error: `Failed to write file: ${errorMessage}` }
      }
    }
  )

  // Save As using native Electron save file dialog
  ipcMain.handle(
    'file:saveAs',
    async (
      _event,
      content: string,
      defaultName?: string,
      defaultPath?: string
    ) => {
      try {
        let initialPath = activeProjectRoot || app.getPath('documents')
        if (defaultPath && !defaultPath.startsWith('untitled:')) {
          try {
            initialPath = path.dirname(normalizePath(defaultPath))
          } catch {
            // keep fallback
          }
        }
        if (defaultName) {
          initialPath = path.join(initialPath, defaultName)
        }

        const result = await dialog.showSaveDialog(mainWindow, {
          title: 'Save As — Ajson Studio',
          defaultPath: initialPath,
          filters: [
            { name: 'All Files', extensions: ['*'] },
            { name: 'TypeScript', extensions: ['ts', 'tsx'] },
            { name: 'JavaScript', extensions: ['js', 'jsx', 'mjs'] },
            { name: 'Python', extensions: ['py'] },
            { name: 'JSON', extensions: ['json'] },
            { name: 'HTML', extensions: ['html', 'htm'] },
            { name: 'CSS', extensions: ['css', 'scss'] },
            { name: 'Markdown', extensions: ['md'] },
            { name: 'Text', extensions: ['txt'] },
          ],
        })

        if (result.canceled || !result.filePath) {
          return { success: false, canceled: true }
        }

        const chosenPath = normalizePath(result.filePath)
        await fs.promises.writeFile(chosenPath, content, 'utf-8')
        const stats = await fs.promises.stat(chosenPath)

        return {
          success: true,
          path: chosenPath,
          name: path.basename(chosenPath),
          lastModified: stats.mtimeMs,
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return { success: false, error: `Failed to save file: ${msg}` }
      }
    }
  )

  // Check if a file on disk has changed externally
  ipcMain.handle(
    'file:checkModified',
    async (_event, filePath: string, expectedMtime: number) => {
      try {
        const normPath = normalizePath(filePath)
        if (!fs.existsSync(normPath)) {
          return { exists: false, modified: true }
        }
        const stat = await fs.promises.stat(normPath)
        const modified = stat.mtimeMs > expectedMtime + 100
        return {
          exists: true,
          modified,
          currentMtime: stat.mtimeMs,
        }
      } catch {
        return { exists: false, modified: true }
      }
    }
  )

  // ===========================================================================
  // FILESYSTEM OPERATIONS (Create, Rename, Delete) (Day 2)
  // ===========================================================================

  // Create new file
  ipcMain.handle('fs:createFile', async (_event, targetDir: string, fileName: string) => {
    try {
      if (!isValidFileName(fileName)) {
        return {
          success: false,
          error: `Invalid filename '${fileName}'. Filenames cannot contain / \\ : * ? " < > | or be empty.`,
        }
      }

      const normDir = normalizePath(targetDir)
      const allowedRoot = activeProjectRoot || normDir

      if (!isPathInsideRoot(normDir, allowedRoot)) {
        return { success: false, error: 'Access denied: Directory outside project root.' }
      }

      const targetPath = path.join(normDir, fileName)

      if (fs.existsSync(targetPath)) {
        return {
          success: false,
          error: `A file or directory named '${fileName}' already exists in this location.`,
        }
      }

      await fs.promises.writeFile(targetPath, '', 'utf-8')

      return {
        success: true,
        path: targetPath,
        name: fileName,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Failed to create file: ${msg}` }
    }
  })

  // Create new directory
  ipcMain.handle('fs:createFolder', async (_event, targetDir: string, folderName: string) => {
    try {
      if (!isValidFileName(folderName)) {
        return {
          success: false,
          error: `Invalid folder name '${folderName}'. Folder names cannot contain / \\ : * ? " < > | or be empty.`,
        }
      }

      const normDir = normalizePath(targetDir)
      const allowedRoot = activeProjectRoot || normDir

      if (!isPathInsideRoot(normDir, allowedRoot)) {
        return { success: false, error: 'Access denied: Directory outside project root.' }
      }

      const targetPath = path.join(normDir, folderName)

      if (fs.existsSync(targetPath)) {
        return {
          success: false,
          error: `A folder named '${folderName}' already exists in this location.`,
        }
      }

      await fs.promises.mkdir(targetPath, { recursive: true })

      return {
        success: true,
        path: targetPath,
        name: folderName,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Failed to create folder: ${msg}` }
    }
  })

  // Rename a file or directory
  ipcMain.handle('fs:rename', async (_event, oldPath: string, newName: string) => {
    try {
      if (!isValidFileName(newName)) {
        return {
          success: false,
          error: `Invalid name '${newName}'. Names cannot contain / \\ : * ? " < > | or be empty.`,
        }
      }

      const normOld = normalizePath(oldPath)
      const allowedRoot = activeProjectRoot || normOld

      if (!isPathInsideRoot(normOld, allowedRoot)) {
        return { success: false, error: 'Access denied: Target outside project root.' }
      }

      if (activeProjectRoot && normOld === activeProjectRoot) {
        return { success: false, error: 'Cannot rename the active project root directory.' }
      }

      const parentDir = path.dirname(normOld)
      const normNew = path.join(parentDir, newName)

      if (!isPathInsideRoot(normNew, allowedRoot)) {
        return { success: false, error: 'Access denied: Destination outside project root.' }
      }

      if (fs.existsSync(normNew)) {
        return {
          success: false,
          error: `An item named '${newName}' already exists in this directory.`,
        }
      }

      await fs.promises.rename(normOld, normNew)

      return {
        success: true,
        oldPath: normOld,
        newPath: normNew,
        newName,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Failed to rename: ${msg}` }
    }
  })

  // Safely delete a file or directory
  ipcMain.handle('fs:delete', async (_event, targetPath: string) => {
    try {
      const normTarget = normalizePath(targetPath)
      const allowedRoot = activeProjectRoot || normTarget

      if (!isPathInsideRoot(normTarget, allowedRoot)) {
        return { success: false, error: 'Access denied: Target outside project root.' }
      }

      if (activeProjectRoot && normTarget === activeProjectRoot) {
        return { success: false, error: 'Safety restriction: Cannot delete the project root directory.' }
      }

      if (!fs.existsSync(normTarget)) {
        return { success: false, error: 'Target does not exist.' }
      }

      const stats = await fs.promises.lstat(normTarget)
      if (stats.isSymbolicLink()) {
        await fs.promises.unlink(normTarget)
      } else {
        await fs.promises.rm(normTarget, { recursive: true, force: true })
      }

      return {
        success: true,
        path: normTarget,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Failed to delete: ${msg}` }
    }
  })

  // Open single file dialog (preserved for compatibility)
  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open File in Ajson Studio',
      properties: ['openFile'],
      filters: [
        { name: 'All Supported Files', extensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'html', 'css', 'md', 'txt'] },
        { name: 'TypeScript / JavaScript', extensions: ['ts', 'tsx', 'js', 'jsx'] },
        { name: 'Python', extensions: ['py'] },
        { name: 'Web Files', extensions: ['html', 'css', 'json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const filePath = normalizePath(result.filePaths[0])
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8')
      const fileName = path.basename(filePath)
      const ext = path.extname(filePath).replace('.', '').toLowerCase()

      return {
        path: filePath,
        name: fileName,
        content,
        extension: ext,
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      throw new Error(`Failed to read file: ${errorMessage}`)
    }
  })
}
