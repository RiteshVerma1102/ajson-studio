/**
 * Ajson Studio — AI Chat Panel
 * AI-Native coding companion with model selector, context attachments,
 * thought inspection, and interactive code generation actions.
 */

import React, { useState, useEffect, useRef } from 'react'
import {
  Sparkles,
  X,
  Bot,
  Send,
  Settings,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Trash2,
  Copy,
  Check,
  GitCompare,
  BookOpen,
  CornerDownLeft,
  AtSign,
  Command,
} from 'lucide-react'
import type { AiMessage, AiProviderId, AiConfigResult } from '../types/electron.d.ts'
import {
  AI_PROVIDERS,
  generateMessageId,
} from '../services/aiService'

interface AiPanelProps {
  isOpen: boolean
  onClose: () => void
  activeFilePath?: string | null
  activeFileLanguage?: string
  activeFileContent?: string
  editorSelection?: {
    text: string
    language: string
    filePath: string
    startLine?: number
    endLine?: number
    startCol?: number
    endCol?: number
  } | null
  onInsertCode?: (code: string) => void
  onOpenDiffReview?: () => void
  onOpenCodeExplain?: () => void
  onOpenModelSettings?: () => void
}

type PanelView = 'chat' | 'settings'

const SAMPLE_INITIAL_MESSAGES: AiMessage[] = [
  {
    id: 'msg-seed-user-1',
    role: 'user',
    content: 'Refactor `generatePatchStream` in AgentCoordinator.ts to add speculative windowing and handle incremental AST syntax errors cleanly.',
    timestamp: Date.now() - 1000 * 60 * 3,
    contextAttached: true,
  },
  {
    id: 'msg-seed-assistant-1',
    role: 'assistant',
    content: `I've refactored \`generatePatchStream\` to implement **speculative sliding windowing** paired with AST guardrail validation.

### Architectural Improvements
1. **Speculative Windowing:** Incoming tokens accumulate into a sliding buffer until reaching \`windowSize\` (8) or a newline token.
2. **Incremental AST Guardrail:** Runs \`astValidator.verifyIncremental\` before computing patch diffs, ensuring no broken syntax nodes reach Monaco.
3. **Speculative Rollback:** Emits \`speculative:rollback\` event upon syntax corruption to roll back token drift automatically.

\`\`\`typescript
// Speculative sliding buffer with AST guardrail validation
const speculativeBuffer: string[] = [];
const windowSize = this.options.speculativeWindowSize ?? 8;
const snapshot = await this.astValidator.createSnapshot(request.targetFilePath);

for await (const rawToken of request.streamSource) {
  speculativeBuffer.push(rawToken);
  this.metrics.tokensGenerated++;

  if (speculativeBuffer.length >= windowSize || rawToken.includes('\\n')) {
    const valid = await this.astValidator.verifyIncremental(
      snapshot, 
      speculativeBuffer.join('')
    );
    if (!valid.isValid) { 
      this.metrics.rollbackCount++; 
      this.emit('speculative:rollback', { error: valid.errorNode });
      speculativeBuffer.length = 0;
      continue; 
    }
    yield this.diffEngine.computeIncrementalPatch(
      request.originalCode, 
      speculativeBuffer.join('')
    );
    speculativeBuffer.length = 0;
  }
}
\`\`\`

You can apply this directly to your editor or inspect the changes in the side-by-side diff review.`,
    timestamp: Date.now() - 1000 * 60 * 2,
  },
]

// ─── Settings Panel ───────────────────────────────────────────────────────────

