export type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'html'
  | 'css'
  | 'json'
  | 'python'
  | 'markdown'
  | 'plaintext'
  | 'yaml'
  | 'shell'
  | 'sql'
  | 'xml'

export interface EditorTab {
  id: string
  name: string
  path: string
  language: SupportedLanguage
  content: string
  originalContent?: string
  isDirty?: boolean
  isReadOnly?: boolean
  lastSavedMtime?: number
  hasExternalChange?: boolean
}

export interface FileTreeNode {
  id: string
  name: string
  path: string
  isDirectory: boolean
  extension?: string
  language?: SupportedLanguage
  children?: FileTreeNode[]
  isExpanded?: boolean
  size?: number
  lastModified?: number
}

export type ActivityView = 'explorer' | 'search' | 'git' | 'extensions'

export type BottomTab = 'terminal' | 'problems' | 'output' | 'tests'

export interface CursorPosition {
  lineNumber: number
  column: number
}

export interface EditorSelectionRange {
  text: string
  startLine: number
  startCol: number
  endLine: number
  endCol: number
  isEmpty: boolean
  filePath?: string
  language?: string
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

export interface EditorLocation {
  lineNumber: number
  column: number
  matchLength?: number
}

export interface CommandItem {
  id: string
  title: string
  category: 'File' | 'Editor' | 'View' | 'Navigation' | 'Explorer' | 'Workspace'
  shortcut?: string
  description?: string
  action: () => void
}
