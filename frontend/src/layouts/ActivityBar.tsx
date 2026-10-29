import React from 'react';
import {
  Files,
  Search,
  GitBranch,
  Play,
  CheckSquare,
  Blocks,
  FileJson,
  Bot,
  Settings,
} from 'lucide-react';
import { useLayoutStore, SidebarTab } from '../state/layoutStore';
import { Tooltip } from '../components/Tooltip/Tooltip';
import styles from './ActivityBar.module.css';

interface NavItem {
  id: SidebarTab;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  shortcut?: string;
}

export const ActivityBar: React.FC = () => {
  const { sidebarOpen, activeSidebarTab, setActiveSidebarTab } = useLayoutStore();

  const topItems: NavItem[] = [
    { id: 'explorer', label: 'Explorer', icon: <Files size={18} />, shortcut: 'Ctrl+Shift+E' },
    { id: 'search', label: 'Search', icon: <Search size={18} />, shortcut: 'Ctrl+Shift+F' },
    { id: 'git', label: 'Source Control', icon: <GitBranch size={18} />, badge: 2, shortcut: 'Ctrl+Shift+G' },
    { id: 'json', label: 'JSON Tools & Suite', icon: <FileJson size={18} />, shortcut: 'Ctrl+Shift+J' },
    { id: 'debug', label: 'Run & Debug', icon: <Play size={18} />, shortcut: 'Ctrl+Shift+D' },
    { id: 'tests', label: 'Test Explorer', icon: <CheckSquare size={18} />, shortcut: 'Ctrl+Shift+T' },
    { id: 'extensions', label: 'Extensions & MCP', icon: <Blocks size={18} />, shortcut: 'Ctrl+Shift+X' },
  ];

  return (
    <aside className={styles.activityBar} aria-label="Activity Bar">
      <div className={styles.topGroup}>
        {topItems.map((item) => {
          const isActive = sidebarOpen && activeSidebarTab === item.id;
          return (
            <Tooltip
              key={item.id}
              content={
                <span>
                  {item.label} {item.shortcut && <span style={{ opacity: 0.6 }}>({item.shortcut})</span>}
                </span>
              }
              position="right"
            >
              <button
                className={`${styles.actionItem} ${isActive ? styles.active : ''}`}
                onClick={() => setActiveSidebarTab(item.id)}
                aria-label={item.label}
                aria-pressed={isActive}
              >
                {isActive && <div className={styles.activeIndicator} />}
                {item.icon}
                {item.badge !== undefined && (
                  <span className={styles.badge}>{item.badge}</span>
                )}
              </button>
            </Tooltip>
          );
        })}
      </div>

      <div className={styles.bottomGroup}>
        <Tooltip content="Agents & Missions" position="right">
          <button
            className={`${styles.actionItem} ${
              sidebarOpen && activeSidebarTab === 'explorer' ? '' : ''
            }`}
            onClick={() => useLayoutStore.getState().setActiveView('manager')}
            aria-label="Mission Control"
          >
            <Bot size={18} color="var(--accent)" />
          </button>
        </Tooltip>

        <Tooltip content="Settings (Ctrl+,)" position="right">
          <button
            className={`${styles.actionItem} ${
              sidebarOpen && activeSidebarTab === 'settings' ? styles.active : ''
            }`}
            onClick={() => setActiveSidebarTab('settings')}
            aria-label="Settings"
          >
            {sidebarOpen && activeSidebarTab === 'settings' && (
              <div className={styles.activeIndicator} />
            )}
            <Settings size={18} />
          </button>
        </Tooltip>
      </div>
    </aside>
  );
};
