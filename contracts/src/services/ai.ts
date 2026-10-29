import { z } from 'zod';
import {
  AiProviderId,
  AiProviderIdSchema,
  AiModelConfig,
  AiModelConfigSchema,
  AiChatMessage,
  AiChatMessageSchema,
  AiContextItem,
  AiContextItemSchema,
  AIEvent,
  AIEventSchema,
} from '../ai';

export interface AiService {
  sendMessage(params: {
    messages: AiChatMessage[];
    provider?: AiProviderId;
    model?: string;
    context?: AiContextItem[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<string>;
  cancelRequest(requestId: string): Promise<void>;
  setApiKey(provider: AiProviderId, key: string): Promise<void>;
  hasApiKey(provider: AiProviderId): Promise<boolean>;
  clearApiKey(provider: AiProviderId): Promise<void>;
  getProviders(): Promise<AiModelConfig[]>;
  getActiveProvider(): Promise<AiProviderId>;
  setActiveProvider(provider: AiProviderId): Promise<void>;
  onStreamEvent?(cb: (event: AIEvent) => void): () => void;
}

export const AiSendMessageRequestSchema = z.object({
  messages: z.array(AiChatMessageSchema),
  provider: AiProviderIdSchema.optional(),
  model: z.string().optional(),
  context: z.array(AiContextItemSchema).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
});
export const AiSendMessageResponseSchema = z.object({
  text: z.string(),
  requestId: z.string().optional(),
});

export const AiCancelRequestSchema = z.object({
  requestId: z.string(),
});
export const AiCancelResponseSchema = z.object({
  success: z.boolean(),
});

export const AiSetKeyRequestSchema = z.object({
  provider: AiProviderIdSchema,
  key: z.string(),
});
export const AiSetKeyResponseSchema = z.object({
  success: z.boolean(),
});

export const AiHasKeyRequestSchema = z.object({
  provider: AiProviderIdSchema,
});
export const AiHasKeyResponseSchema = z.object({
  hasKey: z.boolean(),
});

export const AiClearKeyRequestSchema = z.object({
  provider: AiProviderIdSchema,
});
export const AiClearKeyResponseSchema = z.object({
  success: z.boolean(),
});

export const AiGetProvidersResponseSchema = z.array(AiModelConfigSchema);

export const AiStreamEventSchema = AIEventSchema;
