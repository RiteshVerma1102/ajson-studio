/**
 * Ajson Studio — AI Service Layer (Day 3)
 *
 * Provider-independent AI service interface. All provider-specific HTTP logic
 * is kept in the main Electron process (via IPC), so renderer code never
 * holds API keys or makes direct network calls.
 *
 * Key design decisions:
 * - Credentials stay in main process only (Electron safeStorage via IPC)
 * - Renderer talks only through window.ajsonAPI.ai (restricted preload bridge)
 * - AbortController cancellation is forwarded through IPC as a cancel signal
 * - No fake or hardcoded responses; every error state is surfaced honestly
 */

export type AiProviderId = 'openai' | 'anthropic' | 'google'

export interface AiProviderConfig {
  providerId: AiProviderId
  modelId: string
  temperature?: number
  maxTokens?: number
}

export interface AiMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  contextAttached?: boolean
}

export interface AiCodeContext {
  type: 'selection' | 'file'
  filePath: string
  language: string
  content: string
  /** Human-readable label shown in the UI before sending */
  label: string
  startLine?: number
  endLine?: number
  charCount?: number
  byteSize?: number
}

export type AiRequestStatus = 'idle' | 'loading' | 'streaming' | 'cancelled' | 'error'

export interface AiSendMessageRequest {
  messages: AiMessage[]
  context?: AiCodeContext | null
  providerId: AiProviderId
  modelId: string
  temperature?: number
  maxTokens?: number
  requestId: string
}

export interface AiSendMessageResult {
  success: boolean
  requestId: string
  message?: AiMessage
  error?: AiErrorDetail
}

export interface AiErrorDetail {
  code: AiErrorCode
  message: string
  retryable: boolean
}

export type AiErrorCode =
  | 'NOT_CONFIGURED'        // Provider not set up
  | 'MISSING_API_KEY'       // Key not stored
  | 'INVALID_KEY'           // Key rejected by provider
  | 'RATE_LIMITED'          // 429 response
  | 'NETWORK_ERROR'         // Network unreachable / timeout
  | 'PROVIDER_ERROR'        // 5xx from provider
  | 'REQUEST_TOO_LARGE'     // Context/message exceeds model limit
  | 'CANCELLED'             // User cancelled
  | 'INVALID_REQUEST'       // Validation failed before sending
  | 'EMPTY_RESPONSE'        // Provider returned empty output
  | 'UNKNOWN'               // Catch-all

export interface AiProviderInfo {
  id: AiProviderId
  displayName: string
  models: AiModelInfo[]
  requiresApiKey: boolean
  documentationUrl: string
}

export interface AiModelInfo {
  id: string
  displayName: string
  contextWindow: number
  supportsStreaming: boolean
}

// ─── Provider catalogue (static metadata — no keys, no secret URLs) ──────────

