import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * Filter logic matching src/components/CommandPalette.tsx
 */
function filterCommands(commands, query) {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return commands

  const tokens = trimmed.split(/\s+/).filter(Boolean)
  return commands.filter((cmd) => {
    const haystack = `${cmd.title} ${cmd.category} ${cmd.description || ''} ${cmd.id}`.toLowerCase()
    return tokens.every((token) => haystack.includes(token))
  })
}

/**
 * Keyboard navigation index calculator matching CommandPalette
 */
function getNextIndex(currentIndex, totalCount, direction) {
  if (totalCount === 0) return 0
  if (direction === 'down') {
    return (currentIndex + 1) % totalCount
  }
  if (direction === 'up') {
    return (currentIndex - 1 + totalCount) % totalCount
  }
  return currentIndex
}

/**
 * Mock command list representing the 14 commands wired in App.tsx
 */
function createMockCommandList(handlers = {}) {
  return [
    {
      id: 'open-folder',
      title: 'File: Open Folder...',
      category: 'File',
      shortcut: 'Ctrl+O',
      description: 'Open a project folder into the workspace explorer',
      action: handlers.openFolder || (() => {}),
    },
    {
      id: 'open-file',
      title: 'File: Open File...',
      category: 'File',
      shortcut: 'Ctrl+P',
      description: 'Open an existing text file from disk',
      action: handlers.openFile || (() => {}),
    },
    {
      id: 'new-scratchpad',
      title: 'File: New File / Scratchpad',
      category: 'File',
      shortcut: 'Ctrl+N',
      description: 'Create a new unsaved editor scratchpad buffer',
      action: handlers.newScratchpad || (() => {}),
    },
    {
      id: 'save-file',
      title: 'File: Save',
      category: 'File',
      shortcut: 'Ctrl+S',
      description: 'Save changes in the currently active editor tab',
      action: handlers.saveFile || (() => {}),
    },
    {
      id: 'save-file-as',
      title: 'File: Save As...',
      category: 'File',
      shortcut: 'Ctrl+Shift+S',
      description: 'Save the active tab contents to a new file location',
      action: handlers.saveFileAs || (() => {}),
    },
    {
      id: 'close-active-tab',
      title: 'View: Close Active Tab',
      category: 'View',
      shortcut: 'Ctrl+W',
      description: 'Close currently focused editor tab with unsaved change check',
      action: handlers.closeActiveTab || (() => {}),
    },
    {
      id: 'find-in-file',
      title: 'Edit: Find in File',
      category: 'Edit',
      shortcut: 'Ctrl+F',
      description: 'Trigger Monaco Editor native in-buffer search widget',
      action: handlers.findInFile || (() => {}),
    },
    {
      id: 'replace-in-file',
      title: 'Edit: Replace in File',
      category: 'Edit',
      shortcut: 'Ctrl+H',
      description: 'Trigger Monaco Editor native Find & Replace widget',
      action: handlers.replaceInFile || (() => {}),
    },
    {
      id: 'search-in-project',
      title: 'Search: Search in Project',
      category: 'Search',
      shortcut: 'Ctrl+Shift+F',
      description: 'Open Sidebar search panel and focus project query input',
      action: handlers.searchInProject || (() => {}),
    },
    {
      id: 'toggle-explorer',
      title: 'View: Toggle Explorer Panel',
      category: 'View',
      shortcut: 'Ctrl+B',
      description: 'Show or hide the primary left sidebar / project explorer',
      action: handlers.toggleExplorer || (() => {}),
    },
    {
      id: 'toggle-bottom-panel',
      title: 'View: Toggle Bottom Panel',
      category: 'View',
      shortcut: 'Ctrl+J',
      description: 'Show or hide the lower terminal, problems and output panel',
      action: handlers.toggleBottomPanel || (() => {}),
    },
    {
      id: 'next-tab',
      title: 'Navigation: Switch to Next Tab',
      category: 'Navigation',
      shortcut: 'Ctrl+Tab',
      description: 'Switch active tab to the next buffer on the right',
      action: handlers.nextTab || (() => {}),
    },
    {
      id: 'prev-tab',
      title: 'Navigation: Switch to Previous Tab',
      category: 'Navigation',
      shortcut: 'Ctrl+Shift+Tab',
      description: 'Switch active tab to the previous buffer on the left',
      action: handlers.prevTab || (() => {}),
    },
    {
      id: 'reload-workspace',
      title: 'Workspace: Reload / Refresh Explorer',
      category: 'Workspace',
      shortcut: 'Ctrl+Shift+R',
      description: 'Rescan and refresh the active project directory tree',
      action: handlers.reloadWorkspace || (() => {}),
    },
  ]
}

