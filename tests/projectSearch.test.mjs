import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// Pure search engine implementation matching electron/ipc/handlers.ts
const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'dist-electron',
  'build',
  'out',
  '.vscode',
  '.idea',
  '.cache',
  '.next',
  '.nuxt',
  'coverage',
])

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'tiff',
  'zip', 'tar', 'gz', '7z', 'rar', 'bz2',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'exe', 'dll', 'so', 'dylib', 'bin', 'iso', 'node', 'wasm',
  'mp3', 'wav', 'ogg', 'flac', 'aac',
  'mp4', 'mkv', 'avi', 'mov', 'webm',
  'ttf', 'otf', 'woff', 'woff2', 'eot',
  'class', 'pyc', 'pyo', 'obj', 'o',
])

const MAX_FILE_SIZE = 5 * 1024 * 1024

function normalizePath(p) {
  return path.normalize(path.resolve(p))
}

function isPathInsideRoot(targetPath, allowedRoot) {
  const normTarget = normalizePath(targetPath)
  const normRoot = normalizePath(allowedRoot)
  if (normTarget !== normRoot && !normTarget.startsWith(normRoot + path.sep)) {
    return false
  }
  try {
    if (fs.existsSync(normTarget)) {
      const realTarget = fs.realpathSync(normTarget)
      const realRoot = fs.realpathSync(normRoot)
      if (realTarget !== realRoot && !realTarget.startsWith(realRoot + path.sep)) {
        return false
      }
    }
  } catch {}
  return true
}

function isBinaryContent(buffer) {
  const checkLength = Math.min(buffer.length, 512)
  for (let i = 0; i < checkLength; i++) {
    if (buffer[i] === 0) return true
  }
  return false
}

async function collectSearchableFiles(dirPath, rootPath, fileList, maxFiles = 3000, maxDepth = 15, currentDepth = 0) {
  if (currentDepth > maxDepth || fileList.length >= maxFiles) return
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (fileList.length >= maxFiles) break
      if (entry.isDirectory()) {
        if (DEFAULT_IGNORED_DIRS.has(entry.name)) continue
        const subDir = path.join(dirPath, entry.name)
        if (!isPathInsideRoot(subDir, rootPath)) continue
        await collectSearchableFiles(subDir, rootPath, fileList, maxFiles, maxDepth, currentDepth + 1)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).replace('.', '').toLowerCase()
        if (BINARY_EXTENSIONS.has(ext)) continue
        const fullPath = path.join(dirPath, entry.name)
        if (!isPathInsideRoot(fullPath, rootPath)) continue
        fileList.push(fullPath)
      }
    }
  } catch {}
}

function searchContentLines(content, query, caseSensitive, wholeWord, isRegex, remainingQuota) {
  const matches = []
  if (!query || remainingQuota <= 0) return { matches, reachedQuota: false }

  let regex
  try {
    let pattern = query
    if (!isRegex) {
      pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
    if (wholeWord) {
      pattern = `\\b${pattern}\\b`
    }
    const flags = caseSensitive ? 'g' : 'gi'
    regex = new RegExp(pattern, flags)
  } catch {
    return { matches, reachedQuota: false }
  }

  const lines = content.split(/\r?\n/)
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]
    regex.lastIndex = 0

    let match
    while ((match = regex.exec(line)) !== null) {
      const matchLen = Math.max(match[0].length, 1)
      matches.push({
        lineNumber: lineIdx + 1,
        column: match.index + 1,
        lineContent: line.length > 300 ? line.slice(0, 300) : line,
        matchLength: matchLen,
      })
      if (matches.length >= remainingQuota) {
        return { matches, reachedQuota: true }
      }
      if (match[0].length === 0) {
        regex.lastIndex++
      }
    }
  }
  return { matches, reachedQuota: false }
}

