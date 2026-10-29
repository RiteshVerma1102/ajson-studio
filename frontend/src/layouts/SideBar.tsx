import React from 'react';
import {
  ChevronLeft,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useLayoutStore, SidebarTab } from '../state/layoutStore';
import { IconButton } from '../components/IconButton/IconButton';
import { PanelErrorBoundary } from '../components/ErrorBoundary/PanelErrorBoundary';
import { FileTree } from '../panels/explorer/FileTree';
import { SearchPanel } from '../panels/search/SearchPanel';
import { GitPanel } from '../panels/git/GitPanel';
import { SettingsPanel } from '../panels/settings/SettingsPanel';
import { DebugPanel } from '../panels/debug/DebugPanel';
import { TestExplorerPanel } from '../panels/tests/TestExplorerPanel';
import { ExtensionsPanel } from '../panels/extensions/ExtensionsPanel';
import { JsonToolsPanel } from '../panels/json/JsonToolsPanel';
import styles from './SideBar.module.css';

const TAB_TITLES: Record<SidebarTab, string> = {
  explorer: 'Explorer',
  search: 'Search',
  git: 'Source Control',
  debug: 'Run & Debug',
  tests: 'Test Explorer',
  extensions: 'Extensions & MCP',
  json: 'JSON Tools & Suite',
  settings: 'Settings',
};

export const SideBar: React.FC = () => {
  const {
    activeSidebarTab,
    toggleSidebar,
    maximizedPanel,
    toggleMaximizePanel,
  } = useLayoutStore();

  const isMaximized = maximizedPanel === 'sidebar';

  return (
    <PanelErrorBoundary name={`SideBar (${TAB_TITLES[activeSidebarTab]})`}>
      <div className={styles.sideBar}>
        <div className={styles.header}>
          <span className={styles.title}>{TAB_TITLES[activeSidebarTab]}</span>
          <div className={styles.actions}>
            <IconButton
              label={isMaximized ? 'Restore Side Bar' : 'Maximize Side Bar'}
              size="sm"
              onClick={() => toggleMaximizePanel('sidebar')}
            >
              {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </IconButton>
            <IconButton label="Collapse Side Bar" size="sm" onClick={toggleSidebar}>
              <ChevronLeft size={14} />
            </IconButton>
          </div>
        </div>

        <div className={styles.content}>
          {activeSidebarTab === 'explorer' && <FileTree />}
          {activeSidebarTab === 'search' && <SearchPanel />}
          {activeSidebarTab === 'git' && <GitPanel />}
          {activeSidebarTab === 'debug' && <DebugPanel />}
          {activeSidebarTab === 'tests' && <TestExplorerPanel />}
          {activeSidebarTab === 'extensions' && <ExtensionsPanel />}
          {activeSidebarTab === 'json' && <JsonToolsPanel />}
          {activeSidebarTab === 'settings' && <SettingsPanel />}
        </div>
      </div>
    </PanelErrorBoundary>
  );
};
