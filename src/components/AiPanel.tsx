/**
 * Ajson Studio — AI Chat Panel (Day 3)
 *
 * Real chat interface backed by the ai:* IPC API.
 * - Does NOT display fake AI responses
 * - Shows a clear setup screen when no provider is configured
 * - Allows optional code context attachment (selection or current file)
 * - Warns about external transmission before sending
 * - Supports message cancellation (best-effort for non-streaming requests)
 * - Keeps credentials out of UI state; all key management goes through IPC
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Sparkles,
  X,
  Bot,
  Send,
  Settings,
  ChevronDown,
  ChevronRight,
  Key,
  Eye,
  EyeOff,
  Code2,
  FileCode2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  XCircle,
  RefreshCw,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  CornerDownLeft,
} from 'lucide-react'
import type { AiMessage, AiCodeContext, AiProviderId, AiConfigResult } from '../types/electron.d.ts'
import {
  AI_PROVIDERS,
  generateMessageId,
  generateRequestId,
  validateAiRequest,
  isLikelySensitiveFile,
  containsObviousSecrets,
  MAX_CONTEXT_CHARS,
} from '../services/aiService'

interface AiPanelProps {
  isOpen: boolean
  onClose: () => void
  /** Current active tab's file path, for "include file" context */
  activeFilePath?: string | null
  activeFileLanguage?: string
  activeFileContent?: string
  /** Current editor selection, if any */
  editorSelection?: {
    text: string
    language: string
    filePath: string
    startLine?: number
    endLine?: number
    startCol?: number
    endCol?: number
  } | null
  /** Optional callback to insert generated code at editor cursor */
  onInsertCode?: (code: string) => void
}

type PanelView = 'chat' | 'settings'

// ─── Setup / Unconfigured Banner ─────────────────────────────────────────────

