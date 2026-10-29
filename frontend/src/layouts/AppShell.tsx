import React, { useEffect } from 'react';
import { Panel, PanelGroup } from 'react-resizable-panels';
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
import { AboutDialog } from '../components/AboutDialog/AboutDialog';
import { OnboardingTour } from '../components/Onboarding/OnboardingTour';
import { MissionControl } from '../panels/mission/MissionControl';
import { QuickOpen } from '../panels/explorer/QuickOpen';
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
    zenMode,
    toggleZenMode,
    maximizedPanel,
    applyLayoutPreset,
    aboutOpen,
    setAboutOpen,
    tourOpen,
    setTourOpen,
    quickOpen,
    setQuickOpen,
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
      title: 'Switch between Editor & Mission Control',
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

    const unregisterZen = registerCommand({
      id: 'view.toggleZenMode',
      title: 'Toggle Zen Mode',
      category: 'View',
      action: toggleZenMode,
    });

    const unregisterPresetFocus = registerCommand({
      id: 'view.presetFocus',
      title: 'Apply Layout Preset: Focus',
      category: 'View',
      action: () => applyLayoutPreset('focus'),
    });

    const unregisterPresetAgent = registerCommand({
      id: 'view.presetAgent',
      title: 'Apply Layout Preset: Agent-First',
      category: 'View',
      action: () => applyLayoutPreset('agent-first'),
    });

    const unregisterPresetDefault = registerCommand({
      id: 'view.presetDefault',
      title: 'Apply Layout Preset: Default',
      category: 'View',
      action: () => applyLayoutPreset('default'),
    });

    const unregisterAbout = registerCommand({
      id: 'help.about',
      title: 'About Ajson Studio',
      category: 'Help',
      action: () => setAboutOpen(true),
    });

    const unregisterTour = registerCommand({
      id: 'help.onboardingTour',
      title: 'Start Onboarding Tour',
      category: 'Help',
      action: () => setTourOpen(true),
    });

    const unregisterQuickOpen = registerCommand({
      id: 'workbench.action.quickOpen',
      title: 'Go to File (Quick Open)',
      category: 'File',
      shortcut: 'Ctrl+P',
      action: () => setQuickOpen(true),
    });

    return () => {
      unregisterSidebar();
      unregisterBottom();
      unregisterRight();
      unregisterView();
      unregisterTheme();
      unregisterReset();
      unregisterZen();
      unregisterPresetFocus();
      unregisterPresetAgent();
      unregisterPresetDefault();
      unregisterAbout();
      unregisterTour();
      unregisterQuickOpen();
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
    toggleZenMode,
    applyLayoutPreset,
    setAboutOpen,
    setTourOpen,
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
      {!zenMode && <TitleBar />}

      <div className={styles.workspaceArea}>
        {!zenMode && <ActivityBar />}

        {activeView === 'manager' ? (
          <div className={styles.managerView}>
            <MissionControl />
          </div>
        ) : maximizedPanel === 'editor' ? (
          <div style={{ flex: 1, height: '100%' }}>
            <EditorArea />
          </div>
        ) : maximizedPanel === 'bottom' ? (
          <div style={{ flex: 1, height: '100%' }}>
            <BottomPanel />
          </div>
        ) : maximizedPanel === 'sidebar' ? (
          <div style={{ flex: 1, height: '100%' }}>
            <SideBar />
          </div>
        ) : maximizedPanel === 'right' ? (
          <div style={{ flex: 1, height: '100%' }}>
            <RightPanel />
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

      {!zenMode && <StatusBar />}
      <CommandPalette />
      <QuickOpen isOpen={quickOpen} onClose={() => setQuickOpen(false)} />
      <ToastContainer />
      <AboutDialog isOpen={aboutOpen} onClose={() => setAboutOpen(false)} />
      <OnboardingTour isOpen={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  );
};
