import { z } from 'zod';
import {
  OutputChannel,
  OutputChannelSchema,
  OutputLine,
  OutputLineSchema,
  OutputLogLevelSchema,
} from '../domain';

export interface OutputService {
  append(channel: OutputChannel, text: string, level?: 'info' | 'warn' | 'error' | 'success'): void;
  clear(channel: OutputChannel): void;
  list(channel: OutputChannel): OutputLine[];
  onDidAppend(cb: (line: OutputLine) => void): () => void;
}

export const OutputAppendRequestSchema = z.object({
  channel: OutputChannelSchema,
  text: z.string(),
  level: OutputLogLevelSchema.optional(),
});

export const OutputClearRequestSchema = z.object({
  channel: OutputChannelSchema,
});

export const OutputListRequestSchema = z.object({
  channel: OutputChannelSchema,
});
export const OutputListResponseSchema = z.array(OutputLineSchema);