async function executeProjectSearch(activeProjectRoot, query, options = {}) {
  if (!activeProjectRoot) {
    return { success: false, query, results: [], totalMatches: 0, totalFiles: 0, error: 'No project open' }
  }
  const trimmed = (query || '').trim()
  if (!trimmed) {
    return { success: true, query: '', results: [], totalMatches: 0, totalFiles: 0 }
  }

  const maxMatches = options.maxMatches || 500
  const caseSensitive = !!options.caseSensitive
  const wholeWord = !!options.wholeWord
  const isRegex = !!options.isRegex

  const unsavedMap = new Map()
  if (Array.isArray(options.unsavedBuffers)) {
    for (const item of options.unsavedBuffers) {
      if (item && item.path && typeof item.content === 'string') {
        unsavedMap.set(normalizePath(item.path), item.content)
      }
    }
  }

  const fileList = []
  await collectSearchableFiles(activeProjectRoot, activeProjectRoot, fileList)

  const results = []
  let totalMatches = 0
  let truncated = false
  const processedFiles = new Set()

  for (const filePath of fileList) {
    if (truncated) break
    const normPath = normalizePath(filePath)
    processedFiles.add(normPath)

    let content = ''
    if (unsavedMap.has(normPath)) {
      content = unsavedMap.get(normPath)
    } else {
      try {
        const stats = await fs.promises.stat(normPath)
        if (stats.size > MAX_FILE_SIZE) continue
        const buffer = await fs.promises.readFile(normPath)
        if (isBinaryContent(buffer)) continue
        content = buffer.toString('utf-8')
      } catch {
        continue
      }
    }

    const quota = maxMatches - totalMatches
    const searchRes = searchContentLines(content, trimmed, caseSensitive, wholeWord, isRegex, quota)
    if (searchRes.matches.length > 0) {
      totalMatches += searchRes.matches.length
      results.push({
        filePath: normPath,
        fileName: path.basename(normPath),
        relativePath: path.relative(activeProjectRoot, normPath),
        matches: searchRes.matches,
      })
    }
    if (searchRes.reachedQuota || totalMatches >= maxMatches) {
      truncated = true
      break
    }
  }

  if (!truncated) {
    for (const [bufPath, bufContent] of unsavedMap.entries()) {
      if (processedFiles.has(bufPath)) continue
      if (!isPathInsideRoot(bufPath, activeProjectRoot)) continue

      const quota = maxMatches - totalMatches
      const searchRes = searchContentLines(bufContent, trimmed, caseSensitive, wholeWord, isRegex, quota)
      if (searchRes.matches.length > 0) {
        totalMatches += searchRes.matches.length
        results.push({
          filePath: bufPath,
          fileName: path.basename(bufPath),
          relativePath: path.relative(activeProjectRoot, bufPath),
          matches: searchRes.matches,
        })
      }
      if (searchRes.reachedQuota || totalMatches >= maxMatches) {
        truncated = true
        break
      }
    }
  }

  return {
    success: true,
    query: trimmed,
    results,
    totalMatches,
    totalFiles: results.length,
    truncated,
  }
}

// ============================================================================
// Phase 3 Automated Test Suite
// ============================================================================

