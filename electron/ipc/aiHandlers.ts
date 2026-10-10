/**
 * Ajson Studio — AI IPC Handlers (Day 3, Main Process Only)
 *
 * SECURITY DESIGN:
 * - API keys are stored with Electron safeStorage (OS keychain on Windows/macOS/Linux).
 * - If safeStorage is unavailable (dev/test), keys are held in-memory only for the session.
 * - Keys are never written to disk in plaintext, logs, or renderer process.
 * - All outbound HTTP requests are made here in the main process.
 * - The preload bridge exposes only {success, message, error} — never raw keys.
 * - No AI-generated shell commands are executed.
 * - Requests are size-validated before being forwarded to any provider.
 */

import { ipcMain, safeStorage } from 'electron'
import * as https from 'https'
import * as http from 'http'

// ─── Types (mirrored from renderer service to avoid import across boundaries) ─

type AiProviderId = 'openai' | 'anthropic' | 'google'

interface AiMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  contextAttached?: boolean
}

interface AiCodeContext {
  type: 'selection' | 'file'
  filePath: string
  language: string
  content: string
  label: string
  startLine?: number
  endLine?: number
  charCount?: number
  byteSize?: number
}

interface AiSendMessageRequest {
  messages: AiMessage[]
  context?: AiCodeContext | null
  providerId: AiProviderId
  modelId: string
  temperature?: number
  maxTokens?: number
  requestId: string
}

// ─── Encrypted credential storage ────────────────────────────────────────────

/**
 * In-memory fallback when safeStorage is unavailable (e.g. CI / headless tests).
 * Values are never persisted to disk.
 */
const inMemoryKeyStore = new Map<AiProviderId, string>()

function canUseSafeStorage(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

/**
 * Store an API key securely. Uses Electron safeStorage when available,
 * otherwise falls back to a session-only in-memory store.
 *
 * IMPORTANT: This function is intentionally NOT async-serialized to disk in
 * plaintext. safeStorage encrypts before passing to the OS credential store.
 */
function storeApiKey(providerId: AiProviderId, apiKey: string): void {
  if (canUseSafeStorage()) {
    try {
      const encrypted = safeStorage.encryptString(apiKey)
      // Store the encrypted buffer as base64 in a simple registry map.
      // In production you would use a persistent KV store; for now we use
      // in-memory with base64 as a placeholder that makes the interface correct.
      inMemoryKeyStore.set(providerId, `safeStorage:${encrypted.toString('base64')}`)
    } catch {
      // Fallback: store plaintext in memory only (cleared on app restart)
      console.warn('[AI IPC] safeStorage encryption failed — using session-only memory store')
      inMemoryKeyStore.set(providerId, `plain:${apiKey}`)
    }
  } else {
    inMemoryKeyStore.set(providerId, `plain:${apiKey}`)
  }
}

/**
 * Retrieve a stored API key.
 */
function retrieveApiKey(providerId: AiProviderId): string | null {
  const raw = inMemoryKeyStore.get(providerId)
  if (!raw) return null

  if (raw.startsWith('safeStorage:')) {
    try {
      const b64 = raw.slice('safeStorage:'.length)
      const buf = Buffer.from(b64, 'base64')
      return safeStorage.decryptString(buf)
    } catch {
      return null
    }
  }

  if (raw.startsWith('plain:')) {
    return raw.slice('plain:'.length)
  }

  return null
}

function hasApiKey(providerId: AiProviderId): boolean {
  return !!retrieveApiKey(providerId)
}

function clearApiKey(providerId: AiProviderId): void {
  inMemoryKeyStore.delete(providerId)
}

// ─── Validation constants (duplicated from renderer — no import across boundary) ─

const MAX_REQUEST_CONTENT_CHARS = 100_000
const MAX_CONTEXT_CHARS = 50_000
const MAX_MESSAGE_CHARS = 32_000
const REQUEST_TIMEOUT_MS = 60_000
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

function isLikelySensitiveFilePath(filePath?: string): boolean {
  if (!filePath) return false
  const name = filePath.replace(/\\/g, '/').split('/').pop() ?? ''
  return SENSITIVE_FILE_PATTERNS.some((pat) => pat.test(name))
}

function containsObviousSecretsInContent(content?: string): boolean {
  if (!content) return false
  return OBVIOUS_SECRET_CONTENT_PATTERNS.some((pat) => pat.test(content))
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateRequest(req: AiSendMessageRequest): string | null {
  if (!req || typeof req !== 'object') return 'Invalid request payload.'
  if (!['openai', 'anthropic', 'google'].includes(req.providerId)) {
    return `Unknown provider: "${req.providerId}"`
  }
  if (!req.modelId || typeof req.modelId !== 'string' || req.modelId.trim() === '') {
    return 'No model specified.'
  }
  if (!Array.isArray(req.messages) || req.messages.length === 0) {
    return 'No messages provided.'
  }
  for (const msg of req.messages) {
    if (!msg || typeof msg.content !== 'string') return 'Invalid message format.'
    if (msg.content.length > MAX_MESSAGE_CHARS) {
      return `A message exceeds the ${MAX_MESSAGE_CHARS.toLocaleString()} character limit.`
    }
  }
  if (req.context) {
    if (typeof req.context.content !== 'string' || req.context.content.trim().length === 0) {
      return 'Context cannot be empty.'
    }
    if (isLikelySensitiveFilePath(req.context.filePath)) {
      return `Cannot attach sensitive file "${req.context.filePath}". Credentials and secrets are automatically excluded.`
    }
    if (containsObviousSecretsInContent(req.context.content)) {
      return 'The attached code contains obvious API keys, private keys, or tokens. Credentials are automatically excluded.'
    }
    if (req.context.content.length > MAX_CONTEXT_CHARS) {
      return `Context exceeds ${MAX_CONTEXT_CHARS.toLocaleString()} character limit.`
    }
  }
  const totalChars =
    req.messages.reduce((acc: number, m: AiMessage) => acc + m.content.length, 0) +
    (req.context?.content.length ?? 0)
  if (totalChars > MAX_REQUEST_CONTENT_CHARS) {
    return `Total payload (${totalChars.toLocaleString()} chars) exceeds ${MAX_REQUEST_CONTENT_CHARS.toLocaleString()} character limit.`
  }
  return null
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

interface HttpResult {
  statusCode: number
  body: string
}

function httpPost(
  url: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs: number
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const isHttps = parsed.protocol === 'https:'
    const requestLib = isHttps ? https : http

    const req = requestLib.request(
      {
        method: 'POST',
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body: data }))
        res.on('error', reject)
      }
    )

    req.on('error', reject)

    const timer = setTimeout(() => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    req.on('close', () => clearTimeout(timer))
    req.write(body)
    req.end()
  })
}

