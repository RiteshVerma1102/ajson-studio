import { z } from 'zod';
import { WorkspaceInfo, WorkspaceInfoSchema } from '../domain';

export interface WorkspaceService {
  open(path?: string): Promise<WorkspaceInfo | null>;
  getCurrent(): Promise<WorkspaceInfo | null>;
  close(): Promise<void>;
  refresh(): Promise<void>;
  onDidChange(cb: (workspace: WorkspaceInfo | null) => void): () => void;
}

export const WorkspaceOpenRequestSchema = z.object({
  path: z.string().optional(),
});
export type WorkspaceOpenRequest = z.infer<typeof WorkspaceOpenRequestSchema>;

export const WorkspaceOpenResponseSchema = WorkspaceInfoSchema.nullable();

export const WorkspaceGetCurrentResponseSchema = WorkspaceInfoSchema.nullable();

export const WorkspaceCloseResponseSchema = z.object({
  success: z.boolean(),
});

export const WorkspaceRefreshResponseSchema = z.object({
  success: z.boolean(),
});

export const WorkspaceEventSchema = z.object({
  event: z.enum(['opened', 'closed', 'refreshed']),
  workspace: WorkspaceInfoSchema.nullable(),
});
export type WorkspaceEvent = z.infer<typeof WorkspaceEventSchema>;
