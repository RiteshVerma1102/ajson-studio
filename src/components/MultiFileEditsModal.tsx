import React, { useState } from 'react'
import {
  Layers,
  FileCode2,
  Check,
} from 'lucide-react'

interface MultiFileEditsModalProps {
  isOpen: boolean
  onClose: () => void
  onApplyAll: () => void
}

interface FileEdit {
  path: string
  name: string
  additions: number
  deletions: number
  status: 'modified' | 'created'
  applied: boolean
  snippet: {
    before?: string
    after: string
  }
}

export const MultiFileEditsModal: React.FC<MultiFileEditsModalProps> = ({
  isOpen,
  onClose,
  onApplyAll,
}) => {
  const [selectedFileIdx, setSelectedFileIdx] = useState(0)
  const [files, setFiles] = useState<FileEdit[]>([
    {
      path: 'src/ai/AgentCoordinator.ts',
      name: 'AgentCoordinator.ts',
      additions: 42,
      deletions: 14,
      status: 'modified',
      applied: true,
      snippet: {
        before: '    for await (const t of request.streamSource) {\n      rawTokens.push(t);\n    }',
        after: '    // Sliding window buffer with speculative rollback\n    for await (const rawToken of request.streamSource) {\n      speculativeBuffer.push(rawToken);\n      if (speculativeBuffer.length >= windowSize) {\n        yield this.diffEngine.computeIncrementalPatch(...);\n      }\n    }',
      },
    },
    {
      path: 'src/core/StreamingDiffEngine.ts',
      name: 'StreamingDiffEngine.ts',
      additions: 18,
      deletions: 7,
      status: 'modified',
      applied: true,
      snippet: {
        before: '  public computePatch(raw: string): PatchChunk { ... }',
        after: '  public computeIncrementalPatch(orig: string, candidate: string): PatchChunk {\n    // Linear scan with hunk splitting\n    let startIdx = 0;\n    while (orig[startIdx] === candidate[startIdx]) startIdx++;\n    return { id: `chunk-${Date.now()}`, startLine: startIdx + 1, ... };\n  }',
      },
    },
    {
      path: 'src/types/models.d.ts',
      name: 'models.d.ts',
      additions: 8,
      deletions: 0,
      status: 'created',
      applied: true,
      snippet: {
        after: 'export interface TokenStreamMetrics {\n  tokensGenerated: number;\n  speculativeHits: number;\n  verificationLatencyMs: number;\n  rollbackCount: number;\n}',
      },
    },
  ])

  if (!isOpen) return null

  const selectedFile = files[selectedFileIdx]

  const toggleFileApply = (idx: number) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, applied: !f.applied } : f))
    )
  }

  const handleApplyAll = () => {
    onApplyAll()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl h-[80vh] bg-[#121319] border border-[#252838] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-12 bg-[#151722] border-b border-[#232637] flex items-center justify-between px-4 select-none">
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 rounded-lg bg-violet-950/60 border border-violet-500/40 flex items-center justify-center">
              <Layers className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-slate-100 text-xs">Multi-File Edits Review (Composer)</span>
                <span className="text-[10px] bg-violet-950/50 text-violet-300 border border-violet-800/40 px-2 py-0.5 rounded font-mono">
                  3 Files Modified
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-[#252839] hover:bg-[#1a1d2c] text-slate-400 hover:text-slate-200 text-xs transition-colors"
            >
              Discard All
            </button>
            <button
              onClick={handleApplyAll}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-xs shadow-md shadow-violet-600/30 transition-all flex items-center space-x-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply All (3 Files)</span>
              <span className="text-[10px] text-violet-200 font-mono ml-1">⌘Enter</span>
            </button>
          </div>
        </div>

        {/* Content Split: Left File List, Right Diff Preview */}
        <div className="flex-1 grid grid-cols-12 overflow-hidden">
          {/* Left Column: Changed Files List */}
          <div className="col-span-4 bg-[#0f1015] border-r border-[#222535] p-3 flex flex-col space-y-1.5 overflow-y-auto">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 px-1 py-1">
              Modified Files in Batch
            </div>

            {files.map((file, idx) => {
              const isSelected = selectedFileIdx === idx
              return (
                <div
                  key={file.path}
                  onClick={() => setSelectedFileIdx(idx)}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-violet-950/30 border-violet-500/50 text-slate-100 shadow-sm'
                      : 'bg-[#141620] border-[#202334] text-slate-400 hover:bg-[#1a1c28] hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={file.applied}
                      onChange={() => toggleFileApply(idx)}
                      onClick={(e) => e.stopPropagation()}
                      className="accent-violet-500 rounded cursor-pointer"
                    />
                    <FileCode2 className={`w-4 h-4 shrink-0 ${isSelected ? 'text-violet-400' : 'text-slate-500'}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{file.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">{file.path}</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 text-[10px] font-mono shrink-0 pl-2">
                    <span className="text-emerald-400">+{file.additions}</span>
                    <span className="text-rose-400">-{file.deletions}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right Column: Diff Preview */}
          <div className="col-span-8 bg-[#121319] flex flex-col overflow-hidden">
            <div className="h-9 px-4 bg-[#151722] border-b border-[#222535] flex items-center justify-between text-xs text-slate-400 select-none">
              <span className="font-mono text-violet-300 text-xs">{selectedFile.path}</span>
              <div className="flex items-center space-x-2 text-[11px] font-mono">
                <span className="text-emerald-400">+{selectedFile.additions} lines</span>
                <span className="text-rose-400">-{selectedFile.deletions} lines</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-[11.5px]">
              {selectedFile.snippet.before && (
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider">
                    Removed Chunk
                  </div>
                  <pre className="p-3 rounded-lg bg-rose-950/20 border border-rose-800/30 text-rose-300 overflow-x-auto">
                    <code>{selectedFile.snippet.before}</code>
                  </pre>
                </div>
              )}

              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                  Proposed Replacement
                </div>
                <pre className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/30 text-emerald-300 overflow-x-auto">
                  <code>{selectedFile.snippet.after}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
