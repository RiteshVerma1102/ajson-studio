import { z } from 'zod';

export const AiProviderIdSchema = z.enum(['anthropic', 'openai', 'gemini', 'ollama']);
export type AiProviderId = z.infer<typeof AiProviderIdSchema>;

export const AiModelConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: AiProviderIdSchema,
  contextWindow: z.number().positive(),
  supportsVision: z.boolean().default(false),
  supportsStreaming: z.boolean().default(true),
  supportsTools: z.boolean().default(true),
  costPer1kInput: z.number().optional(),
  costPer1kOutput: z.number().optional(),
});
export type AiModelConfig = z.infer<typeof AiModelConfigSchema>;

export const AiContextItemSchema = z.object({
  path: z.string(),
  content: z.string(),
  language: z.string(),
  startLine: z.number().optional(),
  endLine: z.number().optional(),
  isSelection: z.boolean().optional(),
  byteSize: z.number().optional(),
});
export type AiContextItem = z.infer<typeof AiContextItemSchema>;

export const AiChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.number(),
  context: z.array(AiContextItemSchema).optional(),
});
export type AiChatMessage = z.infer<typeof AiChatMessageSchema>;

// --- Approval Kinds (including 'mcp') ---
export const ApprovalKindSchema = z.enum(['mcp', 'command', 'edit', 'browse', 'delete']);
export type ApprovalKind = z.infer<typeof ApprovalKindSchema>;

export const AgentApprovalRequestSchema = z.object({
  id: z.string(),
  kind: ApprovalKindSchema,
  title: z.string(),
  description: z.string(),
  target: z.string().optional(),
  payload: z.unknown(),
  timestamp: z.number(),
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  resolvedAt: z.number().optional(),
  resolvedReason: z.string().optional(),
});
export type AgentApprovalRequest = z.infer<typeof AgentApprovalRequestSchema>;

// --- AIEvent Union ---
export const AIEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('thought'),
    text: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('tool_call'),
    tool: z.string(),
    params: z.unknown(),
    callId: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('tool_result'),
    callId: z.string(),
    result: z.unknown(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('approval_requested'),
    approval: AgentApprovalRequestSchema,
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('approval_resolved'),
    id: z.string(),
    approved: z.boolean(),
    reason: z.string().optional(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('text_delta'),
    delta: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('done'),
    totalTokens: z.number().optional(),
    durationMs: z.number().optional(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('error'),
    code: z.string(),
    message: z.string(),
    timestamp: z.number(),
  }),
]);
export type AIEvent = z.infer<typeof AIEventSchema>;

// --- Agent Mission Domain Types ---
export const MissionStatusSchema = z.enum([
  'idle',
  'running',
  'waiting_approval',
  'completed',
  'failed',
  'cancelled',
]);
export type MissionStatus = z.infer<typeof MissionStatusSchema>;

export const AgentMissionSchema = z.object({
  id: z.string(),
  title: z.string(),
  goal: z.string(),
  status: MissionStatusSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
  events: z.array(AIEventSchema),
  approvals: z.array(AgentApprovalRequestSchema),
  assignedModel: z.string().optional(),
});
export type AgentMission = z.infer<typeof AgentMissionSchema>;
