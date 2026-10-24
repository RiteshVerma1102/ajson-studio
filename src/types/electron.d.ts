export interface AppInfo {
  appName: string
  version: string
  platform: string
  arch: string
  nodeVersion: string
  chromeVersion: string
  electronVersion: string
}

export interface OpenedFileResult {
  path: string
  name: string
  content: string
  extension: string
}

export interface FileTreeNodeDTO {
  id: string
  name: string
  path: string
  isDirectory: boolean
  extension?: string
  children?: FileTreeNodeDTO[]
  size?: number
  lastModified?: number
}

export interface ProjectOpenResult {
  path: string
  name: string
  tree: FileTreeNodeDTO[]
}

export interface ProjectTreeResult {
  success: boolean
  path?: string
  name?: string
  tree: FileTreeNodeDTO[]
  error?: string
}

export interface FileReadResult {
  success: boolean
  path?: string
  name?: string
  content?: string
  size?: number
  lastModified?: number
  extension?: string
  isBinary?: boolean
  error?: string
}

export interface FileWriteResult {
  success: boolean
  path?: string
  lastModified?: number
  conflict?: boolean
  error?: string
}

export interface SaveAsResult {
  success: boolean
  canceled?: boolean
  path?: string
  name?: string
  lastModified?: number
  error?: string
}

export interface CheckModifiedResult {
  exists: boolean
  modified: boolean
  currentMtime?: number
}

export interface FileOpResult {
  success: boolean
  path?: string
  name?: string
  oldPath?: string
  newPath?: string
  newName?: string
  error?: string
}

export interface SearchMatch {
  lineNumber: number
  column: number
  lineContent: string
  matchLength: number
}

export interface SearchFileResult {
  filePath: string
  fileName: string
  relativePath: string
  matches: SearchMatch[]
}

export interface ProjectSearchResult {
  success: boolean
  query: string
  results: SearchFileResult[]
  totalMatches: number
  totalFiles: number
  truncated?: boolean
  error?: string
}

export interface SearchOptions {
  caseSensitive?: boolean
  wholeWord?: boolean
  isRegex?: boolean
  maxMatches?: number
  unsavedBuffers?: Array<{ path: string; content: string }>
}

export interface RecentProject {
  path: string
  name: string
  lastOpened: number
  exists?: boolean
}

export interface PersistedTab {
  path: string
  name: string
}

export interface WorkspaceState {
  version: number
  lastProjectRoot: { path: string; name: string } | null
  recentProjects: RecentProject[]
  openTabs: PersistedTab[]
  activeTabPath: string | null
  sidebarOpen: boolean
  sidebarWidth?: number
  activeActivityView: 'explorer' | 'search' | 'git' | 'extensions' | 'jsontools'
  bottomPanelOpen: boolean
  bottomPanelHeight?: number
  activeBottomTab: 'terminal' | 'problems' | 'output' | 'tests'
}

export interface WorkspaceGetStateResult {
  success: boolean
  data?: WorkspaceState
  error?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Types (Day 3)
// ─────────────────────────────────────────────────────────────────────────────

export type AiProviderId = 'openai' | 'anthropic' | 'google'

export type AiErrorCode =
  | 'NOT_CONFIGURED'
  | 'MISSING_API_KEY'
  | 'INVALID_KEY'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'PROVIDER_ERROR'
  | 'REQUEST_TOO_LARGE'
  | 'CANCELLED'
  | 'INVALID_REQUEST'
  | 'EMPTY_RESPONSE'
  | 'UNKNOWN'

export interface AiErrorDetail {
  code: AiErrorCode
  message: string
  retryable: boolean
}

export interface AiMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  contextAttached?: boolean
  /** Chip label shown for the context sent with this message (UI only) */
  contextLabel?: string
  /** Model that produced an assistant message (UI only) */
  modelId?: string
}

export interface AiCodeContext {
  type: 'selection' | 'file'
  filePath: string
  language: string
  content: string
  label: string
  startLine?: number
  endLine?: number
  charCount?: number
  byteSize?: number
}

