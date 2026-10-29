import { AiService } from '../services/ai';

export async function runAiConformanceTests(
  createService: () => Promise<AiService> | AiService
) {
  const ai = await createService();

  // 1. Providers
  const providers = await ai.getProviders();
  if (!Array.isArray(providers) || providers.length === 0) {
    throw new Error('getProviders did not return models');
  }

  // 2. Key management
  await ai.setApiKey('anthropic', 'sk-ant-conformance-key-12345');
  const hasKey = await ai.hasApiKey('anthropic');
  if (!hasKey) {
    throw new Error('hasApiKey returned false after setApiKey');
  }

  await ai.clearApiKey('anthropic');
  const hasKeyAfterClear = await ai.hasApiKey('anthropic');
  if (hasKeyAfterClear) {
    throw new Error('clearApiKey failed to clear key');
  }

  return true;
}
