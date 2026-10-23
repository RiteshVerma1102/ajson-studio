/**
 * AJSON Studio — Core JSON utility functions (Phase 2)
 *
 * All functions are pure, synchronous, and run entirely in-browser.
 * No document content is logged at any point.
 */

// ─── Types ──────────────────────────────────────────────────────

export interface JsonValidationError {
  message: string;
  line: number;
  column: number;
  offset?: number;
}

export interface JsonValidationResult {
  valid: boolean;
  errors: JsonValidationError[];
  /** Size in characters */
  charCount: number;
  /** Approximate byte size (UTF-8) */
  byteSize: number;
  /** Number of top-level keys (if object) or items (if array) */
  topLevelCount: number | null;
  /** Depth of nesting */
  depth: number;
  /** Type of root value */
  rootType: "object" | "array" | "string" | "number" | "boolean" | "null" | "empty";
}

export interface FormatOptions {
  indent?: number | "tab";
  sortKeys?: boolean;
  /** Sort order: 'asc' | 'desc' */
  sortOrder?: "asc" | "desc";
}

export interface FormatResult {
  output: string;
  error?: string;
}

// ─── Validation ─────────────────────────────────────────────────

/**
 * Validates JSON text. Returns line/column info for the first syntax error.
 * Does NOT throw; all errors are returned in the result object.
 */
export function validateJson(text: string): JsonValidationResult {
  const charCount = text.length;
  const byteSize = new TextEncoder().encode(text).length;

  if (!text.trim()) {
    return { valid: false, errors: [], charCount, byteSize, topLevelCount: null, depth: 0, rootType: "empty" };
  }

  try {
    const parsed = JSON.parse(text);
    const rootType = getRootType(parsed);
    const topLevelCount =
      rootType === "object"
        ? Object.keys(parsed as Record<string, unknown>).length
        : rootType === "array"
        ? (parsed as unknown[]).length
        : null;
    const depth = getDepth(parsed);
    return { valid: true, errors: [], charCount, byteSize, topLevelCount, depth, rootType };
  } catch (e) {
    const err = e as SyntaxError;
    const location = parseJsonErrorLocation(text, err.message);
    return {
      valid: false,
      errors: [{ message: err.message, ...location }],
      charCount,
      byteSize,
      topLevelCount: null,
      depth: 0,
      rootType: "empty",
    };
  }
}

function getRootType(val: unknown): JsonValidationResult["rootType"] {
  if (val === null) return "null";
  if (Array.isArray(val)) return "array";
  switch (typeof val) {
    case "object": return "object";
    case "string": return "string";
    case "number": return "number";
    case "boolean": return "boolean";
    default: return "null";
  }
}

function getDepth(val: unknown, current = 0): number {
  if (val === null || typeof val !== "object") return current;
  const children = Object.values(val as Record<string, unknown>);
  if (children.length === 0) return current;
  return Math.max(...children.map((c) => getDepth(c, current + 1)));
}

/**
 * Parses the line + column from a native JSON.parse SyntaxError message.
 * Falls back to line 1, col 1 when the pattern doesn't match.
 */
function parseJsonErrorLocation(
  text: string,
  message: string
): { line: number; column: number; offset?: number } {
  // V8: "Unexpected token } in JSON at position 42"
  const posMatch = message.match(/position (\d+)/i);
  if (posMatch) {
    const offset = parseInt(posMatch[1], 10);
    const before = text.slice(0, offset);
    const line = (before.match(/\n/g) || []).length + 1;
    const lastNl = before.lastIndexOf("\n");
    const column = lastNl === -1 ? offset + 1 : offset - lastNl;
    return { line, column, offset };
  }
  // Firefox / Safari: "JSON.parse: unexpected character at line 3 column 5 ..."
  const lcMatch = message.match(/line (\d+) column (\d+)/i);
  if (lcMatch) {
    return { line: parseInt(lcMatch[1], 10), column: parseInt(lcMatch[2], 10) };
  }
  return { line: 1, column: 1 };
}

// ─── Format (Pretty-print) ──────────────────────────────────────

