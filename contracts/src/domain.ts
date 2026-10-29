import { z } from 'zod';

// --- Workspace Domain Types ---
export const WorkspaceInfoSchema = z.object({
  rootPath: z.string(),
  name: z.string(),
});
export type WorkspaceInfo = z.infer<typeof WorkspaceInfoSchema>;

// --- File System Domain Types ---
export const FileStatSchema = z.object({
  isDirectory: z.boolean(),
  size: z.number().nonnegative(),
  mtime: z.number().nonnegative(),
});
export type FileStat = z.infer<typeof FileStatSchema>;

export const FileEntrySchema: z.ZodType<FileEntry> = z.lazy(() =>
  z.object({
    name: z.string().min(1),
    path: z.string(),
    isDirectory: z.boolean(),
    size: z.number().optional(),
    children: z.array(FileEntrySchema).optional(),
  })
);
export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  children?: FileEntry[];
}

// --- Terminal Domain Types ---
export const ShellTypeSchema = z.enum(['bash', 'zsh', 'pwsh']);
export type ShellType = z.infer<typeof ShellTypeSchema>;

export const TerminalSessionOptionsSchema = z.object({
  cwd: z.string().optional(),
  shell: ShellTypeSchema.optional(),
  title: z.string().optional(),
  owner: z.enum(['user', 'agent']).optional(),
  readOnly: z.boolean().optional(),
});
export type TerminalSessionOptions = z.infer<typeof TerminalSessionOptionsSchema>;

export const TerminalSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  cwd: z.string(),
  shell: ShellTypeSchema,
  owner: z.enum(['user', 'agent']),
  readOnly: z.boolean(),
  createdAt: z.number(),
});
export type TerminalSession = z.infer<typeof TerminalSessionSchema>;

// --- Git Domain Types ---
export const GitIndexStatusSchema = z.enum(['M', 'A', 'D', 'R', '-']);
export type GitIndexStatus = z.infer<typeof GitIndexStatusSchema>;

export const GitWorkTreeStatusSchema = z.enum(['M', 'D', '?', '-']);
export type GitWorkTreeStatus = z.infer<typeof GitWorkTreeStatusSchema>;

export const GitFileStatusSchema = z.object({
  path: z.string(),
  index: GitIndexStatusSchema,
  workTree: GitWorkTreeStatusSchema,
});
export type GitFileStatus = z.infer<typeof GitFileStatusSchema>;

export const GitCommitSchema = z.object({
  hash: z.string(),
  parents: z.array(z.string()),
  author: z.string(),
  date: z.string(),
  message: z.string(),
});
export type GitCommit = z.infer<typeof GitCommitSchema>;

export const GitDiffResultSchema = z.object({
  original: z.string(),
  modified: z.string(),
});
export type GitDiffResult = z.infer<typeof GitDiffResultSchema>;

export const GitDiffSummarySchema = z.object({
  files: z.number().nonnegative(),
  additions: z.number().nonnegative(),
  deletions: z.number().nonnegative(),
});
export type GitDiffSummary = z.infer<typeof GitDiffSummarySchema>;

export const GitBranchSchema = z.object({
  name: z.string(),
  isCurrent: z.boolean(),
  commitHash: z.string(),
});
export type GitBranch = z.infer<typeof GitBranchSchema>;

// --- Search Domain Types ---
export const SearchQuerySchema = z.object({
  query: z.string(),
  isRegex: z.boolean().optional(),
  isCaseSensitive: z.boolean().optional(),
  matchWholeWord: z.boolean().optional(),
  includePattern: z.string().optional(),
  excludePattern: z.string().optional(),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const SearchMatchSchema = z.object({
  path: z.string(),
  lineNumber: z.number().int().positive(),
  column: z.number().int().positive(),
  lineContent: z.string(),
  matchLength: z.number().int().positive(),
});
export type SearchMatch = z.infer<typeof SearchMatchSchema>;

// --- Diagnostics Domain Types ---
export const DiagnosticSeveritySchema = z.enum(['error', 'warning', 'info']);
export type DiagnosticSeverity = z.infer<typeof DiagnosticSeveritySchema>;

export const DiagnosticMarkerSchema = z.object({
  source: z.string(),
  uri: z.string(),
  message: z.string(),
  severity: DiagnosticSeveritySchema,
  startLineNumber: z.number().int().positive(),
  startColumn: z.number().int().positive(),
  endLineNumber: z.number().int().positive(),
  endColumn: z.number().int().positive(),
  code: z.union([z.string(), z.number()]).optional(),
});
export type DiagnosticMarker = z.infer<typeof DiagnosticMarkerSchema>;

export const DiagnosticsFilterSchema = z.object({
  severity: z.array(DiagnosticSeveritySchema).optional(),
  query: z.string().optional(),
  currentFileOnly: z.boolean().optional(),
  activeUri: z.string().optional(),
});
export type DiagnosticsFilter = z.infer<typeof DiagnosticsFilterSchema>;

// --- Output Domain Types ---
export const OutputChannelSchema = z.enum(['Tasks', 'Git', 'Ajson']);
export type OutputChannel = z.infer<typeof OutputChannelSchema>;

export const OutputLogLevelSchema = z.enum(['info', 'warn', 'error', 'success']);
export type OutputLogLevel = z.infer<typeof OutputLogLevelSchema>;

export const OutputLineSchema = z.object({
  id: z.string(),
  channel: OutputChannelSchema,
  text: z.string(),
  level: OutputLogLevelSchema,
  timestamp: z.number(),
});
export type OutputLine = z.infer<typeof OutputLineSchema>;

// --- Index & Symbol Domain Types ---
export const SymbolKindSchema = z.enum([
  'file',
  'module',
  'namespace',
  'package',
  'class',
  'method',
  'property',
  'field',
  'constructor',
  'enum',
  'interface',
  'function',
  'variable',
  'constant',
]);
export type SymbolKind = z.infer<typeof SymbolKindSchema>;

export const IndexSymbolSchema = z.object({
  name: z.string(),
  kind: SymbolKindSchema,
  path: z.string(),
  line: z.number().int().positive(),
  column: z.number().int().positive(),
  containerName: z.string().optional(),
});
export type IndexSymbol = z.infer<typeof IndexSymbolSchema>;

export const IndexStatusSchema = z.object({
  isIndexing: z.boolean(),
  indexedFiles: z.number().nonnegative(),
  totalFiles: z.number().nonnegative(),
  lastIndexedAt: z.number().optional(),
});
export type IndexStatus = z.infer<typeof IndexStatusSchema>;
