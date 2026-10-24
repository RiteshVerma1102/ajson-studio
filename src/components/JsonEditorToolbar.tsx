import React, { useState } from 'react'
import {
  Copy,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  ChevronDown,
  Hash,
} from 'lucide-react'
import {
  validateJson,
  formatJson,
  minifyJson,
  findDuplicateKeys,
  type JsonValidationResult,
  type JsonStats,
} from '../utils/jsonUtils'

export type JsonViewMode = 'raw' | 'tree' | 'stats'

interface JsonEditorToolbarProps {
  content: string
  onChange: (val: string) => void
  viewMode: JsonViewMode
  onViewModeChange: (mode: JsonViewMode) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  fileName?: string
}

// ─── JSON Tree View Node ───────────────────────────────────────────────────

export const JsonTreeNode: React.FC<{
  k: string | null
  val: unknown
  depth: number
  path: string
}> = ({ k, val, depth, path }) => {
  const [open, setOpen] = useState(depth < 2)
  const pl = depth * 16

  if (Array.isArray(val)) {
    return (
      <div className="font-mono text-xs leading-relaxed select-text">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center space-x-1 py-0.5 px-1.5 rounded hover:bg-[#2A2D2E] text-[#CCCCCC] w-full text-left"
          style={{ paddingLeft: `${pl}px` }}
        >
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#858585] shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#858585] shrink-0" />
          )}
          {k !== null && <span className="text-[#9CDCFE]">{k}: </span>}
          <span className="text-[#D4D4D4]">[</span>
          <span className="text-[#858585] text-[10.5px]">({val.length} items)</span>
          {!open && <span className="text-[#D4D4D4]">]</span>}
        </button>
        {open && (
          <div>
            {val.map((item, i) => (
              <JsonTreeNode
                key={i}
                k={String(i)}
                val={item}
                depth={depth + 1}
                path={`${path}[${i}]`}
              />
            ))}
            <div
              className="py-0.5 px-1.5 text-[#D4D4D4]"
              style={{ paddingLeft: `${pl + 14}px` }}
            >
              ]
            </div>
          </div>
        )}
      </div>
    )
  }

  if (val !== null && typeof val === 'object') {
    const entries = Object.entries(val as Record<string, unknown>)
    return (
      <div className="font-mono text-xs leading-relaxed select-text">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center space-x-1 py-0.5 px-1.5 rounded hover:bg-[#2A2D2E] text-[#CCCCCC] w-full text-left"
          style={{ paddingLeft: `${pl}px` }}
        >
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#858585] shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#858585] shrink-0" />
          )}
          {k !== null && <span className="text-[#9CDCFE] font-medium">{k}: </span>}
          <span className="text-[#D4D4D4]">{"{"}</span>
          <span className="text-[#858585] text-[10.5px]">({entries.length} keys)</span>
          {!open && <span className="text-[#D4D4D4]">{"}"}</span>}
        </button>
        {open && (
          <div>
            {entries.map(([ek, ev]) => (
              <JsonTreeNode
                key={ek}
                k={ek}
                val={ev}
                depth={depth + 1}
                path={`${path}.${ek}`}
              />
            ))}
            <div
              className="py-0.5 px-1.5 text-[#D4D4D4]"
              style={{ paddingLeft: `${pl + 14}px` }}
            >
              {"}"}
            </div>
          </div>
        )}
      </div>
    )
  }

  const isString = typeof val === 'string'
  const isNumber = typeof val === 'number'
  const isBool = typeof val === 'boolean'
  const isNull = val === null

  let valClass = 'text-[#CCCCCC]'
  if (isString) valClass = 'text-[#CE9178]'
  else if (isNumber) valClass = 'text-[#B5CEA8]'
  else if (isBool) valClass = 'text-[#569CD6]'
  else if (isNull) valClass = 'text-[#569CD6] italic'

  const display = isString ? `"${val}"` : String(val)

  return (
    <div
      className="flex items-center py-0.5 px-1.5 hover:bg-[#2A2D2E] rounded font-mono text-xs text-[#CCCCCC] select-text"
      style={{ paddingLeft: `${pl + 16}px` }}
    >
      {k !== null && <span className="text-[#9CDCFE] font-medium mr-1.5">{k}:</span>}
      <span className={valClass}>{display}</span>
    </div>
  )
}