/**
 * Formats JSON text. Preserves Unicode, null, booleans, and number precision.
 * sortKeys is key-order-insensitive by default (configurable).
 */
export function formatJson(text: string, opts: FormatOptions = {}): FormatResult {
  if (!text.trim()) return { output: "", error: "Input is empty." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { output: text, error: (e as SyntaxError).message };
  }

  const indent = opts.indent === "tab" ? "\t" : (opts.indent ?? 2);
  const sorted = opts.sortKeys ? deepSortKeys(parsed, opts.sortOrder ?? "asc") : parsed;

  try {
    return { output: JSON.stringify(sorted, null, indent) };
  } catch (e) {
    return { output: text, error: (e as Error).message };
  }
}

// ─── Minify ─────────────────────────────────────────────────────

/** Minifies JSON. Returns exact error if the input is invalid. */
export function minifyJson(text: string): FormatResult {
  if (!text.trim()) return { output: "", error: "Input is empty." };
  try {
    return { output: JSON.stringify(JSON.parse(text)) };
  } catch (e) {
    return { output: text, error: (e as SyntaxError).message };
  }
}

// ─── Sort Keys ──────────────────────────────────────────────────

/**
 * Recursively sorts all object keys.
 * Arrays are left in their original order (only their element objects are sorted).
 * Policy: ascending by default; descending when sortOrder='desc'.
 */
export function deepSortKeys(val: unknown, order: "asc" | "desc" = "asc"): unknown {
  if (Array.isArray(val)) return val.map((v) => deepSortKeys(v, order));
  if (val !== null && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const keys = Object.keys(obj).sort((a, b) =>
      order === "asc" ? a.localeCompare(b) : b.localeCompare(a)
    );
    const result: Record<string, unknown> = {};
    for (const k of keys) result[k] = deepSortKeys(obj[k], order);
    return result;
  }
  return val;
}

// ─── Duplicate Key Detection ─────────────────────────────────────

/**
 * Detects duplicate keys in JSON text using a regex-based pass.
 * NOTE: JS engines deduplicate keys silently on parse, so this catches
 * raw-text duplicates before they are lost. Not 100% reliable for all edge
 * cases (e.g. nested strings containing braces), but covers common cases.
 */
export function findDuplicateKeys(text: string): Array<{ key: string; count: number }> {
  const duplicates: Array<{ key: string; count: number }> = [];
  if (!text.trim()) return duplicates;


  const keyPattern = /"([^"\\]|\\.)*"\s*:/g;
  const keyCounts = new Map<string, number>();
  let m: RegExpExecArray | null;
  while ((m = keyPattern.exec(text)) !== null) {
    const key = m[0].slice(1, m[0].lastIndexOf('"'));
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  }
  keyCounts.forEach((count, key) => {
    if (count > 1) duplicates.push({ key, count });
  });
  return duplicates;
}

// ─── Stats ───────────────────────────────────────────────────────

export interface JsonStats {
  charCount: number;
  byteSize: number;
  lineCount: number;
  objectCount: number;
  arrayCount: number;
  stringCount: number;
  numberCount: number;
  boolCount: number;
  nullCount: number;
  keyCount: number;
  depth: number;
}

function countNodes(
  val: unknown,
  stats: Omit<JsonStats, "charCount" | "byteSize" | "lineCount">,
  currentDepth: number
): void {
  if (val === null) {
    stats.nullCount++;
  } else if (Array.isArray(val)) {
    stats.arrayCount++;
    if (currentDepth > stats.depth) stats.depth = currentDepth;
    val.forEach((v) => countNodes(v, stats, currentDepth + 1));
  } else if (typeof val === "object") {
    stats.objectCount++;
    if (currentDepth > stats.depth) stats.depth = currentDepth;
    for (const [, v] of Object.entries(val as Record<string, unknown>)) {
      stats.keyCount++;
      countNodes(v, stats, currentDepth + 1);
    }
  } else if (typeof val === "string") {
    stats.stringCount++;
  } else if (typeof val === "number") {
    stats.numberCount++;
  } else if (typeof val === "boolean") {
    stats.boolCount++;
  }
}

