import React, { useState, useEffect } from 'react'
import {
  Sparkles,
  Check,
  X,
} from 'lucide-react'


interface AiCodeGenOverlayProps {
  isOpen: boolean
  onClose: () => void
  onAccept: (code: string) => void
  initialPrompt?: string
}

export const AiCodeGenOverlay: React.FC<AiCodeGenOverlayProps> = ({
  isOpen,
  onClose,
  onAccept,
  initialPrompt = 'Add exponential backoff retry to streaming AST validation',
}) => {
  const [prompt, setPrompt] = useState(initialPrompt)
  const [isGenerating, setIsGenerating] = useState(true)
  const [streamIndex, setStreamIndex] = useState(0)

  const generatedSnippetLines = [
    { type: 'comment', text: '  /**' },
    { type: 'comment', text: '   * Robust retry wrapper with exponential backoff and jitter' },
    { type: 'comment', text: '   */' },
    { type: 'code', text: '  private async executeWithRetry<T>(' },
    { type: 'code', text: '    fn: () => Promise<T>,' },
    { type: 'code', text: '    maxRetries: number = 3,' },
    { type: 'code', text: '    baseDelayMs: number = 150' },
    { type: 'code', text: '  ): Promise<T> {' },
    { type: 'code', text: '    let attempt = 0;' },
    { type: 'code', text: '    while (attempt < maxRetries) {' },
    { type: 'code', text: '      try {' },
    { type: 'code', text: '        return await fn();' },
    { type: 'code', text: '      } catch (err) {' },
    { type: 'code', text: '        attempt++;' },
    { type: 'code', text: '        if (attempt >= maxRetries) throw err;' },
    { type: 'code', text: '        const backoff = baseDelayMs * Math.pow(2, attempt) + Math.random() * 50;' },
    { type: 'code', text: '        await new Promise((res) => setTimeout(res, backoff));' },
    { type: 'code', text: '      }' },
    { type: 'code', text: '    }' },
    { type: 'code', text: '    throw new Error("Max retries exceeded");' },
    { type: 'code', text: '  }' },
  ]

  useEffect(() => {
    if (isOpen) {
      setIsGenerating(true)
      setStreamIndex(0)
      const interval = setInterval(() => {
        setStreamIndex((prev) => {
          if (prev >= generatedSnippetLines.length) {
            clearInterval(interval)
            setIsGenerating(false)
            return prev
          }
          return prev + 1
        })
      }, 75)
      return () => clearInterval(interval)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleAccept = () => {
    const fullCode = generatedSnippetLines.map((l) => l.text).join('\n')
    onAccept(fullCode)
    onClose()
  }

  return (
    <div className="absolute inset-0 z-40 bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-[#12131a] border border-violet-500/50 rounded-xl shadow-2xl shadow-violet-950/40 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Inline Prompt Bar */}
        <div className="p-3 bg-[#151722] border-b border-[#242838] flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-900/60 border border-violet-500/40 flex items-center justify-center text-violet-300">
            <Sparkles className="w-4 h-4 animate-violet-pulse" />
          </div>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what code to generate or edit (⌘K)..."
            className="flex-1 bg-[#0e1017] border border-[#232737] focus:border-violet-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none font-sans"
          />
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-violet-400 bg-violet-950/60 border border-violet-800/40 px-2 py-1 rounded font-mono">
              Claude 3.7
            </span>
          </div>
        </div>

        {/* Live Code Streaming Container */}
        <div className="p-4 bg-[#0d0e14] overflow-y-auto max-h-[360px] font-mono text-[11.5px] space-y-0.5 border-b border-[#202332]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1b1e2c] text-[10px] text-slate-500 select-none">
            <div className="flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-violet-400 animate-ping' : 'bg-emerald-400'}`} />
              <span className="text-slate-300 font-semibold">
                {isGenerating ? 'Streaming tokens into target buffer...' : 'Code generation complete'}
              </span>
            </div>
            <span className="font-mono text-violet-400">
              {streamIndex}/{generatedSnippetLines.length} lines generated
            </span>
          </div>

          {generatedSnippetLines.slice(0, streamIndex).map((line, idx) => (
            <div
              key={idx}
              className="flex items-start px-2 py-0.5 rounded bg-emerald-950/20 text-emerald-300 border-l-2 border-emerald-500/70"
            >
              <span className="w-6 shrink-0 text-right pr-3 text-slate-600 select-none text-[10px]">
                +{idx + 1}
              </span>
              <span className="whitespace-pre font-mono">{line.text}</span>
            </div>
          ))}

          {isGenerating && (
            <div className="flex items-center space-x-2 text-violet-400 py-1 pl-8 text-xs">
              <span className="inline-block w-2 h-4 bg-violet-400 animate-pulse" />
              <span className="text-[11px] text-slate-400">Predicting speculative tokens...</span>
            </div>
          )}
        </div>

        {/* Interactive Floating Pill Bar */}
        <div className="h-11 px-4 bg-[#141622] flex items-center justify-between text-xs select-none">
          <div className="flex items-center space-x-2 text-[11px] text-slate-400">
            <span>Shortcut:</span>
            <span className="px-1.5 py-0.5 rounded bg-[#1c1f2e] text-slate-300 font-mono text-[10px] border border-[#2a2f45]">
              Tab: Accept All
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#1c1f2e] text-slate-300 font-mono text-[10px] border border-[#2a2f45]">
              Esc: Reject
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-lg border border-[#262a3c] bg-[#181a26] hover:bg-[#202334] text-slate-300 hover:text-white text-xs font-medium transition-colors flex items-center space-x-1"
            >
              <X className="w-3.5 h-3.5 text-rose-400" />
              <span>Discard</span>
            </button>

            <button
              onClick={handleAccept}
              className="px-3.5 py-1 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-medium shadow-md shadow-violet-600/30 transition-all flex items-center space-x-1.5"
            >
              <Check className="w-3.5 h-3.5 text-white" />
              <span>Accept (Tab)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