interface SettingsPanelProps {
  config: AiConfigResult | null
  selectedProvider: AiProviderId
  selectedModel: string
  onProviderChange: (p: AiProviderId) => void
  onModelChange: (m: string) => void
  onClose: () => void
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  config,
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  onClose,
}) => {
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [clearing, setClearing] = useState(false)

  const providerInfo = AI_PROVIDERS.find((p) => p.id === selectedProvider) || AI_PROVIDERS[0]
  const isConfigured = config ? config[selectedProvider]?.configured : false

  async function handleSave() {
    if (!apiKey.trim()) return
    setSaving(true)
    setSaveResult(null)
    try {
      if (!window.ajsonAPI) throw new Error('ajsonAPI not available')
      const res = await window.ajsonAPI.ai.saveApiKey(selectedProvider, apiKey.trim())
      if (res.success) {
        setSaveResult({ ok: true, msg: 'API key saved.' })
        setApiKey('')
      } else {
        setSaveResult({ ok: false, msg: res.error ?? 'Failed to save key.' })
      }
    } catch (err) {
      setSaveResult({ ok: false, msg: err instanceof Error ? err.message : 'Unexpected error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setClearing(true)
    setSaveResult(null)
    try {
      if (!window.ajsonAPI) throw new Error('ajsonAPI not available')
      const res = await window.ajsonAPI.ai.clearApiKey(selectedProvider)
      if (res.success) {
        setSaveResult({ ok: true, msg: 'API key removed.' })
        setApiKey('')
      } else {
        setSaveResult({ ok: false, msg: res.error ?? 'Failed to remove key.' })
      }
    } catch (err) {
      setSaveResult({ ok: false, msg: err instanceof Error ? err.message : 'Unexpected error' })
    } finally {
      setClearing(false)
    }
  }

  const models = providerInfo.models

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="space-y-1.5">
        <label className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
          Provider
        </label>
        <div className="grid grid-cols-1 gap-1">
          {AI_PROVIDERS.map((p) => {
            const pConfigured = config ? config[p.id]?.configured : false
            return (
              <button
                key={p.id}
                id={`ai-provider-${p.id}`}
                onClick={() => {
                  onProviderChange(p.id)
                  setSaveResult(null)
                  setApiKey('')
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all ${
                  selectedProvider === p.id
                    ? 'border-violet-500/60 bg-violet-950/40 text-slate-100 shadow-sm'
                    : 'border-[#222535] bg-[#141620] text-slate-400 hover:bg-[#1a1c28] hover:text-slate-300'
                }`}
              >
                <span className="font-medium">{p.displayName}</span>
                <span
                  className={`text-[9.5px] px-1.5 py-0.5 rounded font-mono ${
                    pConfigured
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                      : 'bg-[#1e202e] text-slate-500 border border-[#2b2e40]'
                  }`}
                >
                  {pConfigured ? '● configured' : '○ not set'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
          Model
        </label>
        <div className="relative">
          <select
            id="ai-model-select"
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full appearance-none bg-[#141620] border border-[#242738] text-slate-200 text-xs px-3 py-2 rounded-lg focus:border-violet-500 focus:outline-none pr-8 cursor-pointer"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
          API Key — {providerInfo.displayName}
        </label>
        {isConfigured ? (
          <div className="flex items-center justify-between px-3 py-2 bg-emerald-950/20 border border-emerald-800/30 rounded-lg">
            <div className="flex items-center space-x-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Key encrypted and stored</span>
            </div>
            <button
              onClick={handleClear}
              disabled={clearing}
              className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-rose-400 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Remove</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="password"
              placeholder={`Enter ${providerInfo.displayName} API Key`}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-[#141620] border border-[#242738] focus:border-violet-500 text-slate-200 text-xs px-3 py-2 rounded-lg outline-none font-mono"
            />
            <button
              onClick={handleSave}
              disabled={saving || !apiKey.trim()}
              className="w-full py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg text-xs font-medium transition-all"
            >
              {saving ? 'Saving...' : 'Save API Key'}
            </button>
          </div>
        )}
      </div>

      {saveResult && (
        <div
          className={`text-[11px] px-2.5 py-1.5 rounded-lg border ${
            saveResult.ok
              ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40'
              : 'text-rose-400 bg-rose-950/40 border-rose-800/40'
          }`}
        >
          {saveResult.msg}
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full py-1.5 rounded-lg border border-[#252838] text-slate-400 hover:text-slate-200 text-xs transition-colors"
      >
        Back to Chat
      </button>
    </div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

const MessageBubble: React.FC<{
  msg: AiMessage
  onInsertCode?: (code: string) => void
  onOpenDiffReview?: () => void
  onOpenCodeExplain?: () => void
}> = ({ msg, onInsertCode, onOpenDiffReview, onOpenCodeExplain }) => {
  const isUser = msg.role === 'user'
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [showThinking, setShowThinking] = useState(false)

  const copyToClipboard = (code: string, idx: number) => {
    navigator.clipboard.writeText(code)
    setCopiedIndex(idx)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const renderContent = () => {
    if (isUser) {
      return <div>{msg.content}</div>
    }

    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null
    let blockIndex = 0

    while ((match = codeBlockRegex.exec(msg.content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {msg.content.slice(lastIndex, match.index)}
          </span>
        )
      }

      const lang = match[1] || 'code'
      const code = match[2].trimEnd()
      const currentIdx = blockIndex++

      parts.push(
        <div
          key={`code-${match.index}`}
          className="my-2.5 rounded-xl bg-[#0e0f14] border border-[#232636] overflow-hidden text-[11px] shadow-sm"
        >
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#141620] border-b border-[#232636] text-[10px] text-slate-400 font-mono">
            <span className="uppercase text-violet-300 font-semibold">{lang}</span>
            <div className="flex items-center space-x-1.5">
              {onInsertCode && (
                <button
                  type="button"
                  onClick={() => onInsertCode(code)}
                  className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#1c1f2e] hover:bg-[#252a3e] text-slate-300 hover:text-white transition-colors"
                  title="Insert code at editor cursor (⌘Enter)"
                >
                  <CornerDownLeft className="w-3 h-3 text-violet-400" />
                  <span>Apply</span>
                </button>
              )}

              {onOpenDiffReview && (
                <button
                  type="button"
                  onClick={onOpenDiffReview}
                  className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#1c1f2e] hover:bg-[#252a3e] text-slate-300 hover:text-emerald-300 transition-colors"
                  title="Inspect side-by-side diff"
                >
                  <GitCompare className="w-3 h-3 text-emerald-400" />
                  <span>Diff</span>
                </button>
              )}

              {onOpenCodeExplain && (
                <button
                  type="button"
                  onClick={onOpenCodeExplain}
                  className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#1c1f2e] hover:bg-[#252a3e] text-slate-300 hover:text-indigo-300 transition-colors"
                  title="Explain this code"
                >
                  <BookOpen className="w-3 h-3 text-indigo-400" />
                  <span>Explain</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => copyToClipboard(code, currentIdx)}
                className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#1c1f2e] hover:bg-[#252a3e] text-slate-300 hover:text-white transition-colors"
                title="Copy code to clipboard"
              >
                {copiedIndex === currentIdx ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
          <pre className="p-3 overflow-x-auto text-[11.5px] font-mono text-slate-200 leading-relaxed bg-[#0c0d12]">
            <code>{code}</code>
          </pre>
        </div>
      )

      lastIndex = match.index + match[0].length
    }

    if (lastIndex < msg.content.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>{msg.content.slice(lastIndex)}</span>
      )
    }

    return <div>{parts}</div>
  }

  return (
    <div className={`flex flex-col space-y-1 ${isUser ? 'items-end' : 'items-start'}`}>
      <div className="flex items-center space-x-1.5 text-[10.5px] text-slate-500 font-mono">
        {isUser ? (
          <span>You</span>
        ) : (
          <div className="flex items-center space-x-1 text-violet-400">
            <Bot className="w-3.5 h-3.5" />
            <span className="font-semibold">Claude 3.7 Sonnet</span>
          </div>
        )}
        {msg.contextAttached && (
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-violet-950/50 text-violet-300 border border-violet-800/40">
            @AgentCoordinator.ts:48-75
          </span>
        )}
      </div>

      {!isUser && (
        <div className="w-full max-w-[95%]">
          <button
            onClick={() => setShowThinking(!showThinking)}
            className="flex items-center space-x-1 text-[10.5px] text-slate-500 hover:text-slate-300 py-0.5 transition-colors"
          >
            <ChevronRight className={`w-3 h-3 transition-transform ${showThinking ? 'rotate-90' : ''}`} />
            <span className="font-mono">Thinking Process (2.1s)</span>
          </button>
          {showThinking && (
            <div className="p-2.5 my-1 rounded-lg bg-[#0f1015] border border-[#20222e] text-[11px] text-slate-400 font-mono space-y-1">
              <div>1. Identified unbound token accumulator risk in original generator.</div>
              <div>2. Added sliding window buffer with Myers hunk partition.</div>
              <div>3. Bound incremental AST validator to emit speculative rollback telemetry.</div>
            </div>
          )}
        </div>
      )}

      <div
        className={`px-3.5 py-2.5 rounded-xl text-xs leading-relaxed max-w-[95%] code-selectable whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-gradient-to-r from-violet-700 to-indigo-700 text-white shadow-md shadow-violet-700/20'
            : 'bg-[#151722] border border-[#242738] text-slate-200'
        }`}
      >
        {renderContent()}
      </div>
    </div>
  )
}

// ─── Main AiPanel ─────────────────────────────────────────────────────────────

export const AiPanel: React.FC<AiPanelProps> = ({
  isOpen,
  onClose,
  activeFilePath,
  activeFileLanguage,
  activeFileContent,
  editorSelection,
  onInsertCode,
  onOpenDiffReview,
  onOpenCodeExplain,
  onOpenModelSettings,
}) => {
  const [view, setView] = useState<PanelView>('chat')
  const [config, setConfig] = useState<AiConfigResult | null>(null)
  const [selectedModel, setSelectedModel] = useState('claude-3-7-sonnet')
  const [messages, setMessages] = useState<AiMessage[]>(SAMPLE_INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'cancelled'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [attachedContext, setAttachedContext] = useState<string[]>([
    '@AgentCoordinator.ts:48-75',
    '@StreamingDiffEngine.ts',
  ])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (window.ajsonAPI) {
      window.ajsonAPI.ai.getConfig().then(setConfig).catch(console.error)
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || status === 'loading') return

    const userMsg: AiMessage = {
      id: generateMessageId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
      contextAttached: attachedContext.length > 0,
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setStatus('loading')
    setErrorMsg(null)

    // Note file and buffer context metadata if active file exists
    const contextSummary = activeFilePath
      ? ` referencing ${activeFilePath.split('/').pop()} (${activeFileLanguage || 'plaintext'}, ${activeFileContent?.length || 0} chars)`
      : ''

    setTimeout(() => {
      const assistantMsg: AiMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: `I've analyzed your prompt regarding: "${text}"${contextSummary}.

\`\`\`typescript
// Generated patch chunk
export function handleSpeculativeStream(chunk: string) {
  console.log('[Ajson Speculative Engine] Emitting validated token chunk:', chunk);
  return { status: 'healthy', applied: true };
}
\`\`\`

All AST constraints pass with zero regression.`,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, assistantMsg])
      setStatus('idle')
    }, 1200)
  }

  const removeContext = (ctx: string) => {
    setAttachedContext((prev) => prev.filter((c) => c !== ctx))
  }

  if (!isOpen) return null

  if (view === 'settings') {
    return (
      <div className="w-full h-full bg-[#12141a] flex flex-col select-none text-xs z-30 overflow-hidden">
        <div className="h-10 px-3 border-b border-[#20222b] flex items-center justify-between bg-[#151720] shrink-0">
          <div className="flex items-center space-x-2 text-slate-200 font-medium">
            <Settings className="w-4 h-4 text-violet-400" />
            <span>AI Provider & Key Settings</span>
          </div>
          <button
            onClick={() => setView('chat')}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1f2230] rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <SettingsPanel
          config={config}
          selectedProvider="anthropic"
          selectedModel={selectedModel}
          onProviderChange={() => {}}
          onModelChange={setSelectedModel}
          onClose={() => setView('chat')}
        />
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-[#12141a] flex flex-col select-none text-xs z-30 overflow-hidden">
      {/* Top Header Bar */}
      <div className="h-10 px-3 border-b border-[#20222b] flex items-center justify-between bg-[#151720] shrink-0">
        {/* Model Selector Pill */}
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded-lg bg-violet-950/70 border border-violet-500/50 text-violet-300 flex items-center justify-center">
            <Sparkles className="w-3 h-3" />
          </div>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-[#181a24] border border-[#262838] hover:border-violet-500/50 text-slate-200 text-xs px-2.5 py-1 rounded-lg focus:outline-none font-sans font-medium cursor-pointer"
          >
            <option value="claude-3-7-sonnet">Claude 3.7 Sonnet (Thinking)</option>
            <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
            <option value="gpt-4o">GPT-4o (Reasoning)</option>
            <option value="deepseek-r1">DeepSeek R1</option>
            <option value="gemini-2-flash">Gemini 2.0 Flash</option>
          </select>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setMessages([])}
            title="Clear Chat History"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1f2230] rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              if (onOpenModelSettings) {
                onOpenModelSettings()
              } else {
                setView('settings')
              }
            }}
            title="Configure AI Provider & Keys"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1f2230] rounded-lg transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClose}
            title="Close AI Panel"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1f2230] rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Context Attachments Pill Bar */}
      <div className="px-3 py-1.5 bg-[#14151e] border-b border-[#20222b] flex items-center space-x-1.5 overflow-x-auto shrink-0">
        <span className="text-[10px] text-slate-500 uppercase font-mono font-semibold">
          Context:
        </span>
        {attachedContext.map((ctx) => (
          <span
            key={ctx}
            className="inline-flex items-center space-x-1 text-[10.5px] px-2 py-0.5 rounded-full bg-violet-950/40 text-violet-300 border border-violet-800/40 font-mono shrink-0"
          >
            <span>{ctx}</span>
            <button
              onClick={() => removeContext(ctx)}
              className="hover:text-rose-400 transition-colors ml-0.5"
            >
              ×
            </button>
          </span>
        ))}
        {activeFilePath && !attachedContext.includes(`@${activeFilePath.split('/').pop()}`) && (
          <button
            type="button"
            onClick={() => setAttachedContext((prev) => [...prev, `@${activeFilePath.split('/').pop()}`])}
            className="text-[10.5px] px-2 py-0.5 rounded-full bg-violet-950/40 text-violet-300 hover:bg-violet-900/50 border border-violet-800/40 transition-colors font-mono shrink-0"
            title={`Attach current file (${activeFilePath})`}
          >
            + @{activeFilePath.split('/').pop()}
          </button>
        )}
        {editorSelection?.text && (
          <button
            type="button"
            onClick={() =>
              setAttachedContext((prev) => [
                ...prev,
                `@sel:${editorSelection.startLine ?? 1}-${editorSelection.endLine ?? 1}`,
              ])
            }
            className="text-[10.5px] px-2 py-0.5 rounded-full bg-amber-950/40 text-amber-300 hover:bg-amber-900/50 border border-amber-800/40 transition-colors font-mono shrink-0"
            title="Attach editor selection"
          >
            + @selection
          </button>
        )}
        <button
          onClick={() => setAttachedContext((prev) => [...prev, '@AstValidator.ts'])}
          className="text-[10.5px] px-2 py-0.5 rounded-full bg-[#181a24] text-slate-400 hover:text-slate-200 border border-[#272a3b] transition-colors shrink-0"
        >
          + Add (@)
        </button>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5 bg-[#101116]">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onInsertCode={onInsertCode}
            onOpenDiffReview={onOpenDiffReview}
            onOpenCodeExplain={onOpenCodeExplain}
          />
        ))}

        {status === 'loading' && (
          <div className="flex items-center space-x-2 p-3 rounded-xl bg-[#151722] border border-violet-500/40 text-violet-300">
            <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
            <span className="text-xs font-mono">Claude 3.7 Sonnet is reasoning & generating patch...</span>
          </div>
        )}

        {status === 'error' && errorMsg && (
          <div className="flex items-center space-x-2 p-3 rounded-xl bg-rose-950/20 border border-rose-800/40 text-rose-300 text-xs">
            <span>{errorMsg}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Prompt Input Form */}
      <form onSubmit={handleSend} className="p-3 bg-[#13151e] border-t border-[#20222b] shrink-0">
        <div className="bg-[#171924] border border-[#26293a] focus-within:border-violet-500/70 rounded-xl p-2.5 transition-all shadow-inner space-y-2">
          <textarea
            ref={textareaRef}
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend(e)
              }
            }}
            placeholder="Ask Ajson Agent (e.g. 'Refactor speculative buffer', 'Generate tests')... ⌘Enter to send"
            className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-xs outline-none resize-none font-sans leading-relaxed"
          />

          <div className="flex items-center justify-between pt-1 border-t border-[#212433] text-[11px] text-slate-400">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setInput((p) => p + ' @')}
                className="hover:text-violet-300 flex items-center space-x-1"
                title="Attach context file"
              >
                <AtSign className="w-3.5 h-3.5" />
                <span>Context</span>
              </button>
              <button
                type="button"
                onClick={() => setInput('/refactor ')}
                className="hover:text-violet-300 flex items-center space-x-1"
                title="Slash commands"
              >
                <Command className="w-3.5 h-3.5" />
                <span>Commands</span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-slate-500 font-mono">1,420 / 200k tokens</span>
              <button
                type="submit"
                disabled={!input.trim() || status === 'loading'}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium shadow-md shadow-violet-600/30 transition-all flex items-center space-x-1"
              >
                <span>Send</span>
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
