import React, { useEffect } from 'react';
import { Panel, PanelGroup } from 'react-resizable-panels';
import { Bot, ArrowLeft } from 'lucide-react';
import { useLayoutStore } from '../state/layoutStore';
import { useCommandStore } from '../state/commandStore';
import { TitleBar } from './TitleBar';
import { ActivityBar } from './ActivityBar';
import { SideBar } from './SideBar';
import { EditorArea } from './EditorArea';
import { BottomPanel } from './BottomPanel';
import { RightPanel } from './RightPanel';
import { StatusBar } from './StatusBar';
import { Splitter } from '../components/Splitter/Splitter';
import { CommandPalette } from '../components/CommandPalette/CommandPalette';
import { ToastContainer } from '../components/Toast/Toast';
import { Button } from '../components/Button/Button';
import { EmptyState } from '../components/EmptyState/EmptyState';
import styles from './AppShell.module.css';

export const AppShell: React.FC = () => {
  const {
    activeView,
    setActiveView,
    sidebarOpen,
    sidebarSize,
    setSidebarSize,
    bottomPanelOpen,
    bottomPanelSize,
    setBottomPanelSize,
    rightPanelOpen,
    rightPanelSize,
    setRightPanelSize,
    toggleSidebar,
    toggleBottomPanel,
    toggleRightPanel,
    resetPanelSizes,
    theme,
    setTheme,
  } = useLayoutStore();

  const { registerCommand } = useCommandStore();

  // Register Core System Commands
  useEffect(() => {
    const unregisterSidebar = registerCommand({
      id: 'view.toggleSidebar',
      title: 'Toggle Primary Side Bar',
      category: 'View',
      shortcut: 'Ctrl+B',
      action: toggleSidebar,
    });

    const unregisterBottom = registerCommand({
      id: 'view.toggleBottomPanel',
      title: 'Toggle Bottom Panel',
      category: 'View',
      shortcut: 'Ctrl+J',
      action: toggleBottomPanel,
    });

    const unregisterRight = registerCommand({
      id: 'view.toggleRightPanel',
      title: 'Toggle AI Assistant Panel',
      category: 'View',
      shortcut: 'Ctrl+Alt+B',
      action: toggleRightPanel,
    });

    const unregisterView = registerCommand({
      id: 'view.switchView',
      title: 'Switch between Editor & Manager View',
      category: 'View',
      shortcut: 'Ctrl+Shift+M',
      action: () => setActiveView(activeView === 'editor' ? 'manager' : 'editor'),
    });

    const unregisterTheme = registerCommand({
      id: 'preferences.toggleTheme',
      title: 'Toggle Color Theme (Dark/Light)',
      category: 'Preferences',
      action: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    });

    const unregisterReset = registerCommand({
      id: 'view.resetPanelSizes',
      title: 'Reset Panel Sizes to Defaults',
      category: 'View',
      action: resetPanelSizes,
    });

    return () => {
      unregisterSidebar();
      unregisterBottom();
      unregisterRight();
      unregisterView();
      unregisterTheme();
      unregisterReset();
    };
  }, [
    registerCommand,
    toggleSidebar,
    toggleBottomPanel,
    toggleRightPanel,
    activeView,
    setActiveView,
    theme,
    setTheme,
    resetPanelSizes,
  ]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        toggleSidebar();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        toggleBottomPanel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar, toggleBottomPanel]);

  return (
    <div className={styles.shell}>
      <TitleBar />

      <div className={styles.workspaceArea}>
        <ActivityBar />

        {activeView === 'manager' ? (
          <div className={styles.managerView}>
            <EmptyState
              icon={<Bot size={36} color="var(--accent)" />}
              title="Mission Control — Agents Dashboard"
              description="Coordinate multiple parallel autonomous agents, review generated artifacts (plans, diffs, test runs, screenshots), and manage approval inboxes. Scheduled for Phase 6."
              action={
                <Button
                  variant="primary"
                  leftIcon={<ArrowLeft size={14} />}
                  onClick={() => setActiveView('editor')}
                >
                  Return to Code Editor
                </Button>
              }
            />
          </div>
        ) : (
          <PanelGroup
            direction="horizontal"
            className={styles.panelGroup}
            autoSaveId="ajson-horizontal-layout"
          >
            {sidebarOpen && (
              <>
                <Panel
                  id="sidebar-panel"
                  defaultSize={sidebarSize}
                  minSize={12}
                  maxSize={40}
                  onResize={setSidebarSize}
                  order={1}
                >
                  <SideBar />
                </Panel>
                <Splitter id="split-sidebar" onDoubleClick={resetPanelSizes} />
              </>
            )}

            {/* Center Area: Editor + Bottom Panel */}
            <Panel id="center-panel" order={2} minSize={30}>
              <PanelGroup
                direction="vertical"
                className={styles.panelGroup}
                autoSaveId="ajson-vertical-layout"
              >
                <Panel id="editor-panel" order={1} minSize={20}>
                  <EditorArea />
                </Panel>

                {bottomPanelOpen && (
                  <>
                    <Splitter id="split-bottom" onDoubleClick={resetPanelSizes} />
                    <Panel
                      id="bottom-panel"
                      defaultSize={bottomPanelSize}
                      minSize={15}
                      maxSize={65}
                      onResize={setBottomPanelSize}
                      order={2}
                    >
                      <BottomPanel />
                    </Panel>
                  </>
                )}
              </PanelGroup>
            </Panel>

            {rightPanelOpen && (
              <>
                <Splitter id="split-right" onDoubleClick={resetPanelSizes} />
                <Panel
                  id="right-panel"
                  defaultSize={rightPanelSize}
                  minSize={15}
                  maxSize={45}
                  onResize={setRightPanelSize}
                  order={3}
                >
                  <RightPanel />
                </Panel>
              </>
            )}
          </PanelGroup>
        )}
      </div>

      <StatusBar />
      <CommandPalette />
      <ToastContainer />
    </div>
  );
};
