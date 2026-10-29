import { z } from 'zod';
import {
  AgentMission,
  AgentMissionSchema,
  AIEvent,
  AIEventSchema,
} from '../ai';

export interface AgentService {
  createMission(goal: string, options?: { model?: string }): Promise<AgentMission>;
  listMissions(): Promise<AgentMission[]>;
  getMission(id: string): Promise<AgentMission | null>;
  cancelMission(id: string): Promise<void>;
  approveAction(approvalId: string): Promise<void>;
  rejectAction(approvalId: string, reason?: string): Promise<void>;
  onAgentEvent(cb: (missionId: string, event: AIEvent) => void): () => void;
}

export const AgentCreateMissionRequestSchema = z.object({
  goal: z.string().min(1),
  model: z.string().optional(),
});
export const AgentCreateMissionResponseSchema = AgentMissionSchema;

export const AgentListMissionsResponseSchema = z.array(AgentMissionSchema);

export const AgentGetMissionRequestSchema = z.object({
  id: z.string(),
});
export const AgentGetMissionResponseSchema = AgentMissionSchema.nullable();

export const AgentCancelMissionRequestSchema = z.object({
  id: z.string(),
});
export const AgentCancelMissionResponseSchema = z.object({
  success: z.boolean(),
});

export const AgentApproveActionRequestSchema = z.object({
  approvalId: z.string(),
});
export const AgentApproveActionResponseSchema = z.object({
  success: z.boolean(),
});

export const AgentRejectActionRequestSchema = z.object({
  approvalId: z.string(),
  reason: z.string().optional(),
});
export const AgentRejectActionResponseSchema = z.object({
  success: z.boolean(),
});

export const AgentEventPayloadSchema = z.object({
  missionId: z.string(),
  event: AIEventSchema,
});
