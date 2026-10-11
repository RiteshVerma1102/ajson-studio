import React, { useState } from 'react'
import {
  GitCompare,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FileCode2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'


interface DiffReviewModalProps {
  isOpen: boolean
  onClose: () => void
  fileName?: string
  onApplyChanges?: () => void
}

interface DiffLine {
  oldLineNumber?: number
  newLineNumber?: number
  type: 'unchanged' | 'removed' | 'added'
  content: string
}

export const DiffReviewModal: React.FC<DiffReviewModalProps> = ({
  isOpen,
  onClose,
  fileName = 'src/ai/AgentCoordinator.ts',
  onApplyChanges,
}) => {
  const [currentChunk, setCurrentChunk] = useState(1)
  const [isApplied, setIsApplied] = useState(false)
  const totalChunks = 2

  if (!isOpen) return null

  const originalLines: DiffLine[] = [
    { oldLineNumber: 48, newLineNumber: 48, type: 'unchanged', content: "  public async *generatePatchStream(" },
    { oldLineNumber: 49, newLineNumber: 49, type: 'unchanged', content: "    request: AgentRequest" },
    { oldLineNumber: 50, newLineNumber: 50, type: 'unchanged', content: "  ): AsyncGenerator<PatchChunk, void, unknown> {" },
    { oldLineNumber: 51, newLineNumber: 51, type: 'unchanged', content: "    if (this.isProcessing) {" },
    { oldLineNumber: 52, newLineNumber: 52, type: 'unchanged', content: "      throw new Error('[AgentCoordinator] Active session in progress;');" },
    { oldLineNumber: 53, newLineNumber: 53, type: 'unchanged', content: "    }" },
    { oldLineNumber: 54, type: 'removed', content: "    // Naive unbounded buffer" },
    { oldLineNumber: 55, type: 'removed', content: "    const rawTokens: string[] = [];" },
    { oldLineNumber: 56, type: 'removed', content: "    for await (const t of request.streamSource) {" },
    { oldLineNumber: 57, type: 'removed', content: "      rawTokens.push(t);" },
    { oldLineNumber: 58, type: 'removed', content: "      yield this.diffEngine.computePatch(rawTokens.join(''));" },
    { oldLineNumber: 59, type: 'removed', content: "    }" },
    { oldLineNumber: 60, newLineNumber: 74, type: 'unchanged', content: "    this.emit('stream:complete', { metrics: this.metrics });" },
    { oldLineNumber: 61, newLineNumber: 75, type: 'unchanged', content: "  }" },
  ]

  const proposedLines: DiffLine[] = [
    { oldLineNumber: 48, newLineNumber: 48, type: 'unchanged', content: "  public async *generatePatchStream(" },
    { oldLineNumber: 49, newLineNumber: 49, type: 'unchanged', content: "    request: AgentRequest" },
    { oldLineNumber: 50, newLineNumber: 50, type: 'unchanged', content: "  ): AsyncGenerator<PatchChunk, void, unknown> {" },
    { oldLineNumber: 51, newLineNumber: 51, type: 'unchanged', content: "    if (this.isProcessing) {" },
    { oldLineNumber: 52, newLineNumber: 52, type: 'unchanged', content: "      throw new Error('[AgentCoordinator] Active session in progress;');" },
    { oldLineNumber: 53, newLineNumber: 53, type: 'unchanged', content: "    }" },
    { newLineNumber: 54, type: 'added', content: "    // Speculative sliding buffer with AST guardrail validation" },
    { newLineNumber: 55, type: 'added', content: "    const speculativeBuffer: string[] = [];" },
    { newLineNumber: 56, type: 'added', content: "    const windowSize = this.options.speculativeWindowSize ?? 8;" },
    { newLineNumber: 57, type: 'added', content: "    const snapshot = await this.astValidator.createSnapshot(request.targetFilePath);" },
    { newLineNumber: 58, type: 'added', content: "    for await (const rawToken of request.streamSource) {" },
    { newLineNumber: 59, type: 'added', content: "      speculativeBuffer.push(rawToken);" },
    { newLineNumber: 60, type: 'added', content: "      if (speculativeBuffer.length >= windowSize || rawToken.includes('\\n')) {" },
    { newLineNumber: 61, type: 'added', content: "        const valid = await this.astValidator.verifyIncremental(snapshot, speculativeBuffer.join(''));" },
    { newLineNumber: 62, type: 'added', content: "        if (!valid.isValid) { this.metrics.rollbackCount++; continue; }" },
    { newLineNumber: 63, type: 'added', content: "        yield this.diffEngine.computeIncrementalPatch(request.originalCode, speculativeBuffer.join(''));" },
    { newLineNumber: 64, type: 'added', content: "        speculativeBuffer.length = 0;" },
    { newLineNumber: 65, type: 'added', content: "      }" },
    { newLineNumber: 66, type: 'added', content: "    }" },
    { oldLineNumber: 60, newLineNumber: 74, type: 'unchanged', content: "    this.emit('stream:complete', { metrics: this.metrics });" },
    { oldLineNumber: 61, newLineNumber: 75, type: 'unchanged', content: "  }" },
  ]

  const handleAcceptAll = () => {
    setIsApplied(true)
    onApplyChanges?.()
    setTimeout(() => {
      onClose()
    }, 900)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-6xl h-[85vh] bg-[#121319] border border-[#252836] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Diff Review Top Header */}
        <div className="h-12 bg-[#151720] border-b border-[#232635] flex items-center justify-between px-4 select-none">
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 rounded-lg bg-violet-950/60 border border-violet-500/40 flex items-center justify-center">
              <GitCompare className="w-4 h-4 text-violet-400" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-100 text-xs">Side-by-Side Diff Review</span>
              <span className="text-slate-500 text-xs">/</span>
              <span className="font-mono text-violet-300 text-xs bg-violet-950/40 px-2 py-0.5 rounded border border-violet-800/40">
                {fileName}
              </span>
            </div>
            <div className="flex items-center space-x-1.5 pl-2 text-[11px] font-mono">
              <span className="text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.5 rounded">
                +13 additions
              </span>
              <span className="text-rose-400 bg-rose-950/40 border border-rose-800/40 px-1.5 py-0.5 rounded">
                -6 deletions
              </span>
            </div>
          </div>

          {/* Chunk Navigation & Review Actions */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1 bg-[#101117] border border-[#232635] rounded-lg px-2 py-1 text-xs text-slate-300">
              <button
                onClick={() => setCurrentChunk(Math.max(1, currentChunk - 1))}
                className="hover:text-violet-400 transition-colors"
                title="Previous Hunk"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono px-1.5 text-slate-400">
                Hunk {currentChunk} of {totalChunks}
              </span>
              <button
                onClick={() => setCurrentChunk(Math.min(totalChunks, currentChunk + 1))}
                className="hover:text-violet-400 transition-colors"
                title="Next Hunk"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg border border-[#282c3c] bg-[#181a24] hover:bg-[#202331] text-slate-300 hover:text-white text-xs font-medium transition-all flex items-center space-x-1.5"
              >
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>Reject Changes</span>
                <span className="text-[10px] text-slate-500 font-mono ml-1">Esc</span>
              </button>

              <button
                onClick={handleAcceptAll}
                disabled={isApplied}
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-medium shadow-md shadow-violet-600/25 transition-all flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>{isApplied ? 'Changes Applied!' : 'Accept & Apply Changes'}</span>
                <span className="text-[10px] text-violet-200 font-mono ml-1">⌘Enter</span>
              </button>
            </div>
          </div>
        </div>

        {/* Diff Review Split View Columns */}
        <div className="flex-1 grid grid-cols-2 divide-x divide-[#232635] overflow-hidden font-mono text-[11.5px]">
          {/* Left: Original Buffer */}
          <div className="flex flex-col bg-[#0f1016] overflow-hidden">
            <div className="h-8 px-3 bg-[#13151e] border-b border-[#232635] flex items-center justify-between text-xs text-slate-400 select-none">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-rose-400/80" />
                <span className="font-semibold text-slate-300">Original (Current Buffer)</span>
              </div>
              <span className="text-[10.5px] text-slate-500 font-mono">Lines 48–61</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {originalLines.map((line, idx) => (
                <div
                  key={`orig-${idx}`}
                  className={`flex items-start px-2 py-0.5 rounded leading-relaxed transition-colors ${
                    line.type === 'removed'
                      ? 'bg-rose-950/25 text-rose-300 border-l-2 border-rose-500'
                      : 'text-slate-400 hover:bg-[#151722]'
                  }`}
                >
                  <span className="w-8 shrink-0 text-right pr-3 text-slate-600 select-none text-[10.5px]">
                    {line.oldLineNumber || ''}
                  </span>
                  <span className="w-4 shrink-0 text-slate-500 select-none font-bold">
                    {line.type === 'removed' ? '-' : ' '}
                  </span>
                  <span className="flex-1 whitespace-pre">{line.content}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: AI Proposed Patch */}
          <div className="flex flex-col bg-[#111218] overflow-hidden">
            <div className="h-8 px-3 bg-[#141620] border-b border-[#232635] flex items-center justify-between text-xs text-slate-400 select-none">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-semibold text-violet-300 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  <span>AI Patch Proposal (Claude 3.7 Sonnet)</span>
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] bg-violet-950/50 text-violet-300 border border-violet-800/40 px-1.5 py-0.5 rounded">
                  Speculative Guardrail
                </span>
                <span className="text-[10.5px] text-slate-500 font-mono">Lines 48–75</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {proposedLines.map((line, idx) => (
                <div
                  key={`prop-${idx}`}
                  className={`flex items-start px-2 py-0.5 rounded leading-relaxed transition-colors ${
                    line.type === 'added'
                      ? 'bg-emerald-950/25 text-emerald-300 border-l-2 border-emerald-500'
                      : 'text-slate-300 hover:bg-[#151722]'
                  }`}
                >
                  <span className="w-8 shrink-0 text-right pr-3 text-slate-600 select-none text-[10.5px]">
                    {line.newLineNumber || ''}
                  </span>
                  <span className="w-4 shrink-0 text-emerald-400 select-none font-bold">
                    {line.type === 'added' ? '+' : ' '}
                  </span>
                  <span className="flex-1 whitespace-pre">{line.content}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Diff Review Footer Bar */}
        <div className="h-9 px-4 bg-[#141620] border-t border-[#232635] flex items-center justify-between text-xs text-slate-400 select-none">
          <div className="flex items-center space-x-3 text-[11px]">
            <span className="flex items-center space-x-1 text-slate-400">
              <FileCode2 className="w-3 h-3 text-violet-400" />
              <span>Syntactic integrity: <strong className="text-emerald-400">Validated</strong></span>
            </span>
            <span className="text-slate-600">•</span>
            <span>Zero AST regressions detected</span>
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-mono">
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-[#1f2230] text-slate-300 border border-[#2d3144]">⌘Enter</kbd> to accept</span>
            <span>or <kbd className="px-1.5 py-0.5 rounded bg-[#1f2230] text-slate-300 border border-[#2d3144]">Esc</kbd> to discard</span>
          </div>
        </div>
      </div>
    </div>
  )
}
