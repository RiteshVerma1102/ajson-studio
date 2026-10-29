import { z } from 'zod';
import {
  IndexSymbol,
  IndexSymbolSchema,
  IndexStatus,
  IndexStatusSchema,
} from '../domain';

export interface IndexService {
  indexWorkspace(): Promise<void>;
  searchSymbols(query: string, limit?: number): Promise<IndexSymbol[]>;
  getStatus(): Promise<IndexStatus>;
  onIndexProgress?(cb: (status: IndexStatus) => void): () => void;
}

export const IndexWorkspaceResponseSchema = z.object({
  success: z.boolean(),
});

export const IndexSearchSymbolsRequestSchema = z.object({
  query: z.string(),
  limit: z.number().int().positive().optional(),
});
export const IndexSearchSymbolsResponseSchema = z.array(IndexSymbolSchema);

export const IndexGetStatusResponseSchema = IndexStatusSchema;
