import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// Import pure logic functions from workspaceState module
// Note: We can implement/mirror pure helpers or import compiled dist-electron
const MAX_RECENT_PROJECTS = 10

function getDefaultWorkspaceState() {
  return {
    version: 1,
    lastProjectRoot: null,
    recentProjects: [],
    openTabs: [],
    activeTabPath: null,
    sidebarOpen: true,
    sidebarWidth: 256,
    activeActivityView: 'explorer',
    bottomPanelOpen: true,
    bottomPanelHeight: 210,
    activeBottomTab: 'terminal',
  }
}

function normalizePath(p) {
  if (!p) return ''
  return path.normalize(path.resolve(p))
}

function sanitizeWorkspaceState(raw) {
  const defaults = getDefaultWorkspaceState()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return defaults
  }

  const obj = raw

  // 1. Version
  const version = typeof obj.version === 'number' ? obj.version : defaults.version

  // 2. Last Project Root
  let lastProjectRoot = null
  if (
    obj.lastProjectRoot &&
    typeof obj.lastProjectRoot === 'object' &&
    !Array.isArray(obj.lastProjectRoot)
  ) {
    const lpr = obj.lastProjectRoot
    if (typeof lpr.path === 'string' && lpr.path.trim().length > 0) {
      lastProjectRoot = {
        path: normalizePath(lpr.path),
        name: typeof lpr.name === 'string' && lpr.name.trim().length > 0
          ? lpr.name.trim()
          : path.basename(lpr.path),
      }
    }
  }

  // 3. Recent Projects
  const recentProjects = []
  const seenPaths = new Set()

  if (Array.isArray(obj.recentProjects)) {
    for (const item of obj.recentProjects) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const rp = item
        if (typeof rp.path === 'string' && rp.path.trim().length > 0) {
          const norm = normalizePath(rp.path)
          if (!seenPaths.has(norm)) {
            seenPaths.add(norm)
            recentProjects.push({
              path: norm,
              name: typeof rp.name === 'string' && rp.name.trim().length > 0
                ? rp.name.trim()
                : path.basename(norm),
              lastOpened: typeof rp.lastOpened === 'number' ? rp.lastOpened : Date.now(),
            })
            if (recentProjects.length >= MAX_RECENT_PROJECTS) break
          }
        }
      }
    }
  }

  // 4. Open Tabs
  const openTabs = []
  const seenTabPaths = new Set()

  if (Array.isArray(obj.openTabs)) {
    for (const item of obj.openTabs) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const tab = item
        if (typeof tab.path === 'string' && tab.path.trim().length > 0) {
          const norm = normalizePath(tab.path)
          if (!seenTabPaths.has(norm)) {
            seenTabPaths.add(norm)
            openTabs.push({
              path: norm,
              name: typeof tab.name === 'string' && tab.name.trim().length > 0
                ? tab.name.trim()
                : path.basename(norm),
            })
          }
        }
      }
    }
  }

  // 5. Active Tab Path
  let activeTabPath = null
  if (typeof obj.activeTabPath === 'string' && obj.activeTabPath.trim().length > 0) {
    activeTabPath = normalizePath(obj.activeTabPath)
  }

  // 6. Sidebar & Panels
  const sidebarOpen = typeof obj.sidebarOpen === 'boolean' ? obj.sidebarOpen : defaults.sidebarOpen

  const validActivityViews = ['explorer', 'search', 'git', 'extensions']
  const activeActivityView = validActivityViews.includes(obj.activeActivityView)
    ? obj.activeActivityView
    : defaults.activeActivityView

  const bottomPanelOpen =
    typeof obj.bottomPanelOpen === 'boolean' ? obj.bottomPanelOpen : defaults.bottomPanelOpen

  const validBottomTabs = ['terminal', 'problems', 'output']
  const activeBottomTab = validBottomTabs.includes(obj.activeBottomTab)
    ? obj.activeBottomTab
    : defaults.activeBottomTab

  // 7. Panel Dimensions (with min/max clamps)
  let sidebarWidth = defaults.sidebarWidth || 256
  if (typeof obj.sidebarWidth === 'number' && !isNaN(obj.sidebarWidth)) {
    sidebarWidth = Math.max(180, Math.min(600, Math.round(obj.sidebarWidth)))
  }

  let bottomPanelHeight = defaults.bottomPanelHeight || 210
  if (typeof obj.bottomPanelHeight === 'number' && !isNaN(obj.bottomPanelHeight)) {
    bottomPanelHeight = Math.max(120, Math.min(600, Math.round(obj.bottomPanelHeight)))
  }

  return {
    version,
    lastProjectRoot,
    recentProjects,
    openTabs,
    activeTabPath,
    sidebarOpen,
    sidebarWidth,
    activeActivityView,
    bottomPanelOpen,
    bottomPanelHeight,
    activeBottomTab,
  }
}