export function computeJsonStats(text: string): JsonStats | null {
  if (!text.trim()) return null;
  try {
    const parsed = JSON.parse(text);
    const inner: Omit<JsonStats, "charCount" | "byteSize" | "lineCount"> = {
      objectCount: 0, arrayCount: 0, stringCount: 0, numberCount: 0,
      boolCount: 0, nullCount: 0, keyCount: 0, depth: 0,
    };
    countNodes(parsed, inner, 0);
    return {
      charCount: text.length,
      byteSize: new TextEncoder().encode(text).length,
      lineCount: text.split("\n").length,
      ...inner,
    };
  } catch {
    return null;
  }
}

// ─── JSON ↔ TypeScript types ──────────────────────────────────────

function tsType(val: unknown, indent: string, depth: number): string {
  const pad = indent.repeat(depth);
  const padInner = indent.repeat(depth + 1);
  if (val === null) return "null";
  if (Array.isArray(val)) {
    if (val.length === 0) return "unknown[]";
    const inner = tsType(val[0], indent, depth);
    return `${inner}[]`;
  }
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return "Record<string, unknown>";
    const props = keys.map(
      (k) => `${padInner}${/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k)}: ${tsType(obj[k], indent, depth + 1)};`
    );
    return `{\n${props.join("\n")}\n${pad}}`;
  }
  return typeof val;
}

export function jsonToTypeScript(text: string, rootName = "Root"): FormatResult {
  if (!text.trim()) return { output: "", error: "Input is empty." };
  try {
    const parsed = JSON.parse(text);
    const body = tsType(parsed, "  ", 0);
    const isObject = !Array.isArray(parsed) && parsed !== null && typeof parsed === "object";
    const output = isObject
      ? `export interface ${rootName} ${body}`
      : `export type ${rootName} = ${body};`;
    return { output };
  } catch (e) {
    return { output: "", error: (e as SyntaxError).message };
  }
}

// ─── JSON ↔ CSV ───────────────────────────────────────────────────

export interface CsvConvertResult {
  output: string;
  error?: string;
  /** Number of data rows produced */
  rowCount?: number;
  /** Column headers used */
  headers?: string[];
}

/**
 * Converts a JSON array-of-objects to CSV.
 * Limits: max 100 000 rows; values are coerced to string; nested objects are JSON-stringified.
 */
export function jsonToCsv(text: string): CsvConvertResult {
  if (!text.trim()) return { output: "", error: "Input is empty." };
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch (e) {
    return { output: "", error: (e as SyntaxError).message };
  }

  if (!Array.isArray(parsed)) {
    return { output: "", error: "JSON root must be an array of objects to convert to CSV." };
  }

  if (parsed.length === 0) return { output: "", rowCount: 0, headers: [] };

  if (parsed.length > 100_000) {
    return { output: "", error: "Too many rows (>100 000). CSV conversion is limited for safety." };
  }

  const headers = Array.from(
    new Set(parsed.flatMap((row) => (row && typeof row === "object" ? Object.keys(row as Record<string, unknown>) : [])))
  );

  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    if (s.includes(",") || s.includes("\n") || s.includes('"')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const rows = (parsed as Array<Record<string, unknown>>).map((row) =>
    headers.map((h) => escape(row?.[h])).join(",")
  );

  return {
    output: [headers.map(escape).join(","), ...rows].join("\n"),
    rowCount: rows.length,
    headers,
  };
}

/**
 * Converts CSV text to a JSON array-of-objects.
 * Uses first row as headers. Empty cells become empty strings.
 */
export function csvToJson(text: string): CsvConvertResult {
  if (!text.trim()) return { output: "", error: "Input is empty." };

  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { output: "[]", rowCount: 0, headers: [] };

  const parseCsvLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inQ) { inQ = true; continue; }
      if (ch === '"' && inQ) {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
        continue;
      }
      if (ch === "," && !inQ) { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    out.push(cur);
    return out;
  };

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((l) => {
    const vals = parseCsvLine(l);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
    return obj;
  });

  return {
    output: JSON.stringify(rows, null, 2),
    rowCount: rows.length,
    headers,
  };
}