test('AJSON STUDIO — DAY 2, PHASE 3: REAL PROJECT-WIDE SEARCH TEST SUITE', async (t) => {
  const disposableRoot = normalizePath(path.join(os.tmpdir(), 'ajson_search_test_' + Date.now()))
  fs.mkdirSync(disposableRoot, { recursive: true })

  // Populate test workspace
  const srcDir = path.join(disposableRoot, 'src')
  const docsDir = path.join(disposableRoot, 'docs')
  const nodeModulesDir = path.join(disposableRoot, 'node_modules', 'dummy-pkg')
  const gitDir = path.join(disposableRoot, '.git')

  fs.mkdirSync(srcDir, { recursive: true })
  fs.mkdirSync(docsDir, { recursive: true })
  fs.mkdirSync(nodeModulesDir, { recursive: true })
  fs.mkdirSync(gitDir, { recursive: true })

  // 1. Regular text files
  const fileApp = path.join(srcDir, 'App.tsx')
  const fileUtils = path.join(srcDir, 'utils.ts')
  const fileReadme = path.join(disposableRoot, 'README.md')

  fs.writeFileSync(
    fileApp,
    'import React from "react";\nexport const App = () => {\n  const greeting = "Hello Ajson";\n  console.log(greeting);\n  return <div>{greeting}</div>;\n};\n',
    'utf-8'
  )

  fs.writeFileSync(
    fileUtils,
    'export function computeSum(a: number, b: number) {\n  // greeting helper\n  return a + b;\n}\n',
    'utf-8'
  )

  fs.writeFileSync(
    fileReadme,
    '# Project Documentation\nWelcome to Ajson Studio project-wide search testing.\n',
    'utf-8'
  )

  // 2. File in ignored directory (must never match)
  const ignoredFile = path.join(nodeModulesDir, 'index.js')
  fs.writeFileSync(ignoredFile, 'const greeting = "from node_modules";\n', 'utf-8')

  // 3. Binary file (must never match)
  const binaryFile = path.join(srcDir, 'logo.png')
  const binaryBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00])
  fs.writeFileSync(binaryFile, binaryBuffer)

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Exact and partial content matches
    // ------------------------------------------------------------------------
    await t.test('Exact and partial matches across multiple files', async () => {
      const res = await executeProjectSearch(disposableRoot, 'greeting')
      assert.equal(res.success, true)
      assert.equal(res.totalFiles, 2, 'Should match in App.tsx and utils.ts')
      assert.equal(res.totalMatches, 4, 'Should find 3 matches in App.tsx and 1 in utils.ts')

      const appResult = res.results.find((r) => r.fileName === 'App.tsx')
      assert.ok(appResult, 'App.tsx must be in search results')
      assert.equal(appResult.matches.length, 3)

      const utilsResult = res.results.find((r) => r.fileName === 'utils.ts')
      assert.ok(utilsResult, 'utils.ts must be in search results')
      assert.equal(utilsResult.matches.length, 1)
    })

    // ------------------------------------------------------------------------
    // TEST 2: Correct line and column information
    // ------------------------------------------------------------------------
    await t.test('Correct 1-indexed line and column numbers', async () => {
      const res = await executeProjectSearch(disposableRoot, 'computeSum')
      assert.equal(res.totalMatches, 1)
      const match = res.results[0].matches[0]
      assert.equal(match.lineNumber, 1)
      assert.equal(match.column, 17) // 'export function ' is 16 chars, so 17 is 1-indexed start
      assert.equal(match.matchLength, 10)
      assert.ok(match.lineContent.includes('computeSum(a: number, b: number)'))
    })

    // ------------------------------------------------------------------------
    // TEST 3: Ignored directories (.git, node_modules) are excluded
    // ------------------------------------------------------------------------
    await t.test('Ignored directories like node_modules are excluded from search', async () => {
      const res = await executeProjectSearch(disposableRoot, 'from node_modules')
      assert.equal(res.totalMatches, 0, 'node_modules contents must never be returned')
    })

    // ------------------------------------------------------------------------
    // TEST 4: Binary files are skipped
    // ------------------------------------------------------------------------
    await t.test('Binary files (.png and null-byte files) are skipped', async () => {
      const res = await executeProjectSearch(disposableRoot, 'PNG')
      assert.equal(res.totalMatches, 0, 'Binary file content must never match')
    })

    // ------------------------------------------------------------------------
    // TEST 5: Empty queries and no-result queries
    // ------------------------------------------------------------------------
    await t.test('Empty query returns empty results immediately without scan', async () => {
      const resEmpty = await executeProjectSearch(disposableRoot, '   ')
      assert.equal(resEmpty.success, true)
      assert.equal(resEmpty.totalMatches, 0)
      assert.equal(resEmpty.results.length, 0)

      const resNone = await executeProjectSearch(disposableRoot, 'nonExistentTerm123XYZ')
      assert.equal(resNone.success, true)
      assert.equal(resNone.totalMatches, 0)
      assert.equal(resNone.results.length, 0)
    })

    // ------------------------------------------------------------------------
    // TEST 6: Path traversal security
    // ------------------------------------------------------------------------
    await t.test('Path traversal attempts are rejected', async () => {
      const outsideDir = path.join(disposableRoot, '..')
      assert.equal(isPathInsideRoot(outsideDir, disposableRoot), false)
      assert.equal(isPathInsideRoot(path.join(disposableRoot, '..', 'secret.txt'), disposableRoot), false)
    })

    // ------------------------------------------------------------------------
    // TEST 7: Case sensitive and whole word options
    // ------------------------------------------------------------------------
    await t.test('Case-sensitive and whole-word filtering', async () => {
      // Case sensitive
      const resLower = await executeProjectSearch(disposableRoot, 'hello', { caseSensitive: true })
      assert.equal(resLower.totalMatches, 0, 'Case sensitive search for lowercase "hello" should yield 0 matches')

      const resUpper = await executeProjectSearch(disposableRoot, 'Hello', { caseSensitive: true })
      assert.equal(resUpper.totalMatches, 1, 'Case sensitive search for "Hello" must yield 1 match')

      // Whole word
      const resPartial = await executeProjectSearch(disposableRoot, 'sum', { wholeWord: false })
      assert.ok(resPartial.totalMatches >= 1, 'Partial match for "sum" matches computeSum')

      const resWhole = await executeProjectSearch(disposableRoot, 'sum', { wholeWord: true })
      assert.equal(resWhole.totalMatches, 0, 'Whole word search for "sum" should not match computeSum')
    })

    // ------------------------------------------------------------------------
    // TEST 8: Unsaved editor buffer precedence
    // ------------------------------------------------------------------------
    await t.test('Live unsaved in-memory editor buffer takes precedence over disk', async () => {
      // Disk content of App.tsx has: const greeting = "Hello Ajson";
      // Simulate user editing App.tsx in Monaco without saving:
      const unsavedAppContent =
        'import React from "react";\nexport const App = () => {\n  const greeting = "Super Unsaved Dynamic Content!";\n};\n'

      const unsavedBuffers = [
        {
          path: fileApp,
          content: unsavedAppContent,
        },
      ]

      // Search for the word that exists ONLY on disk:
      const resDisk = await executeProjectSearch(disposableRoot, 'Hello Ajson', { unsavedBuffers })
      const appInDiskRes = resDisk.results.find((r) => r.fileName === 'App.tsx')
      assert.equal(appInDiskRes, undefined, 'Stale disk content must NOT be returned when buffer is modified')

      // Search for the word that exists ONLY in the in-memory buffer:
      const resMemory = await executeProjectSearch(disposableRoot, 'Super Unsaved Dynamic Content', { unsavedBuffers })
      assert.equal(resMemory.totalMatches, 1, 'In-memory buffer must be matched in search')
      assert.equal(resMemory.results[0].fileName, 'App.tsx')
      assert.equal(resMemory.results[0].matches[0].lineNumber, 3)
    })

    // ------------------------------------------------------------------------
    // TEST 9: In-memory untitled buffer inside workspace
    // ------------------------------------------------------------------------
    await t.test('In-memory new file not yet on disk is searched', async () => {
      const scratchFile = path.join(srcDir, 'NewScratch.ts')
      const unsavedBuffers = [
        {
          path: scratchFile,
          content: 'export const scratchToken = "AJSON_LIVE_SEARCH_TOKEN";\n',
        },
      ]

      assert.equal(fs.existsSync(scratchFile), false, 'File must not exist on disk')
      const res = await executeProjectSearch(disposableRoot, 'AJSON_LIVE_SEARCH_TOKEN', { unsavedBuffers })
      assert.equal(res.totalMatches, 1)
      assert.equal(res.results[0].fileName, 'NewScratch.ts')
      assert.equal(res.results[0].matches[0].lineNumber, 1)
    })

    // ------------------------------------------------------------------------
    // TEST 10: Result quota capping and truncation flag
    // ------------------------------------------------------------------------
    await t.test('Caps search results when exceeding maxMatches quota', async () => {
      const resCapped = await executeProjectSearch(disposableRoot, 'greeting', { maxMatches: 2 })
      assert.equal(resCapped.totalMatches, 2)
      assert.equal(resCapped.truncated, true)
    })
  } finally {
    fs.rmSync(disposableRoot, { recursive: true, force: true })
    assert.equal(fs.existsSync(disposableRoot), false, 'Disposable test directory cleaned up')
  }
})