export const AI_PROVIDERS: AiProviderInfo[] = [
  {
    id: 'openai',
    displayName: 'OpenAI',
    requiresApiKey: true,
    documentationUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-4o', displayName: 'GPT-4o', contextWindow: 128000, supportsStreaming: true },
      { id: 'gpt-4o-mini', displayName: 'GPT-4o mini', contextWindow: 128000, supportsStreaming: true },
      { id: 'gpt-4-turbo', displayName: 'GPT-4 Turbo', contextWindow: 128000, supportsStreaming: true },
    ],
  },
  {
    id: 'anthropic',
    displayName: 'Anthropic',
    requiresApiKey: true,
    documentationUrl: 'https://console.anthropic.com/keys',
    models: [
      { id: 'claude-opus-5-5', displayName: 'Claude Opus 5.5', contextWindow: 200000, supportsStreaming: true },
      { id: 'claude-sonnet-5-5', displayName: 'Claude Sonnet 5.5', contextWindow: 200000, supportsStreaming: true },
      { id: 'claude-haiku-5-5', displayName: 'Claude Haiku 5.5', contextWindow: 200000, supportsStreaming: true },
    ],
  },
  {
    id: 'google',
    displayName: 'Google Gemini',
    requiresApiKey: true,
    documentationUrl: 'https://aistudio.google.com/app/apikey',
    models: [
      { id: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', contextWindow: 1000000, supportsStreaming: true },
      { id: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', contextWindow: 1000000, supportsStreaming: true },
    ],
  },
]

// ─── Input validation ────────────────────────────────────────────────────────

/** Max total message content allowed in a single request (characters, ~100 KB) */
export const MAX_REQUEST_CONTENT_CHARS = 100_000

/** Max characters for a single attached code context snippet */
export const MAX_CONTEXT_CHARS = 50_000

/** Max individual message content length */
export const MAX_MESSAGE_CHARS = 32_000

export function validateAiRequest(req: AiSendMessageRequest): AiErrorDetail | null {
  if (!req.providerId || !AI_PROVIDERS.find((p) => p.id === req.providerId)) {
    return {
      code: 'INVALID_REQUEST',
      message: `Unknown provider: "${req.providerId}"`,
      retryable: false,
    }
  }

  if (!req.modelId || typeof req.modelId !== 'string' || req.modelId.trim() === '') {
    return {
      code: 'INVALID_REQUEST',
      message: 'A model must be selected before sending.',
      retryable: false,
    }
  }

  if (!Array.isArray(req.messages) || req.messages.length === 0) {
    return {
      code: 'INVALID_REQUEST',
      message: 'No messages to send.',
      retryable: false,
    }
  }

  for (const msg of req.messages) {
    if (!msg.content || typeof msg.content !== 'string') {
      return {
        code: 'INVALID_REQUEST',
        message: 'Message content must be a non-empty string.',
        retryable: false,
      }
    }
    if (msg.content.length > MAX_MESSAGE_CHARS) {
      return {
        code: 'REQUEST_TOO_LARGE',
        message: `A message exceeds the ${MAX_MESSAGE_CHARS.toLocaleString()} character limit.`,
        retryable: false,
      }
    }
  }

  if (req.context) {
    if (!req.context.content || req.context.content.trim().length === 0) {
      return {
        code: 'INVALID_REQUEST',
        message: 'Attached context cannot be empty. Select or provide non-empty code.',
        retryable: false,
      }
    }

    if (isLikelySensitiveFile(req.context.filePath)) {
      return {
        code: 'INVALID_REQUEST',
        message: `Cannot attach sensitive file "${req.context.filePath}". Secrets and credentials are automatically excluded.`,
        retryable: false,
      }
    }

    if (containsObviousSecrets(req.context.content)) {
      return {
        code: 'INVALID_REQUEST',
        message: 'The attached code contains obvious API keys, private keys, or tokens. Credentials are automatically excluded.',
        retryable: false,
      }
    }

    if (req.context.content.length > MAX_CONTEXT_CHARS) {
      return {
        code: 'REQUEST_TOO_LARGE',
        message: `The attached code context (${req.context.content.length.toLocaleString()} chars) exceeds the ${MAX_CONTEXT_CHARS.toLocaleString()} character limit. Select a smaller portion.`,
        retryable: false,
      }
    }
  }

  // Total payload guard
  const totalChars =
    req.messages.reduce((acc, m) => acc + m.content.length, 0) +
    (req.context?.content.length ?? 0)

  if (totalChars > MAX_REQUEST_CONTENT_CHARS) {
    return {
      code: 'REQUEST_TOO_LARGE',
      message: `Total request content (${totalChars.toLocaleString()} chars) exceeds the ${MAX_REQUEST_CONTENT_CHARS.toLocaleString()} character limit. Please shorten your context or clear some history.`,
      retryable: false,
    }
  }

  return null
}

// ─── Sensitive path / env file & secret detection ───────────────────────────

const SENSITIVE_FILE_PATTERNS = [
  /\.env$/i,
  /\.env\./i,
  /secrets?\./i,
  /credentials?\./i,
  /private[-_]?key/i,
  /api[-_]?key/i,
  /id_rsa/i,
  /id_ed25519/i,
  /id_ecdsa/i,
  /id_dsa/i,
  /\.pem$/i,
  /\.pfx$/i,
  /\.p12$/i,
  /\.key$/i,
  /\.keystore$/i,
  /\.jks$/i,
  /\.kdbx$/i,
  /token\.json$/i,
  /auth_token/i,
]

const OBVIOUS_SECRET_CONTENT_PATTERNS = [
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/i,
  /-----BEGIN (?:ENCRYPTED )?PRIVATE KEY-----/i,
  /-----BEGIN CERTIFICATE-----/i,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}\b/,
  /\bsk-[a-zA-Z0-9_-]{32,}\b/,
  /\bAIza[0-9A-Za-z-_]{35}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
]

