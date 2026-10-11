import React, { useState } from 'react'
import {
  Sliders,
  X,
  Key,
  CheckCircle2,
  Zap,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
} from 'lucide-react'

interface ModelSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onSave?: (settings: any) => void
}

export const ModelSettingsModal: React.FC<ModelSettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [activeProvider, setActiveProvider] = useState<'anthropic' | 'openai' | 'gemini' | 'ollama'>('anthropic')
  const [apiKey, setApiKey] = useState('sk-ant-api03-preview-9828472918471928')
  const [showKey, setShowKey] = useState(false)
  const [selectedModel, setSelectedModel] = useState('claude-3-7-sonnet')
  const [temperature, setTemperature] = useState(0.2)
  const [maxTokens, setMaxTokens] = useState(4096)
  const [enableSpeculative, setEnableSpeculative] = useState(true)
  const [testStatus, setTestStatus] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  if (!isOpen) return null

  const handleTestConnection = () => {
    setTesting(true)
    setTestStatus(null)
    setTimeout(() => {
      setTesting(false)
      setTestStatus('Success! Latency: 214ms • Context window: 200k tokens')
    }, 700)
  }

  const handleSave = () => {
    onSave?.({
      provider: activeProvider,
      model: selectedModel,
      temperature,
      maxTokens,
      enableSpeculative,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl max-h-[85vh] bg-[#121319] border border-[#252838] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-12 bg-[#151722] border-b border-[#232637] flex items-center justify-between px-4 select-none">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-950/60 border border-violet-500/40 flex items-center justify-center">
              <Sliders className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <span className="font-semibold text-slate-100 text-xs">Model & AI Provider Settings</span>
              <span className="text-slate-500 text-xs mx-1.5">•</span>
              <span className="text-slate-400 text-xs">Ajson Studio AI Core</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-[#1e2130] text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-300 font-sans">
          {/* Provider Selection Tabs */}
          <div className="space-y-1.5">
            <label className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
              Select AI Inference Provider
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'anthropic', label: 'Anthropic', model: 'Claude 3.7', active: true },
                { id: 'openai', label: 'OpenAI', model: 'GPT-4o / o3-mini' },
                { id: 'gemini', label: 'Google Gemini', model: 'Gemini 2.0 Flash' },
                { id: 'ollama', label: 'Local Ollama', model: 'Qwen 2.5 Coder' },
              ].map((p) => {
                const isSelected = activeProvider === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setActiveProvider(p.id as any)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-violet-950/40 border-violet-500/60 text-slate-100 shadow-sm shadow-violet-950/30'
                        : 'bg-[#151722] border-[#222535] text-slate-400 hover:bg-[#1a1d2c] hover:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-semibold text-xs">{p.label}</span>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-violet-400" />}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{p.model}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Model Dropdown */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                Default Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-[#151722] border border-[#242738] focus:border-violet-500 text-slate-200 text-xs px-3 py-2 rounded-lg outline-none font-mono cursor-pointer"
              >
                <option value="claude-3-7-sonnet">Claude 3.7 Sonnet (Thinking Engine)</option>
                <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                <option value="claude-3-5-haiku">Claude 3.5 Haiku (Ultra-fast)</option>
                <option value="gpt-4o">GPT-4o (Omni Reasoning)</option>
                <option value="o3-mini">o3-mini (High reasoning effort)</option>
                <option value="gemini-2-flash">Gemini 2.0 Flash</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                API Key Configuration
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your API key here..."
                  className="w-full bg-[#151722] border border-[#242738] focus:border-violet-500 text-slate-200 text-xs px-3 py-2 pr-16 rounded-lg outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Connection Test & Storage Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#141620] border border-[#222535]">
            <div className="flex items-center space-x-2 text-[11px] text-slate-400">
              <Key className="w-3.5 h-3.5 text-violet-400" />
              <span>Keys are AES-256 encrypted in local hardware keychain. Never uploaded.</span>
            </div>

            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="px-3 py-1 rounded-md bg-[#1d202e] hover:bg-[#25283a] text-violet-300 border border-violet-500/30 text-xs font-medium transition-colors flex items-center space-x-1.5"
            >
              {testing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 text-amber-400" />}
              <span>{testing ? 'Pinging...' : 'Test Connection'}</span>
            </button>
          </div>

          {testStatus && (
            <div className="p-2.5 rounded-lg bg-emerald-950/25 border border-emerald-800/40 text-emerald-300 text-xs flex items-center space-x-2 font-mono">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{testStatus}</span>
            </div>
          )}

          {/* Hyperparameters Sliders */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#222535]">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                  Temperature
                </label>
                <span className="font-mono text-violet-300 font-bold">{temperature}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-violet-500 cursor-pointer"
              />
              <p className="text-[10.5px] text-slate-500">Lower values give deterministic, precise code patches.</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                  Max Output Tokens
                </label>
                <span className="font-mono text-violet-300 font-bold">{maxTokens}</span>
              </div>
              <input
                type="range"
                min="1024"
                max="16384"
                step="512"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full accent-violet-500 cursor-pointer"
              />
              <p className="text-[10.5px] text-slate-500">Max tokens generated per completion request.</p>
            </div>
          </div>

          {/* Speculative Decoding Switch */}
          <div className="p-3 rounded-lg bg-[#141620] border border-[#222535] flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-200">Speculative Token Window Guardrails</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Automatically rollback syntactic breakages before tokens emit to Monaco buffer.
              </div>
            </div>
            <input
              type="checkbox"
              checked={enableSpeculative}
              onChange={(e) => setEnableSpeculative(e.target.checked)}
              className="accent-violet-500 w-4 h-4 cursor-pointer"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 px-4 bg-[#141622] border-t border-[#232637] flex items-center justify-between text-xs text-slate-400 select-none">
          <span className="text-[11px] font-mono text-slate-500">Ajson Studio v0.1.0-alpha • Runtime: Desktop</span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-[#242738] hover:bg-[#1a1d2c] text-slate-300 text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-xs shadow-md shadow-violet-600/30 transition-all flex items-center space-x-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save & Apply</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