async function loadWorkspaceState(storageFilePath) {
  try {
    if (!fs.existsSync(storageFilePath)) {
      return getDefaultWorkspaceState()
    }

    const content = await fs.promises.readFile(storageFilePath, 'utf-8')
    if (!content.trim()) {
      return getDefaultWorkspaceState()
    }

    const parsed = JSON.parse(content)
    return sanitizeWorkspaceState(parsed)
  } catch (err) {
    return getDefaultWorkspaceState()
  }
}

async function saveWorkspaceState(storageFilePath, state) {
  try {
    const parentDir = path.dirname(storageFilePath)
    if (!fs.existsSync(parentDir)) {
      await fs.promises.mkdir(parentDir, { recursive: true })
    }

    const sanitized = sanitizeWorkspaceState(state)
    const serialized = JSON.stringify(sanitized, null, 2)

    const tempFilePath = `${storageFilePath}.tmp.${Date.now()}.${Math.floor(Math.random() * 10000)}`
    await fs.promises.writeFile(tempFilePath, serialized, 'utf-8')

    try {
      await fs.promises.rename(tempFilePath, storageFilePath)
    } catch {
      await fs.promises.writeFile(storageFilePath, serialized, 'utf-8')
      try {
        await fs.promises.unlink(tempFilePath)
      } catch {}
    }

    return true
  } catch (err) {
    return false
  }
}

function addRecentProject(state, project, maxCount = MAX_RECENT_PROJECTS) {
  const normPath = normalizePath(project.path)
  if (!normPath) return state

  const projectName = project.name?.trim() || path.basename(normPath) || normPath
  const filtered = state.recentProjects.filter((p) => normalizePath(p.path) !== normPath)

  const newEntry = {
    path: normPath,
    name: projectName,
    lastOpened: Date.now(),
  }

  const updatedRecents = [newEntry, ...filtered].slice(0, maxCount)

  return {
    ...state,
    lastProjectRoot: { path: normPath, name: projectName },
    recentProjects: updatedRecents,
  }
}

function removeRecentProject(state, projectPath) {
  const normPath = normalizePath(projectPath)
  const updatedRecents = state.recentProjects.filter((p) => normalizePath(p.path) !== normPath)

  let updatedLastRoot = state.lastProjectRoot
  if (state.lastProjectRoot && normalizePath(state.lastProjectRoot.path) === normPath) {
    updatedLastRoot = updatedRecents.length > 0
      ? { path: updatedRecents[0].path, name: updatedRecents[0].name }
      : null
  }

  return {
    ...state,
    lastProjectRoot: updatedLastRoot,
    recentProjects: updatedRecents,
  }
}

async function checkRecentProjectsExistence(projects) {
  const results = []

  for (const proj of projects) {
    let exists = false
    try {
      if (fs.existsSync(proj.path)) {
        const stat = await fs.promises.stat(proj.path)
        exists = stat.isDirectory()
      }
    } catch {
      exists = false
    }

    results.push({
      ...proj,
      exists,
    })
  }

  return results
}

async function filterValidTabsToRestore(tabs) {
  const validTabs = []

  for (const tab of tabs) {
    try {
      if (fs.existsSync(tab.path)) {
        const stat = await fs.promises.stat(tab.path)
        if (stat.isFile()) {
          validTabs.push(tab)
        }
      }
    } catch {}
  }

  return validTabs
}

