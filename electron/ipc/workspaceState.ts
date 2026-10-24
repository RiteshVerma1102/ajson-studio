import * as fs from 'fs'
import * as path from 'path'

export interface RecentProjectDTO {
  path: string
  name: string
  lastOpened: number
  exists?: boolean
}

export interface PersistedTabDTO {
  path: string
  name: string
}

export interface WorkspaceStateDTO {
  version: number
  lastProjectRoot: { path: string; name: string } | null
  recentProjects: RecentProjectDTO[]
  openTabs: PersistedTabDTO[]
  activeTabPath: string | null
  sidebarOpen: boolean
  sidebarWidth?: number
  activeActivityView: 'explorer' | 'search' | 'git' | 'extensions' | 'jsontools'
  bottomPanelOpen: boolean
  bottomPanelHeight?: number
  activeBottomTab: 'terminal' | 'problems' | 'output' | 'tests'
}

export const MAX_RECENT_PROJECTS = 10

/**
 * Default safe initial workspace state
 */
export function getDefaultWorkspaceState(): WorkspaceStateDTO {
  return {
    version: 1,
    lastProjectRoot: null,
    recentProjects: [],
    openTabs: [],
    activeTabPath: null,
    sidebarOpen: true,
    sidebarWidth: 256,
    activeActivityView: 'explorer',
    bottomPanelOpen: true,
    bottomPanelHeight: 210,
    activeBottomTab: 'terminal',
  }
}

/**
 * Normalizes a file or directory path with OS-native path separators.
 */
export function normalizePath(p: string): string {
  if (!p) return ''
  return path.normalize(path.resolve(p))
}

/**
 * Validates and sanitizes raw data against the expected WorkspaceState schema.
 * Replaces missing or corrupted fields with safe defaults and strips unverified attributes.
 */
export function sanitizeWorkspaceState(raw: unknown): WorkspaceStateDTO {
  const defaults = getDefaultWorkspaceState()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return defaults
  }

  const obj = raw as Record<string, unknown>

  // 1. Version
  const version = typeof obj.version === 'number' ? obj.version : defaults.version

  // 2. Last Project Root
  let lastProjectRoot: { path: string; name: string } | null = null
  if (
    obj.lastProjectRoot &&
    typeof obj.lastProjectRoot === 'object' &&
    !Array.isArray(obj.lastProjectRoot)
  ) {
    const lpr = obj.lastProjectRoot as Record<string, unknown>
    if (typeof lpr.path === 'string' && lpr.path.trim().length > 0) {
      lastProjectRoot = {
        path: normalizePath(lpr.path),
        name: typeof lpr.name === 'string' && lpr.name.trim().length > 0
          ? lpr.name.trim()
          : path.basename(lpr.path),
      }
    }
  }

  // 3. Recent Projects (array of validated projects, max 10, deduplicated)
  const recentProjects: RecentProjectDTO[] = []
  const seenPaths = new Set<string>()

  if (Array.isArray(obj.recentProjects)) {
    for (const item of obj.recentProjects) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const rp = item as Record<string, unknown>
        if (typeof rp.path === 'string' && rp.path.trim().length > 0) {
          const norm = normalizePath(rp.path)
          if (!seenPaths.has(norm)) {
            seenPaths.add(norm)
            recentProjects.push({
              path: norm,
              name: typeof rp.name === 'string' && rp.name.trim().length > 0
                ? rp.name.trim()
                : path.basename(norm),
              lastOpened: typeof rp.lastOpened === 'number' ? rp.lastOpened : Date.now(),
            })
            if (recentProjects.length >= MAX_RECENT_PROJECTS) break
          }
        }
      }
    }
  }

  // 4. Open Tabs (valid array of path + name)
  const openTabs: PersistedTabDTO[] = []
  const seenTabPaths = new Set<string>()

  if (Array.isArray(obj.openTabs)) {
    for (const item of obj.openTabs) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const tab = item as Record<string, unknown>
        if (typeof tab.path === 'string' && tab.path.trim().length > 0) {
          const norm = normalizePath(tab.path)
          if (!seenTabPaths.has(norm)) {
            seenTabPaths.add(norm)
            openTabs.push({
              path: norm,
              name: typeof tab.name === 'string' && tab.name.trim().length > 0
                ? tab.name.trim()
                : path.basename(norm),
            })
          }
        }
      }
    }
  }

  // 5. Active Tab Path
  let activeTabPath: string | null = null
  if (typeof obj.activeTabPath === 'string' && obj.activeTabPath.trim().length > 0) {
    activeTabPath = normalizePath(obj.activeTabPath)
  }

  // 6. Sidebar & Panels
  const sidebarOpen = typeof obj.sidebarOpen === 'boolean' ? obj.sidebarOpen : defaults.sidebarOpen

  const validActivityViews = ['explorer', 'search', 'git', 'extensions', 'jsontools'] as const
  const activeActivityView = validActivityViews.includes(obj.activeActivityView as any)
    ? (obj.activeActivityView as WorkspaceStateDTO['activeActivityView'])
    : defaults.activeActivityView

  const bottomPanelOpen =
    typeof obj.bottomPanelOpen === 'boolean' ? obj.bottomPanelOpen : defaults.bottomPanelOpen

  const validBottomTabs = ['terminal', 'problems', 'output', 'tests'] as const
  const activeBottomTab = validBottomTabs.includes(obj.activeBottomTab as any)
    ? (obj.activeBottomTab as WorkspaceStateDTO['activeBottomTab'])
    : defaults.activeBottomTab

  // 7. Panel Dimensions (with min/max clamps)
  let sidebarWidth = defaults.sidebarWidth || 256
  if (typeof obj.sidebarWidth === 'number' && !isNaN(obj.sidebarWidth)) {
    sidebarWidth = Math.max(180, Math.min(600, Math.round(obj.sidebarWidth)))
  }

  let bottomPanelHeight = defaults.bottomPanelHeight || 210
  if (typeof obj.bottomPanelHeight === 'number' && !isNaN(obj.bottomPanelHeight)) {
    bottomPanelHeight = Math.max(120, Math.min(600, Math.round(obj.bottomPanelHeight)))
  }

  return {
    version,
    lastProjectRoot,
    recentProjects,
    openTabs,
    activeTabPath,
    sidebarOpen,
    sidebarWidth,
    activeActivityView,
    bottomPanelOpen,
    bottomPanelHeight,
    activeBottomTab,
  }
}

