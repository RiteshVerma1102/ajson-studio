import {
  AiService,
  AiModelConfig,
  AiProviderId,
  AiChatMessage,
  AiContextItem,
  AIEvent,
} from '@ajson/contracts';

export class MockAiService implements AiService {
  private activeProvider: AiProviderId = 'anthropic';
  private apiKeys: Map<AiProviderId, string> = new Map();
  private streamListeners: Set<(event: AIEvent) => void> = new Set();

  private defaultModels: AiModelConfig[] = [
    {
      id: 'claude-3-5-sonnet',
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      contextWindow: 200000,
      supportsVision: true,
      supportsStreaming: true,
      supportsTools: true,
      costPer1kInput: 0.003,
      costPer1kOutput: 0.015,
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      contextWindow: 128000,
      supportsVision: true,
      supportsStreaming: true,
      supportsTools: true,
      costPer1kInput: 0.005,
      costPer1kOutput: 0.015,
    },
    {
      id: 'gemini-1-5-pro',
      name: 'Gemini 1.5 Pro',
      provider: 'gemini',
      contextWindow: 1000000,
      supportsVision: true,
      supportsStreaming: true,
      supportsTools: true,
    },
    {
      id: 'llama-3-8b',
      name: 'Llama 3 (Local)',
      provider: 'ollama',
      contextWindow: 8192,
      supportsVision: false,
      supportsStreaming: true,
      supportsTools: false,
    },
  ];

  async getProviders(): Promise<AiModelConfig[]> {
    return this.defaultModels;
  }

  async getActiveProvider(): Promise<AiProviderId> {
    return this.activeProvider;
  }

  async setActiveProvider(provider: AiProviderId): Promise<void> {
    this.activeProvider = provider;
  }

  async setApiKey(provider: AiProviderId, key: string): Promise<void> {
    this.apiKeys.set(provider, key);
  }

  async hasApiKey(provider: AiProviderId): Promise<boolean> {
    if (provider === 'ollama') return true;
    return this.apiKeys.has(provider);
  }

  async clearApiKey(provider: AiProviderId): Promise<void> {
    this.apiKeys.delete(provider);
  }

  async cancelRequest(_requestId: string): Promise<void> {
    // No-op for mock
  }

  async sendMessage(params: {
    messages: AiChatMessage[];
    provider?: AiProviderId;
    model?: string;
    context?: AiContextItem[];
  }): Promise<string> {
    const lastMsg = params.messages[params.messages.length - 1]?.content || '';
    
    // Simulate streaming events
    this.notifyStream({
      type: 'thought',
      text: 'Analyzing project context and code structure...',
      timestamp: Date.now(),
    });

    const response = `[Ajson AI Response]\nI have analyzed your request: "${lastMsg.slice(0, 50)}...". Everything looks clean and ready for implementation.`;

    this.notifyStream({
      type: 'text_delta',
      delta: response,
      timestamp: Date.now(),
    });

    this.notifyStream({
      type: 'done',
      totalTokens: 142,
      durationMs: 320,
      timestamp: Date.now(),
    });

    return response;
  }

  onStreamEvent(cb: (event: AIEvent) => void): () => void {
    this.streamListeners.add(cb);
    return () => {
      this.streamListeners.delete(cb);
    };
  }

  private notifyStream(event: AIEvent) {
    for (const listener of this.streamListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in AI stream listener', err);
      }
    }
  }
}