/**
 * Returns true if a file path looks like it may contain credentials.
 * Used to block accidental attachment of sensitive files.
 */
export function isLikelySensitiveFile(filePath: string): boolean {
  if (!filePath) return false
  const name = filePath.replace(/\\/g, '/').split('/').pop() ?? ''
  return SENSITIVE_FILE_PATTERNS.some((pat) => pat.test(name))
}

/**
 * Returns true if the code text appears to contain hardcoded secret tokens or private keys.
 */
export function containsObviousSecrets(content: string): boolean {
  if (!content) return false
  return OBVIOUS_SECRET_CONTENT_PATTERNS.some((pat) => pat.test(content))
}

// ─── Unique ID generation ────────────────────────────────────────────────────

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// ─── AI Code Actions (Day 4 Phase 2) ─────────────────────────────────────────

export type AiActionType = 'generate' | 'explain' | 'refactor' | 'fix'

export interface AiActionDefinition {
  type: AiActionType
  label: string
  description: string
  promptPrefix: string
  defaultPrompt: string
  requiresSelection: boolean
}

export const AI_ACTION_TEMPLATES: Record<AiActionType, AiActionDefinition> = {
  generate: {
    type: 'generate',
    label: 'Generate Code',
    description: 'Create new code based on natural language instructions',
    promptPrefix: 'Generate: ',
    defaultPrompt: 'Generate a clean, modular implementation for the following requirements:',
    requiresSelection: false,
  },
  explain: {
    type: 'explain',
    label: 'Explain Code',
    description: 'Explain logic, structure, and edge cases of the code',
    promptPrefix: 'Explain: ',
    defaultPrompt: 'Explain how this code works in detail, breaking down the logic, inputs, outputs, and any potential edge cases.',
    requiresSelection: false,
  },
  refactor: {
    type: 'refactor',
    label: 'Refactor Selection',
    description: 'Refactor selected code for readability and performance while preserving behavior',
    promptPrefix: 'Refactor: ',
    defaultPrompt: 'Refactor the selected code to improve readability, maintainability, and performance while strictly preserving its exact behavior.',
    requiresSelection: true,
  },
  fix: {
    type: 'fix',
    label: 'Fix Selected Code',
    description: 'Diagnose and fix bugs, errors, and unhandled edge cases in the selected code',
    promptPrefix: 'Fix: ',
    defaultPrompt: 'Analyze the selected code for bugs, logic errors, syntax mistakes, or unhandled edge cases, and provide a robust, corrected version.',
    requiresSelection: true,
  },
}

export function buildActionPrompt(
  actionType: AiActionType,
  userInstruction?: string,
  contextSnippet?: string
): string {
  const template = AI_ACTION_TEMPLATES[actionType]
  const instruction = userInstruction?.trim() || template.defaultPrompt
  if (!contextSnippet) return instruction

  switch (actionType) {
    case 'explain':
      return `${instruction}\n\nCode to explain:\n\`\`\`\n${contextSnippet}\n\`\`\``
    case 'refactor':
      return `${instruction}\n\nSelected code to refactor:\n\`\`\`\n${contextSnippet}\n\`\`\`\n\nProvide the refactored code block and a brief explanation of the improvements.`
    case 'fix':
      return `${instruction}\n\nSelected code to fix:\n\`\`\`\n${contextSnippet}\n\`\`\`\n\nIdentify the bugs and provide the corrected code block.`
    case 'generate':
      return `${instruction}\n\nContext:\n\`\`\`\n${contextSnippet}\n\`\`\``
    default:
      return instruction
  }
}

export interface ExtractedCodeBlock {
  language: string
  code: string
  startIndex: number
  endIndex: number
}

export function extractCodeBlocks(markdown: string): ExtractedCodeBlock[] {
  if (!markdown) return []
  const regex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g
  const blocks: ExtractedCodeBlock[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(markdown)) !== null) {
    blocks.push({
      language: match[1] || 'plaintext',
      code: match[2].trimEnd(),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    })
  }
  return blocks
}