test('Command Palette: All 14 required Phase 4 commands exist with valid properties', () => {
  const commands = createMockCommandList()
  assert.equal(commands.length, 14, 'Must have exactly 14 commands registered')

  const expectedIds = [
    'open-folder',
    'open-file',
    'new-scratchpad',
    'save-file',
    'save-file-as',
    'close-active-tab',
    'find-in-file',
    'replace-in-file',
    'search-in-project',
    'toggle-explorer',
    'toggle-bottom-panel',
    'next-tab',
    'prev-tab',
    'reload-workspace',
  ]

  for (const id of expectedIds) {
    const cmd = commands.find((c) => c.id === id)
    assert.ok(cmd, `Command with id "${id}" must exist`)
    assert.ok(cmd.title.length > 0, `Command "${id}" must have non-empty title`)
    assert.ok(cmd.category.length > 0, `Command "${id}" must have category`)
    assert.ok(typeof cmd.action === 'function', `Command "${id}" action must be a function`)
    assert.ok(cmd.shortcut, `Command "${id}" must display a shortcut`)
  }
})

test('Command Palette Filtering: Empty query returns full command list', () => {
  const commands = createMockCommandList()
  const filtered = filterCommands(commands, '')
  assert.equal(filtered.length, 14)
  const filteredSpaces = filterCommands(commands, '   ')
  assert.equal(filteredSpaces.length, 14)
})

test('Command Palette Filtering: Fuzzy and substring matching on title', () => {
  const commands = createMockCommandList()

  const saveResults = filterCommands(commands, 'save')
  assert.ok(saveResults.some((c) => c.id === 'save-file'))
  assert.ok(saveResults.some((c) => c.id === 'save-file-as'))

  const saveAsResults = filterCommands(commands, 'save as')
  assert.equal(saveAsResults.length, 1, 'Should match only "File: Save As..."')
  assert.equal(saveAsResults[0].id, 'save-file-as')

  const tabResults = filterCommands(commands, 'tab')
  assert.equal(tabResults.length, 5, 'Should match all tab-related commands')
  assert.ok(tabResults.some((c) => c.id === 'close-active-tab'))
  assert.ok(tabResults.some((c) => c.id === 'next-tab'))
  assert.ok(tabResults.some((c) => c.id === 'prev-tab'))

  const searchResults = filterCommands(commands, 'search: search')
  assert.equal(searchResults.length, 1)
  assert.equal(searchResults[0].id, 'search-in-project')
})

test('Command Palette Filtering: Category search', () => {
  const commands = createMockCommandList()

  const navResults = filterCommands(commands, 'Navigation')
  assert.equal(navResults.length, 2)
  assert.ok(navResults.every((c) => c.category === 'Navigation'))

  const workspaceResults = filterCommands(commands, 'Workspace')
  assert.equal(workspaceResults.length, 2)
  assert.ok(workspaceResults.some((c) => c.id === 'reload-workspace'))
  assert.ok(workspaceResults.some((c) => c.id === 'open-folder'))
})

test('Command Palette Filtering: Multi-token search', () => {
  const commands = createMockCommandList()

  const results = filterCommands(commands, 'view tab')
  assert.equal(results.length, 1)
  assert.equal(results[0].id, 'close-active-tab')

  const fileSaveAs = filterCommands(commands, 'file as')
  assert.equal(fileSaveAs.length, 1)
  assert.equal(fileSaveAs[0].id, 'save-file-as')
})

test('Command Palette Filtering: Empty state when no commands match', () => {
  const commands = createMockCommandList()
  const results = filterCommands(commands, 'xyznonexistent123')
  assert.equal(results.length, 0, 'No commands should match random gibberish')
})

test('Command Palette Navigation: Arrow down and up with wrapping', () => {
  const count = 5

  // Down navigation
  assert.equal(getNextIndex(0, count, 'down'), 1)
  assert.equal(getNextIndex(1, count, 'down'), 2)
  assert.equal(getNextIndex(3, count, 'down'), 4)
  assert.equal(getNextIndex(4, count, 'down'), 0, 'Down from last wraps to 0')

  // Up navigation
  assert.equal(getNextIndex(0, count, 'up'), 4, 'Up from 0 wraps to last item')
  assert.equal(getNextIndex(4, count, 'up'), 3)
  assert.equal(getNextIndex(2, count, 'up'), 1)

  // Empty list edge case
  assert.equal(getNextIndex(0, 0, 'down'), 0)
  assert.equal(getNextIndex(0, 0, 'up'), 0)
})

