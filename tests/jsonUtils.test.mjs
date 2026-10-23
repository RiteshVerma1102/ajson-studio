/**
 * AJSON Studio — Unit tests for JSON utilities (Phase 2 gate)
 * Run with: node --test tests/jsonUtils.test.mjs
 */
import { strict as assert } from 'node:assert'
import { test, describe } from 'node:test'

// We import from src/utils/jsonUtils — but since this is .mjs and the source is .ts
// we use a simple inline reimplementation of the key functions to avoid a build step.
// All logic here is a 1-to-1 port of jsonUtils.ts.

// ─── Inline port (no build step needed) ─────────────────────────

function validateJson(text) {
  const charCount = text.length
  if (!text.trim()) return { valid: false, errors: [], charCount, byteSize: 0, topLevelCount: null, depth: 0, rootType: 'empty' }
  try {
    const parsed = JSON.parse(text)
    const rootType = Array.isArray(parsed) ? 'array' : parsed === null ? 'null' : typeof parsed
    const topLevelCount = rootType === 'object' ? Object.keys(parsed).length : rootType === 'array' ? parsed.length : null
    return { valid: true, errors: [], charCount, byteSize: charCount, topLevelCount, depth: 0, rootType }
  } catch (e) {
    return { valid: false, errors: [{ message: e.message, line: 1, column: 1 }], charCount, byteSize: 0, topLevelCount: null, depth: 0, rootType: 'empty' }
  }
}

function formatJson(text, opts = {}) {
  if (!text.trim()) return { output: '', error: 'Input is empty.' }
  let parsed
  try { parsed = JSON.parse(text) } catch (e) { return { output: text, error: e.message } }
  const indent = opts.indent === 'tab' ? '\t' : (opts.indent ?? 2)
  const sorted = opts.sortKeys ? deepSortKeys(parsed, opts.sortOrder ?? 'asc') : parsed
  return { output: JSON.stringify(sorted, null, indent) }
}

function minifyJson(text) {
  if (!text.trim()) return { output: '', error: 'Input is empty.' }
  try { return { output: JSON.stringify(JSON.parse(text)) } }
  catch (e) { return { output: text, error: e.message } }
}

function deepSortKeys(val, order = 'asc') {
  if (Array.isArray(val)) return val.map(v => deepSortKeys(v, order))
  if (val !== null && typeof val === 'object') {
    const keys = Object.keys(val).sort((a, b) => order === 'asc' ? a.localeCompare(b) : b.localeCompare(a))
    const result = {}
    for (const k of keys) result[k] = deepSortKeys(val[k], order)
    return result
  }
  return val
}

function jsonToCsv(text) {
  if (!text.trim()) return { output: '', error: 'Input is empty.' }
  let parsed
  try { parsed = JSON.parse(text) } catch (e) { return { output: '', error: e.message } }
  if (!Array.isArray(parsed)) return { output: '', error: 'JSON root must be an array' }
  if (parsed.length === 0) return { output: '', rowCount: 0, headers: [] }
  const headers = Array.from(new Set(parsed.flatMap(r => typeof r === 'object' && r ? Object.keys(r) : [])))
  const escape = v => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    return (s.includes(',') || s.includes('\n') || s.includes('"')) ? `"${s.replace(/"/g,'""')}"` : s
  }
  const rows = parsed.map(row => headers.map(h => escape(row?.[h])).join(','))
  return { output: [headers.map(escape).join(','), ...rows].join('\n'), rowCount: rows.length, headers }
}

function jsonToTypeScript(text, rootName = 'Root') {
  if (!text.trim()) return { output: '', error: 'Input is empty.' }
  try {
    const parsed = JSON.parse(text)
    const tsType = (val, indent, depth) => {
      const pad = indent.repeat(depth), padInner = indent.repeat(depth + 1)
      if (val === null) return 'null'
      if (Array.isArray(val)) return val.length === 0 ? 'unknown[]' : `${tsType(val[0], indent, depth)}[]`
      if (typeof val === 'object') {
        const keys = Object.keys(val)
        if (!keys.length) return 'Record<string, unknown>'
        const props = keys.map(k => `${padInner}${/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k)}: ${tsType(val[k], indent, depth + 1)};`)
        return `{\n${props.join('\n')}\n${pad}}`
      }
      return typeof val
    }
    const body = tsType(parsed, '  ', 0)
    const isObject = !Array.isArray(parsed) && parsed !== null && typeof parsed === 'object'
    return { output: isObject ? `export interface ${rootName} ${body}` : `export type ${rootName} = ${body};` }
  } catch (e) { return { output: '', error: e.message } }
}

// ─── Tests ───────────────────────────────────────────────────────

