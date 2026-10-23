/**
 * AJSON Studio — JSON Editor + Tools shell (Phase 2/3/4/5)
 *
 * This replaces the generic editor view with a full JSON-tool suite.
 * Everything runs in-browser; no backend is required.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText, Minimize2, GitCompare, Shield, Search, Table2, Code2,
  Settings, Layers, Bot, Zap, Copy, Download, Upload,
  CheckCircle2, AlertCircle, AlertTriangle, XCircle, ChevronRight,
  ChevronDown, Plus, Trash2, Hash, X, Info,
} from "lucide-react";
import {
  validateJson, formatJson, minifyJson, deepSortKeys, computeJsonStats,
  jsonToTypeScript, jsonToCsv, csvToJson, findDuplicateKeys,
  type JsonValidationResult, type JsonStats, type FormatOptions,
} from "../utils/jsonUtils";
import {
  loadSettings, saveSettings, loadDocuments, saveDocuments, loadActiveDocId, saveActiveDocId,
} from "../utils/persistence";
import {
  JSON_TEMPLATES,
  type JsonToolId, type JsonDocument, type AppSettings,
} from "../types/jsonTools";

// ─── Toast ───────────────────────────────────────────────────────

interface ToastMsg { id: number; type: "success" | "error" | "info" | "warning"; text: string; }

function useToasts() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const counter = useRef(0);
  const push = useCallback((type: ToastMsg["type"], text: string) => {
    const id = ++counter.current;
    setToasts((p) => [...p, { id, type, text }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3800);
  }, []);
  const remove = useCallback((id: number) => setToasts((p) => p.filter((t) => t.id !== id)), []);
  return { toasts, push, remove };
}

// ─── Shared types ─────────────────────────────────────────────────

function newDoc(name = "Untitled"): JsonDocument {
  const now = Date.now();
  return { id: `doc_${now}_${Math.random().toString(36).slice(2, 7)}`, name, content: "", isDirty: false, createdAt: now, updatedAt: now };
}

// ─── Activity bar items ──────────────────────────────────────────

interface NavItem { id: JsonToolId; label: string; Icon: React.FC<{ className?: string }>; }
const NAV: NavItem[] = [
  { id: "editor",     label: "Editor",      Icon: FileText },
  { id: "format",     label: "Format",      Icon: Minimize2 },
  { id: "diff",       label: "Diff",        Icon: GitCompare },
  { id: "schema",     label: "Schema",      Icon: Shield },
  { id: "jsonpath",   label: "JSONPath",    Icon: Search },
  { id: "csv",        label: "CSV",         Icon: Table2 },
  { id: "typescript", label: "TypeScript",  Icon: Code2 },
  { id: "templates",  label: "Templates",   Icon: Layers },
  { id: "ai",         label: "AI Panel",    Icon: Bot },
  { id: "api",        label: "API Play",    Icon: Zap },
  { id: "settings",   label: "Settings",    Icon: Settings },
];

// ─── Utility UI pieces ───────────────────────────────────────────

const CopyBtn: React.FC<{ text: string; onToast: (m: string) => void }> = ({ text, onToast }) => {
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => onToast("Copied to clipboard")).catch(() => onToast("Copy failed"));
  };
  return (
    <button onClick={copy} title="Copy" className="tool-icon-btn" aria-label="Copy output">
      <Copy className="w-3.5 h-3.5" />
    </button>
  );
};

const DownloadBtn: React.FC<{ text: string; filename: string }> = ({ text, filename }) => {
  const dl = () => {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button onClick={dl} title="Download" className="tool-icon-btn" aria-label="Download">
      <Download className="w-3.5 h-3.5" />
    </button>
  );
};

interface ValidationBadgeProps { result: JsonValidationResult | null; }
const ValidationBadge: React.FC<ValidationBadgeProps> = ({ result }) => {
  if (!result) return null;
  if (result.rootType === "empty") return (
    <span className="val-badge val-badge--empty"><Hash className="w-3 h-3" /> Empty</span>
  );
  if (result.valid) return (
    <span className="val-badge val-badge--valid"><CheckCircle2 className="w-3 h-3" /> Valid JSON</span>
  );
  return (
    <span className="val-badge val-badge--invalid">
      <XCircle className="w-3 h-3" /> Invalid — line {result.errors[0]?.line}, col {result.errors[0]?.column}
    </span>
  );
};

// ─── Textarea editor with line numbers ─────────────────────────

interface CodeAreaProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  "aria-label"?: string;
}
const CodeArea: React.FC<CodeAreaProps> = ({ value, onChange, placeholder, readOnly, className = "", "aria-label": ariaLabel }) => {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const lnRef = useRef<HTMLDivElement>(null);

  const lineCount = value ? value.split("\n").length : 1;
  const lines = Array.from({ length: Math.max(lineCount, 1) }, (_, i) => i + 1);

  const syncScroll = () => {
    if (taRef.current && lnRef.current) {
      lnRef.current.scrollTop = taRef.current.scrollTop;
    }
  };

  const handleTab = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newVal = value.slice(0, start) + "  " + value.slice(end);
      onChange(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  };

  return (
    <div className={`code-area-wrap ${className}`} data-readonly={readOnly}>
      <div ref={lnRef} className="code-area-lines" aria-hidden="true">
        {lines.map((n) => <div key={n} className="code-area-ln">{n}</div>)}
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => !readOnly && onChange(e.target.value)}
        onScroll={syncScroll}
        onKeyDown={handleTab}
        placeholder={placeholder}
        readOnly={readOnly}
        className="code-area-ta"
        spellCheck={false}
        aria-label={ariaLabel}
        aria-multiline="true"
      />
    </div>
  );
};

// ─── JSON Tree View ─────────────────────────────────────────────

interface TreeNodeProps { k: string | null; val: unknown; depth: number; path: string; }
const TreeNode: React.FC<TreeNodeProps> = ({ k, val, depth, path }) => {
  const [open, setOpen] = useState(depth < 2);
  const pl = depth * 14;

  if (Array.isArray(val)) {
    return (
      <div>
        <button onClick={() => setOpen(!open)} className="tree-row" style={{ paddingLeft: pl }} aria-expanded={open} aria-label={`${k ?? "root"} array`}>
          {open ? <ChevronDown className="tree-chevron" /> : <ChevronRight className="tree-chevron" />}
          {k !== null && <span className="tree-key">{k}</span>}
          {k !== null && <span className="tree-colon">: </span>}
          <span className="tree-bracket">[</span>
          <span className="tree-count">{val.length}</span>
          {!open && <span className="tree-bracket">]</span>}
        </button>
        {open && (
          <div>
            {val.map((item, i) => (
              <TreeNode key={i} k={String(i)} val={item} depth={depth + 1} path={`${path}[${i}]`} />
            ))}
            <div className="tree-row tree-close" style={{ paddingLeft: pl }}><span className="tree-bracket">]</span></div>
          </div>
        )}
      </div>
    );
  }

  if (val !== null && typeof val === "object") {
    const entries = Object.entries(val as Record<string, unknown>);
    return (
      <div>
        <button onClick={() => setOpen(!open)} className="tree-row" style={{ paddingLeft: pl }} aria-expanded={open} aria-label={`${k ?? "root"} object`}>
          {open ? <ChevronDown className="tree-chevron" /> : <ChevronRight className="tree-chevron" />}
          {k !== null && <span className="tree-key">{k}</span>}
          {k !== null && <span className="tree-colon">: </span>}
          <span className="tree-bracket">{"{"}</span>
          <span className="tree-count">{entries.length}</span>
          {!open && <span className="tree-bracket">{"}"}</span>}
        </button>
        {open && (
          <div>
            {entries.map(([ek, ev]) => (
              <TreeNode key={ek} k={ek} val={ev} depth={depth + 1} path={`${path}.${ek}`} />
            ))}
            <div className="tree-row tree-close" style={{ paddingLeft: pl }}><span className="tree-bracket">{"}"}</span></div>
          </div>
        )}
      </div>
    );
  }

  const valueClass =
    val === null ? "tree-null"
    : typeof val === "string" ? "tree-string"
    : typeof val === "number" ? "tree-number"
    : typeof val === "boolean" ? "tree-bool"
    : "tree-val";
  const display = typeof val === "string" ? `"${val}"` : String(val);

  return (
    <div className="tree-row tree-leaf" style={{ paddingLeft: pl + 16 }}>
      {k !== null && <span className="tree-key">{k}</span>}
      {k !== null && <span className="tree-colon">: </span>}
      <span className={valueClass}>{display}</span>
    </div>
  );
};

// ─── Stats panel ─────────────────────────────────────────────────

const StatsPanel: React.FC<{ stats: JsonStats; validation: JsonValidationResult }> = ({ stats, validation }) => (
  <div className="stats-grid">
    {([
      ["Chars", stats.charCount.toLocaleString()],
      ["Bytes", stats.byteSize > 1024 ? `${(stats.byteSize/1024).toFixed(1)} KB` : `${stats.byteSize} B`],
      ["Lines", stats.lineCount.toLocaleString()],
      ["Depth", String(stats.depth)],
      ["Objects", stats.objectCount.toLocaleString()],
      ["Arrays", stats.arrayCount.toLocaleString()],
      ["Keys", stats.keyCount.toLocaleString()],
      ["Strings", stats.stringCount.toLocaleString()],
      ["Numbers", stats.numberCount.toLocaleString()],
      ["Booleans", stats.boolCount.toLocaleString()],
      ["Nulls", stats.nullCount.toLocaleString()],
      ["Root", validation.rootType],
    ] as [string, string][]).map(([label, value]) => (
      <div key={label} className="stat-cell">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
      </div>
    ))}
  </div>
);

// ─── Editor Tool (format / validate / tree / stats) ──────────────

const EditorTool: React.FC<{
  doc: JsonDocument;
  onContent: (c: string) => void;
  settings: AppSettings;
  push: (type: ToastMsg["type"], msg: string) => void;
}> = ({ doc, onContent, settings, push }) => {
  const [tab, setTab] = useState<"raw" | "tree" | "stats">("raw");
  const [formatOpts, setFormatOpts] = useState<FormatOptions>({
    indent: settings.indentSize,
    sortKeys: settings.sortKeysOnFormat,
    sortOrder: "asc",
  });

  const validation = validateJson(doc.content);
  const stats = tab === "stats" ? computeJsonStats(doc.content) : null;
  const dups = findDuplicateKeys(doc.content);

  let parsed: unknown = null;
  if (validation.valid) try { parsed = JSON.parse(doc.content); } catch { /* noop */ }

  const doFormat = () => {
    const r = formatJson(doc.content, formatOpts);
    if (r.error) { push("error", r.error); return; }
    onContent(r.output);
    push("success", "Formatted");
  };

  const doMinify = () => {
    const r = minifyJson(doc.content);
    if (r.error) { push("error", r.error); return; }
    onContent(r.output);
    push("success", "Minified");
  };

  const doSort = () => {
    if (!validation.valid) { push("error", "Fix JSON errors before sorting."); return; }
    const r = formatJson(doc.content, { ...formatOpts, sortKeys: true });
    if (r.error) { push("error", r.error); return; }
    onContent(r.output);
    push("success", "Keys sorted (ascending)");
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { push("error", "File exceeds 5 MB limit."); return; }
    if (!file.name.endsWith(".json") && file.type !== "application/json" && file.type !== "text/plain") {
      push("error", "Only .json or .txt files are accepted."); return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => { onContent((ev.target?.result as string) || ""); };
    reader.onerror = () => push("error", "Failed to read file.");
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="tool-pane">
      {/* Toolbar */}
      <div className="tool-bar">
        <div className="tool-bar-left">
          <button onClick={doFormat} className="tool-btn tool-btn--primary">Format</button>
          <button onClick={doMinify} className="tool-btn">Minify</button>
          <button onClick={doSort} className="tool-btn">Sort Keys</button>
          <select
            value={String(formatOpts.indent)}
            onChange={(e) => setFormatOpts({ ...formatOpts, indent: e.target.value === "tab" ? "tab" : parseInt(e.target.value) })}
            className="tool-select"
            aria-label="Indent size"
          >
            <option value="2">2 spaces</option>
            <option value="4">4 spaces</option>
            <option value="tab">Tab</option>
          </select>
        </div>
        <div className="tool-bar-right">
          <label className="tool-btn tool-btn--icon" title="Upload JSON file" aria-label="Upload JSON file">
            <Upload className="w-3.5 h-3.5" />
            <input type="file" accept=".json,text/plain" onChange={handleUpload} className="sr-only" />
          </label>
          {doc.content && <CopyBtn text={doc.content} onToast={(m) => push("success", m)} />}
          {doc.content && <DownloadBtn text={doc.content} filename={doc.name.endsWith(".json") ? doc.name : `${doc.name}.json`} />}
        </div>
      </div>

      {/* Error bar */}
      {!validation.valid && validation.errors.length > 0 && (
        <div className="error-bar" role="alert">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{validation.errors[0].message}</span>
          <span className="text-[var(--text-muted)] ml-1">— line {validation.errors[0].line}, col {validation.errors[0].column}</span>
        </div>
      )}

      {/* Duplicate key warning */}
      {dups.length > 0 && (
        <div className="warn-bar" role="alert">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Duplicate keys detected: {dups.map(d => `"${d.key}" (×${d.count})`).join(", ")}
        </div>
      )}

      {/* View tabs */}
      <div className="view-tabs">
        {(["raw", "tree", "stats"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`view-tab ${tab === t ? "view-tab--active" : ""}`}>
            {t === "raw" ? "Raw" : t === "tree" ? "Tree" : "Stats"}
          </button>
        ))}
        <div className="ml-auto"><ValidationBadge result={validation} /></div>
      </div>

      {/* Content */}
      <div className="tool-body">
        {tab === "raw" && (
          <CodeArea
            value={doc.content}
            onChange={onContent}
            placeholder={`{\n  "key": "value"\n}`}
            aria-label="JSON editor"
            className="flex-1"
          />
        )}
        {tab === "tree" && (
          <div className="tree-wrap" role="tree" aria-label="JSON tree view">
            {!validation.valid
              ? <div className="empty-state"><XCircle className="w-8 h-8 text-[var(--danger)] mb-2" /><p>Fix JSON errors to view tree.</p></div>
              : !doc.content.trim()
              ? <div className="empty-state"><p>Enter JSON to see tree view.</p></div>
              : <TreeNode k={null} val={parsed} depth={0} path="$" />
            }
          </div>
        )}
        {tab === "stats" && (
          <div className="p-4">
            {stats
              ? <StatsPanel stats={stats} validation={validation} />
              : <div className="empty-state"><p>{doc.content.trim() ? "Fix JSON errors to view stats." : "Enter JSON to view stats."}</p></div>
            }
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Format Tool (standalone pretty-printer) ─────────────────────

const FormatTool: React.FC<{ push: (t: ToastMsg["type"], m: string) => void }> = ({ push }) => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [indent, setIndent] = useState<2 | 4 | "tab">(2);
  const [sortKeys, setSortKeys] = useState(false);

  const doFormat = () => {
    const r = formatJson(input, { indent, sortKeys });
    if (r.error) { push("error", r.error); setOutput(""); return; }
    setOutput(r.output);
  };
  const doMinify = () => {
    const r = minifyJson(input);
    if (r.error) { push("error", r.error); setOutput(""); return; }
    setOutput(r.output);
  };

  const validation = validateJson(input);

  return (
    <div className="tool-pane">
      <div className="tool-bar">
        <div className="tool-bar-left">
          <button onClick={doFormat} className="tool-btn tool-btn--primary">Pretty Print</button>
          <button onClick={doMinify} className="tool-btn">Minify</button>
          <select value={String(indent)} onChange={(e) => setIndent(e.target.value === "tab" ? "tab" : (parseInt(e.target.value) as 2 | 4))} className="tool-select" aria-label="Indent">
            <option value="2">2 spaces</option>
            <option value="4">4 spaces</option>
            <option value="tab">Tab</option>
          </select>
          <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-muted)] text-xs">
            <input type="checkbox" checked={sortKeys} onChange={(e) => setSortKeys(e.target.checked)} className="accent-[var(--accent)]" />
            Sort keys
          </label>
        </div>
        <div className="tool-bar-right">
          <ValidationBadge result={validation} />
        </div>
      </div>
      <div className="tool-split">
        <CodeArea value={input} onChange={setInput} placeholder='{"key": "value"}' aria-label="Input JSON" />
        <div className="split-divider" />
        <div className="split-right">
          <div className="split-right-bar">
            <span className="text-[var(--text-dim)] text-xs">Output</span>
            {output && <>
              <CopyBtn text={output} onToast={(m) => push("success", m)} />
              <DownloadBtn text={output} filename="formatted.json" />
            </>}
          </div>
          <CodeArea value={output} onChange={() => {}} readOnly aria-label="Formatted output" />
        </div>
      </div>
    </div>
  );
};

