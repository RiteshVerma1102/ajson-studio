import { z } from 'zod';
import { FileEntry, FileEntrySchema, FileStat, FileStatSchema } from '../domain';

export type FsWatchEventType = 'change' | 'add' | 'unlink' | 'addDir' | 'unlinkDir';
export const FsWatchEventTypeSchema = z.enum(['change', 'add', 'unlink', 'addDir', 'unlinkDir']);

export interface FileSystemService {
  readDir(path: string): Promise<FileEntry[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  createFile(path: string, content?: string): Promise<void>;
  createDir(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  delete(path: string): Promise<void>;
  stat(path: string): Promise<FileStat | null>;
  exists(path: string): Promise<boolean>;
  watch(cb: (event: FsWatchEventType, path: string) => void): () => void;
}

// IPC Schemas for File System
export const FsReadDirRequestSchema = z.object({
  path: z.string(),
});
export const FsReadDirResponseSchema = z.array(FileEntrySchema);

export const FsReadFileRequestSchema = z.object({
  path: z.string(),
  maxBytes: z.number().positive().optional(),
});
export const FsReadFileResponseSchema = z.object({
  content: z.string(),
});

export const FsWriteFileRequestSchema = z.object({
  path: z.string(),
  content: z.string(),
});
export const FsWriteFileResponseSchema = z.object({
  success: z.boolean(),
});

export const FsCreateFileRequestSchema = z.object({
  path: z.string(),
  content: z.string().optional(),
});
export const FsCreateFileResponseSchema = z.object({
  success: z.boolean(),
});

export const FsCreateDirRequestSchema = z.object({
  path: z.string(),
});
export const FsCreateDirResponseSchema = z.object({
  success: z.boolean(),
});

export const FsRenameRequestSchema = z.object({
  oldPath: z.string(),
  newPath: z.string(),
});
export const FsRenameResponseSchema = z.object({
  success: z.boolean(),
});

export const FsDeleteRequestSchema = z.object({
  path: z.string(),
});
export const FsDeleteResponseSchema = z.object({
  success: z.boolean(),
});

export const FsStatRequestSchema = z.object({
  path: z.string(),
});
export const FsStatResponseSchema = FileStatSchema.nullable();

export const FsExistsRequestSchema = z.object({
  path: z.string(),
});
export const FsExistsResponseSchema = z.object({
  exists: z.boolean(),
});

export const FsWatchEventSchema = z.object({
  event: FsWatchEventTypeSchema,
  path: z.string(),
  workspaceId: z.string().optional(),
  timestamp: z.number().default(() => Date.now()),
});
export type FsWatchEvent = z.infer<typeof FsWatchEventSchema>;
