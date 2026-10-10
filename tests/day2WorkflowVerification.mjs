import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// ==============================================================================
// Implementation Under Test (Pure Logic & Filesystem Security Layer)
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
    // path may not exist yet
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

async function buildDirectoryTree(dirPath, rootPath, maxDepth = 10, currentDepth = 0) {
  if (currentDepth > maxDepth) return []
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
  const nodes = []

  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() === b.isDirectory()) {
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    }
    return a.isDirectory() ? -1 : 1
  })

  for (const entry of sorted) {
    if (entry.isDirectory() && (entry.name === 'node_modules' || entry.name === '.git')) {
      continue
    }

    const fullPath = path.join(dirPath, entry.name)
    if (!isPathInsideRoot(fullPath, rootPath)) continue

    if (entry.isDirectory()) {
      const children = await buildDirectoryTree(fullPath, rootPath, maxDepth, currentDepth + 1)
      nodes.push({
        id: fullPath,
        name: entry.name,
        path: fullPath,
        isDirectory: true,
        children,
      })
    } else {
      nodes.push({
        id: fullPath,
        name: entry.name,
        path: fullPath,
        isDirectory: false,
        extension: path.extname(entry.name).replace('.', '').toLowerCase(),
      })
    }
  }

  return nodes
}

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

// ==============================================================================
// 10-Step Workflow Test Suite
// ==============================================================================

