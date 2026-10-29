import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  RefreshCw,
  AlertCircle,
  Bell,
  Sparkles,
  Database,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Info,
  Trash2,
} from 'lucide-react';
import { useLayoutStore } from '../state/layoutStore';
import { useNotificationStore } from '../state/notificationStore';
import { useEditorStore } from '../state/editorStore';
import { gitService, diagnosticsService } from '../services';
import styles from './StatusBar.module.css';

export const StatusBar: React.FC = () => {
  const { toggleRightPanel, setActiveBottomTab } = useLayoutStore();
  const { notifications, clearAll } = useNotificationStore();
  const { tabs, activeTabId } = useEditorStore();

  const [branch, setBranch] = useState('development');
  const [problemCount, setProblemCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  useEffect(() => {
    gitService.currentBranch().then(setBranch).catch(() => {});
    const unbindGit = gitService.onDidChange(() => {
      gitService.currentBranch().then(setBranch).catch(() => {});
    });

    const updateDiag = () => setProblemCount(diagnosticsService.list().length);
    updateDiag();
    const unbindDiag = diagnosticsService.onDidChange(updateDiag);

    return () => {
      unbindGit();
      unbindDiag();
    };
  }, []);

  return (
    <footer className={styles.statusBar} role="contentinfo" aria-label="Status Bar">
      <div className={styles.left}>
        <button className={styles.item} title={`Current Git Branch: ${branch}`}>
          <GitBranch size={12} />
          <span>{branch}</span>
        </button>

        <button className={styles.item} title="Synchronize Changes" onClick={() => void gitService.status()}>
          <RefreshCw size={11} />
        </button>

        <button
          className={styles.item}
          onClick={() => setActiveBottomTab('problems')}
          title={`Problems (${problemCount})`}
        >
          <AlertCircle size={12} color={problemCount > 0 ? 'var(--color-warning)' : undefined} />
          <span>{problemCount}</span>
        </button>

        <button className={styles.item} onClick={toggleRightPanel} title="AI Engine Ready">
          <div className={styles.aiPill}>
            <Sparkles size={12} />
            <span>AI Ready</span>
          </div>
        </button>

        <button className={styles.item} title="Codebase Index Status: 100% Complete">
          <Database size={11} />
          <span>Indexed: 100%</span>
        </button>
      </div>

      <div className={styles.right}>
        {activeTab && (
          <button className={styles.item} title="Cursor Position">
            <span>
              Ln {activeTab.cursorLine || 1}, Col {activeTab.cursorColumn || 1}
            </span>
          </button>
        )}

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
          <span>{activeTab ? activeTab.language : 'TypeScript React'}</span>
        </button>

        <button className={styles.item} title="Active AI Model: Claude 3.5 Sonnet">
          <Radio size={11} color="var(--accent)" />
          <span>Claude 3.5 Sonnet</span>
        </button>

        <div style={{ position: 'relative' }}>
          <button
            className={styles.item}
            onClick={() => setShowNotifications(!showNotifications)}
            title={`Notification Center (${notifications.length})`}
          >
            <Bell size={12} />
            {notifications.length > 0 && (
              <span className={styles.unreadDot} />
            )}
          </button>

          {showNotifications && (
            <div className={styles.notificationCenter}>
              <div className={styles.centerHeader}>
                <span>Notifications ({notifications.length})</span>
                <button
                  className={styles.clearBtn}
                  onClick={() => {
                    clearAll();
                    setShowNotifications(false);
                  }}
                  title="Clear All"
                >
                  <Trash2 size={12} />
                  <span>Clear All</span>
                </button>
              </div>

              <div className={styles.notificationList}>
                {notifications.map((n) => (
                  <div key={n.id} className={styles.notificationItem}>
                    <div className={styles.itemIcon}>
                      {n.type === 'success' && <CheckCircle2 size={13} color="var(--color-success)" />}
                      {n.type === 'warning' && <AlertTriangle size={13} color="var(--color-warning)" />}
                      {n.type === 'error' && <AlertCircle size={13} color="var(--color-danger)" />}
                      {n.type === 'info' && <Info size={13} color="var(--color-info)" />}
                    </div>
                    <div className={styles.itemText}>
                      <span className={styles.itemTitle}>{n.title}</span>
                      <span className={styles.itemMessage}>{n.message}</span>
                    </div>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <div className={styles.emptyNotice}>No recent notifications</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
};
