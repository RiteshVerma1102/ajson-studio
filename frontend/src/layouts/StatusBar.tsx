import React from 'react';
import {
  GitBranch,
  RefreshCw,
  AlertCircle,
  Bell,
  Sparkles,
  Database,
  Radio,
} from 'lucide-react';
import { useLayoutStore } from '../state/layoutStore';
import { useNotificationStore } from '../state/notificationStore';
import styles from './StatusBar.module.css';

export const StatusBar: React.FC = () => {
  const { toggleRightPanel, setActiveBottomTab } = useLayoutStore();
  const { notifications, addNotification } = useNotificationStore();

  const handleProblemsClick = () => {
    setActiveBottomTab('problems');
  };

  const handleBellClick = () => {
    addNotification({
      type: 'info',
      title: 'Ajson Studio Ready',
      message: 'Phase 1 frontend foundation initialized with reactive layout stores.',
    });
  };

  return (
    <footer className={styles.statusBar} role="contentinfo" aria-label="Status Bar">
      <div className={styles.left}>
        <button className={styles.item} title="Current Git Branch">
          <GitBranch size={12} />
          <span>development</span>
        </button>

        <button className={styles.item} title="Synchronize Changes">
          <RefreshCw size={11} />
        </button>

        <button className={styles.item} onClick={handleProblemsClick} title="Problems (0)">
          <AlertCircle size={12} />
          <span>0</span>
        </button>

        <button className={styles.item} onClick={toggleRightPanel} title="AI Engine">
          <div className={styles.aiPill}>
            <Sparkles size={12} />
            <span>AI Ready</span>
          </div>
        </button>

        <button className={styles.item} title="Codebase Index Status">
          <Database size={11} />
          <span>Indexed: 100%</span>
        </button>
      </div>

      <div className={styles.right}>
        <button className={styles.item} title="Cursor Position">
          <span>Ln 1, Col 1</span>
        </button>

        <button className={styles.item} title="Indentation">
          <span>Spaces: 2</span>
        </button>

        <button className={styles.item} title="File Encoding">
          <span>UTF-8</span>
        </button>

        <button className={styles.item} title="End of Line Sequence">
          <span>LF</span>
        </button>

        <button className={styles.item} title="Language Mode">
          <span>TypeScript React</span>
        </button>

        <button className={styles.item} title="Active AI Model">
          <Radio size={11} color="var(--accent)" />
          <span>Claude 3.5 Sonnet</span>
        </button>

        <button
          className={styles.item}
          onClick={handleBellClick}
          title={`Notifications (${notifications.length})`}
        >
          <Bell size={12} />
        </button>
      </div>
    </footer>
  );
};
