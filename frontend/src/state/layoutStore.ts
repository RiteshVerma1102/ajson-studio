import { create } from 'zustand';
import { safeStorage } from './storage';

export type SidebarTab =
  | 'explorer'
  | 'search'
  | 'git'
  | 'debug'
  | 'tests'
  | 'extensions'
  | 'settings';

export type BottomTab = 'terminal' | 'output' | 'problems';

export type AppView = 'editor' | 'manager';

export type ThemeMode = 'dark' | 'light' | 'high-contrast';

export interface LayoutState {
  activeView: AppView;
  theme: ThemeMode;

  sidebarOpen: boolean;
  sidebarSize: number;
  activeSidebarTab: SidebarTab;

  rightPanelOpen: boolean;
  rightPanelSize: number;

  bottomPanelOpen: boolean;
  bottomPanelSize: number;
  activeBottomTab: BottomTab;

  // Actions
  setActiveView: (view: AppView) => void;
  toggleView: () => void;
  setTheme: (theme: ThemeMode) => void;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarSize: (size: number) => void;
  setActiveSidebarTab: (tab: SidebarTab) => void;

  toggleRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;
  setRightPanelSize: (size: number) => void;

  toggleBottomPanel: () => void;
  setBottomPanelOpen: (open: boolean) => void;
  setBottomPanelSize: (size: number) => void;
  setActiveBottomTab: (tab: BottomTab) => void;

  resetPanelSizes: () => void;
}

const STORAGE_KEY = 'ajson_layout_state_v1';
const THEME_STORAGE_KEY = 'ajson_theme_v1';

const DEFAULT_SIZES = {
  sidebar: 20,
  rightPanel: 25,
  bottomPanel: 28,
};

function loadInitialState() {
  const savedTheme = (safeStorage.getItem(THEME_STORAGE_KEY) as ThemeMode) || 'dark';

  try {
    const raw = safeStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        activeView: (parsed.activeView as AppView) || 'editor',
        theme: savedTheme,
        sidebarOpen: parsed.sidebarOpen ?? true,
        sidebarSize: parsed.sidebarSize ?? DEFAULT_SIZES.sidebar,
        activeSidebarTab: (parsed.activeSidebarTab as SidebarTab) || 'explorer',
        rightPanelOpen: parsed.rightPanelOpen ?? true,
        rightPanelSize: parsed.rightPanelSize ?? DEFAULT_SIZES.rightPanel,
        bottomPanelOpen: parsed.bottomPanelOpen ?? true,
        bottomPanelSize: parsed.bottomPanelSize ?? DEFAULT_SIZES.bottomPanel,
        activeBottomTab: (parsed.activeBottomTab as BottomTab) || 'terminal',
      };
    }
  } catch {
    // Corrupted state fallback
  }

  return {
    activeView: 'editor' as AppView,
    theme: savedTheme,
    sidebarOpen: true,
    sidebarSize: DEFAULT_SIZES.sidebar,
    activeSidebarTab: 'explorer' as SidebarTab,
    rightPanelOpen: true,
    rightPanelSize: DEFAULT_SIZES.rightPanel,
    bottomPanelOpen: true,
    bottomPanelSize: DEFAULT_SIZES.bottomPanel,
    activeBottomTab: 'terminal' as BottomTab,
  };
}

function persistState(state: Partial<LayoutState>) {
  try {
    const payload = {
      activeView: state.activeView,
      sidebarOpen: state.sidebarOpen,
      sidebarSize: state.sidebarSize,
      activeSidebarTab: state.activeSidebarTab,
      rightPanelOpen: state.rightPanelOpen,
      rightPanelSize: state.rightPanelSize,
      bottomPanelOpen: state.bottomPanelOpen,
      bottomPanelSize: state.bottomPanelSize,
      activeBottomTab: state.activeBottomTab,
    };
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage write failure
  }
}

export const useLayoutStore = create<LayoutState>((set, get) => {
  const initial = loadInitialState();

  return {
    ...initial,

    setActiveView: (view) => {
      set({ activeView: view });
      persistState(get());
    },

    toggleView: () => {
      const next = get().activeView === 'editor' ? 'manager' : 'editor';
      set({ activeView: next });
      persistState(get());
    },

    setTheme: (theme) => {
      set({ theme });
      safeStorage.setItem(THEME_STORAGE_KEY, theme);
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme);
      }
    },

    toggleSidebar: () => {
      set((s) => ({ sidebarOpen: !s.sidebarOpen }));
      persistState(get());
    },

    setSidebarOpen: (open) => {
      set({ sidebarOpen: open });
      persistState(get());
    },

    setSidebarSize: (size) => {
      set({ sidebarSize: size });
      persistState(get());
    },

    setActiveSidebarTab: (tab) => {
      set((s) => {
        // Clicking active tab toggles sidebar open/closed
        if (s.activeSidebarTab === tab && s.sidebarOpen) {
          return { sidebarOpen: false };
        }
        return { activeSidebarTab: tab, sidebarOpen: true };
      });
      persistState(get());
    },

    toggleRightPanel: () => {
      set((s) => ({ rightPanelOpen: !s.rightPanelOpen }));
      persistState(get());
    },

    setRightPanelOpen: (open) => {
      set({ rightPanelOpen: open });
      persistState(get());
    },

    setRightPanelSize: (size) => {
      set({ rightPanelSize: size });
      persistState(get());
    },

    toggleBottomPanel: () => {
      set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen }));
      persistState(get());
    },

    setBottomPanelOpen: (open) => {
      set({ bottomPanelOpen: open });
      persistState(get());
    },

    setBottomPanelSize: (size) => {
      set({ bottomPanelSize: size });
      persistState(get());
    },

    setActiveBottomTab: (tab) => {
      set({ activeBottomTab: tab, bottomPanelOpen: true });
      persistState(get());
    },

    resetPanelSizes: () => {
      set({
        sidebarSize: DEFAULT_SIZES.sidebar,
        rightPanelSize: DEFAULT_SIZES.rightPanel,
        bottomPanelSize: DEFAULT_SIZES.bottomPanel,
      });
      persistState(get());
    },
  };
});
