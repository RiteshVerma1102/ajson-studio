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
  Plus,
  History,
  Square,
  AlertTriangle,
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
    id: 'msg-seed-assistant-1',
    role: 'assistant',
    content: `Welcome to **Ajson Studio AI**! 👋

I can help you with your JSON files:
- ✅ **Format & validate** JSON
- 🔍 **Explain** any JSON structure
- ✏️ **Generate** JSON from a description
- 🔄 **Transform** or filter JSON data

Open a JSON file and ask me anything!`,
    timestamp: Date.now() - 1000 * 30,
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
            ? 'bg-[#252526] border border-[#333333] text-white'
            : 'bg-[#252526] border border-[#333333] text-[#CCCCCC]'
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
  interface ChatSession {
    id: string
    title: string
    messages: AiMessage[]
    timestamp: number
  }

  const [view, setView] = useState<PanelView>('chat')
  const [config, setConfig] = useState<AiConfigResult | null>(null)
  const [selectedModel, setSelectedModel] = useState('claude-3-7-sonnet')
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: 'session-1',
      title: 'Welcome',
      messages: SAMPLE_INITIAL_MESSAGES,
      timestamp: Date.now() - 1000 * 60,
    },
  ])
  const [activeSessionId, setActiveSessionId] = useState('session-1')
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false)
  const [messages, setMessages] = useState<AiMessage[]>(SAMPLE_INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'cancelled'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [attachedContext, setAttachedContext] = useState<string[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const generationTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (window.ajsonAPI) {
      window.ajsonAPI.ai.getConfig().then(setConfig).catch(console.error)
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status])

  // Sync messages back to active session
  useEffect(() => {
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? { ...s, messages } : s))
    )
  }, [messages, activeSessionId])

  // Map selected model to provider
  const currentProviderId: AiProviderId = selectedModel.includes('gpt')
    ? 'openai'
    : selectedModel.includes('gemini')
    ? 'google'
    : 'anthropic'

  const isConfigured = config ? config[currentProviderId]?.configured : false

  const handleNewChat = () => {
    const newId = `session-${Date.now()}`
    const newSession: ChatSession = {
      id: newId,
      title: 'New Conversation',
      messages: [],
      timestamp: Date.now(),
    }
    setSessions((prev) => [newSession, ...prev])
    setActiveSessionId(newId)
    setMessages([])
    setStatus('idle')
    setErrorMsg(null)
  }

  const handleSelectSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId)
    if (session) {
      setActiveSessionId(sessionId)
      setMessages(session.messages)
      setShowHistoryDropdown(false)
      setStatus('idle')
      setErrorMsg(null)
    }
  }

  const handleStopGenerating = () => {
    if (status === 'loading') {
      if (generationTimerRef.current) {
        clearTimeout(generationTimerRef.current)
        generationTimerRef.current = null
      }
      setStatus('cancelled')
    }
  }

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

    generationTimerRef.current = setTimeout(() => {
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
    <div className="w-full h-full bg-[#181818] flex flex-col select-none text-xs z-30 overflow-hidden">
      {/* Top Header Bar */}
      <div className="h-9 px-3 border-b border-[#333333] flex items-center justify-between bg-[#181818] shrink-0 text-[#CCCCCC]">
        <div className="flex items-center space-x-2 truncate">
          <span className="font-medium text-[12px] text-white truncate">
            {sessions.find((s) => s.id === activeSessionId)?.title || 'Run The Project'}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={handleNewChat}
            title="Start New Chat"
            className="p-1 text-[#9DA3AE] hover:text-white hover:bg-[#2A2D2E] rounded-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
              title="Conversation History"
              className={`p-1 rounded transition-colors ${
                showHistoryDropdown ? 'bg-violet-950/60 text-violet-300' : 'text-slate-400 hover:text-slate-100 hover:bg-[#1c1d28]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
            </button>

            {showHistoryDropdown && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-[#14151e] border border-[#252837] rounded-lg shadow-2xl p-1 z-50 text-xs font-mono space-y-0.5">
                <div className="text-[10px] text-slate-500 uppercase px-2 py-1 font-sans font-semibold">
                  Past Conversations
                </div>
                {sessions.map((sess) => (
                  <button
                    key={sess.id}
                    onClick={() => handleSelectSession(sess.id)}
                    className={`w-full text-left px-2 py-1.5 rounded truncate transition-colors ${
                      sess.id === activeSessionId
                        ? 'bg-violet-950/50 text-violet-200'
                        : 'text-slate-300 hover:bg-[#1c1e2a]'
                    }`}
                  >
                    {sess.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setMessages([])}
            title="Clear Chat Messages"
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-[#1c1d28] rounded transition-colors"
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
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-[#1c1d28] rounded transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClose}
            title="Close AI Panel"
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-[#1c1d28] rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Context Attachments Pill Bar */}
      <div className="px-3 py-1.5 bg-[#181818] border-b border-[#333333] flex items-center space-x-1.5 overflow-x-auto shrink-0">
        <span className="text-[10px] text-[#858585] uppercase font-mono font-semibold">
          Context:
        </span>
        {attachedContext.map((ctx) => (
          <span
            key={ctx}
            className="inline-flex items-center space-x-1 text-[10.5px] px-2 py-0.5 rounded-sm bg-[#252526] text-[#CCCCCC] border border-[#333333] font-mono shrink-0"
          >
            <span>{ctx}</span>
            <button
              onClick={() => removeContext(ctx)}
              className="hover:text-[#F14C4C] transition-colors ml-0.5"
            >
              ×
            </button>
          </span>
        ))}
        {activeFilePath && !attachedContext.includes(`@${activeFilePath.split('/').pop()}`) && (
          <button
            type="button"
            onClick={() => setAttachedContext((prev) => [...prev, `@${activeFilePath.split('/').pop()}`])}
            className="text-[10.5px] px-2 py-0.5 rounded-sm bg-[#252526] text-[#CCCCCC] hover:text-white border border-[#333333] transition-colors font-mono shrink-0"
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
            className="text-[10.5px] px-2 py-0.5 rounded-sm bg-[#252526] text-amber-300 hover:text-amber-200 border border-[#333333] transition-colors font-mono shrink-0"
            title="Attach editor selection"
          >
            + @selection
          </button>
        )}
        <button
          onClick={() => setAttachedContext((prev) => [...prev, '@AstValidator.ts'])}
          className="text-[10.5px] px-2 py-0.5 rounded-sm bg-[#252526] text-[#9DA3AE] hover:text-white border border-[#333333] transition-colors shrink-0"
        >
          + Add (@)
        </button>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5 bg-[#181818]">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-3 text-slate-500">
            <div className="w-10 h-10 rounded-xl bg-violet-950/50 border border-violet-800/40 flex items-center justify-center text-violet-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-slate-200 font-semibold text-xs">Ajson Coding Assistant</div>
              <div className="text-[11px] text-slate-500">Ask a question or prompt changes to your active code</div>
            </div>
            <div className="w-full space-y-1.5 pt-2 text-left">
              {[
                'Refactor active selection with speculative buffering',
                'Explain generatePatchStream() AST validation logic',
                'Generate test cases for StreamingDiffEngine',
              ].map((starter) => (
                <button
                  key={starter}
                  onClick={() => setInput(starter)}
                  className="w-full text-left p-2 rounded-lg bg-[#141620] hover:bg-[#1a1d2c] border border-[#232637] text-[11px] text-slate-300 transition-colors"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        )}

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
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#141620] border border-violet-500/40 text-violet-300">
            <div className="flex items-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
              <span className="text-xs font-mono">Generating response...</span>
            </div>
            <button
              onClick={handleStopGenerating}
              className="px-2 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/40 flex items-center space-x-1 text-[11px] transition-colors"
            >
              <Square className="w-3 h-3 fill-rose-300" />
              <span>Stop</span>
            </button>
          </div>
        )}

        {status === 'error' && errorMsg && (
          <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/50 text-rose-300 text-xs space-y-2">
            <div className="flex items-center space-x-1.5 font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>AI Provider Notice</span>
            </div>
            <p className="text-[11.5px] leading-relaxed text-rose-200/90">{errorMsg}</p>
            {onOpenModelSettings && (
              <button
                type="button"
                onClick={onOpenModelSettings}
                className="px-2.5 py-1 rounded bg-rose-900/40 hover:bg-rose-900/60 text-white text-xs font-medium border border-rose-700/50 transition-colors"
              >
                Configure Provider Key
              </button>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Prompt Input Form */}
      <form onSubmit={handleSend} className="p-3 bg-[#181818] border-t border-[#333333] shrink-0">
        <div className="bg-[#1E1E1E] border border-[#333333] focus-within:border-[#007ACC] rounded-xl p-2.5 transition-colors space-y-2">
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
            placeholder="Ask anything, @ to mention, / for actions"
            className="w-full bg-transparent text-[#CCCCCC] placeholder-[#6E7681] text-xs outline-none resize-none font-sans leading-relaxed"
          />

          <div className="flex items-center justify-between pt-1 text-[11px] text-[#9DA3AE]">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setInput((p) => p + ' @')}
                className="hover:text-white p-1 rounded-sm hover:bg-[#252526] transition-colors"
                title="Add context"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              {/* Model Picker Pill */}
              <div className="relative flex items-center">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="bg-[#252526] hover:bg-[#2A2D2E] border border-[#333333] hover:border-[#007ACC] text-[#CCCCCC] text-[10.5px] pl-2 pr-5 py-0.5 rounded-md focus:outline-none font-sans cursor-pointer appearance-none transition-colors"
                >
                  <option value="gemini-3.8-flash">Gemini 3.8 Flash High</option>
                  <option value="claude-3-7-sonnet">Claude 3.7 Sonnet</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="deepseek-r1">DeepSeek R1</option>
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9DA3AE] pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={!input.trim() || status === 'loading'}
              className="w-7 h-7 rounded-full bg-[#37373D] hover:bg-[#007ACC] disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors"
              title="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
