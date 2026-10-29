import { create } from 'zustand';
import { safeStorage } from './storage';
import { fileSystemService } from '../services';

export interface EditorTab {
  id: string;
  path: string;
  title: string;
  content: string;
  originalContent: string;
  language: string;
  isDirty: boolean;
  isPreview: boolean;
  isPinned: boolean;
  type?: 'file' | 'diff';
  diffStaged?: boolean;
  cursorLine?: number;
  cursorColumn?: number;
  hasConflict?: boolean;
}

export type SplitLayout = 'none' | 'vertical' | 'horizontal';

export interface EditorState {
  tabs: EditorTab[];
  activeTabId: string | null;

  // Split editor support
  splitLayout: SplitLayout;
  secondaryActiveTabId: string | null;

  // Actions
  openFile: (path: string, options?: { preview?: boolean; line?: number; column?: number }) => Promise<void>;
  openDiff: (path: string, original: string, modified: string, staged?: boolean) => void;
  updateContent: (id: string, content: string) => void;
  saveActiveFile: () => Promise<void>;
  resolveConflict: (id: string, choice: 'keep' | 'revert') => Promise<void>;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeSavedTabs: () => void;
  closeAllTabs: () => void;
  setActiveTabId: (id: string) => void;
  pinTab: (id: string) => void;
  reorderTabs: (sourceIndex: number, destinationIndex: number) => void;
  setSplitLayout: (layout: SplitLayout) => void;
  setSecondaryActiveTabId: (id: string | null) => void;
}

const STORAGE_KEY = 'ajson_editor_tabs_v1';

function detectLanguage(path: string): string {
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.md')) return 'markdown';
  return 'plaintext';
}

function loadPersistedTabs(): { tabs: EditorTab[]; activeTabId: string | null } {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
        return {
          tabs: parsed.tabs,
          activeTabId: parsed.activeTabId || parsed.tabs[0]?.id || null,
        };
      }
    }
  } catch {
    // Corrupted storage fallback
  }

  // Default seed tab
  const initialPath = 'src/App.tsx';
  return {
    tabs: [
      {
        id: initialPath,
        path: initialPath,
        title: 'App.tsx',
        content: '',
        originalContent: '',
        language: 'typescript',
        isDirty: false,
        isPreview: false,
        isPinned: true,
      },
    ],
    activeTabId: initialPath,
  };
}

function persistTabs(tabs: EditorTab[], activeTabId: string | null) {
  try {
    const serialized = tabs.map((t) => ({
      ...t,
      // Don't persist temporary diff tabs
      type: t.type === 'diff' ? undefined : t.type,
    }));
    safeStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs: serialized, activeTabId }));
  } catch {
    // Ignore storage write failures
  }
}

