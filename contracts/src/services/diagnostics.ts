import { z } from 'zod';
import {
  DiagnosticMarker,
  DiagnosticMarkerSchema,
  DiagnosticsFilter,
  DiagnosticsFilterSchema,
} from '../domain';

export interface DiagnosticsService {
  list(filter?: DiagnosticsFilter): DiagnosticMarker[];
  publish(source: string, uri: string, markers: DiagnosticMarker[]): void;
  clearSource(source: string): void;
  clearUri(uri: string): void;
  onDidChange(cb: () => void): () => void;
}

export const DiagnosticsListRequestSchema = DiagnosticsFilterSchema.optional();
export const DiagnosticsListResponseSchema = z.array(DiagnosticMarkerSchema);

export const DiagnosticsPublishRequestSchema = z.object({
  source: z.string(),
  uri: z.string(),
  markers: z.array(DiagnosticMarkerSchema),
});