const SetupBanner: React.FC<{ onOpenSettings: () => void }> = ({ onOpenSettings }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-4">
    <div className="w-12 h-12 rounded-xl bg-indigo-950/50 border border-indigo-800/40 flex items-center justify-center">
      <Bot className="w-6 h-6 text-indigo-400" />
    </div>
    <div className="text-center space-y-2">
      <h3 className="text-slate-200 font-semibold text-sm">No AI Provider Configured</h3>
      <p className="text-slate-400 text-[11.5px] leading-relaxed max-w-[220px]">
        Connect an AI provider to start getting coding assistance. Your API key is stored securely on this device.
      </p>
    </div>
    <button
      id="ai-open-settings-btn"
      onClick={onOpenSettings}
      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
    >
      <Key className="w-3.5 h-3.5" />
      <span>Configure AI Provider</span>
    </button>
  </div>
)

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
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [clearing, setClearing] = useState(false)

  const providerInfo = AI_PROVIDERS.find((p) => p.id === selectedProvider)!
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
    <div className="flex-1 overflow-y-auto p-3 space-y-4">
      {/* Provider selector */}
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
                className={`flex items-center justify-between px-2.5 py-2 rounded-md border text-[11.5px] transition-all ${
                  selectedProvider === p.id
                    ? 'border-indigo-600/60 bg-indigo-950/40 text-slate-200'
                    : 'border-[#1d2335] bg-[#111420]/60 text-slate-400 hover:bg-[#181d2c] hover:text-slate-300'
                }`}
              >
                <span className="font-medium">{p.displayName}</span>
                <span
                  className={`text-[9.5px] px-1.5 py-0.5 rounded font-mono ${
                    pConfigured
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                      : 'bg-[#1a2030] text-slate-500 border border-[#242b40]'
                  }`}
                >
                  {pConfigured ? '● configured' : '○ not set'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Model selector */}
      <div className="space-y-1.5">
        <label className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
          Model
        </label>
        <div className="relative">
          <select
            id="ai-model-select"
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full appearance-none bg-[#121622] border border-[#1d2335] text-slate-200 text-[11.5px] px-2.5 py-1.5 rounded-md focus:border-indigo-500 focus:outline-none pr-7 cursor-pointer"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {/* API Key entry */}
      <div className="space-y-1.5">
        <label className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
          API Key — {providerInfo.displayName}
        </label>

        {isConfigured ? (
          <div className="flex items-center justify-between px-2.5 py-2 bg-emerald-950/20 border border-emerald-800/30 rounded-md">
            <div className="flex items-center space-x-1.5 text-[11px] text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Key stored (encrypted)</span>
            </div>
            <button
              id="ai-clear-key-btn"
              onClick={handleClear}
              disabled={clearing}
              className="flex items-center space-x-1 text-[10px] text-slate-400 hover:text-rose-400 transition-colors disabled:opacity-50"
            >
              {clearing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              <span>Remove</span>
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center space-x-1.5 bg-[#121622] border border-[#1d2335] rounded-md px-2.5 py-1.5 focus-within:border-indigo-500 transition-colors">
              <input
                id="ai-api-key-input"
                type={showKey ? 'text' : 'password'}
                placeholder={`Paste ${providerInfo.displayName} API key…`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                className="flex-1 bg-transparent text-slate-200 placeholder-slate-500 text-xs focus:outline-none font-mono"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                tabIndex={-1}
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              id="ai-save-key-btn"
              onClick={handleSave}
              disabled={!apiKey.trim() || saving}
              className="w-full flex items-center justify-center space-x-1.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
              <span>{saving ? 'Saving…' : 'Save API Key'}</span>
            </button>
          </div>
        )}

        {saveResult && (
          <div
            className={`flex items-start space-x-1.5 text-[11px] px-2.5 py-2 rounded-md ${
              saveResult.ok
                ? 'bg-emerald-950/30 border border-emerald-800/30 text-emerald-400'
                : 'bg-rose-950/30 border border-rose-800/30 text-rose-400'
            }`}
          >
            {saveResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
            <span>{saveResult.msg}</span>
          </div>
        )}

        <a
          href="#"
          onClick={(e) => { e.preventDefault(); window.open?.(providerInfo.documentationUrl) }}
          className="flex items-center space-x-1 text-[10.5px] text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          <span>Get API key — {providerInfo.displayName}</span>
        </a>
      </div>

      {/* Privacy notice */}
      <div className="px-2.5 py-2.5 bg-amber-950/20 border border-amber-800/30 rounded-md space-y-1">
        <div className="flex items-center space-x-1.5 text-[10.5px] font-semibold text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Privacy Notice</span>
        </div>
        <p className="text-[10px] text-amber-300/70 leading-relaxed">
          When you send a message, selected code context may be transmitted to{' '}
          <strong>{providerInfo.displayName}</strong>'s external servers. Do not include credentials, secrets, or .env file contents in context.
        </p>
      </div>

      <button
        onClick={onClose}
        className="w-full py-1.5 rounded-md border border-[#1d2335] text-slate-400 hover:text-slate-200 hover:border-[#2a3450] text-xs transition-colors"
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
}> = ({ msg, onInsertCode }) => {
  const isUser = msg.role === 'user'
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

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
          className="my-2 rounded-md bg-[#0a0d14] border border-[#1b2234] overflow-hidden text-[11px]"
        >
          <div className="flex items-center justify-between px-2.5 py-1 bg-[#101420] border-b border-[#1b2234] text-[10px] text-slate-400 font-mono">
            <span className="uppercase text-slate-400 font-semibold">{lang}</span>
            <div className="flex items-center space-x-1.5">
              {onInsertCode && (
                <button
                  type="button"
                  onClick={() => onInsertCode(code)}
                  className="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-[#1a2236] text-slate-400 hover:text-cyan-300 transition-colors"
                  title="Insert code at editor cursor"
                >
                  <CornerDownLeft className="w-3 h-3" />
                  <span>Insert</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => copyToClipboard(code, currentIdx)}
                className="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-[#1a2236] text-slate-400 hover:text-slate-200 transition-colors"
                title="Copy code"
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
          <pre className="p-2.5 overflow-x-auto text-[11px] font-mono text-slate-200 leading-relaxed">
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
      <div className="flex items-center space-x-1 text-[10px] text-slate-500 font-mono">
        {isUser ? (
          <span>You</span>
        ) : (
          <>
            <Bot className="w-3 h-3 text-indigo-400" />
            <span>Ajson AI</span>
          </>
        )}
        {msg.contextAttached && (
          <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-indigo-950/50 text-indigo-300 border border-indigo-800/40">
            + context
          </span>
        )}
      </div>
      <div
        className={`px-2.5 py-2 rounded-lg text-[11.5px] leading-relaxed max-w-[90%] code-selectable whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-gradient-to-r from-cyan-700 to-indigo-700 text-white'
            : 'bg-[#141824] border border-[#1f2538] text-slate-300'
        }`}
      >
        {renderContent()}
      </div>
    </div>
  )
}

// ─── Context Selector ─────────────────────────────────────────────────────────

function formatContextSize(charCount: number): string {
  if (charCount < 1024) return `${charCount} chars`
  return `${(charCount / 1024).toFixed(1)} KB (${charCount.toLocaleString()} chars)`
}

interface ContextSelectorProps {
  editorSelection: {
    text: string
    language: string
    filePath: string
    startLine?: number
    endLine?: number
    startCol?: number
    endCol?: number
  } | null | undefined
  activeFilePath: string | null | undefined
  activeFileLanguage: string | undefined
  activeFileContent: string | undefined
  pendingContext: AiCodeContext | null
  onSetContext: (ctx: AiCodeContext | null) => void
}

const ContextSelector: React.FC<ContextSelectorProps> = ({
  editorSelection,
  activeFilePath,
  activeFileLanguage,
  activeFileContent,
  pendingContext,
  onSetContext,
}) => {
  const [expanded, setExpanded] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Selection state & validation
  const hasSelection = !!editorSelection && editorSelection.text.trim().length > 0
  const selectionLines = editorSelection
    ? editorSelection.endLine && editorSelection.startLine
      ? editorSelection.endLine - editorSelection.startLine + 1
      : editorSelection.text.split('\n').length
    : 0
  const selectionRangeLabel = editorSelection?.startLine && editorSelection?.endLine
    ? `L${editorSelection.startLine}–L${editorSelection.endLine} (${selectionLines} lines)`
    : `${selectionLines} lines`
  const selectionChars = editorSelection?.text.length || 0
  const isSelectionSensitive = editorSelection
    ? isLikelySensitiveFile(editorSelection.filePath) || containsObviousSecrets(editorSelection.text)
    : false

  // File state & validation
  const hasFile = typeof activeFileContent === 'string' && activeFileContent.trim().length > 0
  const fileLines = activeFileContent ? activeFileContent.split('\n').length : 0
  const fileChars = activeFileContent?.length || 0
  const isFileOversized = fileChars > MAX_CONTEXT_CHARS
  const isFileSensitive =
    isLikelySensitiveFile(activeFilePath || '') ||
    (activeFileContent ? containsObviousSecrets(activeFileContent) : false)
  const fileName = activeFilePath
    ? activeFilePath.split(/[/\\]/).pop() || 'Untitled'
    : 'Untitled'

  if (!hasSelection && !hasFile && !pendingContext) return null

  function attachSelection() {
    if (!editorSelection || !editorSelection.text.trim() || isSelectionSensitive) return
    const fname = editorSelection.filePath ? editorSelection.filePath.split(/[/\\]/).pop() || 'selection' : 'selection'
    const label = `${fname} • ${selectionRangeLabel}`

    onSetContext({
      type: 'selection',
      filePath: editorSelection.filePath || 'selection',
      language: editorSelection.language || 'plaintext',
      content: editorSelection.text,
      label,
      startLine: editorSelection.startLine,
      endLine: editorSelection.endLine,
      charCount: editorSelection.text.length,
      byteSize: new TextEncoder().encode(editorSelection.text).length,
    })
    setExpanded(false)
    setShowPreview(false)
  }

  function attachFile() {
    if (!activeFileContent || !activeFileContent.trim() || isFileOversized || isFileSensitive) return
    const fname = activeFilePath ? activeFilePath.split(/[/\\]/).pop() || 'file' : 'file'
    const label = `${fname} • Full file (${fileLines} lines)`

    onSetContext({
      type: 'file',
      filePath: activeFilePath || 'Untitled',
      language: activeFileLanguage ?? 'plaintext',
      content: activeFileContent,
      label,
      startLine: 1,
      endLine: fileLines,
      charCount: activeFileContent.length,
      byteSize: new TextEncoder().encode(activeFileContent).length,
    })
    setExpanded(false)
    setShowPreview(false)
  }

  return (
    <div className="px-2 pb-1 space-y-1">
      {pendingContext ? (
        <div className="rounded-md bg-indigo-950/30 border border-indigo-800/40 p-1.5 text-[10.5px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-indigo-300 min-w-0">
              {pendingContext.type === 'selection' ? (
                <Code2 className="w-3 h-3 text-cyan-400 shrink-0" />
              ) : (
                <FileCode2 className="w-3 h-3 text-indigo-400 shrink-0" />
              )}
              <span className="font-medium truncate">{pendingContext.label}</span>
              <span className="text-[9.5px] px-1 py-0.2 rounded bg-indigo-900/40 text-indigo-300/80 border border-indigo-700/30 shrink-0">
                unsaved buffer
              </span>
              <span className="text-indigo-400/80 shrink-0">
                ({formatContextSize(pendingContext.charCount || pendingContext.content.length)})
              </span>
            </div>
            <div className="flex items-center space-x-1 shrink-0 ml-1">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition-colors"
                title={showPreview ? 'Hide context snippet' : 'Preview attached context'}
              >
                {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  onSetContext(null)
                  setShowPreview(false)
                }}
                className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-colors"
                title="Remove attachment"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Collapsible snippet preview */}
          {showPreview && (
            <div className="mt-1.5 p-2 bg-[#080b12] border border-[#182032] rounded text-[10px] font-mono text-slate-300 max-h-24 overflow-y-auto whitespace-pre-wrap break-all leading-normal">
              {pendingContext.content.slice(0, 500)}
              {pendingContext.content.length > 500 && (
                <span className="text-slate-500 italic block mt-1">
                  … and {pendingContext.content.length - 500} more characters
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="relative">
          <button
            type="button"
            id="ai-attach-context-btn"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center space-x-1 text-[10.5px] text-slate-400 hover:text-slate-200 transition-colors"
          >
            {expanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            <Code2 className="w-3 h-3 text-cyan-400" />
            <span>Attach code context</span>
          </button>

          {expanded && (
            <div className="absolute bottom-full left-0 mb-1 w-64 bg-[#0f131d] border border-[#1d2335] rounded-md shadow-2xl z-40 overflow-hidden divide-y divide-[#1b2234]">
              {/* Attach Selection Option */}
              <button
                type="button"
                id="ai-attach-selection-btn"
                onClick={attachSelection}
                disabled={!hasSelection || isSelectionSensitive}
                className="w-full text-left px-3 py-2 text-[11px] hover:bg-[#181d2c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                title={
                  !hasSelection
                    ? 'No text selected in editor'
                    : isSelectionSensitive
                    ? 'Cannot attach: sensitive credentials or secrets detected'
                    : 'Attach highlighted editor selection'
                }
              >
                <div className="flex items-center space-x-2">
                  <Code2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-200 font-medium truncate">
                      {isSelectionSensitive
                        ? '⚠ Sensitive selection blocked'
                        : hasSelection
                        ? `Selected code (${selectionRangeLabel})`
                        : 'Selected text'}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {hasSelection
                        ? `${formatContextSize(selectionChars)} from live editor`
                        : 'Highlight lines in Monaco to attach'}
                    </div>
                  </div>
                </div>
              </button>

              {/* Attach Current File Option */}
              <button
                type="button"
                id="ai-attach-file-btn"
                onClick={attachFile}
                disabled={!hasFile || isFileOversized || isFileSensitive}
                className="w-full text-left px-3 py-2 text-[11px] hover:bg-[#181d2c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  !hasFile
                    ? 'No active file open'
                    : isFileSensitive
                    ? 'Cannot attach: file may contain credentials (.env/keys)'
                    : isFileOversized
                    ? 'File exceeds 50 KB context limit. Select a smaller portion.'
                    : 'Attach active tab buffer'
                }
              >
                <div className="flex items-center space-x-2">
                  <FileCode2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-200 font-medium truncate">
                      {isFileSensitive
                        ? '⚠ Sensitive file blocked'
                        : isFileOversized
                        ? `File too large (${formatContextSize(fileChars)})`
                        : `Current file: ${fileName}`}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {hasFile
                        ? `${fileLines} lines (${formatContextSize(fileChars)}) • unsaved buffer`
                        : 'No active editor buffer'}
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="w-full flex items-center space-x-1.5 px-3 py-1.5 text-[10.5px] text-slate-500 hover:text-slate-300 hover:bg-[#181d2c] transition-colors"
              >
                <X className="w-3 h-3" />
                <span>Dismiss</span>
              </button>
            </div>
          )}
        </div>
      )}
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
}) => {
  const [view, setView] = useState<PanelView>('chat')
  const [config, setConfig] = useState<AiConfigResult | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<AiProviderId>('openai')
  const [selectedModel, setSelectedModel] = useState('gpt-4o')
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'cancelled'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pendingContext, setPendingContext] = useState<AiCodeContext | null>(null)
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load AI config on mount / when panel opens
  useEffect(() => {
    if (!isOpen || !window.ajsonAPI) return
    window.ajsonAPI.ai.getConfig().then(setConfig).catch(() => setConfig(null))
  }, [isOpen, view])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status])

  // Keep model in sync with provider changes
  function handleProviderChange(p: AiProviderId) {
    setSelectedProvider(p)
    const models = AI_PROVIDERS.find((x) => x.id === p)?.models ?? []
    if (models.length > 0) setSelectedModel(models[0].id)
  }

  const isAnyConfigured = config
    ? config.openai.configured || config.anthropic.configured || config.google.configured
    : false

  const isCurrentProviderConfigured = config ? config[selectedProvider]?.configured : false

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || status === 'loading') return

    setErrorMsg(null)

    const userMessage: AiMessage = {
      id: generateMessageId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
      contextAttached: !!pendingContext,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setStatus('loading')

    const requestId = generateRequestId()
    setActiveRequestId(requestId)

    // Build the messages array to send (strip internal metadata for wire format)
    const wireMessages = [...messages, userMessage].map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    }))

    const req = {
      messages: wireMessages,
      context: pendingContext,
      providerId: selectedProvider,
      modelId: selectedModel,
      requestId,
    }

    // Pre-flight client-side validation (mirrors main process validation)
    const validationError = validateAiRequest(req)
    if (validationError) {
      setErrorMsg(validationError.message)
      setStatus('error')
      setActiveRequestId(null)
      return
    }

    try {
      if (!window.ajsonAPI) throw new Error('ajsonAPI bridge not available.')

      const result = await window.ajsonAPI.ai.sendMessage(req)

      if (result.success && result.message) {
        setMessages((prev) => [...prev, result.message!])
        setPendingContext(null)
        setStatus('idle')
      } else if (result.error?.code === 'CANCELLED') {
        setStatus('cancelled')
        setErrorMsg('Request was cancelled.')
      } else {
        setErrorMsg(result.error?.message ?? 'Unknown error from AI provider.')
        setStatus('error')
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected error sending request.')
      setStatus('error')
    } finally {
      setActiveRequestId(null)
    }
  }

  const handleCancel = useCallback(async () => {
    if (!activeRequestId || !window.ajsonAPI) return
    await window.ajsonAPI.ai.cancelRequest(activeRequestId)
    setStatus('cancelled')
    setErrorMsg('Request cancelled.')
    setActiveRequestId(null)
  }, [activeRequestId])

  function handleClearConversation() {
    setMessages([])
    setErrorMsg(null)
    setStatus('idle')
    setPendingContext(null)
  }

  if (!isOpen) return null

  return (
    <div className="w-80 bg-[#0d1017] border-l border-[#1b2030] flex flex-col h-full select-none text-xs z-30">
      {/* Header */}
      <div className="h-9 px-3 border-b border-[#1b2030] flex items-center justify-between bg-[#0a0d13] shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Sparkles className="w-2.5 h-2.5" />
          </div>
          <span className="font-semibold text-slate-200 text-[11.5px] uppercase tracking-wider">
            Ajson AI
          </span>
          {config && isCurrentProviderConfigured && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono">
              {AI_PROVIDERS.find((p) => p.id === selectedProvider)?.displayName}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1">
          {messages.length > 0 && (
            <button
              onClick={handleClearConversation}
              title="Clear conversation"
              className="p-1 text-slate-500 hover:text-slate-300 hover:bg-[#181d2a] rounded transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
          <button
            id="ai-settings-btn"
            onClick={() => setView(view === 'settings' ? 'chat' : 'settings')}
            title="AI Settings"
            className={`p-1 rounded transition-colors ${
              view === 'settings'
                ? 'text-indigo-400 bg-indigo-950/40'
                : 'text-slate-500 hover:text-slate-200 hover:bg-[#181d2a]'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:text-slate-200 text-slate-500 hover:bg-[#181d2a] rounded transition-colors"
            title="Close AI Panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Settings view */}
      {view === 'settings' ? (
        <SettingsPanel
          config={config}
          selectedProvider={selectedProvider}
          selectedModel={selectedModel}
          onProviderChange={handleProviderChange}
          onModelChange={setSelectedModel}
          onClose={() => setView('chat')}
        />
      ) : !isAnyConfigured ? (
        /* Setup state — no provider configured */
        <SetupBanner onOpenSettings={() => setView('settings')} />
      ) : (
        /* Chat view */
        <>
          {/* Provider selector strip (when configured) */}
          {!isCurrentProviderConfigured && (
            <div className="px-3 py-2 bg-amber-950/20 border-b border-amber-800/20 flex items-center space-x-2 shrink-0">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="text-[10.5px] text-amber-300">
                {AI_PROVIDERS.find((p) => p.id === selectedProvider)?.displayName} not configured.{' '}
                <button
                  onClick={() => setView('settings')}
                  className="underline hover:text-amber-200 transition-colors"
                >
                  Add key
                </button>{' '}
                or switch provider in settings.
              </span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-2 opacity-60">
                <Bot className="w-7 h-7 text-indigo-400" />
                <p className="text-slate-400 text-[11px] leading-relaxed max-w-[190px]">
                  Ask a coding question. Optionally attach selected code or the current file as context.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} onInsertCode={onInsertCode} />
            ))}

            {/* Loading indicator */}
            {status === 'loading' && (
              <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                <div className="flex items-center space-x-1 px-2.5 py-2 bg-[#141824] border border-[#1f2538] rounded-lg">
                  <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                  <span>Waiting for response…</span>
                  <button
                    onClick={handleCancel}
                    className="ml-1 text-slate-500 hover:text-rose-400 transition-colors"
                    title="Cancel request"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Error banner */}
            {(status === 'error' || status === 'cancelled') && errorMsg && (
              <div className="flex items-start space-x-2 px-2.5 py-2 bg-rose-950/20 border border-rose-800/30 rounded-md text-[11px] text-rose-300">
                <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                <div className="flex-1 space-y-1">
                  <p>{errorMsg}</p>
                  {status === 'error' && (
                    <button
                      onClick={() => { setStatus('idle'); setErrorMsg(null) }}
                      className="flex items-center space-x-1 text-[10px] text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Dismiss</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Context selector */}
          <ContextSelector
            editorSelection={editorSelection}
            activeFilePath={activeFilePath}
            activeFileLanguage={activeFileLanguage}
            activeFileContent={activeFileContent}
            pendingContext={pendingContext}
            onSetContext={setPendingContext}
          />

          {/* Input form */}
          <form
            onSubmit={handleSend}
            className="p-2 border-t border-[#1b2030] bg-[#090b10] shrink-0"
          >
            <div className="flex items-center space-x-1.5 bg-[#121622] border border-[#222a3f] rounded-md px-2 py-1 focus-within:border-indigo-500 transition-colors">
              <input
                ref={inputRef}
                id="ai-message-input"
                type="text"
                placeholder={
                  !isCurrentProviderConfigured
                    ? 'Configure a provider to chat…'
                    : 'Ask Ajson AI…'
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={status === 'loading' || !isCurrentProviderConfigured}
                className="flex-1 bg-transparent text-slate-200 placeholder-slate-500 text-xs focus:outline-none disabled:opacity-50"
              />
              {status === 'loading' ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="p-1 rounded text-rose-400 hover:text-rose-300 transition-colors"
                  title="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  id="ai-send-btn"
                  disabled={!input.trim() || !isCurrentProviderConfigured}
                  className="p-1 rounded text-indigo-400 hover:text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Send message"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </form>
        </>
      )}
    </div>
  )
}