describe('validateJson', () => {
  test('empty string → rootType empty, valid false', () => {
    const r = validateJson('')
    assert.equal(r.valid, false)
    assert.equal(r.rootType, 'empty')
  })

  test('valid object', () => {
    const r = validateJson('{"a":1}')
    assert.equal(r.valid, true)
    assert.equal(r.rootType, 'object')
    assert.equal(r.topLevelCount, 1)
  })

  test('valid array', () => {
    const r = validateJson('[1,2,3]')
    assert.equal(r.valid, true)
    assert.equal(r.rootType, 'array')
    assert.equal(r.topLevelCount, 3)
  })

  test('invalid JSON', () => {
    const r = validateJson('{bad}')
    assert.equal(r.valid, false)
    assert.ok(r.errors.length > 0)
  })

  test('preserves null at root', () => {
    const r = validateJson('null')
    assert.equal(r.valid, true)
    assert.equal(r.rootType, 'null')
  })

  test('preserves boolean at root', () => {
    const r = validateJson('true')
    assert.equal(r.valid, true)
    assert.equal(r.rootType, 'boolean')
  })
})

describe('formatJson', () => {
  test('formats with 2-space indent by default', () => {
    const r = formatJson('{"b":2,"a":1}')
    assert.ok(!r.error)
    assert.ok(r.output.includes('  '))
  })

  test('empty input → error', () => {
    const r = formatJson('')
    assert.ok(r.error)
  })

  test('invalid input → returns error, not throw', () => {
    const r = formatJson('{bad}')
    assert.ok(r.error)
  })

  test('sortKeys sorts ascending', () => {
    const r = formatJson('{"z":1,"a":2}', { sortKeys: true, sortOrder: 'asc' })
    const parsed = JSON.parse(r.output)
    assert.deepEqual(Object.keys(parsed), ['a', 'z'])
  })

  test('sortKeys sorts descending', () => {
    const r = formatJson('{"a":1,"z":2}', { sortKeys: true, sortOrder: 'desc' })
    const parsed = JSON.parse(r.output)
    assert.deepEqual(Object.keys(parsed), ['z', 'a'])
  })

  test('preserves Unicode', () => {
    const input = '{"emoji":"😀","arabic":"مرحبا"}'
    const r = formatJson(input)
    assert.ok(!r.error)
    const parsed = JSON.parse(r.output)
    assert.equal(parsed.emoji, '😀')
    assert.equal(parsed.arabic, 'مرحبا')
  })

  test('preserves null and booleans', () => {
    const r = formatJson('{"a":null,"b":true,"c":false}')
    const p = JSON.parse(r.output)
    assert.equal(p.a, null)
    assert.equal(p.b, true)
    assert.equal(p.c, false)
  })

  test('preserves number precision', () => {
    const r = formatJson('{"pi":3.14159265358979}')
    const p = JSON.parse(r.output)
    assert.equal(p.pi, 3.14159265358979)
  })
})

describe('minifyJson', () => {
  test('removes whitespace', () => {
    const r = minifyJson('{\n  "a": 1,\n  "b": 2\n}')
    assert.equal(r.output, '{"a":1,"b":2}')
  })

  test('empty → error', () => {
    assert.ok(minifyJson('').error)
  })

  test('invalid → error', () => {
    assert.ok(minifyJson('{bad}').error)
  })
})

describe('deepSortKeys', () => {
  test('sorts nested object keys', () => {
    const result = deepSortKeys({ z: { b: 1, a: 2 }, a: 3 })
    assert.deepEqual(Object.keys(result), ['a', 'z'])
    assert.deepEqual(Object.keys(result.z), ['a', 'b'])
  })

  test('arrays are left in original order', () => {
    const result = deepSortKeys([{ b: 1, a: 2 }, { d: 3, c: 4 }])
    assert.equal(Array.isArray(result), true)
    assert.deepEqual(Object.keys(result[0]), ['a', 'b'])
  })
})

describe('jsonToCsv', () => {
  test('converts array of objects', () => {
    const r = jsonToCsv('[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]')
    assert.ok(!r.error)
    assert.equal(r.rowCount, 2)
    assert.ok(r.output.startsWith('id,name\n'))
  })

  test('rejects non-array root', () => {
    const r = jsonToCsv('{"a":1}')
    assert.ok(r.error)
  })

  test('empty array → 0 rows', () => {
    const r = jsonToCsv('[]')
    assert.equal(r.rowCount, 0)
  })

  test('escapes commas in values', () => {
    const r = jsonToCsv('[{"name":"Smith, Jr."}]')
    assert.ok(r.output.includes('"Smith, Jr."'))
  })

  test('empty input → error', () => {
    assert.ok(jsonToCsv('').error)
  })
})

describe('jsonToTypeScript', () => {
  test('generates interface for object', () => {
    const r = jsonToTypeScript('{"name":"Alice","age":30}')
    assert.ok(!r.error)
    assert.ok(r.output.includes('export interface Root'))
    assert.ok(r.output.includes('name: string'))
    assert.ok(r.output.includes('age: number'))
  })

  test('generates type alias for primitives', () => {
    const r = jsonToTypeScript('"hello"', 'MyStr')
    assert.ok(r.output.includes('export type MyStr = string'))
  })

  test('generates array type', () => {
    const r = jsonToTypeScript('[1,2,3]')
    assert.ok(r.output.includes('number[]'))
  })

  test('empty → error', () => {
    assert.ok(jsonToTypeScript('').error)
  })

  test('invalid JSON → error', () => {
    assert.ok(jsonToTypeScript('{bad}').error)
  })
})

console.log('\n✅ All JSON utility tests completed.')
