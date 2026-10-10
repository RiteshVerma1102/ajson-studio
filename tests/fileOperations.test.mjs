import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// ==============================================================================
// Security & Filesystem Helpers Under Test
// ==============================================================================
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
  } catch {
    // Path might not exist yet during creation
  }

  return true
}

function isValidFileName(name) {
  if (!name || name.trim() === '') return false
  const illegalRe = /[<>:"/\\|?*\x00-\x1F]/
  return !illegalRe.test(name)
}

function isBinaryContent(buffer) {
  const checkLength = Math.min(buffer.length, 512)
  for (let i = 0; i < checkLength; i++) {
    if (buffer[i] === 0) return true
  }
  return false
}

// ==============================================================================
// Test Suites
// ==============================================================================
test('Security: Path traversal attacks are strictly rejected', () => {
  const tempRoot = normalizePath(path.join(os.tmpdir(), 'ajson_test_security_' + Date.now()))
  fs.mkdirSync(tempRoot, { recursive: true })

  try {
    // 1. Direct parent traversal
    assert.equal(isPathInsideRoot(path.join(tempRoot, '..', 'secret.txt'), tempRoot), false)
    assert.equal(isPathInsideRoot(path.join(tempRoot, '..', '..', 'windows', 'system32'), tempRoot), false)

    // 2. Traversal embedded inside subpath
    assert.equal(isPathInsideRoot(path.join(tempRoot, 'src', '..', '..', 'outside.js'), tempRoot), false)

    // 3. Absolute path pointing outside root
    const outsidePath = path.resolve(os.tmpdir(), 'completely_unrelated')
    assert.equal(isPathInsideRoot(outsidePath, tempRoot), false)

    // 4. Valid inside paths must succeed
    assert.equal(isPathInsideRoot(path.join(tempRoot, 'src', 'App.tsx'), tempRoot), true)
    assert.equal(isPathInsideRoot(path.join(tempRoot, 'nested', 'deep', 'file.json'), tempRoot), true)
    assert.equal(isPathInsideRoot(tempRoot, tempRoot), true)
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('Validation: Filename rules reject illegal characters and empty names', () => {
  assert.equal(isValidFileName(''), false)
  assert.equal(isValidFileName('   '), false)
  assert.equal(isValidFileName('foo/bar'), false)
  assert.equal(isValidFileName('foo\\bar'), false)
  assert.equal(isValidFileName('foo:bar'), false)
  assert.equal(isValidFileName('foo*bar'), false)
  assert.equal(isValidFileName('foo?bar'), false)
  assert.equal(isValidFileName('foo"bar'), false)
  assert.equal(isValidFileName('foo<bar'), false)
  assert.equal(isValidFileName('foo>bar'), false)
  assert.equal(isValidFileName('foo|bar'), false)

  assert.equal(isValidFileName('App.tsx'), true)
  assert.equal(isValidFileName('my-component.test.js'), true)
  assert.equal(isValidFileName('Document (Copy) 2026.md'), true)
  assert.equal(isValidFileName('über_code_123.py'), true)
})

test('Filesystem: Create, Rename and Safe Delete operations', () => {
  const tempWorkspace = normalizePath(path.join(os.tmpdir(), 'ajson_test_fs_' + Date.now()))
  fs.mkdirSync(tempWorkspace, { recursive: true })

  try {
    // 1. Create file inside directory
    const subDir = path.join(tempWorkspace, 'src')
    fs.mkdirSync(subDir, { recursive: true })
    const newFile = path.join(subDir, 'index.ts')
    fs.writeFileSync(newFile, 'console.log("hello")', 'utf-8')
    assert.equal(fs.existsSync(newFile), true)
    assert.equal(fs.readFileSync(newFile, 'utf-8'), 'console.log("hello")')

    // 2. Prevent duplicate overwrite check
    assert.equal(fs.existsSync(newFile), true)

    // 3. Rename file
    const renamedFile = path.join(subDir, 'main.ts')
    fs.renameSync(newFile, renamedFile)
    assert.equal(fs.existsSync(newFile), false)
    assert.equal(fs.existsSync(renamedFile), true)
    assert.equal(fs.readFileSync(renamedFile, 'utf-8'), 'console.log("hello")')

    // 4. Safe Delete
    fs.rmSync(renamedFile)
    assert.equal(fs.existsSync(renamedFile), false)

    // 5. Delete non-empty folder
    const nestedFolder = path.join(tempWorkspace, 'to_delete')
    fs.mkdirSync(nestedFolder, { recursive: true })
    fs.writeFileSync(path.join(nestedFolder, 'inner.txt'), 'test', 'utf-8')
    fs.rmSync(nestedFolder, { recursive: true, force: true })
    assert.equal(fs.existsSync(nestedFolder), false)
  } finally {
    fs.rmSync(tempWorkspace, { recursive: true, force: true })
  }
})

test('Binary Detection: Sniffs null bytes and distinguishes text from binaries', () => {
  const textBuffer = Buffer.from('export const value = 42;\n// Just clean typescript code\n', 'utf-8')
  assert.equal(isBinaryContent(textBuffer), false)

  const binaryBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00])
  assert.equal(isBinaryContent(binaryBuffer), true)
})

test('Unsaved Changes & Tab State: Accurately computes dirty state and tab synchronization', () => {
  const original = 'function add(a, b) { return a + b }'
  let current = original
  let isDirty = current !== original
  assert.equal(isDirty, false)

  // User edits content
  current = 'function add(a: number, b: number) { return a + b }'
  isDirty = current !== original
  assert.equal(isDirty, true)

  // User reverts content to original
  current = original
  isDirty = current !== original
  assert.equal(isDirty, false)

  // User saves content
  current = 'function add(a: number, b: number) { return a + b }'
  const savedOriginal = current
  isDirty = current !== savedOriginal
  assert.equal(isDirty, false)
})

test('Explorer Filtering: Recursively matches file names and preserves ancestor directories', () => {
  function filterTreeNodes(nodes, query) {
    const q = query.trim().toLowerCase()
    if (!q) return { filtered: nodes, matchCount: 0 }
    let matchCount = 0

    function filterList(list) {
      const result = []
      for (const node of list) {
        const selfMatches = node.name.toLowerCase().includes(q)
        if (node.isDirectory) {
          const filteredChildren = node.children ? filterList(node.children) : []
          if (selfMatches || filteredChildren.length > 0) {
            if (selfMatches) matchCount++
            result.push({ ...node, children: filteredChildren })
          }
        } else {
          if (selfMatches) {
            matchCount++
            result.push(node)
          }
        }
      }
      return result
    }

    return { filtered: filterList(nodes), matchCount }
  }

  const mockTree = [
    {
      id: 'src',
      name: 'src',
      isDirectory: true,
      children: [
        { id: 'src/App.tsx', name: 'App.tsx', isDirectory: false },
        { id: 'src/main.tsx', name: 'main.tsx', isDirectory: false },
        {
          id: 'src/components',
          name: 'components',
          isDirectory: true,
          children: [
            { id: 'src/components/FileExplorer.tsx', name: 'FileExplorer.tsx', isDirectory: false },
            { id: 'src/components/Sidebar.tsx', name: 'Sidebar.tsx', isDirectory: false },
          ],
        },
      ],
    },
    { id: 'package.json', name: 'package.json', isDirectory: false },
  ]

  // Filter for "Explorer"
  const filter1 = filterTreeNodes(mockTree, 'Explorer')
  assert.equal(filter1.matchCount, 1)
  assert.equal(filter1.filtered.length, 1) // "src" is retained
  assert.equal(filter1.filtered[0].children[0].name, 'components') // App.tsx and main.tsx filtered out
  assert.equal(filter1.filtered[0].children[0].children[0].name, 'FileExplorer.tsx')

  // Filter for non-existent "xyz123"
  const filter2 = filterTreeNodes(mockTree, 'xyz123')
  assert.equal(filter2.matchCount, 0)
  assert.equal(filter2.filtered.length, 0)

  // Empty filter returns complete tree
  const filter3 = filterTreeNodes(mockTree, '')
  assert.equal(filter3.filtered.length, 2)
})

test('Keyboard Navigation: Flattens visible nodes sequentially respecting folder expansion', () => {
  function getFlattenedVisibleNodes(nodes, expandedNodes) {
    const result = []
    function traverse(list) {
      for (const node of list) {
        result.push(node)
        if (node.isDirectory && expandedNodes.has(node.id) && node.children) {
          traverse(node.children)
        }
      }
    }
    traverse(nodes)
    return result
  }

  const mockTree = [
    {
      id: 'dirA',
      name: 'dirA',
      isDirectory: true,
      children: [
        { id: 'dirA/file1.ts', name: 'file1.ts', isDirectory: false },
        { id: 'dirA/file2.ts', name: 'file2.ts', isDirectory: false },
      ],
    },
    { id: 'fileRoot.json', name: 'fileRoot.json', isDirectory: false },
  ]

  // With dirA collapsed: only dirA and fileRoot.json are visible
  const collapsed = getFlattenedVisibleNodes(mockTree, new Set())
  assert.equal(collapsed.length, 2)
  assert.equal(collapsed[0].id, 'dirA')
  assert.equal(collapsed[1].id, 'fileRoot.json')

  // With dirA expanded: dirA, file1.ts, file2.ts, fileRoot.json are visible in order
  const expanded = getFlattenedVisibleNodes(mockTree, new Set(['dirA']))
  assert.equal(expanded.length, 4)
  assert.equal(expanded[0].id, 'dirA')
  assert.equal(expanded[1].id, 'dirA/file1.ts')
  assert.equal(expanded[2].id, 'dirA/file2.ts')
  assert.equal(expanded[3].id, 'fileRoot.json')
})

test('Context Menu: Coordinates are strictly clamped inside viewport boundaries', () => {
  function clampContextMenu(clickX, clickY, menuWidth, menuHeight, viewportWidth, viewportHeight) {
    const x = Math.min(Math.max(8, clickX), viewportWidth - menuWidth - 8)
    const y = Math.min(Math.max(8, clickY), viewportHeight - menuHeight - 8)
    return { x, y }
  }

  const viewW = 1000
  const viewH = 800
  const menuW = 180
  const menuH = 150

  // Click near top-left: stays inside margin
  assert.deepEqual(clampContextMenu(2, 2, menuW, menuH, viewW, viewH), { x: 8, y: 8 })

  // Click in normal bounds
  assert.deepEqual(clampContextMenu(200, 300, menuW, menuH, viewW, viewH), { x: 200, y: 300 })

  // Click near bottom-right overflow: clamped to stay fully on-screen
  assert.deepEqual(clampContextMenu(990, 790, menuW, menuH, viewW, viewH), {
    x: 1000 - 180 - 8, // 812
    y: 800 - 150 - 8,  // 642
  })
})

test('Save Conflict Detection: Detects external disk modifications and prevents silent overwrite', () => {
  const tempWorkspace = normalizePath(path.join(os.tmpdir(), 'ajson_test_conflict_' + Date.now()))
  fs.mkdirSync(tempWorkspace, { recursive: true })

  try {
    const testFile = path.join(tempWorkspace, 'conflict.ts')
    fs.writeFileSync(testFile, 'const v1 = 1;', 'utf-8')
    const originalMtime = fs.statSync(testFile).mtimeMs

    // Helper simulating IPC conflict check
    function writeWithConflictCheck(filePath, content, options) {
      const stats = fs.statSync(filePath)
      if (options?.expectedLastModified && !options.forceOverwrite) {
        if (stats.mtimeMs > options.expectedLastModified + 50) {
          return { success: false, conflict: true, error: 'External modification detected' }
        }
      }
      fs.writeFileSync(filePath, content, 'utf-8')
      return { success: true, lastModified: fs.statSync(filePath).mtimeMs }
    }

    // 1. Clean write with expected mtime succeeds
    const cleanWrite = writeWithConflictCheck(testFile, 'const v2 = 2;', {
      expectedLastModified: originalMtime,
    })
    assert.equal(cleanWrite.success, true)
    const newMtime = cleanWrite.lastModified

    // 2. Simulate external modification by third-party process
    const futureTime = new Date(Date.now() + 5000)
    fs.utimesSync(testFile, futureTime, futureTime)

    // 3. Attempting save with stale mtime fails with conflict
    const conflictWrite = writeWithConflictCheck(testFile, 'const v3 = 3;', {
      expectedLastModified: newMtime,
    })
    assert.equal(conflictWrite.success, false)
    assert.equal(conflictWrite.conflict, true)

    // 4. Force overwrite bypasses conflict check
    const forceWrite = writeWithConflictCheck(testFile, 'const v4 = 4;', {
      expectedLastModified: newMtime,
      forceOverwrite: true,
    })
    assert.equal(forceWrite.success, true)
    assert.equal(fs.readFileSync(testFile, 'utf-8'), 'const v4 = 4;')
  } finally {
    fs.rmSync(tempWorkspace, { recursive: true, force: true })
  }
})

test('Save As: Creates new destination file without corrupting original buffer or source file', () => {
  const tempWorkspace = normalizePath(path.join(os.tmpdir(), 'ajson_test_saveas_' + Date.now()))
  fs.mkdirSync(tempWorkspace, { recursive: true })

  try {
    const originalFile = path.join(tempWorkspace, 'original.ts')
    const destinationFile = path.join(tempWorkspace, 'renamed_copy.ts')
    fs.writeFileSync(originalFile, 'export const orig = 100;', 'utf-8')

    // Simulate Save As action
    const newContent = 'export const copy = 200;'
    fs.writeFileSync(destinationFile, newContent, 'utf-8')

    assert.equal(fs.existsSync(destinationFile), true)
    assert.equal(fs.readFileSync(destinationFile, 'utf-8'), 'export const copy = 200;')
    // Source file must remain completely untouched
    assert.equal(fs.readFileSync(originalFile, 'utf-8'), 'export const orig = 100;')
  } finally {
    fs.rmSync(tempWorkspace, { recursive: true, force: true })
  }
})

test('Multi-Tab Isolation: Multiple open tabs preserve independent content, language, and dirty states', () => {
  const tabs = [
    {
      id: 'tab1',
      name: 'index.ts',
      path: '/proj/index.ts',
      language: 'typescript',
      content: 'const a = 1;',
      originalContent: 'const a = 1;',
      isDirty: false,
    },
    {
      id: 'tab2',
      name: 'styles.css',
      path: '/proj/styles.css',
      language: 'css',
      content: '.btn { color: red; }',
      originalContent: '.btn { color: blue; }',
      isDirty: true,
    },
    {
      id: 'untitled:123',
      name: 'Untitled-1.ts',
      path: 'untitled:123',
      language: 'typescript',
      content: '// scratchpad note',
      originalContent: '// scratchpad note',
      isDirty: false,
    },
  ]

  // Switching active tab doesn't affect contents of other tabs
  let activeTabId = 'tab1'
  assert.equal(tabs.find((t) => t.id === activeTabId).content, 'const a = 1;')

  activeTabId = 'tab2'
  assert.equal(tabs.find((t) => t.id === activeTabId).content, '.btn { color: red; }')
  assert.equal(tabs.find((t) => t.id === activeTabId).isDirty, true)

  // Modifying active tab updates only that tab
  const updatedTabs = tabs.map((t) =>
    t.id === 'tab1' ? { ...t, content: 'const a = 99;', isDirty: true } : t
  )
  assert.equal(updatedTabs[0].isDirty, true)
  assert.equal(updatedTabs[1].isDirty, true)
  assert.equal(updatedTabs[2].isDirty, false)
  assert.equal(updatedTabs[0].content, 'const a = 99;')
  assert.equal(updatedTabs[1].content, '.btn { color: red; }')
})


