/**
 * Universal JSON Utility Functions for Ajson Studio
 */

export interface JsonValidationResult {
  valid: boolean;
  error?: string;
  line?: number;
  column?: number;
  rootType: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' | 'empty';
}

export interface JsonStats {
  byteSize: number;
  keyCount: number;
  arrayCount: number;
  maxDepth: number;
  primitiveCount: number;
}

export function validateJson(raw: string): JsonValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, error: 'Document is empty', rootType: 'empty' };
  }

  try {
    const parsed = JSON.parse(trimmed);
    let rootType: JsonValidationResult['rootType'] = 'object';
    if (Array.isArray(parsed)) rootType = 'array';
    else if (parsed === null) rootType = 'null';
    else if (typeof parsed === 'string') rootType = 'string';
    else if (typeof parsed === 'number') rootType = 'number';
    else if (typeof parsed === 'boolean') rootType = 'boolean';

    return { valid: true, rootType };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const lineMatch = msg.match(/line (\d+)/i);
    const colMatch = msg.match(/column (\d+)/i);
    return {
      valid: false,
      error: msg,
      line: lineMatch ? parseInt(lineMatch[1]!, 10) : undefined,
      column: colMatch ? parseInt(colMatch[1]!, 10) : undefined,
      rootType: 'object',
    };
  }
}

export function formatJson(raw: string, indent: number | '\t' = 2, sortKeys = false): { output: string; error?: string } {
  try {
    let parsed = JSON.parse(raw);
    if (sortKeys) {
      parsed = deepSortKeys(parsed);
    }
    return { output: JSON.stringify(parsed, null, indent) };
  } catch (err) {
    return { output: raw, error: String(err) };
  }
}

export function minifyJson(raw: string): { output: string; error?: string } {
  try {
    const parsed = JSON.parse(raw);
    return { output: JSON.stringify(parsed) };
  } catch (err) {
    return { output: raw, error: String(err) };
  }
}

export function deepSortKeys(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map(deepSortKeys);
  }
  if (input !== null && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = deepSortKeys(obj[key]);
    }
    return result;
  }
  return input;
}

export function computeJsonStats(raw: string): JsonStats | null {
  try {
    const parsed = JSON.parse(raw);
    let keyCount = 0;
    let arrayCount = 0;
    let maxDepth = 0;
    let primitiveCount = 0;

    function traverse(val: unknown, depth: number) {
      if (depth > maxDepth) maxDepth = depth;
      if (Array.isArray(val)) {
        arrayCount++;
        for (const item of val) traverse(item, depth + 1);
      } else if (val !== null && typeof val === 'object') {
        const keys = Object.keys(val as Record<string, unknown>);
        keyCount += keys.length;
        for (const k of keys) traverse((val as Record<string, unknown>)[k], depth + 1);
      } else {
        primitiveCount++;
      }
    }

    traverse(parsed, 1);
    return {
      byteSize: new Blob([raw]).size,
      keyCount,
      arrayCount,
      maxDepth,
      primitiveCount,
    };
  } catch {
    return null;
  }
}

export function jsonToTypeScript(raw: string, rootName = 'RootObject'): string {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return `export type ${rootName} = ${typeof parsed};\n`;
    }

    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return `export type ${rootName} = unknown[];\n`;
      return `export type ${rootName} = Array<${inferTsType(parsed[0])}>;\n`;
    }

    const lines: string[] = [`export interface ${rootName} {`];
    for (const [k, v] of Object.entries(parsed)) {
      lines.push(`  ${k}: ${inferTsType(v)};`);
    }
    lines.push('}\n');
    return lines.join('\n');
  } catch (e) {
    return `// Failed to generate TypeScript: ${String(e)}`;
  }
}

function inferTsType(val: unknown): string {
  if (val === null) return 'null';
  if (Array.isArray(val)) {
    if (val.length === 0) return 'unknown[]';
    return `${inferTsType(val[0])}[]`;
  }
  if (typeof val === 'object') {
    const fields = Object.entries(val as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${inferTsType(v)}`)
      .join('; ');
    return `{ ${fields} }`;
  }
  return typeof val;
}