// ─── JSON Stats Display ────────────────────────────────────────────────────

export const JsonStatsView: React.FC<{
  stats: JsonStats
  validation: JsonValidationResult
}> = ({ stats, validation }) => {
  const items = [
    { label: 'Character Count', value: stats.charCount.toLocaleString() },
    {
      label: 'Byte Size',
      value:
        stats.byteSize > 1024
          ? `${(stats.byteSize / 1024).toFixed(1)} KB`
          : `${stats.byteSize} Bytes`,
    },
    { label: 'Lines', value: stats.lineCount.toLocaleString() },
    { label: 'Max Depth', value: String(stats.depth) },
    { label: 'Objects', value: stats.objectCount.toLocaleString() },
    { label: 'Arrays', value: stats.arrayCount.toLocaleString() },
    { label: 'Total Keys', value: stats.keyCount.toLocaleString() },
    { label: 'Strings', value: stats.stringCount.toLocaleString() },
    { label: 'Numbers', value: stats.numberCount.toLocaleString() },
    { label: 'Booleans', value: stats.boolCount.toLocaleString() },
    { label: 'Nulls', value: stats.nullCount.toLocaleString() },
    { label: 'Root Type', value: validation.rootType },
  ]

  return (
    <div className="p-4 space-y-4 max-w-4xl">
      <div className="flex items-center space-x-2 text-white font-medium text-sm pb-2 border-b border-[#333333]">
        <Hash className="w-4 h-4 text-[#007ACC]" />
        <span>Document Metrics & Breakdown</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
        {items.map((it) => (
          <div
            key={it.label}
            className="p-3 bg-[#252526] border border-[#333333] rounded-sm flex flex-col justify-between"
          >
            <span className="text-[10.5px] uppercase font-sans text-[#9DA3AE] tracking-wide">
              {it.label}
            </span>
            <span className="text-base font-mono font-semibold text-white mt-1">
              {it.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main JSON Editor Toolbar Component ────────────────────────────────────

export const JsonEditorToolbar: React.FC<JsonEditorToolbarProps> = ({
  content,
  onChange,
  viewMode,
  onViewModeChange,
  onToast,
  fileName = 'document.json',
}) => {
  const [indent, setIndent] = useState<2 | 4 | 'tab'>(2)

  const validation = validateJson(content)
  const duplicates = findDuplicateKeys(content)

  const handleFormat = () => {
    const res = formatJson(content, { indent, sortKeys: false })
    if (res.error) {
      onToast(res.error, 'error')
      return
    }
    onChange(res.output)
    onToast('Formatted JSON', 'success')
  }

  const handleMinify = () => {
    const res = minifyJson(content)
    if (res.error) {
      onToast(res.error, 'error')
      return
    }
    onChange(res.output)
    onToast('Minified JSON', 'success')
  }

  const handleSortKeys = () => {
    if (!validation.valid) {
      onToast('Fix JSON errors before sorting keys', 'error')
      return
    }
    const res = formatJson(content, { indent, sortKeys: true })
    if (res.error) {
      onToast(res.error, 'error')
      return
    }
    onChange(res.output)
    onToast('Sorted JSON keys ascending', 'success')
  }

  const handleCopy = () => {
    navigator.clipboard
      .writeText(content)
      .then(() => onToast('Copied to clipboard', 'success'))
      .catch(() => onToast('Copy failed', 'error'))
  }

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName.endsWith('.json') ? fileName : `${fileName}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      onChange((ev.target?.result as string) || '')
      onToast(`Loaded ${file.name}`, 'success')
    }
    reader.onerror = () => onToast('Failed to read file', 'error')
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="bg-[#1E1E1E] border-b border-[#252526] select-none text-xs">
      {/* Primary Tools Row */}
      <div className="h-8 px-2 flex items-center justify-between text-[#CCCCCC]">
        {/* Left Tools: Format, Minify, Sort Keys, Indent */}
        <div className="flex items-center space-x-1">
          <button
            onClick={handleFormat}
            className="px-2 py-0.5 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] border border-[#333333] hover:border-[#007ACC] text-[#CCCCCC] hover:text-white transition-colors"
            title="Format with current indentation"
          >
            Format
          </button>

          <button
            onClick={handleMinify}
            className="px-2 py-0.5 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] border border-[#333333] hover:border-[#007ACC] text-[#CCCCCC] hover:text-white transition-colors"
            title="Strip all whitespace"
          >
            Minify
          </button>

          <button
            onClick={handleSortKeys}
            className="px-2 py-0.5 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] border border-[#333333] hover:border-[#007ACC] text-[#CCCCCC] hover:text-white transition-colors"
            title="Sort object keys recursively"
          >
            Sort Keys
          </button>

          {/* Indent Selector */}
          <select
            value={String(indent)}
            onChange={(e) =>
              setIndent(e.target.value === 'tab' ? 'tab' : (parseInt(e.target.value) as 2 | 4))
            }
            className="bg-[#252526] hover:bg-[#2A2D2E] border border-[#333333] text-[#CCCCCC] text-[11px] px-1.5 py-0.5 rounded-sm outline-none cursor-pointer"
          >
            <option value="2">2 spaces</option>
            <option value="4">4 spaces</option>
            <option value="tab">Tab</option>
          </select>
        </div>

        {/* Center: View Switcher (Raw, Tree, Stats) */}
        <div className="flex items-center space-x-0.5 bg-[#252526] p-0.5 rounded-sm border border-[#333333]">
          {(['raw', 'tree', 'stats'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={`px-2 py-0.5 rounded-sm transition-colors uppercase text-[10px] font-sans font-medium ${
                viewMode === mode
                  ? 'bg-[#007ACC] text-white shadow-sm'
                  : 'text-[#9DA3AE] hover:text-[#CCCCCC]'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Right Tools: Validation Status & File Transfer */}
        <div className="flex items-center space-x-2">
          {/* Validation Status Badge */}
          {validation.rootType === 'empty' ? (
            <span className="flex items-center space-x-1 text-[11px] text-[#858585] font-mono">
              <Hash className="w-3 h-3" />
              <span>Empty</span>
            </span>
          ) : validation.valid ? (
            <span className="flex items-center space-x-1 text-[11px] text-emerald-400 font-mono">
              <CheckCircle2 className="w-3 h-3" />
              <span>Valid</span>
            </span>
          ) : (
            <span
              className="flex items-center space-x-1 text-[11px] text-[#F14C4C] font-mono cursor-pointer"
              title={validation.errors[0]?.message}
            >
              <XCircle className="w-3 h-3" />
              <span>Line {validation.errors[0]?.line} Error</span>
            </span>
          )}

          {/* Transfer buttons */}
          <div className="flex items-center space-x-0.5 border-l border-[#333333] pl-1.5">
            <button
              onClick={handleCopy}
              title="Copy JSON to clipboard"
              className="p-1 rounded-sm text-[#9DA3AE] hover:text-white hover:bg-[#252526] transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleDownload}
              title="Download JSON file"
              className="p-1 rounded-sm text-[#9DA3AE] hover:text-white hover:bg-[#252526] transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <label
              title="Upload JSON file"
              className="p-1 rounded-sm text-[#9DA3AE] hover:text-white hover:bg-[#252526] transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <input
                type="file"
                accept=".json,text/plain"
                onChange={handleUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Inline Warning for Duplicate Keys or Syntax Errors */}
      {!validation.valid && validation.errors.length > 0 && (
        <div className="px-3 py-1 bg-[#F14C4C]/10 border-t border-[#F14C4C]/25 text-[#F14C4C] flex items-center space-x-2 text-[11px] font-mono">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{validation.errors[0].message}</span>
          <span className="text-[#858585]">
            — line {validation.errors[0].line}, column {validation.errors[0].column}
          </span>
        </div>
      )}

      {duplicates.length > 0 && (
        <div className="px-3 py-1 bg-amber-950/20 border-t border-amber-800/30 text-amber-300 flex items-center space-x-2 text-[11px]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span>
            Duplicate keys: {duplicates.map((d) => `"${d.key}" (×${d.count})`).join(', ')}
          </span>
        </div>
      )}
    </div>
  )
}
