import React from 'react';
import { Search, Sun, Moon, Sparkles } from 'lucide-react';
import { useLayoutStore } from '../state/layoutStore';
import { useCommandStore } from '../state/commandStore';
import { Dropdown, DropdownItem } from '../components/Dropdown/Dropdown';
import { Kbd } from '../components/Kbd/Kbd';
import { IconButton } from '../components/IconButton/IconButton';
import { ViewSwitcher } from './ViewSwitcher';
import styles from './TitleBar.module.css';

export const TitleBar: React.FC = () => {
  const { theme, setTheme, toggleSidebar, toggleRightPanel, toggleBottomPanel } =
    useLayoutStore();
  const { openPalette } = useCommandStore();

  const fileMenu: DropdownItem[] = [
    { id: 'new-file', label: 'New File', shortcut: 'Ctrl+N' },
    { id: 'new-window', label: 'New Window', shortcut: 'Ctrl+Shift+N' },
    { id: 'd1', label: '', isDivider: true },
    { id: 'open-file', label: 'Open File...', shortcut: 'Ctrl+O' },
    { id: 'open-folder', label: 'Open Folder...' },
    { id: 'd2', label: '', isDivider: true },
    { id: 'save', label: 'Save', shortcut: 'Ctrl+S' },
    { id: 'save-as', label: 'Save As...', shortcut: 'Ctrl+Shift+S' },
  ];

  const viewMenu: DropdownItem[] = [
    {
      id: 'cmd-palette',
      label: 'Command Palette...',
      shortcut: 'Ctrl+Shift+P / F1',
      onClick: openPalette,
    },
    { id: 'd1', label: '', isDivider: true },
    { id: 'toggle-sidebar', label: 'Toggle Primary Side Bar', onClick: toggleSidebar },
    { id: 'toggle-ai-panel', label: 'Toggle AI Side Panel', onClick: toggleRightPanel },
    { id: 'toggle-bottom-panel', label: 'Toggle Panel', onClick: toggleBottomPanel },
  ];

  const agentMenu: DropdownItem[] = [
    { id: 'new-mission', label: 'New Agent Mission...', shortcut: 'Ctrl+Shift+A' },
    { id: 'open-artifacts', label: 'Browse Artifacts' },
    { id: 'approval-inbox', label: 'Pending Approvals' },
  ];

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className={styles.titleBar}>
      <div className={styles.left}>
        {/* Original Ajson Studio Geometric Isometric Logo */}
        <div className={styles.logo}>
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
            <path
              d="M16 4 L28 11 L28 21 L16 28 L4 21 L4 11 Z"
              stroke="var(--accent)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path
              d="M16 4 L16 28 M4 11 L16 16 L28 11"
              stroke="var(--accent)"
              strokeWidth="1.5"
              strokeOpacity="0.7"
            />
            <circle cx="16" cy="16" r="2.5" fill="var(--accent)" />
          </svg>
          <span>Ajson Studio</span>
        </div>

        {/* Menu Bar */}
        <nav className={styles.menuBar} aria-label="Application Menu">
          <Dropdown
            trigger={<button className={styles.menuItem}>File</button>}
            items={fileMenu}
          />
          <Dropdown
            trigger={<button className={styles.menuItem}>Edit</button>}
            items={[{ id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z' }]}
          />
          <Dropdown
            trigger={<button className={styles.menuItem}>View</button>}
            items={viewMenu}
          />
          <Dropdown
            trigger={<button className={styles.menuItem}>Agent</button>}
            items={agentMenu}
          />
        </nav>
      </div>

      {/* Quick Search / Command Palette Bar */}
      <div className={styles.center}>
        <button
          className={styles.searchTrigger}
          onClick={openPalette}
          aria-label="Open Command Palette"
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Search size={13} />
            <span>Search files, commands, or agents...</span>
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <Kbd>F1</Kbd>
          </div>
        </button>
      </div>

      <div className={styles.right}>
        <ViewSwitcher />

        <IconButton
          label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} theme`}
          size="sm"
          onClick={handleThemeToggle}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </IconButton>

        <IconButton
          label="AI Copilot Status: Ready"
          size="sm"
          style={{ color: 'var(--accent)' }}
        >
          <Sparkles size={15} />
        </IconButton>

        <div className={styles.windowControls} aria-hidden="true">
          <div className={`${styles.windowDot} ${styles.dotMin}`} />
          <div className={`${styles.windowDot} ${styles.dotMax}`} />
          <div className={`${styles.windowDot} ${styles.dotClose}`} />
        </div>
      </div>
    </header>
  );
};
