import React, { useState, useEffect, useCallback } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FilePlus,
  FolderPlus,
  RefreshCw,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { fileSystemService, workspaceService, gitService, FileEntry } from '../../services';
import { useEditorStore } from '../../state/editorStore';
import { IconButton } from '../../components/IconButton/IconButton';
import { Modal } from '../../components/Modal/Modal';
import { Button } from '../../components/Button/Button';
import styles from './FileTree.module.css';

export const FileTree: React.FC = () => {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set(['src', 'fixtures']));
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [gitStatuses, setGitStatuses] = useState<Map<string, string>>(new Map());

  // Creation / Rename / Deletion state
  const [creatingType, setCreatingType] = useState<'file' | 'folder' | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { openFile } = useEditorStore();

  const loadTree = useCallback(async () => {
    try {
      const rootEntries = await fileSystemService.readDir('');
      setEntries(rootEntries);

      // Load Git statuses
      const statuses = await gitService.status();
      const statusMap = new Map<string, string>();
      for (const s of statuses) {
        statusMap.set(s.path, s.index !== '-' ? s.index : s.workTree);
      }
      setGitStatuses(statusMap);
    } catch (err) {
      console.error('Failed to load file tree', err);
    }
  }, []);

  useEffect(() => {
    void loadTree();
    const unbindFs = fileSystemService.watch(() => {
      void loadTree();
    });
    const unbindWs = workspaceService.onDidChange(() => {
      void loadTree();
    });
    const unbindGit = gitService.onDidChange(() => {
      void loadTree();
    });
    return () => {
      unbindFs();
      unbindWs();
      unbindGit();
    };
  }, [loadTree]);

  const toggleFolder = (path: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleSelect = (entry: FileEntry) => {
    setSelectedPath(entry.path);
    if (entry.isDirectory) {
      toggleFolder(entry.path);
    } else {
      void openFile(entry.path);
    }
  };

  // Keyboard Navigation
  const handleKeyDown = (e: React.KeyboardEvent, entry: FileEntry) => {
    if (e.key === 'Enter') {
      handleSelect(entry);
    } else if (e.key === 'F2') {
      e.preventDefault();
      setRenamingPath(entry.path);
      setRenameValue(entry.name);
    } else if (e.key === 'Delete') {
      e.preventDefault();
      setDeleteTarget(entry.path);
    }
  };

  const handleCreateSubmit = async () => {
    if (!newItemName.trim()) {
      setCreatingType(null);
      return;
    }
    const targetPath = selectedPath ? `${selectedPath}/${newItemName.trim()}` : newItemName.trim();
    try {
      if (creatingType === 'file') {
        await fileSystemService.createFile(targetPath, '');
        void openFile(targetPath);
      } else {
        await fileSystemService.createDir(targetPath);
        setOpenFolders((prev) => new Set(prev).add(targetPath));
      }
    } catch (err) {
      alert((err as Error).message);
    }
    setCreatingType(null);
    setNewItemName('');
  };

  const handleRenameSubmit = async () => {
    if (!renamingPath || !renameValue.trim()) {
      setRenamingPath(null);
      return;
    }
    const parts = renamingPath.split('/');
    parts[parts.length - 1] = renameValue.trim();
    const newPath = parts.join('/');

    try {
      await fileSystemService.rename(renamingPath, newPath);
    } catch (err) {
      alert((err as Error).message);
    }
    setRenamingPath(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await fileSystemService.delete(deleteTarget);
    } catch (err) {
      alert((err as Error).message);
    }
    setDeleteTarget(null);
  };

  // Render tree recursively
  const renderEntries = (list: FileEntry[], depth: number = 0) => {
    return list.map((item) => {
      const isFolder = item.isDirectory;
      const isOpen = openFolders.has(item.path);
      const isSelected = selectedPath === item.path;
      const gitCode = gitStatuses.get(item.path);

      return (
        <React.Fragment key={item.path}>
          <div
            role="treeitem"
            tabIndex={0}
            aria-selected={isSelected}
            aria-expanded={isFolder ? isOpen : undefined}
            className={`${styles.treeNode} ${isSelected ? styles.selected : ''}`}
            style={{ paddingLeft: `${depth * 14 + 10}px` }}
            onClick={() => handleSelect(item)}
            onKeyDown={(e) => handleKeyDown(e, item)}
            onContextMenu={(e) => {
              e.preventDefault();
              setSelectedPath(item.path);
            }}
          >
            {isFolder ? (
              <span className={styles.icon}>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {isOpen ? <FolderOpen size={15} color="var(--accent)" /> : <Folder size={15} color="var(--accent)" />}
              </span>
            ) : (
              <span className={styles.icon}>
                {item.name.endsWith('.json') ? (
                  <FileText size={14} color="var(--color-warning)" />
                ) : (
                  <FileCode size={14} color="var(--color-info)" />
                )}
              </span>
            )}

            {renamingPath === item.path ? (
              <input
                className={styles.inlineInput}
                ref={(el) => el?.focus()}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') setRenamingPath(null);
                }}
              />
            ) : (
              <span className={styles.label}>{item.name}</span>
            )}

            {gitCode && (
              <span
                className={`${styles.gitBadge} ${
                  gitCode === 'M'
                    ? styles.gitM
                    : gitCode === 'A'
                    ? styles.gitA
                    : gitCode === 'D'
                    ? styles.gitD
                    : styles.gitU
                }`}
              >
                {gitCode}
              </span>
            )}
          </div>

          {isFolder && isOpen && (
            <SubTree dirPath={item.path} depth={depth + 1} renderParent={renderEntries} />
          )}
        </React.Fragment>
      );
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <IconButton label="Open Workspace Folder" size="sm" onClick={() => void workspaceService.open()}>
          <FolderOpen size={14} />
        </IconButton>
        <IconButton label="New File" size="sm" onClick={() => setCreatingType('file')}>
          <FilePlus size={14} />
        </IconButton>
        <IconButton label="New Folder" size="sm" onClick={() => setCreatingType('folder')}>
          <FolderPlus size={14} />
        </IconButton>
        <IconButton label="Refresh" size="sm" onClick={loadTree}>
          <RefreshCw size={13} />
        </IconButton>
      </div>

      {creatingType && (
        <div style={{ padding: '6px 12px', background: 'var(--bg-2)' }}>
          <input
            className={styles.inlineInput}
            ref={(el) => el?.focus()}
            placeholder={`Enter new ${creatingType} name...`}
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onBlur={handleCreateSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateSubmit();
              if (e.key === 'Escape') setCreatingType(null);
            }}
          />
        </div>
      )}

      <div className={styles.treeArea} role="tree">
        {renderEntries(entries)}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Deletion"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </>
        }
      >
        <p>
          Are you sure you want to delete <strong style={{ color: 'var(--fg-0)' }}>{deleteTarget}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

const SubTree: React.FC<{
  dirPath: string;
  depth: number;
  renderParent: (list: FileEntry[], depth: number) => React.ReactNode;
}> = ({ dirPath, depth, renderParent }) => {
  const [children, setChildren] = useState<FileEntry[]>([]);

  useEffect(() => {
    fileSystemService.readDir(dirPath).then(setChildren).catch(() => {});
  }, [dirPath]);

  return <>{renderParent(children, depth)}</>;
};