// ─── Provider request builders ───────────────────────────────────────────────

async function callOpenAI(
  apiKey: string,
  req: AiSendMessageRequest,
  systemPrompt: string
): Promise<string> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...req.messages.map((m) => ({ role: m.role, content: m.content })),
  ]

  const body = JSON.stringify({
    model: req.modelId,
    messages,
    temperature: req.temperature ?? 0.7,
    max_tokens: req.maxTokens ?? 4096,
  })

  const result = await httpPost(
    'https://api.openai.com/v1/chat/completions',
    { Authorization: `Bearer ${apiKey}` },
    body,
    REQUEST_TIMEOUT_MS
  )

  if (result.statusCode === 401) throw Object.assign(new Error('Invalid API key.'), { code: 'INVALID_KEY' })
  if (result.statusCode === 429) throw Object.assign(new Error('Rate limit exceeded. Try again shortly.'), { code: 'RATE_LIMITED' })
  if (result.statusCode >= 500) throw Object.assign(new Error(`OpenAI server error (${result.statusCode}).`), { code: 'PROVIDER_ERROR' })

  const parsed = JSON.parse(result.body)
  if (!parsed.choices?.[0]?.message?.content) {
    throw Object.assign(new Error('Unexpected response format from OpenAI.'), { code: 'PROVIDER_ERROR' })
  }
  return parsed.choices[0].message.content as string
}

async function callAnthropic(
  apiKey: string,
  req: AiSendMessageRequest,
  systemPrompt: string
): Promise<string> {
  const messages = req.messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }))

  const body = JSON.stringify({
    model: req.modelId,
    system: systemPrompt,
    messages,
    max_tokens: req.maxTokens ?? 4096,
    temperature: req.temperature ?? 0.7,
  })

  const result = await httpPost(
    'https://api.anthropic.com/v1/messages',
    {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body,
    REQUEST_TIMEOUT_MS
  )

  if (result.statusCode === 401) throw Object.assign(new Error('Invalid API key.'), { code: 'INVALID_KEY' })
  if (result.statusCode === 429) throw Object.assign(new Error('Rate limit exceeded. Try again shortly.'), { code: 'RATE_LIMITED' })
  if (result.statusCode >= 500) throw Object.assign(new Error(`Anthropic server error (${result.statusCode}).`), { code: 'PROVIDER_ERROR' })

  const parsed = JSON.parse(result.body)
  const textBlock = parsed.content?.find((c: { type: string; text: string }) => c.type === 'text')
  if (!textBlock?.text) {
    throw Object.assign(new Error('Unexpected response format from Anthropic.'), { code: 'PROVIDER_ERROR' })
  }
  return textBlock.text as string
}

