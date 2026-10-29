import { z } from 'zod';
import {
  TerminalSession,
  TerminalSessionSchema,
  TerminalSessionOptions,
  TerminalSessionOptionsSchema,
} from '../domain';

export interface TerminalService {
  createSession(options?: TerminalSessionOptions): Promise<string>;
  write(id: string, data: string): void;
  resize(id: string, cols: number, rows: number): void;
  kill(id: string): void;
  onData(id: string, cb: (data: string) => void): () => void;
  onExit(id: string, cb: (code: number) => void): () => void;
  runCommand(
    id: string,
    command: string,
    opts?: { timeoutMs?: number }
  ): Promise<{ exitCode: number; output: string }>;
  onCommandStart(id: string, cb: (cmd: string) => void): () => void;
  onCommandEnd(id: string, cb: (cmd: string, code: number) => void): () => void;
  listSessions(): TerminalSession[];
  getCwd(id: string): string;
}

// IPC Schemas for Terminal
export const TerminalCreateRequestSchema = z.object({
  options: TerminalSessionOptionsSchema.optional(),
});
export const TerminalCreateResponseSchema = z.object({
  id: z.string(),
});

export const TerminalWriteRequestSchema = z.object({
  id: z.string(),
  data: z.string(),
});
export const TerminalWriteResponseSchema = z.object({
  success: z.boolean(),
});

export const TerminalResizeRequestSchema = z.object({
  id: z.string(),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});
export const TerminalResizeResponseSchema = z.object({
  success: z.boolean(),
});

export const TerminalKillRequestSchema = z.object({
  id: z.string(),
});
export const TerminalKillResponseSchema = z.object({
  success: z.boolean(),
});

export const TerminalRunCommandRequestSchema = z.object({
  id: z.string(),
  command: z.string(),
  timeoutMs: z.number().int().positive().optional(),
});
export const TerminalRunCommandResponseSchema = z.object({
  exitCode: z.number(),
  output: z.string(),
});

export const TerminalListResponseSchema = z.array(TerminalSessionSchema);

export const TerminalGetCwdRequestSchema = z.object({
  id: z.string(),
});
export const TerminalGetCwdResponseSchema = z.object({
  cwd: z.string(),
});

export const TerminalDataEventSchema = z.object({
  id: z.string(),
  data: z.string(),
});

export const TerminalExitEventSchema = z.object({
  id: z.string(),
  code: z.number(),
});