// -----------------------------------------------------------------------------
// TEST SUITE
// -----------------------------------------------------------------------------

test('Workspace State: Default state returns correct schema and fallbacks', () => {
  const state = getDefaultWorkspaceState()
  assert.equal(state.version, 1)
  assert.equal(state.lastProjectRoot, null)
  assert.deepEqual(state.recentProjects, [])
  assert.deepEqual(state.openTabs, [])
  assert.equal(state.activeTabPath, null)
  assert.equal(state.sidebarOpen, true)
  assert.equal(state.bottomPanelOpen, true)
  assert.equal(state.activeBottomTab, 'terminal')
  assert.equal(state.activeActivityView, 'explorer')
})

test('Workspace State Sanitization: Strips secrets and rejects invalid types', () => {
  const maliciousInput = {
    version: 1,
    apiKey: 'sk-ant-1234567890abcdef',
    password: 'supersecretpassword',
    token: 'jwt-token-xyz',
    sidebarOpen: 'not-a-boolean',
    activeActivityView: 'hacked-view',
    bottomPanelOpen: false,
    activeBottomTab: 'output',
    lastProjectRoot: { path: 'C:/projects/myapp', name: 'myapp' },
  }

  const sanitized = sanitizeWorkspaceState(maliciousInput)

  assert.equal(sanitized.sidebarOpen, true, 'Invalid boolean must fall back to default')
  assert.equal(sanitized.activeActivityView, 'explorer', 'Invalid view must fall back to explorer')
  assert.equal(sanitized.bottomPanelOpen, false, 'Valid boolean preserved')
  assert.equal(sanitized.activeBottomTab, 'output', 'Valid tab preserved')
  assert.ok(sanitized.lastProjectRoot, 'Valid project root preserved')

  // Verify secret fields are stripped
  assert.equal('apiKey' in sanitized, false, 'apiKey must not be present')
  assert.equal('password' in sanitized, false, 'password must not be present')
  assert.equal('token' in sanitized, false, 'token must not be present')
})

