import { z } from 'zod';
import {
  GitFileStatus,
  GitFileStatusSchema,
  GitCommit,
  GitCommitSchema,
  GitDiffResult,
  GitDiffResultSchema,
  GitDiffSummary,
  GitDiffSummarySchema,
  GitBranch,
  GitBranchSchema,
} from '../domain';

export interface GitService {
  status(): Promise<GitFileStatus[]>;
  diff(path: string, opts?: { staged?: boolean }): Promise<GitDiffResult>;
  stage(paths: string[]): Promise<void>;
  unstage(paths: string[]): Promise<void>;
  discard(paths: string[]): Promise<void>;
  commit(message: string, opts?: { amend?: boolean }): Promise<GitCommit>;
  log(opts?: { limit?: number; branch?: string }): Promise<GitCommit[]>;
  branches(): Promise<GitBranch[]>;
  currentBranch(): Promise<string>;
  createBranch(name: string, from?: string): Promise<void>;
  checkout(name: string): Promise<void>;
  deleteBranch(name: string): Promise<void>;
  stashPush(message?: string): Promise<string>;
  stashList(): Promise<{ id: string; message: string; date: string }[]>;
  stashPop(id?: string): Promise<void>;
  getDiffSummary(): Promise<GitDiffSummary>;
  onDidChange(cb: () => void): () => void;
}

// IPC Schemas for Git
export const GitStatusResponseSchema = z.array(GitFileStatusSchema);

export const GitDiffRequestSchema = z.object({
  path: z.string(),
  staged: z.boolean().optional(),
});
export const GitDiffResponseSchema = GitDiffResultSchema;

export const GitStageRequestSchema = z.object({
  paths: z.array(z.string()),
});
export const GitStageResponseSchema = z.object({
  success: z.boolean(),
});

export const GitUnstageRequestSchema = z.object({
  paths: z.array(z.string()),
});
export const GitUnstageResponseSchema = z.object({
  success: z.boolean(),
});

export const GitDiscardRequestSchema = z.object({
  paths: z.array(z.string()),
});
export const GitDiscardResponseSchema = z.object({
  success: z.boolean(),
});

export const GitCommitRequestSchema = z.object({
  message: z.string().min(1),
  amend: z.boolean().optional(),
});
export const GitCommitResponseSchema = GitCommitSchema;

export const GitLogRequestSchema = z.object({
  limit: z.number().int().positive().optional(),
  branch: z.string().optional(),
});
export const GitLogResponseSchema = z.array(GitCommitSchema);

export const GitBranchesResponseSchema = z.array(GitBranchSchema);

export const GitCurrentBranchResponseSchema = z.object({
  branch: z.string(),
});

export const GitCreateBranchRequestSchema = z.object({
  name: z.string().min(1),
  from: z.string().optional(),
});
export const GitCreateBranchResponseSchema = z.object({
  success: z.boolean(),
});

export const GitCheckoutRequestSchema = z.object({
  name: z.string().min(1),
});
export const GitCheckoutResponseSchema = z.object({
  success: z.boolean(),
});

export const GitDeleteBranchRequestSchema = z.object({
  name: z.string().min(1),
});
export const GitDeleteBranchResponseSchema = z.object({
  success: z.boolean(),
});

export const GitStashPushRequestSchema = z.object({
  message: z.string().optional(),
});
export const GitStashPushResponseSchema = z.object({
  id: z.string(),
});

export const GitStashListResponseSchema = z.array(
  z.object({
    id: z.string(),
    message: z.string(),
    date: z.string(),
  })
);

export const GitStashPopRequestSchema = z.object({
  id: z.string().optional(),
});
export const GitStashPopResponseSchema = z.object({
  success: z.boolean(),
});

export const GitDiffSummaryResponseSchema = GitDiffSummarySchema;
