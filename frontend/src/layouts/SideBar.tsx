import React from 'react';
import {
  MoreHorizontal,
  ChevronLeft,
  FolderOpen,
  Search as SearchIcon,
  GitBranch,
  Play,
  CheckSquare,
  Blocks,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useLayoutStore, SidebarTab } from '../state/layoutStore';
import { IconButton } from '../components/IconButton/IconButton';
import { EmptyState } from '../components/EmptyState/EmptyState';
import styles from './SideBar.module.css';

const TAB_TITLES: Record<SidebarTab, string> = {
  explorer: 'Explorer',
  search: 'Search',
  git: 'Source Control',
  debug: 'Run & Debug',
  tests: 'Test Explorer',
  extensions: 'Extensions',
  settings: 'Settings',
};

const TAB_ICONS: Record<SidebarTab, React.ReactNode> = {
  explorer: <FolderOpen size={24} />,
  search: <SearchIcon size={24} />,
  git: <GitBranch size={24} />,
  debug: <Play size={24} />,
  tests: <CheckSquare size={24} />,
  extensions: <Blocks size={24} />,
  settings: <SettingsIcon size={24} />,
};

export const SideBar: React.FC = () => {
  const { activeSidebarTab, toggleSidebar } = useLayoutStore();

  return (
    <div className={styles.sideBar}>
      <div className={styles.header}>
        <span className={styles.title}>{TAB_TITLES[activeSidebarTab]}</span>
        <div className={styles.actions}>
          <IconButton label="More Actions" size="sm">
            <MoreHorizontal size={14} />
          </IconButton>
          <IconButton label="Collapse Side Bar" size="sm" onClick={toggleSidebar}>
            <ChevronLeft size={14} />
          </IconButton>
        </div>
      </div>

      <div className={styles.content}>
        <EmptyState
          icon={TAB_ICONS[activeSidebarTab]}
          title={TAB_TITLES[activeSidebarTab]}
          description={
            activeSidebarTab === 'explorer'
              ? 'Virtual file system and sample project workspace initialized.'
              : `Ready to connect ${TAB_TITLES[activeSidebarTab].toLowerCase()} services.`
          }
        />
      </div>
    </div>
  );
};