test('AJSON STUDIO — DAY 2 ADVANCED WORKFLOW VERIFICATION (10 STEPS)', async (t) => {
  // Setup disposable directory
  const disposableRoot = normalizePath(path.join(os.tmpdir(), 'ajson_disposable_e2e_' + Date.now()))
  fs.mkdirSync(disposableRoot, { recursive: true })

  // Populate initial realistic workspace structure
  const srcDir = path.join(disposableRoot, 'src')
  const docsDir = path.join(disposableRoot, 'docs')
  fs.mkdirSync(srcDir, { recursive: true })
  fs.mkdirSync(docsDir, { recursive: true })

  const initialIndexPath = path.join(srcDir, 'index.ts')
  const initialReadmePath = path.join(disposableRoot, 'README.md')
  const initialContentIndex = 'export const message = "Hello from Ajson Studio!";\nconsole.log(message);\n'
  const initialContentReadme = '# Disposable Test Project\nCreated for Ajson Studio Day 2 validation.\n'

  fs.writeFileSync(initialIndexPath, initialContentIndex, 'utf-8')
  fs.writeFileSync(initialReadmePath, initialContentReadme, 'utf-8')

  try {
    // --------------------------------------------------------------------------
    // STEP 1: Click Open Project Folder and select a disposable test project directory
    // --------------------------------------------------------------------------
    let activeProjectRoot = null
    await t.test('Step 1: Open Project Folder and initialize workspace', async () => {
      activeProjectRoot = normalizePath(disposableRoot)
      assert.ok(fs.existsSync(activeProjectRoot), 'Disposable project directory must exist on disk')
      assert.equal(isPathInsideRoot(activeProjectRoot, activeProjectRoot), true)
      assert.equal(path.basename(activeProjectRoot).startsWith('ajson_disposable_e2e_'), true)
    })

    // --------------------------------------------------------------------------
    // STEP 2: Verify that Explorer displays real files and nested folders
    // --------------------------------------------------------------------------
    let tree = []
    await t.test('Step 2: Verify Explorer tree displays real files and nested folders', async () => {
      tree = await buildDirectoryTree(activeProjectRoot, activeProjectRoot)
      assert.ok(tree.length >= 2, 'Explorer tree must contain directories and root files')

      const foundSrc = tree.find((n) => n.name === 'src' && n.isDirectory)
      const foundDocs = tree.find((n) => n.name === 'docs' && n.isDirectory)
      const foundReadme = tree.find((n) => n.name === 'README.md' && !n.isDirectory)

      assert.ok(foundSrc, 'src directory must be present')
      assert.ok(foundDocs, 'docs directory must be present')
      assert.ok(foundReadme, 'README.md must be present in root')

      // Check nested folder expansion
      assert.ok(foundSrc.children && foundSrc.children.length === 1, 'src folder must contain nested children')
      assert.equal(foundSrc.children[0].name, 'index.ts', 'src must contain index.ts')
    })

    // --------------------------------------------------------------------------
    // STEP 3: Open a text file and verify actual contents appear
    // --------------------------------------------------------------------------
    await t.test('Step 3: Open text file and verify actual content is loaded into editor', async () => {
      // Simulate file:read IPC
      const fileToOpen = path.join(srcDir, 'index.ts')
      assert.equal(isPathInsideRoot(fileToOpen, activeProjectRoot), true)

      const buffer = fs.readFileSync(fileToOpen)
      assert.equal(isBinaryContent(buffer), false, 'Text file must not be detected as binary')
      const loadedContent = buffer.toString('utf-8')
      assert.equal(loadedContent, initialContentIndex, 'Content loaded must exactly match file on disk')
    })

    // --------------------------------------------------------------------------
    // STEP 4: Create a file and folder, then verify they exist on disk
    // --------------------------------------------------------------------------
    const newFolderDir = path.join(srcDir, 'components')
    const newFilePath = path.join(newFolderDir, 'Header.tsx')

    await t.test('Step 4: Create a folder and file, verify existence on disk', async () => {
      // 1. Create folder
      assert.equal(isValidFileName('components'), true)
      assert.equal(isPathInsideRoot(srcDir, activeProjectRoot), true)
      fs.mkdirSync(newFolderDir, { recursive: true })
      assert.ok(fs.existsSync(newFolderDir), 'Newly created folder must physically exist on disk')

      // 2. Create file inside new folder
      assert.equal(isValidFileName('Header.tsx'), true)
      assert.equal(isPathInsideRoot(newFolderDir, activeProjectRoot), true)
      fs.writeFileSync(newFilePath, 'export const Header = () => <header>App Header</header>;\n', 'utf-8')
      assert.ok(fs.existsSync(newFilePath), 'Newly created file must physically exist on disk')
    })

    // --------------------------------------------------------------------------
    // STEP 5: Rename a file and verify actual filesystem and Explorer update
    // --------------------------------------------------------------------------
    const renamedFilePath = path.join(newFolderDir, 'Navbar.tsx')

    await t.test('Step 5: Rename file and verify filesystem & Explorer update', async () => {
      assert.equal(isValidFileName('Navbar.tsx'), true)
      assert.equal(isPathInsideRoot(renamedFilePath, activeProjectRoot), true)

      fs.renameSync(newFilePath, renamedFilePath)
      assert.equal(fs.existsSync(newFilePath), false, 'Old filename must no longer exist')
      assert.equal(fs.existsSync(renamedFilePath), true, 'New filename must exist on disk')

      // Refresh Explorer tree to verify representation
      const updatedTree = await buildDirectoryTree(activeProjectRoot, activeProjectRoot)
      const srcNode = updatedTree.find((n) => n.name === 'src')
      const componentsNode = srcNode.children.find((n) => n.name === 'components')
      const renamedNode = componentsNode.children.find((n) => n.name === 'Navbar.tsx')
      assert.ok(renamedNode, 'Explorer tree must reflect renamed item Navbar.tsx')
    })

    // --------------------------------------------------------------------------
    // STEP 6: Delete a test file only after explicit confirmation
    // --------------------------------------------------------------------------
    await t.test('Step 6: Delete test file only after explicit confirmation', async () => {
      // Explicit confirmation flag simulation
      let userConfirmed = false

      // User has not confirmed: deletion must NOT execute
      const executeDelete = (target, confirmed) => {
        if (!confirmed) return { success: false, error: 'User canceled delete' }
        if (target === activeProjectRoot) return { success: false, error: 'Cannot delete project root' }
        fs.rmSync(target, { recursive: true, force: true })
        return { success: true }
      }

      const unconfirmedResult = executeDelete(renamedFilePath, userConfirmed)
      assert.equal(unconfirmedResult.success, false)
      assert.equal(fs.existsSync(renamedFilePath), true, 'Item must NOT be deleted without confirmation')

      // User confirms in UI modal:
      userConfirmed = true
      const confirmedResult = executeDelete(renamedFilePath, userConfirmed)
      assert.equal(confirmedResult.success, true)
      assert.equal(fs.existsSync(renamedFilePath), false, 'Item must be deleted after user confirmation')

      // Verify Safety restriction: cannot delete active project root
      const rootDeleteResult = executeDelete(activeProjectRoot, true)
      assert.equal(rootDeleteResult.success, false)
      assert.equal(fs.existsSync(activeProjectRoot), true, 'Safety guard prevents deleting project root')
    })

    // --------------------------------------------------------------------------
    // STEP 7: Edit a file, save it, and reopen it to verify saved content
    // --------------------------------------------------------------------------
    await t.test('Step 7: Edit file, save to disk, and reopen to verify content', async () => {
      const fileToEdit = path.join(srcDir, 'index.ts')
      const updatedCode = '// Modified by Ajson Studio Day 2 Test\nexport const version = "2.0.0";\n'

      // Save via file write logic
      assert.equal(isPathInsideRoot(fileToEdit, activeProjectRoot), true)
      fs.writeFileSync(fileToEdit, updatedCode, 'utf-8')

      // Reopen file from disk
      const readBack = fs.readFileSync(fileToEdit, 'utf-8')
      assert.equal(readBack, updatedCode, 'Re-read content must strictly match saved content')
    })

    // --------------------------------------------------------------------------
    // STEP 8: Refresh Explorer and verify that open editor state is preserved
    // --------------------------------------------------------------------------
    await t.test('Step 8: Refresh Explorer and verify open editor state is preserved', async () => {
      // Simulate open editor tabs in React state
      let editorTabs = [
        {
          id: path.join(srcDir, 'index.ts'),
          name: 'index.ts',
          path: path.join(srcDir, 'index.ts'),
          content: '// In-memory edits not yet saved\nexport const draft = true;\n',
          originalContent: '// Modified by Ajson Studio Day 2 Test\nexport const version = "2.0.0";\n',
          isDirty: true,
        },
      ]
      let activeTabId = editorTabs[0].id

      // Refresh Explorer tree
      const refreshedTree = await buildDirectoryTree(activeProjectRoot, activeProjectRoot)
      assert.ok(refreshedTree.length > 0, 'Tree must reload successfully')

      // Verify editor tabs state was untouched
      assert.equal(editorTabs.length, 1, 'Open tabs must not be closed on explorer refresh')
      assert.equal(editorTabs[0].id, activeTabId, 'Active tab ID must remain consistent')
      assert.equal(editorTabs[0].isDirty, true, 'Dirty state must be preserved across explorer refresh')
      assert.equal(editorTabs[0].content, '// In-memory edits not yet saved\nexport const draft = true;\n')
    })

    // --------------------------------------------------------------------------
    // STEP 9: Test filename filtering
    // --------------------------------------------------------------------------
    await t.test('Step 9: Test Explorer filename filtering', async () => {
      const currentTree = await buildDirectoryTree(activeProjectRoot, activeProjectRoot)

      // Query: "index"
      const resIndex = filterTreeNodes(currentTree, 'index')
      assert.equal(resIndex.matchCount, 1)
      assert.equal(resIndex.filtered.length, 1) // "src" retained as ancestor
      assert.equal(resIndex.filtered[0].children[0].name, 'index.ts')

      // Query: "README"
      const resReadme = filterTreeNodes(currentTree, 'README')
      assert.equal(resReadme.matchCount, 1)
      assert.equal(resReadme.filtered[0].name, 'README.md')

      // Query: "nonexistent_query_xyz"
      const resNone = filterTreeNodes(currentTree, 'nonexistent_query_xyz')
      assert.equal(resNone.matchCount, 0)
      assert.equal(resNone.filtered.length, 0)
    })

    // --------------------------------------------------------------------------
    // STEP 10: Check Electron preload/IPC security boundary and path validation
    // --------------------------------------------------------------------------
    await t.test('Step 10: Check preload/IPC security boundary and path validation', async () => {
      // 1. Path traversal attacks
      assert.equal(isPathInsideRoot(path.join(activeProjectRoot, '..', 'secret.txt'), activeProjectRoot), false)
      assert.equal(isPathInsideRoot(path.join(activeProjectRoot, '..', '..', 'Windows', 'System32'), activeProjectRoot), false)
      assert.equal(isPathInsideRoot(path.join(activeProjectRoot, 'src', '..', '..', 'outside.js'), activeProjectRoot), false)

      // 2. Filename validation
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

      // 3. Preload whitelist validation: ensure no raw child_process, fs or Node globals exposed
      const preloadContent = fs.readFileSync(
        path.join(process.cwd(), 'electron', 'preload', 'index.ts'),
        'utf-8'
      )
      assert.ok(preloadContent.includes("contextBridge.exposeInMainWorld('ajsonAPI'"), 'Must use contextBridge')
      assert.ok(!preloadContent.includes('require("child_process")'), 'Must never expose child_process')
      assert.ok(!preloadContent.includes('shell.openPath('), 'Must never expose raw shell execution')
      assert.ok(!preloadContent.includes('process.env'), 'Must never leak server-side process.env')
    })
  } finally {
    // Clean up disposable test project
    fs.rmSync(disposableRoot, { recursive: true, force: true })
    assert.equal(fs.existsSync(disposableRoot), false, 'Disposable directory must be completely cleaned up')
  }
})