export interface AiSendMessageRequest {
  messages: AiMessage[]
  context?: AiCodeContext | null
  providerId: AiProviderId
  modelId: string
  temperature?: number
  maxTokens?: number
  requestId: string
}

export interface AiSendMessageResult {
  success: boolean
  requestId: string
  message?: AiMessage
  error?: AiErrorDetail
}

export interface AiProviderStatus {
  configured: boolean
}

export interface AiConfigResult {
  openai: AiProviderStatus
  anthropic: AiProviderStatus
  google: AiProviderStatus
  safeStorageAvailable: boolean
}

export interface AjsonAPI {
  app: {
    getInfo: () => Promise<AppInfo>
  }
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<boolean>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
  }
  project: {
    openFolder: () => Promise<ProjectOpenResult | null>
    openPath: (folderPath: string) => Promise<ProjectOpenResult>
    getTree: () => Promise<ProjectTreeResult>
    getRoot: () => Promise<{ path: string; name: string } | null>
    search: (query: string, options?: SearchOptions) => Promise<ProjectSearchResult>
  }
  workspace: {
    getState: () => Promise<WorkspaceGetStateResult>
    saveState: (state: Partial<WorkspaceState>) => Promise<{ success: boolean; error?: string }>
    getRecentProjects: () => Promise<{ success: boolean; recentProjects: RecentProject[]; error?: string }>
    addRecentProject: (project: { path: string; name?: string }) => Promise<{ success: boolean; recentProjects?: RecentProject[]; error?: string }>
    removeRecentProject: (projectPath: string) => Promise<{ success: boolean; recentProjects?: RecentProject[]; error?: string }>
    clearRecentProjects: () => Promise<{ success: boolean; recentProjects: RecentProject[]; error?: string }>
  }
  fs: {
    openFileDialog: () => Promise<OpenedFileResult | null>
    readFile: (filePath: string) => Promise<FileReadResult>
    saveFile: (
      filePath: string,
      content: string,
      options?: { expectedLastModified?: number; forceOverwrite?: boolean }
    ) => Promise<FileWriteResult>
    saveFileAs: (
      content: string,
      defaultName?: string,
      defaultPath?: string
    ) => Promise<SaveAsResult>
    checkModified: (
      filePath: string,
      expectedMtime: number
    ) => Promise<CheckModifiedResult>
    createFile: (targetDir: string, fileName: string) => Promise<FileOpResult>
    createFolder: (targetDir: string, folderName: string) => Promise<FileOpResult>
    rename: (oldPath: string, newName: string) => Promise<FileOpResult>
    delete: (targetPath: string) => Promise<FileOpResult>
  }
  terminal: {
    run: (req: { id: string; command: string; cwd?: string; timeoutMs?: number }) => Promise<{ ok: boolean; error?: string }>
    kill: (id: string) => Promise<{ ok: boolean }>
    onEvent: (cb: (event: TerminalEvent) => void) => () => void
  }
  git: {
    status: () => Promise<GitStatusResult>
  }
  ai: {
    getConfig: () => Promise<AiConfigResult>
    saveApiKey: (providerId: string, apiKey: string) => Promise<{ success: boolean; error?: string }>
    clearApiKey: (providerId: string) => Promise<{ success: boolean; error?: string }>
    sendMessage: (req: AiSendMessageRequest) => Promise<AiSendMessageResult>
    cancelRequest: (requestId: string) => Promise<{ success: boolean }>
  }
}

export type TerminalEvent =
  | { id: string; type: 'stdout'; data: string }
  | { id: string; type: 'stderr'; data: string }
  | { id: string; type: 'exit'; code: number | null; signal: string | null; reason: 'completed' | 'killed' | 'timeout' | 'error'; error?: string }

export interface GitStatusResult {
  isRepo: boolean
  branch: string | null
  ahead: number
  behind: number
  changes: { path: string; index: string; workTree: string }[]
  error?: string
}

declare global {
  interface Window {
    ajsonAPI?: AjsonAPI
  }
}