export const useEditorStore = create<EditorState>((set, get) => {
  const initial = loadPersistedTabs();

  // Load initial content for default tab asynchronously
  if (initial.activeTabId) {
    fileSystemService.readFile(initial.activeTabId).then((content) => {
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === initial.activeTabId ? { ...t, content, originalContent: content } : t
        ),
      }));
    }).catch(() => {});
  }

  // Subscribe to external file modifications for safe buffer synchronization
  fileSystemService.watch((event, changedPath) => {
    const norm = changedPath.replace(/\\/g, '/');
    const { tabs } = get();
    const matchingTabs = tabs.filter(
      (t) => t.path === norm || t.path.endsWith('/' + norm) || norm.endsWith('/' + t.path)
    );

    for (const tab of matchingTabs) {
      if (event === 'change') {
        fileSystemService.readFile(tab.path).then((fresh) => {
          if (!tab.isDirty) {
            // Buffer is clean: safely refresh contents automatically
            set((state) => ({
              tabs: state.tabs.map((t) =>
                t.id === tab.id ? { ...t, content: fresh, originalContent: fresh, hasConflict: false } : t
              ),
            }));
          } else if (fresh !== tab.originalContent) {
            // Buffer is dirty: preserve user edits and flag external conflict
            set((state) => ({
              tabs: state.tabs.map((t) =>
                t.id === tab.id ? { ...t, hasConflict: true } : t
              ),
            }));
          }
        }).catch(() => {});
      } else if (event === 'unlink') {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tab.id ? { ...t, hasConflict: true } : t
          ),
        }));
      }
    }
  });

  return {
    tabs: initial.tabs,
    activeTabId: initial.activeTabId,
    splitLayout: 'none',
    secondaryActiveTabId: null,

    openFile: async (path, options) => {
      const { tabs } = get();
      const existing = tabs.find((t) => t.path === path && t.type !== 'diff');

      if (existing) {
        // If already open, just focus and set cursor
        set({
          activeTabId: existing.id,
          tabs: tabs.map((t) =>
            t.id === existing.id
              ? {
                  ...t,
                  cursorLine: options?.line ?? t.cursorLine,
                  cursorColumn: options?.column ?? t.cursorColumn,
                  isPreview: options?.preview === false ? false : t.isPreview,
                }
              : t
          ),
        });
        persistTabs(get().tabs, existing.id);
        return;
      }

      let content = '';
      try {
        content = await fileSystemService.readFile(path);
      } catch {
        content = '';
      }

      const isPreview = options?.preview ?? true;
      const title = path.split('/').pop() || path;
      const language = detectLanguage(path);

      const newTab: EditorTab = {
        id: path,
        path,
        title,
        content,
        originalContent: content,
        language,
        isDirty: false,
        isPreview,
        isPinned: !isPreview,
        cursorLine: options?.line,
        cursorColumn: options?.column,
      };

      // If replacing an unpinned preview tab
      const updatedTabs = [...tabs];
      const previewIndex = updatedTabs.findIndex((t) => t.isPreview && !t.isDirty && !t.isPinned);

      if (previewIndex !== -1 && isPreview) {
        updatedTabs[previewIndex] = newTab;
      } else {
        updatedTabs.push(newTab);
      }

      set({ tabs: updatedTabs, activeTabId: newTab.id });
      persistTabs(updatedTabs, newTab.id);
    },

    openDiff: (path, original, modified, staged) => {
      const id = `diff:${path}:${staged ? 'staged' : 'working'}`;
      const title = `${path.split('/').pop()} (${staged ? 'Staged' : 'Working Tree'})`;

      const diffTab: EditorTab = {
        id,
        path,
        title,
        content: modified,
        originalContent: original,
        language: detectLanguage(path),
        isDirty: false,
        isPreview: false,
        isPinned: true,
        type: 'diff',
        diffStaged: staged,
      };

      const existingIndex = get().tabs.findIndex((t) => t.id === id);
      const updatedTabs = [...get().tabs];
      if (existingIndex !== -1) {
        updatedTabs[existingIndex] = diffTab;
      } else {
        updatedTabs.push(diffTab);
      }

      set({ tabs: updatedTabs, activeTabId: id });
    },

    updateContent: (id, newContent) => {
      set((state) => {
        const nextTabs = state.tabs.map((t) => {
          if (t.id === id) {
            return {
              ...t,
              content: newContent,
              isDirty: newContent !== t.originalContent,
              isPreview: false, // Editing pins the tab
              isPinned: true,
            };
          }
          return t;
        });
        return { tabs: nextTabs };
      });
    },

    saveActiveFile: async () => {
      const { tabs, activeTabId } = get();
      const current = tabs.find((t) => t.id === activeTabId);
      if (!current || !current.isDirty || current.type === 'diff') return;

      await fileSystemService.writeFile(current.path, current.content);

      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === current.id ? { ...t, originalContent: current.content, isDirty: false } : t
        ),
      }));

      persistTabs(get().tabs, get().activeTabId);
    },

    resolveConflict: async (id: string, choice: 'keep' | 'revert') => {
      const target = get().tabs.find((t) => t.id === id);
      if (!target) return;

      if (choice === 'revert') {
        try {
          const fresh = await fileSystemService.readFile(target.path);
          set((state) => ({
            tabs: state.tabs.map((t) =>
              t.id === id
                ? { ...t, content: fresh, originalContent: fresh, isDirty: false, hasConflict: false }
                : t
            ),
          }));
        } catch {
          set((state) => ({
            tabs: state.tabs.map((t) => (t.id === id ? { ...t, hasConflict: false } : t)),
          }));
        }
      } else {
        // Keep current dirty edits
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === id ? { ...t, hasConflict: false } : t)),
        }));
      }
    },

    closeTab: (id) => {
      const { tabs, activeTabId } = get();
      const idx = tabs.findIndex((t) => t.id === id);
      if (idx === -1) return;

      const remaining = tabs.filter((t) => t.id !== id);
      let nextActive = activeTabId;

      if (activeTabId === id) {
        if (remaining.length > 0) {
          nextActive = remaining[Math.min(idx, remaining.length - 1)]!.id;
        } else {
          nextActive = null;
        }
      }

      set({ tabs: remaining, activeTabId: nextActive });
      persistTabs(remaining, nextActive);
    },

    closeOtherTabs: (id) => {
      const target = get().tabs.find((t) => t.id === id);
      if (!target) return;
      const remaining = [target];
      set({ tabs: remaining, activeTabId: target.id });
      persistTabs(remaining, target.id);
    },

    closeSavedTabs: () => {
      const remaining = get().tabs.filter((t) => t.isDirty);
      const nextActive = remaining.length > 0 ? remaining[0]!.id : null;
      set({ tabs: remaining, activeTabId: nextActive });
      persistTabs(remaining, nextActive);
    },

    closeAllTabs: () => {
      const remaining = get().tabs.filter((t) => t.isDirty);
      const nextActive = remaining.length > 0 ? remaining[0]!.id : null;
      set({ tabs: remaining, activeTabId: nextActive });
      persistTabs(remaining, nextActive);
    },

    setActiveTabId: (id) => {
      set({ activeTabId: id });
      persistTabs(get().tabs, id);
    },

    pinTab: (id) => {
      set((state) => {
        const nextTabs = state.tabs.map((t) =>
          t.id === id ? { ...t, isPinned: true, isPreview: false } : t
        );
        persistTabs(nextTabs, state.activeTabId);
        return { tabs: nextTabs };
      });
    },

    reorderTabs: (sourceIndex, destinationIndex) => {
      set((state) => {
        const nextTabs = [...state.tabs];
        const [moved] = nextTabs.splice(sourceIndex, 1);
        if (moved) {
          nextTabs.splice(destinationIndex, 0, moved);
        }
        persistTabs(nextTabs, state.activeTabId);
        return { tabs: nextTabs };
      });
    },

    setSplitLayout: (layout) => {
      set({ splitLayout: layout });
    },

    setSecondaryActiveTabId: (id) => {
      set({ secondaryActiveTabId: id });
    },
  };
});