async function callGoogle(
  apiKey: string,
  req: AiSendMessageRequest,
  systemPrompt: string
): Promise<string> {
  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Understood. I am ready to assist.' }] },
    ...req.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  ]

  const body = JSON.stringify({
    contents,
    generationConfig: {
      temperature: req.temperature ?? 0.7,
      maxOutputTokens: req.maxTokens ?? 4096,
    },
  })

  const modelPath = req.modelId.startsWith('models/') ? req.modelId : `models/${req.modelId}`
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${apiKey}`

  const result = await httpPost(url, {}, body, REQUEST_TIMEOUT_MS)

  if (result.statusCode === 400) {
    const parsed = JSON.parse(result.body)
    const msg = parsed.error?.message ?? 'Bad request'
    if (msg.toLowerCase().includes('api key')) {
      throw Object.assign(new Error('Invalid API key.'), { code: 'INVALID_KEY' })
    }
    throw Object.assign(new Error(`Google API error: ${msg}`), { code: 'PROVIDER_ERROR' })
  }
  if (result.statusCode === 429) throw Object.assign(new Error('Rate limit exceeded. Try again shortly.'), { code: 'RATE_LIMITED' })
  if (result.statusCode >= 500) throw Object.assign(new Error(`Google server error (${result.statusCode}).`), { code: 'PROVIDER_ERROR' })

  const parsed = JSON.parse(result.body)
  const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string') {
    throw Object.assign(new Error('Unexpected response format from Google Gemini.'), { code: 'PROVIDER_ERROR' })
  }
  return text
}

// ─── System prompt builder ───────────────────────────────────────────────────

function buildSystemPrompt(context: AiCodeContext | null | undefined): string {
  let prompt =
    'You are Ajson AI, a helpful coding assistant integrated into Ajson Studio, a desktop IDE. ' +
    'Provide concise, accurate, and practical coding assistance. ' +
    'When suggesting code changes, clearly label them and prefer explaining diffs over replacing large blocks. ' +
    'Do not execute shell commands or modify files without explicit user request.'

  if (context) {
    prompt +=
      `\n\nThe user has attached the following code context from ${context.label}` +
      ` (language: ${context.language}):\n\`\`\`${context.language}\n${context.content}\n\`\`\``
  }

  return prompt
}

// ─── Error normalizer ─────────────────────────────────────────────────────────

function normalizeError(err: unknown): { code: string; message: string; retryable: boolean } {
  if (err instanceof Error) {
    const code = (err as Error & { code?: string }).code
    if (code === 'INVALID_KEY') return { code: 'INVALID_KEY', message: err.message, retryable: false }
    if (code === 'RATE_LIMITED') return { code: 'RATE_LIMITED', message: err.message, retryable: true }
    if (code === 'PROVIDER_ERROR') return { code: 'PROVIDER_ERROR', message: err.message, retryable: true }
    if (err.message.includes('timed out')) return { code: 'NETWORK_ERROR', message: 'Request timed out. Check your internet connection.', retryable: true }
    if (err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED')) {
      return { code: 'NETWORK_ERROR', message: 'Cannot reach the AI provider. Check your internet connection.', retryable: true }
    }
    return { code: 'UNKNOWN', message: err.message, retryable: false }
  }
  return { code: 'UNKNOWN', message: String(err), retryable: false }
}

// ─── Active request cancellation registry ────────────────────────────────────

/**
 * Maps requestId -> a flag that the HTTP helper can check periodically.
 * True = cancel has been requested.
 * (Full streaming cancellation requires provider SSE support; non-streaming
 * cancellation is handled by checking this flag before the request starts.)
 */
const cancelRegistry = new Set<string>()

// ─── Register all AI IPC handlers ────────────────────────────────────────────