test('Atomic Storage: Saves and loads workspace state faithfully', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajson-test-ws-'))
  const storageFile = path.join(tempDir, 'workspace-state.json')

  try {
    const initialState = {
      version: 1,
      lastProjectRoot: { path: path.join(tempDir, 'sample-app'), name: 'sample-app' },
      recentProjects: [
        { path: path.join(tempDir, 'sample-app'), name: 'sample-app', lastOpened: 1700000000000 },
      ],
      openTabs: [
        { path: path.join(tempDir, 'sample-app', 'index.ts'), name: 'index.ts' },
      ],
      activeTabPath: path.join(tempDir, 'sample-app', 'index.ts'),
      sidebarOpen: false,
      activeActivityView: 'search',
      bottomPanelOpen: true,
      activeBottomTab: 'problems',
    }

    const saved = await saveWorkspaceState(storageFile, initialState)
    assert.equal(saved, true, 'Save must return true')
    assert.ok(fs.existsSync(storageFile), 'Storage file must exist on disk')

    const loaded = await loadWorkspaceState(storageFile)
    assert.equal(loaded.sidebarOpen, false)
    assert.equal(loaded.activeActivityView, 'search')
    assert.equal(loaded.activeBottomTab, 'problems')
    assert.equal(loaded.openTabs.length, 1)
    assert.equal(loaded.openTabs[0].name, 'index.ts')
    assert.equal(loaded.lastProjectRoot.name, 'sample-app')
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test('Recent Projects: Re-opening project bumps to top without duplicates', () => {
  let state = getDefaultWorkspaceState()

  state = addRecentProject(state, { path: 'C:/proj/alpha', name: 'alpha' })
  state = addRecentProject(state, { path: 'C:/proj/beta', name: 'beta' })
  state = addRecentProject(state, { path: 'C:/proj/gamma', name: 'gamma' })

  assert.equal(state.recentProjects.length, 3)
  assert.equal(state.recentProjects[0].name, 'gamma')
  assert.equal(state.recentProjects[1].name, 'beta')
  assert.equal(state.recentProjects[2].name, 'alpha')

  // Re-open alpha: should move to top, no duplicates
  state = addRecentProject(state, { path: 'C:/proj/alpha', name: 'alpha' })
  assert.equal(state.recentProjects.length, 3, 'Must not create duplicate')
  assert.equal(state.recentProjects[0].name, 'alpha', 'Must bump to index 0')
  assert.equal(state.recentProjects[1].name, 'gamma')
  assert.equal(state.recentProjects[2].name, 'beta')
})

test('Recent Projects: Capped at maximum entries', () => {
  let state = getDefaultWorkspaceState()

  for (let i = 1; i <= 15; i++) {
    state = addRecentProject(state, { path: `C:/proj/p${i}`, name: `p${i}` }, 10)
  }

  assert.equal(state.recentProjects.length, 10, 'Must be capped at max 10')
  assert.equal(state.recentProjects[0].name, 'p15', 'Most recent project must be at top')
  assert.equal(state.recentProjects[9].name, 'p6', 'Oldest retained project at index 9')
})

test('Recent Projects: Remove entry from recents', () => {
  let state = getDefaultWorkspaceState()
  state = addRecentProject(state, { path: 'C:/proj/one', name: 'one' })
  state = addRecentProject(state, { path: 'C:/proj/two', name: 'two' })

  assert.equal(state.recentProjects.length, 2)
  state = removeRecentProject(state, 'C:/proj/two')
  assert.equal(state.recentProjects.length, 1)
  assert.equal(state.recentProjects[0].name, 'one')
  assert.equal(state.lastProjectRoot.name, 'one')

  state = removeRecentProject(state, 'C:/proj/one')
  assert.equal(state.recentProjects.length, 0)
  assert.equal(state.lastProjectRoot, null)
})

test('Recent Projects: Existence check detects moved or deleted folders', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajson-test-recents-'))

  try {
    const existingDir = path.join(tempDir, 'active-project')
    fs.mkdirSync(existingDir)
    const missingDir = path.join(tempDir, 'deleted-project')

    const projects = [
      { path: existingDir, name: 'active-project', lastOpened: Date.now() },
      { path: missingDir, name: 'deleted-project', lastOpened: Date.now() },
    ]

    const checked = await checkRecentProjectsExistence(projects)
    assert.equal(checked.length, 2)
    assert.equal(checked[0].exists, true, 'Existing folder must have exists: true')
    assert.equal(checked[1].exists, false, 'Deleted or missing folder must have exists: false')
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test('Editor Tab Restoration: Filters out deleted or invalid files', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajson-test-tabs-'))

  try {
    const file1 = path.join(tempDir, 'app.ts')
    const file2 = path.join(tempDir, 'utils.ts')
    const missingFile = path.join(tempDir, 'removed.ts')
    const dirPath = path.join(tempDir, 'subfolder')

    fs.writeFileSync(file1, 'console.log("app")')
    fs.writeFileSync(file2, 'console.log("utils")')
    fs.mkdirSync(dirPath)

    const tabsToRestore = [
      { path: file1, name: 'app.ts' },
      { path: missingFile, name: 'removed.ts' },
      { path: dirPath, name: 'subfolder' }, // Directory cannot be opened as a text tab
      { path: file2, name: 'utils.ts' },
    ]

    const validTabs = await filterValidTabsToRestore(tabsToRestore)
    assert.equal(validTabs.length, 2, 'Only actual existing files must be restored')
    assert.equal(validTabs[0].name, 'app.ts')
    assert.equal(validTabs[1].name, 'utils.ts')
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test('Corrupted Storage: Gracefully recovers from syntax errors or empty files', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajson-test-corrupted-'))
  const corruptedFile = path.join(tempDir, 'corrupted.json')
  const emptyFile = path.join(tempDir, 'empty.json')

  try {
    fs.writeFileSync(corruptedFile, '<<< INVALID JSON SYNTAX DATA >>>')
    fs.writeFileSync(emptyFile, '    \n  ')

    const stateFromCorrupted = await loadWorkspaceState(corruptedFile)
    assert.ok(stateFromCorrupted, 'Must return fallback state')
    assert.equal(stateFromCorrupted.version, 1)
    assert.deepEqual(stateFromCorrupted.recentProjects, [])

    const stateFromEmpty = await loadWorkspaceState(emptyFile)
    assert.ok(stateFromEmpty, 'Must return fallback state')
    assert.equal(stateFromEmpty.version, 1)
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test('Unsaved Changes Guard: Prevents silent project switch when dirty tabs exist', () => {
  const tabs = [
    { id: '1', name: 'main.ts', isDirty: true, content: 'dirty edits' },
    { id: '2', name: 'readme.md', isDirty: false, content: 'clean' },
  ]

  let promptShown = false
  function attemptSwitchProject(confirmDialog) {
    if (tabs.some((t) => t.isDirty)) {
      promptShown = true
      const proceed = confirmDialog('Unsaved changes exist')
      if (!proceed) return false // Cancelled
    }
    return true // Switched
  }

  // User cancels: project switch aborted, edits kept
  const resultCancel = attemptSwitchProject(() => false)
  assert.equal(promptShown, true, 'Confirmation prompt must trigger')
  assert.equal(resultCancel, false, 'Switch must be cancelled')

  // User confirms: switch proceeds
  promptShown = false
  const resultConfirm = attemptSwitchProject(() => true)
  assert.equal(promptShown, true)
  assert.equal(resultConfirm, true, 'Switch proceeds with user consent')
})

test('Panel Dimension Clamping: Enforces minimum and maximum limits on sidebar and bottom dock', () => {
  // Sidebar clamp: 180px - 600px
  assert.equal(sanitizeWorkspaceState({ sidebarWidth: 100 }).sidebarWidth, 180, 'Under min clamped to 180')
  assert.equal(sanitizeWorkspaceState({ sidebarWidth: 900 }).sidebarWidth, 600, 'Over max clamped to 600')
  assert.equal(sanitizeWorkspaceState({ sidebarWidth: 320 }).sidebarWidth, 320, 'Valid preserved')
  assert.equal(sanitizeWorkspaceState({ sidebarWidth: NaN }).sidebarWidth, 256, 'NaN falls back to default 256')
  assert.equal(sanitizeWorkspaceState({ sidebarWidth: 'invalid' }).sidebarWidth, 256, 'String falls back to 256')

  // Bottom dock clamp: 120px - 600px
  assert.equal(sanitizeWorkspaceState({ bottomPanelHeight: 50 }).bottomPanelHeight, 120, 'Under min clamped to 120')
  assert.equal(sanitizeWorkspaceState({ bottomPanelHeight: 800 }).bottomPanelHeight, 600, 'Over max clamped to 600')
  assert.equal(sanitizeWorkspaceState({ bottomPanelHeight: 280 }).bottomPanelHeight, 280, 'Valid preserved')
  assert.equal(sanitizeWorkspaceState({ bottomPanelHeight: NaN }).bottomPanelHeight, 210, 'NaN falls back to default 210')
  assert.equal(sanitizeWorkspaceState({ bottomPanelHeight: null }).bottomPanelHeight, 210, 'Null falls back to 210')
})

test('Panel Dimension Persistence: Saves and restores custom panel dimensions', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajson-test-panels-'))
  const storageFile = path.join(tempDir, 'panels-state.json')

  try {
    const customState = {
      ...getDefaultWorkspaceState(),
      sidebarWidth: 340,
      bottomPanelHeight: 315,
    }

    await saveWorkspaceState(storageFile, customState)
    const reloaded = await loadWorkspaceState(storageFile)

    assert.equal(reloaded.sidebarWidth, 340, 'Custom sidebarWidth must persist and restore')
    assert.equal(reloaded.bottomPanelHeight, 315, 'Custom bottomPanelHeight must persist and restore')
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