// ─── Diff Tool ───────────────────────────────────────────────────

interface DiffLine {
  type: "add" | "del" | "same" | "change";
  left: string;
  right: string;
  path: string;
}

function diffJson(a: unknown, b: unknown, path = "$"): DiffLine[] {
  const lines: DiffLine[] = [];

  if (JSON.stringify(a) === JSON.stringify(b)) {
    lines.push({ type: "same", left: JSON.stringify(a, null, 2).slice(0, 80), right: JSON.stringify(b, null, 2).slice(0, 80), path });
    return lines;
  }

  if (a === null || b === null || typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
    lines.push({ type: "change", left: JSON.stringify(a), right: JSON.stringify(b), path });
    return lines;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      if (i >= a.length) lines.push({ type: "add", left: "", right: JSON.stringify(b[i]), path: `${path}[${i}]` });
      else if (i >= b.length) lines.push({ type: "del", left: JSON.stringify(a[i]), right: "", path: `${path}[${i}]` });
      else lines.push(...diffJson(a[i], b[i], `${path}[${i}]`));
    }
    return lines;
  }

  if (typeof a === "object" && typeof b === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
    for (const k of allKeys) {
      if (!(k in ao)) lines.push({ type: "add", left: "", right: JSON.stringify(bo[k]), path: `${path}.${k}` });
      else if (!(k in bo)) lines.push({ type: "del", left: JSON.stringify(ao[k]), right: "", path: `${path}.${k}` });
      else lines.push(...diffJson(ao[k], bo[k], `${path}.${k}`));
    }
    return lines;
  }

  lines.push({ type: "change", left: JSON.stringify(a), right: JSON.stringify(b), path });
  return lines;
}