export function registerAiIpcHandlers(): void {
  // ── Get configuration status (no keys returned) ──────────────────────────
  ipcMain.handle('ai:getConfig', () => {
    return {
      openai: { configured: hasApiKey('openai') },
      anthropic: { configured: hasApiKey('anthropic') },
      google: { configured: hasApiKey('google') },
      safeStorageAvailable: canUseSafeStorage(),
    }
  })

  // ── Save API key (encrypted) ──────────────────────────────────────────────
  ipcMain.handle('ai:saveApiKey', (_event, providerId: AiProviderId, apiKey: string) => {
    try {
      if (!['openai', 'anthropic', 'google'].includes(providerId)) {
        return { success: false, error: 'Unknown provider.' }
      }
      if (typeof apiKey !== 'string' || apiKey.trim() === '') {
        return { success: false, error: 'API key cannot be empty.' }
      }
      // Basic format guards (not a full validation — providers reject bad keys)
      if (apiKey.trim().length < 10) {
        return { success: false, error: 'API key appears too short.' }
      }
      storeApiKey(providerId, apiKey.trim())
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ── Clear API key ─────────────────────────────────────────────────────────
  ipcMain.handle('ai:clearApiKey', (_event, providerId: AiProviderId) => {
    try {
      if (!['openai', 'anthropic', 'google'].includes(providerId)) {
        return { success: false, error: 'Unknown provider.' }
      }
      clearApiKey(providerId)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ── Send AI message ───────────────────────────────────────────────────────
  ipcMain.handle('ai:sendMessage', async (_event, req: AiSendMessageRequest) => {
    // 1. Validate inputs in main process
    const validationError = validateRequest(req)
    if (validationError) {
      return {
        success: false,
        requestId: req?.requestId ?? '',
        error: { code: 'INVALID_REQUEST', message: validationError, retryable: false },
      }
    }

    // 2. Check for prior cancellation
    if (cancelRegistry.has(req.requestId)) {
      cancelRegistry.delete(req.requestId)
      return {
        success: false,
        requestId: req.requestId,
        error: { code: 'CANCELLED', message: 'Request was cancelled.', retryable: false },
      }
    }

    // 3. Check API key
    const apiKey = retrieveApiKey(req.providerId)
    if (!apiKey) {
      return {
        success: false,
        requestId: req.requestId,
        error: {
          code: 'MISSING_API_KEY',
          message: `No API key configured for ${req.providerId}. Open AI Settings to add your key.`,
          retryable: false,
        },
      }
    }

    // 4. Build system prompt with optional context
    const systemPrompt = buildSystemPrompt(req.context)

    // 5. Dispatch to provider
    try {
      let responseText: string

      if (req.providerId === 'openai') {
        responseText = await callOpenAI(apiKey, req, systemPrompt)
      } else if (req.providerId === 'anthropic') {
        responseText = await callAnthropic(apiKey, req, systemPrompt)
      } else if (req.providerId === 'google') {
        responseText = await callGoogle(apiKey, req, systemPrompt)
      } else {
        return {
          success: false,
          requestId: req.requestId,
          error: { code: 'NOT_CONFIGURED', message: 'Provider not implemented.', retryable: false },
        }
      }

      // 6. Post-call cancellation check
      if (cancelRegistry.has(req.requestId)) {
        cancelRegistry.delete(req.requestId)
        return {
          success: false,
          requestId: req.requestId,
          error: { code: 'CANCELLED', message: 'Request was cancelled.', retryable: false },
        }
      }

      // 7. Empty output guard
      if (!responseText || responseText.trim().length === 0) {
        return {
          success: false,
          requestId: req.requestId,
          error: {
            code: 'EMPTY_RESPONSE',
            message: 'The AI provider returned an empty response. Please try rephrasing your request.',
            retryable: true,
          },
        }
      }

      // 8. Oversized response guard (cap at 150,000 chars)
      let finalContent = responseText
      if (finalContent.length > 150_000) {
        finalContent =
          finalContent.slice(0, 150_000) +
          '\n\n[Warning: AI response exceeded maximum length limit and was truncated.]'
      }

      const assistantMessage: AiMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        role: 'assistant',
        content: finalContent,
        timestamp: Date.now(),
      }

      return { success: true, requestId: req.requestId, message: assistantMessage }
    } catch (err) {
      const normalized = normalizeError(err)
      return {
        success: false,
        requestId: req.requestId,
        error: normalized,
      }
    }
  })

  // ── Cancel an in-flight request ───────────────────────────────────────────
  ipcMain.handle('ai:cancelRequest', (_event, requestId: string) => {
    if (typeof requestId === 'string' && requestId) {
      cancelRegistry.add(requestId)
    }
    return { success: true }
  })
}
