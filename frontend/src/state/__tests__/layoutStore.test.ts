import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutStore } from '../layoutStore';

describe('layoutStore', () => {
  beforeEach(() => {
    useLayoutStore.getState().resetPanelSizes();
    useLayoutStore.getState().setActiveView('editor');
    useLayoutStore.getState().setTheme('dark');
  });

  it('initializes with default layout settings', () => {
    const state = useLayoutStore.getState();
    expect(state.activeView).toBe('editor');
    expect(state.sidebarOpen).toBe(true);
    expect(state.theme).toBe('dark');
    expect(state.bottomPanelOpen).toBe(true);
  });

  it('toggles sidebar visibility', () => {
    const store = useLayoutStore.getState();
    expect(store.sidebarOpen).toBe(true);
    store.toggleSidebar();
    expect(useLayoutStore.getState().sidebarOpen).toBe(false);
    store.toggleSidebar();
    expect(useLayoutStore.getState().sidebarOpen).toBe(true);
  });

  it('switches between editor and manager view', () => {
    const store = useLayoutStore.getState();
    expect(store.activeView).toBe('editor');
    store.toggleView();
    expect(useLayoutStore.getState().activeView).toBe('manager');
    store.toggleView();
    expect(useLayoutStore.getState().activeView).toBe('editor');
  });

  it('updates theme and sets html data-theme attribute', () => {
    const store = useLayoutStore.getState();
    store.setTheme('light');
    expect(useLayoutStore.getState().theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    store.setTheme('high-contrast');
    expect(useLayoutStore.getState().theme).toBe('high-contrast');
    expect(document.documentElement.getAttribute('data-theme')).toBe('high-contrast');
  });

  it('toggles active sidebar tab or closes when re-clicking same tab', () => {
    const store = useLayoutStore.getState();
    store.setActiveSidebarTab('search');
    expect(useLayoutStore.getState().activeSidebarTab).toBe('search');
    expect(useLayoutStore.getState().sidebarOpen).toBe(true);

    // Clicking same tab collapses sidebar
    store.setActiveSidebarTab('search');
    expect(useLayoutStore.getState().sidebarOpen).toBe(false);
  });
});