const DiffTool: React.FC<{ push: (t: ToastMsg["type"], m: string) => void }> = ({ push }) => {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [diffs, setDiffs] = useState<DiffLine[] | null>(null);
  const [orderSensitive, setOrderSensitive] = useState(false);
  const [error, setError] = useState("");

  const runDiff = () => {
    if (!left.trim() && !right.trim()) { push("error", "Both inputs are empty."); return; }
    let a: unknown, b: unknown;
    try { a = JSON.parse(left || "{}"); } catch (e) { setError(`Left: ${(e as Error).message}`); return; }
    try { b = JSON.parse(right || "{}"); } catch (e) { setError(`Right: ${(e as Error).message}`); return; }
    setError("");

    const la = orderSensitive ? a : JSON.parse(JSON.stringify(deepSortKeys(a)));
    const lb = orderSensitive ? b : JSON.parse(JSON.stringify(deepSortKeys(b)));
    setDiffs(diffJson(la, lb));
  };

  const counts = diffs ? diffs.reduce((acc, d) => { acc[d.type] = (acc[d.type] || 0) + 1; return acc; }, {} as Record<string, number>) : null;

  return (
    <div className="tool-pane">
      <div className="tool-bar">
        <div className="tool-bar-left">
          <button onClick={runDiff} className="tool-btn tool-btn--primary">Compare</button>
          <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-muted)] text-xs">
            <input type="checkbox" checked={orderSensitive} onChange={(e) => setOrderSensitive(e.target.checked)} className="accent-[var(--accent)]" />
            Order-sensitive
          </label>
        </div>
        <div className="tool-bar-right">
          {counts && (
            <span className="text-xs text-[var(--text-muted)]">
              <span className="text-[var(--success)]">+{counts.add || 0}</span>{" "}
              <span className="text-[var(--danger)]">-{counts.del || 0}</span>{" "}
              <span className="text-[var(--warning)]">~{counts.change || 0}</span>
            </span>
          )}
        </div>
      </div>
      {error && <div className="error-bar" role="alert"><XCircle className="w-3.5 h-3.5" />{error}</div>}
      <div className="tool-split">
        <div className="flex flex-col flex-1 min-h-0">
          <div className="split-right-bar"><span className="text-[var(--text-dim)] text-xs">Original (Left)</span></div>
          <CodeArea value={left} onChange={setLeft} placeholder='{"a": 1}' aria-label="Original JSON" />
        </div>
        <div className="split-divider" />
        <div className="flex flex-col flex-1 min-h-0">
          <div className="split-right-bar"><span className="text-[var(--text-dim)] text-xs">Modified (Right)</span></div>
          <CodeArea value={right} onChange={setRight} placeholder='{"a": 2}' aria-label="Modified JSON" />
        </div>
      </div>
      {diffs && diffs.length > 0 && (
        <div className="diff-results">
          <div className="diff-header">Diff Results</div>
          <div className="diff-body">
            {diffs.filter(d => d.type !== "same").map((d, i) => (
              <div key={i} className={`diff-row diff-row--${d.type}`}>
                <code className="diff-path">{d.path}</code>
                {d.type === "add" && <span className="diff-right">{d.right}</span>}
                {d.type === "del" && <span className="diff-left">{d.left}</span>}
                {d.type === "change" && (
                  <span className="diff-change">
                    <span className="diff-left">{d.left}</span>
                    {" → "}
                    <span className="diff-right">{d.right}</span>
                  </span>
                )}
                <button onClick={() => navigator.clipboard.writeText(d.path)} className="tool-icon-btn ml-auto" title="Copy JSONPath" aria-label="Copy path">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {diffs && diffs.filter(d => d.type !== "same").length === 0 && (
        <div className="empty-state mt-4"><CheckCircle2 className="w-8 h-8 text-[var(--success)] mb-2" /><p>No differences found.</p></div>
      )}
    </div>
  );
};

// ─── Schema Validation Tool ──────────────────────────────────────

const SchemaTool: React.FC<{ push: (t: ToastMsg["type"], m: string) => void }> = ({ push }) => {
  const [jsonText, setJsonText] = useState("");
  const [schemaText, setSchemaText] = useState("");
  const [result, setResult] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("draft-07");

  const generateSchema = () => {
    if (!jsonText.trim()) { push("error", "Enter JSON first."); return; }
    try {
      const parsed = JSON.parse(jsonText);
      const schema = buildSchema(parsed);
      setSchemaText(JSON.stringify({ $schema: "http://json-schema.org/draft-07/schema#", ...schema }, null, 2));
    } catch (e) { push("error", (e as Error).message); }
  };

  const buildSchema = (val: unknown): Record<string, unknown> => {
    if (val === null) return { type: "null" };
    if (Array.isArray(val)) {
      return { type: "array", items: val.length > 0 ? buildSchema(val[0]) : {} };
    }
    if (typeof val === "object") {
      const props: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        props[k] = buildSchema(v);
      }
      return { type: "object", properties: props, required: Object.keys(val as object) };
    }
    return { type: typeof val };
  };

  const validate = async () => {
    if (!jsonText.trim() || !schemaText.trim()) { push("error", "Both JSON and Schema are required."); return; }
    setLoading(true);
    try {
      const { default: Ajv } = await import("ajv");
      const ajv = new Ajv({ allErrors: true, strict: false });

      let schema: unknown;
      try { schema = JSON.parse(schemaText); } catch (e) { push("error", `Schema error: ${(e as Error).message}`); return; }

      let data: unknown;
      try { data = JSON.parse(jsonText); } catch (e) { push("error", `JSON error: ${(e as Error).message}`); return; }

      const validate = ajv.compile(schema as object);
      const valid = validate(data);
      const errors = (validate.errors || []).map((e) => `${e.instancePath || "/"} ${e.message}`);
      setResult({ valid: valid as boolean, errors });
    } catch (e) {
      push("error", String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tool-pane">
      <div className="tool-bar">
        <div className="tool-bar-left">
          <button onClick={validate} disabled={loading} className="tool-btn tool-btn--primary">
            {loading ? "Validating…" : "Validate"}
          </button>
          <button onClick={generateSchema} className="tool-btn">Generate Schema</button>
          <select value={draft} onChange={(e) => setDraft(e.target.value)} className="tool-select" aria-label="JSON Schema draft">
            <option value="draft-07">Draft-07</option>
            <option value="draft-06">Draft-06</option>
          </select>
        </div>
        <div className="tool-bar-right">
          <span className="text-[var(--text-dim)] text-xs flex items-center gap-1">
            <Info className="w-3 h-3" /> Uses ajv (draft-07 default)
          </span>
        </div>
      </div>
      <div className="tool-split">
        <div className="flex flex-col flex-1 min-h-0">
          <div className="split-right-bar"><span className="text-[var(--text-dim)] text-xs">JSON Data</span></div>
          <CodeArea value={jsonText} onChange={setJsonText} placeholder='{"name": "Alice", "age": 30}' aria-label="JSON data to validate" />
        </div>
        <div className="split-divider" />
        <div className="flex flex-col flex-1 min-h-0">
          <div className="split-right-bar">
            <span className="text-[var(--text-dim)] text-xs">JSON Schema ({draft})</span>
            {schemaText && <CopyBtn text={schemaText} onToast={(m) => push("success", m)} />}
          </div>
          <CodeArea value={schemaText} onChange={setSchemaText} placeholder='{"type": "object", "required": ["name"]}' aria-label="JSON Schema" />
        </div>
      </div>
      {result && (
        <div className={`schema-result ${result.valid ? "schema-result--valid" : "schema-result--invalid"}`}>
          {result.valid
            ? <><CheckCircle2 className="w-4 h-4" /> JSON is valid against the schema</>
            : <>
              <XCircle className="w-4 h-4" /> Validation failed ({result.errors.length} error{result.errors.length !== 1 ? "s" : ""})
              <ul className="schema-errors">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </>
          }
        </div>
      )}
    </div>
  );
};

// ─── JSONPath Playground ─────────────────────────────────────────

const JsonPathTool: React.FC<{ push: (t: ToastMsg["type"], m: string) => void }> = ({ push }) => {
  const [jsonText, setJsonText] = useState('{"store": {"book": [{"title": "Moby Dick", "price": 8.99}, {"title": "War and Peace", "price": 12.99}]}}');
  const [path, setPath] = useState("$.store.book[*].title");
  const [result, setResult] = useState<unknown[] | null>(null);
  const [error, setError] = useState("");

  const run = async () => {
    if (!jsonText.trim()) { push("error", "Enter JSON first."); return; }
    if (!path.trim()) { push("error", "Enter a JSONPath expression."); return; }
    setError("");
    try {
      const { JSONPath } = await import("jsonpath-plus");
      const data = JSON.parse(jsonText);
      const res = JSONPath({ path, json: data });
      setResult(Array.isArray(res) ? res : [res]);
    } catch (e) {
      setError(String(e));
      setResult(null);
    }
  };

  return (
    <div className="tool-pane">
      <div className="tool-bar">
        <div className="tool-bar-left">
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="$.store.book[*].title"
            className="tool-input flex-1"
            aria-label="JSONPath expression"
            spellCheck={false}
          />
          <button onClick={run} className="tool-btn tool-btn--primary">Run</button>
        </div>
        <div className="tool-bar-right">
          {result && <span className="text-[var(--text-dim)] text-xs">{result.length} match{result.length !== 1 ? "es" : ""}</span>}
        </div>
      </div>
      {error && <div className="error-bar" role="alert"><XCircle className="w-3.5 h-3.5" />{error}</div>}
      <div className="tool-split">
        <CodeArea value={jsonText} onChange={setJsonText} aria-label="JSON source" />
        <div className="split-divider" />
        <div className="flex flex-col flex-1 min-h-0">
          <div className="split-right-bar">
            <span className="text-[var(--text-dim)] text-xs">Results</span>
            {result && <CopyBtn text={JSON.stringify(result, null, 2)} onToast={(m) => push("success", m)} />}
          </div>
          <CodeArea
            value={result != null ? JSON.stringify(result, null, 2) : ""}
            onChange={() => {}}
            readOnly
            placeholder="Results will appear here"
            aria-label="JSONPath results"
          />
        </div>
      </div>
    </div>
  );
};

// ─── CSV ↔ JSON Tool ─────────────────────────────────────────────

const CsvTool: React.FC<{ push: (t: ToastMsg["type"], m: string) => void }> = ({ push }) => {
  const [mode, setMode] = useState<"json2csv" | "csv2json">("json2csv");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [meta, setMeta] = useState<{ rows?: number; headers?: string[] } | null>(null);

  const convert = () => {
    const r = mode === "json2csv" ? jsonToCsv(input) : csvToJson(input);
    if (r.error) { push("error", r.error); return; }
    setOutput(r.output);
    setMeta({ rows: r.rowCount, headers: r.headers });
    push("success", `Converted — ${r.rowCount} row${r.rowCount !== 1 ? "s" : ""}`);
  };

  const ext = mode === "json2csv" ? "csv" : "json";

  return (
    <div className="tool-pane">
      <div className="tool-bar">
        <div className="tool-bar-left">
          <div className="mode-toggle">
            <button onClick={() => setMode("json2csv")} className={`mode-btn ${mode === "json2csv" ? "mode-btn--active" : ""}`}>JSON → CSV</button>
            <button onClick={() => setMode("csv2json")} className={`mode-btn ${mode === "csv2json" ? "mode-btn--active" : ""}`}>CSV → JSON</button>
          </div>
          <button onClick={convert} className="tool-btn tool-btn--primary">Convert</button>
        </div>
        <div className="tool-bar-right">
          {meta && (
            <span className="text-[var(--text-dim)] text-xs">
              {meta.rows} rows · {meta.headers?.length} cols
            </span>
          )}
        </div>
      </div>
      <div className="tool-split">
        <CodeArea value={input} onChange={setInput} placeholder={mode === "json2csv" ? '[{"id":1,"name":"Alice"}]' : "id,name\n1,Alice"} aria-label="Input" />
        <div className="split-divider" />
        <div className="flex flex-col flex-1 min-h-0">
          <div className="split-right-bar">
            <span className="text-[var(--text-dim)] text-xs">Output (.{ext})</span>
            {output && <>
              <CopyBtn text={output} onToast={(m) => push("success", m)} />
              <DownloadBtn text={output} filename={`output.${ext}`} />
            </>}
          </div>
          <CodeArea value={output} onChange={() => {}} readOnly aria-label="Output" />
        </div>
      </div>
      <div className="tool-note">
        <Info className="w-3 h-3 shrink-0" />
        Limit: 100 000 rows. Nested objects are JSON-stringified. First CSV row is used as headers.
      </div>
    </div>
  );
};

// ─── TypeScript Generator ────────────────────────────────────────

const TypeScriptTool: React.FC<{ push: (t: ToastMsg["type"], m: string) => void }> = ({ push }) => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [rootName, setRootName] = useState("Root");

  const convert = () => {
    const r = jsonToTypeScript(input, rootName || "Root");
    if (r.error) { push("error", r.error); return; }
    setOutput(r.output);
  };

  return (
    <div className="tool-pane">
      <div className="tool-bar">
        <div className="tool-bar-left">
          <input value={rootName} onChange={(e) => setRootName(e.target.value)} placeholder="Root" className="tool-input w-32" aria-label="Root type name" />
          <button onClick={convert} className="tool-btn tool-btn--primary">Generate Types</button>
        </div>
        <div className="tool-bar-right">
          {output && <CopyBtn text={output} onToast={(m) => push("success", m)} />}
        </div>
      </div>
      <div className="tool-split">
        <CodeArea value={input} onChange={setInput} placeholder='{"name": "Alice", "age": 30}' aria-label="JSON input" />
        <div className="split-divider" />
        <div className="flex flex-col flex-1 min-h-0">
          <div className="split-right-bar"><span className="text-[var(--text-dim)] text-xs">TypeScript types</span></div>
          <CodeArea value={output} onChange={() => {}} readOnly aria-label="TypeScript output" />
        </div>
      </div>
    </div>
  );
};

// ─── Templates Panel ─────────────────────────────────────────────

const TemplatesPanel: React.FC<{ onApply: (content: string, name: string) => void }> = ({ onApply }) => {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div className="tool-pane p-4">
      <h2 className="section-heading mb-4">Templates</h2>
      <div className="templates-grid">
        {JSON_TEMPLATES.map((t) => (
          <div key={t.id} className="template-card">
            <div className="template-icon">
              <FileText className="w-5 h-5" />
            </div>
            <div className="template-info">
              <span className="template-name">{t.name}</span>
              <span className="template-desc">{t.description}</span>
            </div>
            {confirmId === t.id
              ? (
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-xs text-[var(--warning)]">Overwrite current?</span>
                  <button onClick={() => { onApply(t.content, t.name); setConfirmId(null); }} className="tool-btn tool-btn--primary text-xs px-2 py-0.5">Yes</button>
                  <button onClick={() => setConfirmId(null)} className="tool-btn text-xs px-2 py-0.5">No</button>
                </div>
              )
              : <button onClick={() => setConfirmId(t.id)} className="tool-btn mt-2 self-start">Use Template</button>
            }
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Settings Panel ──────────────────────────────────────────────

const SettingsPanel: React.FC<{ settings: AppSettings; onChange: (s: AppSettings) => void }> = ({ settings, onChange }) => {
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => onChange({ ...settings, [k]: v });

  return (
    <div className="tool-pane p-4 overflow-y-auto">
      <h2 className="section-heading mb-4">Settings</h2>
      <div className="settings-form">
        <label className="settings-label">
          Theme
          <select value={settings.theme} onChange={(e) => set("theme", e.target.value as AppSettings["theme"])} className="settings-select" aria-label="Theme">
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </label>
        <label className="settings-label">
          Font Size
          <select value={settings.fontSize} onChange={(e) => set("fontSize", parseInt(e.target.value))} className="settings-select" aria-label="Font size">
            {[11, 12, 13, 14, 16, 18].map((s) => <option key={s} value={s}>{s}px</option>)}
          </select>
        </label>
        <label className="settings-label">
          Font Family
          <select value={settings.fontFamily} onChange={(e) => set("fontFamily", e.target.value as AppSettings["fontFamily"])} className="settings-select" aria-label="Font family">
            <option value="JetBrains Mono">JetBrains Mono</option>
            <option value="Fira Code">Fira Code</option>
            <option value="Cascadia Code">Cascadia Code</option>
            <option value="Consolas">Consolas</option>
          </select>
        </label>
        <label className="settings-label">
          Indent Size
          <select value={String(settings.indentSize)} onChange={(e) => set("indentSize", e.target.value === "tab" ? "tab" : parseInt(e.target.value))} className="settings-select" aria-label="Indent size">
            <option value="2">2 spaces</option>
            <option value="4">4 spaces</option>
            <option value="tab">Tab</option>
          </select>
        </label>
        <label className="settings-row-label">
          <input type="checkbox" checked={settings.wordWrap} onChange={(e) => set("wordWrap", e.target.checked)} className="accent-[var(--accent)]" />
          Word Wrap
        </label>
        <label className="settings-row-label">
          <input type="checkbox" checked={settings.validateOnType} onChange={(e) => set("validateOnType", e.target.checked)} className="accent-[var(--accent)]" />
          Validate on type
        </label>
        <label className="settings-row-label">
          <input type="checkbox" checked={settings.sortKeysOnFormat} onChange={(e) => set("sortKeysOnFormat", e.target.checked)} className="accent-[var(--accent)]" />
          Sort keys on format
        </label>
        <div className="settings-section-heading">Keyboard Shortcuts</div>
        <div className="shortcuts-table">
          {[
            ["New Document", "Ctrl+N"],
            ["Format JSON", "Ctrl+Shift+F"],
            ["Minify JSON", "Ctrl+Shift+M"],
            ["Copy Output", "Ctrl+Shift+C"],
            ["Command Palette", "Ctrl+Shift+P"],
            ["Switch Tool", "Ctrl+1…9"],
          ].map(([action, key]) => (
            <div key={action} className="shortcut-row">
              <span className="shortcut-action">{action}</span>
              <kbd className="shortcut-key">{key}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── AI Panel (JSON-aware) ───────────────────────────────────────

const TASK_PRESETS = [
  { id: "generate", label: "Generate JSON", prompt: "Generate a valid JSON object for: " },
  { id: "explain", label: "Explain JSON", prompt: "Explain this JSON structure: " },
  { id: "repair", label: "Repair JSON", prompt: "Fix all syntax errors in this JSON: " },
  { id: "summarize", label: "Summarize JSON", prompt: "Summarize the contents of this JSON: " },
  { id: "convert", label: "Convert to YAML", prompt: "Convert this JSON to YAML: " },
  { id: "schema", label: "Generate Schema", prompt: "Generate a JSON Schema (draft-07) for this JSON: " },
];

const AiPanelTool: React.FC<{ docContent: string }> = ({ docContent }) => {
  const [prompt, setPrompt] = useState("");
  const [preset, setPreset] = useState<string | null>(null);

  return (
    <div className="tool-pane p-4 overflow-y-auto">
      <div className="ai-no-provider">
        <Bot className="w-10 h-10 text-[var(--accent)]" />
        <h3 className="ai-no-provider-title">No AI Provider Configured</h3>
        <p className="ai-no-provider-desc">
          Connect an AI provider (OpenAI, Anthropic, or Google Gemini) to use the AI assistant.
          Your API key is never stored in the browser.
        </p>
        <div className="ai-provider-links">
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="tool-btn">OpenAI</a>
          <a href="https://console.anthropic.com/keys" target="_blank" rel="noreferrer" className="tool-btn">Anthropic</a>
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="tool-btn">Google Gemini</a>
        </div>
      </div>

      <div className="mt-6">
        <div className="section-heading mb-2">Task Presets</div>
        <div className="preset-grid">
          {TASK_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => { setPreset(p.id); setPrompt(p.prompt + (docContent.trim() ? "(current document)" : "")); }}
              className={`preset-btn ${preset === p.id ? "preset-btn--active" : ""}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt or select a preset above…"
          rows={4}
          className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-[var(--radius-sm)] p-2.5 text-sm resize-none text-[var(--text)] placeholder:text-[var(--text-dim)]"
          aria-label="AI prompt"
        />
        <div className="mt-2 flex items-center gap-2">
          <button disabled className="tool-btn tool-btn--primary opacity-50 cursor-not-allowed">Send (No Provider)</button>
          <span className="text-[var(--text-dim)] text-xs">Provider not configured</span>
        </div>
        <p className="text-[var(--text-dim)] text-xs mt-2 flex items-start gap-1">
          <Info className="w-3 h-3 shrink-0 mt-0.5" />
          Your document content would be sent to the configured AI provider. No data is sent without a provider.
        </p>
      </div>
    </div>
  );
};

// ─── API Playground ──────────────────────────────────────────────

interface ApiHistoryEntry { method: string; url: string; status: number | null; duration: number; ts: number; }

const ApiPlayground: React.FC<{ push: (t: ToastMsg["type"], m: string) => void }> = ({ push }) => {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("https://jsonplaceholder.typicode.com/todos/1");
  const [body, setBody] = useState("");
  const [headersText, setHeadersText] = useState('{\n  "Content-Type": "application/json"\n}');
  const [response, setResponse] = useState<{ status: number; statusText: string; headers: Record<string, string>; body: string; duration: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<ApiHistoryEntry[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const send = async () => {
    if (!url.trim()) { push("error", "URL is required."); return; }
    setLoading(true);
    setError("");
    setResponse(null);
    abortRef.current = new AbortController();
    const t0 = performance.now();

    let headers: Record<string, string> = {};
    try {
      if (headersText.trim()) headers = JSON.parse(headersText);
    } catch { push("error", "Invalid headers JSON."); setLoading(false); return; }

    // Mask Authorization values in history
    const safeHeaders = Object.fromEntries(
      Object.entries(headers).map(([k, v]) =>
        k.toLowerCase().includes("auth") || k.toLowerCase().includes("key") ? [k, "***"] : [k, v]
      )
    );
    void safeHeaders;

    try {
      const init: RequestInit = { method, headers, signal: abortRef.current.signal };
      if (body.trim() && method !== "GET" && method !== "HEAD") init.body = body;

      const res = await fetch(url, init);
      const duration = Math.round(performance.now() - t0);
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { resHeaders[k] = v; });

      let resBody = await res.text();
      try { resBody = JSON.stringify(JSON.parse(resBody), null, 2); } catch { /* keep raw */ }

      setResponse({ status: res.status, statusText: res.statusText, headers: resHeaders, body: resBody, duration });
      setHistory((p) => [{ method, url, status: res.status, duration, ts: Date.now() }, ...p.slice(0, 19)]);
    } catch (e) {
      const msg = (e as Error).message;
      const isCors = msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("cors") || msg.toLowerCase().includes("network");
      if ((e as Error).name === "AbortError") {
        setError("Request cancelled.");
      } else if (isCors) {
        setError(`Network / CORS error: ${msg}\n\nThis is a browser security restriction. The server must include appropriate CORS headers (Access-Control-Allow-Origin) to allow requests from this origin.`);
      } else {
        setError(msg);
      }
      setHistory((p) => [{ method, url, status: null, duration: Math.round(performance.now() - t0), ts: Date.now() }, ...p.slice(0, 19)]);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const statusColor = (s: number | null) =>
    s === null ? "text-[var(--danger)]"
    : s < 300 ? "text-[var(--success)]"
    : s < 400 ? "text-[var(--info)]"
    : s < 500 ? "text-[var(--warning)]"
    : "text-[var(--danger)]";

  return (
    <div className="tool-pane overflow-y-auto">
      <div className="tool-bar">
        <div className="tool-bar-left flex-wrap gap-1">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="tool-select w-24" aria-label="HTTP method">
            {["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"].map(m => <option key={m}>{m}</option>)}
          </select>
          <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} className="tool-input flex-1 min-w-40" placeholder="https://api.example.com/endpoint" aria-label="Request URL" />
          <button onClick={send} disabled={loading} className="tool-btn tool-btn--primary">{loading ? "Sending…" : "Send"}</button>
          {loading && <button onClick={() => abortRef.current?.abort()} className="tool-btn text-[var(--danger)]">Cancel</button>}
        </div>
      </div>

      <div className="api-body">
        <div className="api-req">
          <div className="api-section-title">Headers</div>
          <CodeArea value={headersText} onChange={setHeadersText} aria-label="Request headers" className="h-28" />
          {(method !== "GET" && method !== "HEAD") && (
            <>
              <div className="api-section-title mt-2">Body (JSON)</div>
              <CodeArea value={body} onChange={setBody} placeholder='{"key": "value"}' aria-label="Request body" className="h-40" />
            </>
          )}
        </div>

        <div className="api-resp">
          <div className="api-section-title">Response</div>
          {error && (
            <div className="error-bar whitespace-pre-wrap" role="alert">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="whitespace-pre-wrap">{error}</span>
            </div>
          )}
          {response && (
            <div>
              <div className="api-status-row">
                <span className={`font-mono font-bold ${statusColor(response.status)}`}>{response.status} {response.statusText}</span>
                <span className="text-[var(--text-dim)] text-xs">{response.duration}ms</span>
                <CopyBtn text={response.body} onToast={(m) => push("success", m)} />
                <DownloadBtn text={response.body} filename="response.json" />
              </div>
              <CodeArea value={response.body} onChange={() => {}} readOnly aria-label="Response body" className="h-48" />
            </div>
          )}
          {!response && !error && !loading && (
            <div className="empty-state text-sm">Send a request to see the response.</div>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div className="api-history">
          <div className="flex items-center justify-between mb-1">
            <span className="api-section-title">History</span>
            <button onClick={() => setHistory([])} className="tool-icon-btn text-[var(--danger)]" aria-label="Clear history"><Trash2 className="w-3 h-3" /></button>
          </div>
          {history.map((h, i) => (
            <button key={i} onClick={() => { setMethod(h.method); setUrl(h.url); }} className="api-hist-row">
              <span className="font-mono text-xs text-[var(--accent)]">{h.method}</span>
              <span className="text-xs text-[var(--text)] truncate flex-1 text-left">{h.url}</span>
              <span className={`text-xs font-mono ${statusColor(h.status)}`}>{h.status ?? "ERR"}</span>
              <span className="text-[var(--text-dim)] text-xs">{h.duration}ms</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Document sidebar ─────────────────────────────────────────────

interface DocSidebarProps {
  docs: JsonDocument[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  saveStatus: "saved" | "saving" | "unsaved";
}

const DocSidebar: React.FC<DocSidebarProps> = ({ docs, activeId, onSelect, onCreate, onDelete, onRename, saveStatus }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const startRename = (doc: JsonDocument) => { setEditingId(doc.id); setEditName(doc.name); };
  const commitRename = () => {
    if (editingId && editName.trim()) onRename(editingId, editName.trim());
    setEditingId(null);
  };

  return (
    <div className="doc-sidebar">
      <div className="doc-sidebar-header">
        <span className="doc-sidebar-title">Documents</span>
        <div className="flex items-center gap-1">
          <span className={`save-status save-status--${saveStatus}`} aria-live="polite">
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "Unsaved"}
          </span>
          <button onClick={onCreate} className="tool-icon-btn" aria-label="New document" title="New document">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="doc-list">
        {docs.map((d) => (
          <div key={d.id} className={`doc-item ${d.id === activeId ? "doc-item--active" : ""}`}>
            {editingId === d.id
              ? (
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditingId(null); }}
                  className="doc-rename-input"
                  autoFocus
                  aria-label="Rename document"
                />
              )
              : (
                <button onClick={() => onSelect(d.id)} onDoubleClick={() => startRename(d)} className="doc-name" aria-current={d.id === activeId ? "true" : undefined}>
                  {d.name}
                  {d.isDirty && <span className="doc-dirty-dot" aria-label="Unsaved" />}
                </button>
              )
            }
            <button onClick={() => { if (docs.length > 1) onDelete(d.id); }} className="doc-delete-btn" aria-label={`Delete ${d.name}`} title="Delete">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main JSON Studio App ─────────────────────────────────────────

export const JsonStudio: React.FC = () => {
  // ── Settings ──
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings().data);

  // Apply theme
  useEffect(() => {
    const html = document.documentElement;
    if (settings.theme === "system") {
      html.removeAttribute("data-theme");
    } else {
      html.setAttribute("data-theme", settings.theme);
    }
  }, [settings.theme]);

  // Save settings (debounced)
  const settingsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current);
    settingsSaveTimer.current = setTimeout(() => saveSettings(settings), 500);
    return () => { if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current); };
  }, [settings]);

  // ── Documents ──
  const [docs, setDocs] = useState<JsonDocument[]>(() => {
    const { data, error } = loadDocuments();
    if (error) console.warn("[persistence] load error:", error);
    return data.length > 0 ? data : [newDoc("Untitled.json")];
  });

  const [activeDocId, setActiveDocId] = useState<string>(() => {
    const savedId = loadActiveDocId();
    return savedId && docs.find((d) => d.id === savedId) ? savedId : docs[0]?.id ?? "";
  });

  const activeDoc = docs.find((d) => d.id === activeDocId) ?? docs[0];

  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save (debounced)
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const dirty = docs.some((d) => d.isDirty);
    if (!dirty) return;
    setSaveStatus("saving");
    saveTimer.current = setTimeout(() => {
      const { error } = saveDocuments(docs.map((d) => ({ ...d, isDirty: false })));
      if (error) { setSaveStatus("unsaved"); } else {
        setDocs((p) => p.map((d) => ({ ...d, isDirty: false })));
        setSaveStatus("saved");
      }
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [docs]);

  useEffect(() => { saveActiveDocId(activeDocId); }, [activeDocId]);

  const updateContent = useCallback((content: string) => {
    setDocs((p) => p.map((d) => d.id === activeDocId
      ? { ...d, content, isDirty: true, updatedAt: Date.now() }
      : d
    ));
    setSaveStatus("unsaved");
  }, [activeDocId]);

  const createDoc = () => {
    const d = newDoc(`Untitled-${docs.length + 1}.json`);
    setDocs((p) => [...p, d]);
    setActiveDocId(d.id);
  };

  const deleteDoc = (id: string) => {
    const remaining = docs.filter((d) => d.id !== id);
    setDocs(remaining.length > 0 ? remaining : [newDoc("Untitled.json")]);
    if (activeDocId === id) setActiveDocId(remaining[0]?.id ?? "");
  };

  const renameDoc = (id: string, name: string) => {
    setDocs((p) => p.map((d) => d.id === id ? { ...d, name } : d));
  };

  const applyTemplate = (content: string, name: string) => {
    setDocs((p) => p.map((d) => d.id === activeDocId ? { ...d, content, name, isDirty: true } : d));
    setActiveTool("editor");
  };

  // ── Tool Navigation ──
  const [activeTool, setActiveTool] = useState<JsonToolId>("editor");
  const { toasts, push, remove } = useToasts();

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.shiftKey && e.key.toLowerCase() === "f") { e.preventDefault(); setActiveTool("format"); }
      if (e.shiftKey && e.key.toLowerCase() === "m") { e.preventDefault(); /* minify is in editor tool */ }
      if (e.key.toLowerCase() === "n") { e.preventDefault(); createDoc(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const renderTool = () => {
    switch (activeTool) {
      case "editor":     return <EditorTool doc={activeDoc} onContent={updateContent} settings={settings} push={push} />;
      case "format":     return <FormatTool push={push} />;
      case "diff":       return <DiffTool push={push} />;
      case "schema":     return <SchemaTool push={push} />;
      case "jsonpath":   return <JsonPathTool push={push} />;
      case "csv":        return <CsvTool push={push} />;
      case "typescript": return <TypeScriptTool push={push} />;
      case "templates":  return <TemplatesPanel onApply={applyTemplate} />;
      case "ai":         return <AiPanelTool docContent={activeDoc.content} />;
      case "api":        return <ApiPlayground push={push} />;
      case "settings":   return <SettingsPanel settings={settings} onChange={setSettings} />;
      default:           return null;
    }
  };

  // Validation for status bar
  const validation = validateJson(activeDoc?.content ?? "");

  return (
    <div className="json-studio" style={{ fontFamily: `var(--font-ui)`, fontSize: settings.fontSize }}>
      {/* Activity Bar */}
      <nav className="json-activity-bar" role="navigation" aria-label="Tool navigation">
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTool(id)}
            className={`activity-btn ${activeTool === id ? "activity-btn--active" : ""}`}
            title={label}
            aria-label={label}
            aria-current={activeTool === id ? "page" : undefined}
          >
            <Icon className="w-5 h-5" />
          </button>
        ))}
      </nav>

      {/* Document Sidebar */}
      <DocSidebar
        docs={docs}
        activeId={activeDocId}
        onSelect={setActiveDocId}
        onCreate={createDoc}
        onDelete={deleteDoc}
        onRename={renameDoc}
        saveStatus={saveStatus}
      />

      {/* Main content */}
      <main className="json-main" role="main" aria-label={`${NAV.find(n => n.id === activeTool)?.label} tool`}>
        {renderTool()}
      </main>

      {/* Status bar */}
      <footer className="json-status-bar" role="contentinfo">
        <div className="flex items-center gap-3">
          {validation.rootType !== "empty" && <ValidationBadge result={validation} />}
          {validation.valid && (
            <>
              <span className="status-item">{validation.rootType}</span>
              <span className="status-item">{validation.charCount.toLocaleString()} chars</span>
              {validation.topLevelCount !== null && <span className="status-item">{validation.topLevelCount} {validation.rootType === "array" ? "items" : "keys"}</span>}
              <span className="status-item">depth {validation.depth}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="status-item">
            {settings.indentSize === "tab" ? "Tab" : `${settings.indentSize} spaces`}
          </span>
          <span className="status-item">UTF-8</span>
          <span className="status-item">{settings.theme}</span>
          <span className={`save-status save-status--${saveStatus}`}>{saveStatus}</span>
        </div>
      </footer>

      {/* Toast notifications */}
      <div className="toast-container" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`} role="alert">
            {t.type === "success" && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {t.type === "error" && <XCircle className="w-4 h-4 shrink-0" />}
            {t.type === "warning" && <AlertTriangle className="w-4 h-4 shrink-0" />}
            {t.type === "info" && <Info className="w-4 h-4 shrink-0" />}
            <span className="text-xs">{t.text}</span>
            <button onClick={() => remove(t.id)} className="ml-auto text-current opacity-60 hover:opacity-100" aria-label="Dismiss">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
