import React from 'react'
import {
  Sparkles,
  BookOpen,
  X,
  Clock,
  Cpu,
  ShieldCheck,
  Copy,
  Check,
} from 'lucide-react'


interface CodeExplanationModalProps {
  isOpen: boolean
  onClose: () => void
  symbolName?: string
  filePath?: string
}

export const CodeExplanationModal: React.FC<CodeExplanationModalProps> = ({
  isOpen,
  onClose,
  symbolName = 'generatePatchStream()',
  filePath = 'src/ai/AgentCoordinator.ts',
}) => {
  const [copied, setCopied] = React.useState(false)

  if (!isOpen) return null

  const handleCopy = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[85vh] bg-[#121319] border border-[#262838] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-12 bg-[#151722] border-b border-[#232637] flex items-center justify-between px-4 select-none">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-950/60 border border-violet-500/40 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <span className="font-semibold text-slate-100 text-xs">AI Code Explanation</span>
              <span className="text-slate-500 text-xs mx-1.5">•</span>
              <span className="font-mono text-violet-300 text-xs">{symbolName}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="px-2.5 py-1 rounded-md border border-[#252839] hover:bg-[#1a1d2c] text-slate-400 hover:text-slate-200 text-xs transition-colors flex items-center space-x-1"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-md hover:bg-[#1f2233] text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-300 leading-relaxed font-sans">
          {/* Executive Summary Card */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-violet-950/30 to-indigo-950/20 border border-violet-500/30 space-y-2">
            <div className="flex items-center space-x-2 text-violet-300 font-semibold text-sm">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span>Architectural Overview</span>
            </div>
            <p className="text-slate-300 text-[12px] leading-relaxed">
              <code>AgentCoordinator.generatePatchStream</code> is an <strong>asynchronous generator</strong> that accepts a streaming token source from an AI model and emits atomic <code>PatchChunk</code> diffs in real time. Rather than yielding unvetted raw strings, it runs an <strong>incremental AST guardrail</strong> on sliding token windows to detect syntax corruptions and trigger speculative rollbacks before invalid code reaches the editor.
            </p>
          </div>

          {/* Complexity Cards Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-[#151722] border border-[#242738] space-y-1">
              <div className="flex items-center space-x-1.5 text-slate-400 text-[11px]">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold uppercase tracking-wider text-[10px]">Time Complexity</span>
              </div>
              <div className="font-mono text-base font-bold text-slate-100">O(N) Amortized</div>
              <p className="text-[10.5px] text-slate-400">
                Linear scan per token stream with bounded sliding window checks (W ≤ 8).
              </p>
            </div>

            <div className="p-3 rounded-lg bg-[#151722] border border-[#242738] space-y-1">
              <div className="flex items-center space-x-1.5 text-slate-400 text-[11px]">
                <Cpu className="w-3.5 h-3.5 text-violet-400" />
                <span className="font-semibold uppercase tracking-wider text-[10px]">Space Complexity</span>
              </div>
              <div className="font-mono text-base font-bold text-slate-100">O(W) Window Buffer</div>
              <p className="text-[10.5px] text-slate-400">
                Constant memory buffer capped at window size, avoiding heap bloat during long streams.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-[#151722] border border-[#242738] space-y-1">
              <div className="flex items-center space-x-1.5 text-slate-400 text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-semibold uppercase tracking-wider text-[10px]">AST Verification</span>
              </div>
              <div className="font-mono text-base font-bold text-emerald-400">100% Guarded</div>
              <p className="text-[10.5px] text-slate-400">
                Automatic rollback upon syntax tree breakage; emits <code>speculative:rollback</code>.
              </p>
            </div>
          </div>

          {/* Step-by-Step Logic Breakdown */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider text-[11px]">
              Execution Lifecycle & State Transitions
            </h4>

            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-[#141620] border border-[#202334] flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-violet-900/60 text-violet-300 font-mono text-[10px] flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  <div className="font-medium text-slate-200">Concurrency Locking & Telemetry Initiation</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    Checks <code>this.isProcessing</code> mutex to reject concurrent streams on the same buffer, then triggers <code>stream:start</code> with high-resolution timestamp.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#141620] border border-[#202334] flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-violet-900/60 text-violet-300 font-mono text-[10px] flex items-center justify-center shrink-0">
                  2
                </span>
                <div>
                  <div className="font-medium text-slate-200">Incremental AST Snapshotting</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    Invokes <code>astValidator.createSnapshot(request.targetFilePath)</code> to establish baseline hash and symbol table before applying token diffs.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#141620] border border-[#202334] flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-violet-900/60 text-violet-300 font-mono text-[10px] flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  <div className="font-medium text-slate-200">Speculative Sliding Window Validation</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    Tokens accumulate into <code>speculativeBuffer</code>. When reaching newline or <code>windowSize</code> (default 8), <code>verifyIncremental</code> validates balanced braces and grammatical legality.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#141620] border border-[#202334] flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-violet-900/60 text-violet-300 font-mono text-[10px] flex items-center justify-center shrink-0">
                  4
                </span>
                <div>
                  <div className="font-medium text-slate-200">Atomic Yield & Cleanup</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    If valid, emits <code>PatchChunk</code> via <code>diffEngine.computeIncrementalPatch</code> and clears the speculative window. The <code>finally</code> block guarantees the mutex is freed.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-11 px-4 bg-[#141622] border-t border-[#232637] flex items-center justify-between text-xs text-slate-400 select-none">
          <div className="flex items-center space-x-1.5 text-[11px] font-mono text-slate-400">
            <span>Source:</span>
            <span className="text-violet-300">{filePath}</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
