import React, { useState, useEffect, useCallback } from 'react';
import {
  GitBranch,
  Check,
  Plus,
  Minus,
  Undo2,
  FileCode,
  RefreshCw,
} from 'lucide-react';
import { gitService, GitFileStatus } from '../../services';
import { useEditorStore } from '../../state/editorStore';
import { IconButton } from '../../components/IconButton/IconButton';
import { Button } from '../../components/Button/Button';
import styles from './GitPanel.module.css';

export const GitPanel: React.FC = () => {
  const [statuses, setStatuses] = useState<GitFileStatus[]>([]);
  const [currentBranch, setCurrentBranch] = useState('development');
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);

  const { openDiff } = useEditorStore();

  const loadGitStatus = useCallback(async () => {
    try {
      const s = await gitService.status();
      setStatuses(s);
      const b = await gitService.currentBranch();
      setCurrentBranch(b);
    } catch (err) {
      console.error('Failed to load git status', err);
    }
  }, []);

  useEffect(() => {
    void loadGitStatus();
    const unbind = gitService.onDidChange(() => {
      void loadGitStatus();
    });
    return () => unbind();
  }, [loadGitStatus]);

  const stagedFiles = statuses.filter((s) => s.index !== '-');
  const workingFiles = statuses.filter((s) => s.workTree !== '-');

  const handleStageAll = async () => {
    const paths = workingFiles.map((s) => s.path);
    await gitService.stage(paths);
  };

  const handleUnstageAll = async () => {
    const paths = stagedFiles.map((s) => s.path);
    await gitService.unstage(paths);
  };

  const handleCommit = async () => {
    if (!commitMessage.trim() || isCommitting) return;
    setIsCommitting(true);
    try {
      await gitService.commit(commitMessage.trim());
      setCommitMessage('');
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleDiffClick = async (filePath: string, staged: boolean) => {
    const diff = await gitService.diff(filePath, { staged });
    openDiff(filePath, diff.original, diff.modified, staged);
  };

  return (
    <div className={styles.container}>
      {/* Branch & Actions Header */}
      <div className={styles.header}>
        <div className={styles.branchBadge}>
          <GitBranch size={13} color="var(--accent)" />
          <span>{currentBranch}</span>
        </div>
        <IconButton label="Refresh Git Status" size="sm" onClick={loadGitStatus}>
          <RefreshCw size={13} />
        </IconButton>
      </div>

      {/* Commit Input Box */}
      <div className={styles.commitBox}>
        <textarea
          className={styles.commitInput}
          placeholder="Commit message (Ctrl+Enter to commit)..."
          rows={3}
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              void handleCommit();
            }
          }}
        />
        <Button
          variant="primary"
          size="sm"
          disabled={!commitMessage.trim() || stagedFiles.length === 0 || isCommitting}
          leftIcon={<Check size={13} />}
          onClick={() => void handleCommit()}
        >
          {isCommitting ? 'Committing...' : `Commit to ${currentBranch}`}
        </Button>
      </div>

      {/* Staged Changes Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <span>Staged Changes</span>
            <span className={styles.badge}>{stagedFiles.length}</span>
          </div>
          {stagedFiles.length > 0 && (
            <IconButton label="Unstage All" size="sm" onClick={handleUnstageAll}>
              <Minus size={13} />
            </IconButton>
          )}
        </div>

        <div className={styles.fileList}>
          {stagedFiles.map((f) => (
            <div
              key={f.path}
              className={styles.fileRow}
              onClick={() => void handleDiffClick(f.path, true)}
            >
              <FileCode size={14} color="var(--color-success)" />
              <span className={styles.filePath}>{f.path}</span>
              <span className={`${styles.statusPill} ${styles.statusStaged}`}>
                {f.index}
              </span>
              <IconButton
                label="Unstage"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  void gitService.unstage([f.path]);
                }}
              >
                <Minus size={12} />
              </IconButton>
            </div>
          ))}
          {stagedFiles.length === 0 && (
            <div className={styles.emptyNotice}>No staged changes</div>
          )}
        </div>
      </div>

      {/* Working Tree Changes Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <span>Changes</span>
            <span className={styles.badge}>{workingFiles.length}</span>
          </div>
          {workingFiles.length > 0 && (
            <IconButton label="Stage All Changes" size="sm" onClick={handleStageAll}>
              <Plus size={13} />
            </IconButton>
          )}
        </div>

        <div className={styles.fileList}>
          {workingFiles.map((f) => (
            <div
              key={f.path}
              className={styles.fileRow}
              onClick={() => void handleDiffClick(f.path, false)}
            >
              <FileCode size={14} color="var(--color-warning)" />
              <span className={styles.filePath}>{f.path}</span>
              <span className={`${styles.statusPill} ${styles.statusWorking}`}>
                {f.workTree}
              </span>
              <div className={styles.rowActions}>
                <IconButton
                  label="Discard Changes"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    void gitService.discard([f.path]);
                  }}
                >
                  <Undo2 size={12} />
                </IconButton>
                <IconButton
                  label="Stage File"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    void gitService.stage([f.path]);
                  }}
                >
                  <Plus size={12} />
                </IconButton>
              </div>
            </div>
          ))}
          {workingFiles.length === 0 && (
            <div className={styles.emptyNotice}>Working tree clean</div>
          )}
        </div>
      </div>
    </div>
  );
};