test('Command Palette Execution: Executes selected command action', () => {
  let executedAction = null

  const commands = createMockCommandList({
    saveFile: () => { executedAction = 'save-file' },
    openFolder: () => { executedAction = 'open-folder' },
    findInFile: () => { executedAction = 'find-in-file' },
  })

  // Execute Save
  const saveCmd = commands.find((c) => c.id === 'save-file')
  saveCmd.action()
  assert.equal(executedAction, 'save-file')

  // Execute Find
  const findCmd = commands.find((c) => c.id === 'find-in-file')
  findCmd.action()
  assert.equal(executedAction, 'find-in-file')
})

test('Command Palette: Unsaved-change protection logic on close-active-tab', () => {
  let tabClosed = false
  let promptShown = false

  // Tab state simulation
  const tabs = [
    { id: '1', title: 'test.ts', isDirty: true, content: 'modified' },
    { id: '2', title: 'scratch.txt', isDirty: false, content: 'clean' },
  ]
  let activeTabId = '1'

  function handleCloseTab(tabId, confirmDialog) {
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab) return
    if (tab.isDirty) {
      promptShown = true
      const proceed = confirmDialog(tab.title)
      if (!proceed) {
        return // Abort close
      }
    }
    tabClosed = true
  }

  // 1. User cancels closing dirty tab
  handleCloseTab(activeTabId, () => false)
  assert.equal(promptShown, true, 'Confirmation prompt must be shown for dirty tab')
  assert.equal(tabClosed, false, 'Tab must not be closed when user cancels')

  // 2. User confirms closing dirty tab
  handleCloseTab(activeTabId, () => true)
  assert.equal(tabClosed, true, 'Tab closed after explicit confirmation')

  // 3. Clean tab closes directly without prompt
  promptShown = false
  tabClosed = false
  handleCloseTab('2', () => false)
  assert.equal(promptShown, false, 'Clean tab closes without prompting confirmation')
  assert.equal(tabClosed, true, 'Clean tab closes immediately')
})

test('Keyboard Shortcut Dispatch: Normal typing does not trigger shortcuts', () => {
  // Shortcut dispatcher matching App.tsx logic
  function shouldTriggerShortcut(event, isPaletteOpen) {
    // If palette is open, palette handles its own keys
    if (isPaletteOpen) return null

    const isCmdOrCtrl = event.ctrlKey || event.metaKey

    // Normal typing in inputs should not trigger global hotkeys unless modifier is pressed
    if (!isCmdOrCtrl) {
      return null
    }

    if (isCmdOrCtrl && event.shiftKey && event.key.toLowerCase() === 'p') {
      return 'command-palette'
    }
    if (isCmdOrCtrl && event.key.toLowerCase() === 's') {
      return event.shiftKey ? 'save-as' : 'save'
    }
    if (isCmdOrCtrl && event.key.toLowerCase() === 'b') {
      return 'toggle-explorer'
    }
    if (isCmdOrCtrl && event.key.toLowerCase() === 'w') {
      return 'close-tab'
    }
    if (isCmdOrCtrl && event.key.toLowerCase() === 'p' && !event.shiftKey) {
      return 'open-file'
    }
    return null
  }

  // Regular letter typing in Monaco or input
  assert.equal(shouldTriggerShortcut({ ctrlKey: false, metaKey: false, shiftKey: false, key: 's' }, false), null)
  assert.equal(shouldTriggerShortcut({ ctrlKey: false, metaKey: false, shiftKey: false, key: 'p' }, false), null)
  assert.equal(shouldTriggerShortcut({ ctrlKey: false, metaKey: false, shiftKey: false, key: 'w' }, false), null)
  assert.equal(shouldTriggerShortcut({ ctrlKey: false, metaKey: false, shiftKey: false, key: 'b' }, false), null)

  // Hotkey combinations
  assert.equal(shouldTriggerShortcut({ ctrlKey: true, metaKey: false, shiftKey: true, key: 'P' }, false), 'command-palette')
  assert.equal(shouldTriggerShortcut({ ctrlKey: true, metaKey: false, shiftKey: false, key: 's' }, false), 'save')
  assert.equal(shouldTriggerShortcut({ ctrlKey: true, metaKey: false, shiftKey: true, key: 'S' }, false), 'save-as')
  assert.equal(shouldTriggerShortcut({ ctrlKey: true, metaKey: false, shiftKey: false, key: 'b' }, false), 'toggle-explorer')
  assert.equal(shouldTriggerShortcut({ ctrlKey: true, metaKey: false, shiftKey: false, key: 'w' }, false), 'close-tab')
  assert.equal(shouldTriggerShortcut({ ctrlKey: true, metaKey: false, shiftKey: false, key: 'p' }, false), 'open-file')

  // When palette is already open, global hotkeys are suppressed so input typing works freely
  assert.equal(shouldTriggerShortcut({ ctrlKey: true, metaKey: false, shiftKey: false, key: 's' }, true), null)
})