/**
 * Safely loads workspace state from disk.
 * Falls back to default state on missing file, corrupted JSON or read error.
 */
export async function loadWorkspaceState(storageFilePath: string): Promise<WorkspaceStateDTO> {
  try {
    if (!fs.existsSync(storageFilePath)) {
      return getDefaultWorkspaceState()
    }

    const content = await fs.promises.readFile(storageFilePath, 'utf-8')
    if (!content.trim()) {
      return getDefaultWorkspaceState()
    }

    const parsed = JSON.parse(content)
    return sanitizeWorkspaceState(parsed)
  } catch (err) {
    console.warn(`[WorkspaceStorage] Warning: Failed to load workspace state from ${storageFilePath}:`, err)
    return getDefaultWorkspaceState()
  }
}

/**
 * Saves workspace state atomically to prevent corrupting state on unexpected shutdown.
 */
export async function saveWorkspaceState(
  storageFilePath: string,
  state: Partial<WorkspaceStateDTO>
): Promise<boolean> {
  try {
    const parentDir = path.dirname(storageFilePath)
    if (!fs.existsSync(parentDir)) {
      await fs.promises.mkdir(parentDir, { recursive: true })
    }

    // Merge with current state or sanitize
    const sanitized = sanitizeWorkspaceState(state)
    const serialized = JSON.stringify(sanitized, null, 2)

    // Write to a temporary file first, then atomically rename
    const tempFilePath = `${storageFilePath}.tmp.${Date.now()}.${Math.floor(Math.random() * 10000)}`
    await fs.promises.writeFile(tempFilePath, serialized, 'utf-8')

    try {
      await fs.promises.rename(tempFilePath, storageFilePath)
    } catch {
      // Fallback if atomic rename is locked on Windows filesystem
      await fs.promises.writeFile(storageFilePath, serialized, 'utf-8')
      try {
        await fs.promises.unlink(tempFilePath)
      } catch {}
    }

    return true
  } catch (err) {
    console.error(`[WorkspaceStorage] Error saving workspace state to ${storageFilePath}:`, err)
    return false
  }
}

/**
 * Adds or updates a project in the recent projects list.
 * Deduplicates entries and keeps the list within MAX_RECENT_PROJECTS.
 */
export function addRecentProject(
  state: WorkspaceStateDTO,
  project: { path: string; name?: string },
  maxCount: number = MAX_RECENT_PROJECTS
): WorkspaceStateDTO {
  const normPath = normalizePath(project.path)
  if (!normPath) return state

  const projectName = project.name?.trim() || path.basename(normPath) || normPath
  const filtered = state.recentProjects.filter((p) => normalizePath(p.path) !== normPath)

  const newEntry: RecentProjectDTO = {
    path: normPath,
    name: projectName,
    lastOpened: Date.now(),
  }

  const updatedRecents = [newEntry, ...filtered].slice(0, maxCount)

  return {
    ...state,
    lastProjectRoot: { path: normPath, name: projectName },
    recentProjects: updatedRecents,
  }
}

/**
 * Removes an entry from the recent projects list.
 */
export function removeRecentProject(
  state: WorkspaceStateDTO,
  projectPath: string
): WorkspaceStateDTO {
  const normPath = normalizePath(projectPath)
  const updatedRecents = state.recentProjects.filter((p) => normalizePath(p.path) !== normPath)

  let updatedLastRoot = state.lastProjectRoot
  if (state.lastProjectRoot && normalizePath(state.lastProjectRoot.path) === normPath) {
    updatedLastRoot = updatedRecents.length > 0
      ? { path: updatedRecents[0].path, name: updatedRecents[0].name }
      : null
  }

  return {
    ...state,
    lastProjectRoot: updatedLastRoot,
    recentProjects: updatedRecents,
  }
}

/**
 * Validates recent projects by checking if their directories still exist on disk.
 */
export async function checkRecentProjectsExistence(
  projects: RecentProjectDTO[]
): Promise<RecentProjectDTO[]> {
  const results: RecentProjectDTO[] = []

  for (const proj of projects) {
    let exists = false
    try {
      if (fs.existsSync(proj.path)) {
        const stat = await fs.promises.stat(proj.path)
        exists = stat.isDirectory()
      }
    } catch {
      exists = false
    }

    results.push({
      ...proj,
      exists,
    })
  }

  return results
}

/**
 * Validates tabs to restore, filtering out files that have been deleted, moved, or are directories.
 */
export async function filterValidTabsToRestore(
  tabs: PersistedTabDTO[]
): Promise<PersistedTabDTO[]> {
  const validTabs: PersistedTabDTO[] = []

  for (const tab of tabs) {
    try {
      if (fs.existsSync(tab.path)) {
        const stat = await fs.promises.stat(tab.path)
        if (stat.isFile()) {
          validTabs.push(tab)
        }
      }
    } catch {
      // Safely ignore missing or inaccessible files
    }
  }

  return validTabs
}
