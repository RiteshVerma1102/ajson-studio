import React, { useState, useEffect, useCallback } from 'react'
import { X, Key, CheckCircle2, Eye, EyeOff, Save, Trash2, AlertTriangle } from 'lucide-react'
import { AI_PROVIDERS } from '../services/aiService'
import type { AiProviderId, AiConfigResult } from '../types/electron'

interface ModelSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  /** Called only after a key was really saved or removed. */
  onSave?: (change: { provider: AiProviderId; action: 'saved' | 'removed' }) => void
}

export const ModelSettingsModal: React.FC<ModelSettingsModalProps> = ({ isOpen, onClose, onSave }) => {
  const [provider, setProvider] = useState<AiProviderId>('anthropic')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [config, setConfig] = useState<AiConfigResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const api = typeof window !== 'undefined' ? window.ajsonAPI?.ai : undefined

  const refresh = useCallback(async () => {
    if (!api) {
      return
    }
    try {
      setConfig(await api.getConfig())
    } catch {
      setConfig(null)
    }
  }, [api])

  useEffect(() => {
    if (isOpen) {
      setApiKey('')
      setResult(null)
      void refresh()
    }
  }, [isOpen, refresh])

  if (!isOpen) {
    return null
  }

  const info = AI_PROVIDERS.find((p) => p.id === provider) ?? AI_PROVIDERS[0]
  const configured = Boolean(config?.[provider]?.configured)

  const save = async () => {
    if (!api || !apiKey.trim()) {
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const res = await api.saveApiKey(provider, apiKey.trim())
      if (res.success) {
        setApiKey('')
        setResult({ ok: true, msg: `${info.displayName} key saved.` })
        onSave?.({ provider, action: 'saved' })
        await refresh()
      } else {
        setResult({ ok: false, msg: res.error ?? 'Failed to save key.' })
      }
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : 'Unexpected error' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!api) {
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const res = await api.clearApiKey(provider)
      if (res.success) {
        setResult({ ok: true, msg: `${info.displayName} key removed.` })
        onSave?.({ provider, action: 'removed' })
        await refresh()
      } else {
        setResult({ ok: false, msg: res.error ?? 'Failed to remove key.' })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="AI provider settings">
      <div className="w-full max-w-lg bg-[#1F1F1F] border border-[#333333] rounded-md shadow-2xl flex flex-col overflow-hidden">
        <div className="h-10 px-4 flex items-center justify-between border-b border-[#333333] bg-[#181818]">
          <div className="flex items-center space-x-2 text-[#E6E6E6] text-[12.5px] font-medium">
            <Key className="w-4 h-4 text-[#007ACC]" />
            <span>AI Provider Keys</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-[#9DA3AE] hover:text-white hover:bg-[#2A2D2E] rounded-sm">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs text-[#CCCCCC]">
          {!api && (
            <div className="flex items-start space-x-2 p-2.5 rounded-sm bg-amber-950/30 border border-amber-800/40 text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Keys can only be stored in the desktop app. They are encrypted and kept in the Electron main process, never in the browser.</span>
            </div>
          )}
          {config && !config.safeStorageAvailable && (
            <div className="flex items-start space-x-2 p-2.5 rounded-sm bg-amber-950/30 border border-amber-800/40 text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>OS-level encryption is unavailable on this system, so saved keys are not protected by the OS keychain.</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2" role="tablist">
            {AI_PROVIDERS.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={provider === p.id}
                onClick={() => {
                  setProvider(p.id)
                  setApiKey('')
                  setResult(null)
                }}
                className={`px-2 py-2 rounded-sm border text-left ${
                  provider === p.id ? 'border-[#007ACC] bg-[#04395E]/40 text-white' : 'border-[#333333] bg-[#252526] hover:bg-[#2A2D2E]'
                }`}
              >
                <div className="font-medium">{p.displayName}</div>
                <div className={`text-[10px] ${config?.[p.id]?.configured ? 'text-emerald-400' : 'text-[#858585]'}`}>
                  {config?.[p.id]?.configured ? 'Key saved' : 'No key'}
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="provider-key" className="text-[10.5px] font-semibold text-[#9DA3AE] uppercase tracking-wider">
              {info.displayName} API key {configured && <span className="normal-case text-emerald-400">(a key is already saved; entering a new one replaces it)</span>}
            </label>
            <div className="relative">
              <input
                id="provider-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="Paste your API key"
                className="w-full bg-[#181818] border border-[#333333] focus:border-[#007ACC] text-[#E6E6E6] px-3 py-2 pr-9 rounded-sm outline-none font-mono"
              />
              <button type="button" onClick={() => setShowKey(!showKey)} aria-label={showKey ? 'Hide key' : 'Show key'} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9DA3AE] hover:text-white">
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="text-[10.5px] text-[#858585]">
              Get a key at <span className="font-mono">{info.documentationUrl}</span>. The key is validated by the provider on your first request.
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10.5px] font-semibold text-[#9DA3AE] uppercase tracking-wider">Available models</div>
            <div className="font-mono text-[11px] text-[#CCCCCC]">{info.models.map((m) => m.id).join(', ')}</div>
          </div>

          {result && (
            <div className={`flex items-center space-x-1.5 ${result.ok ? 'text-emerald-400' : 'text-red-400'}`} role="status">
              {result.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              <span>{result.msg}</span>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[#333333] bg-[#181818] flex items-center justify-between">
          <button
            onClick={remove}
            disabled={!api || !configured || busy}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-sm border border-[#333333] text-red-300 hover:bg-[#2A2D2E] disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove key</span>
          </button>
          <div className="flex items-center space-x-2">
            <button onClick={onClose} className="px-3 py-1 rounded-sm border border-[#333333] hover:bg-[#2A2D2E]">
              Close
            </button>
            <button
              onClick={save}
              disabled={!api || !apiKey.trim() || busy}
              className="flex items-center space-x-1 px-3 py-1 rounded-sm bg-[#007ACC] hover:bg-[#0098FF] text-white disabled:opacity-40"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save key</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
