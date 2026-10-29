import React, { useState, useEffect, useRef } from 'react';
import { Command } from 'cmdk';
import { Search, FileCode, FileText } from 'lucide-react';
import { fileSystemService } from '../../services';
import { useEditorStore } from '../../state/editorStore';
import { useLayoutStore } from '../../state/layoutStore';
import styles from './QuickOpen.module.css';

interface QuickOpenProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickOpen: React.FC<QuickOpenProps> = ({ isOpen, onClose }) => {
  const [files, setFiles] = useState<string[]>([]);
  const { openFile } = useEditorStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      // Fetch all files from virtual FS or read recursively
      if ('getAllFiles' in fileSystemService && typeof (fileSystemService as any).getAllFiles === 'function') {
        const allFiles = (fileSystemService as any).getAllFiles() as Map<string, string>;
        setFiles(Array.from(allFiles.keys()));
      } else {
        void fileSystemService.readDir('').then((entries) => {
          setFiles(entries.map((e) => e.path));
        });
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+P or Cmd+P (without Shift)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          useLayoutStore.getState().setQuickOpen(true);
        }
      }

      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelect = (path: string) => {
    openFile(path);
    onClose();
  };

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <Command className={styles.commandRoot} label="Quick Open File">
        <div className={styles.inputWrapper}>
          <Search size={16} />
          <Command.Input
            ref={inputRef}
            placeholder="Search files by name (Ctrl+P)..."
            className={styles.input}
          />
        </div>

        <Command.List className={styles.list}>
          <Command.Empty className={styles.empty}>No matching files found.</Command.Empty>

          {files.map((path) => {
            const fileName = path.split('/').pop() || path;
            const dir = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
            return (
              <Command.Item
                key={path}
                value={`${fileName} ${path}`}
                onSelect={() => handleSelect(path)}
                className={styles.item}
              >
                <div className={styles.itemLeft}>
                  {fileName.endsWith('.json') ? (
                    <FileText size={14} color="var(--color-warning)" />
                  ) : (
                    <FileCode size={14} color="var(--accent)" />
                  )}
                  <span className={styles.filename}>{fileName}</span>
                </div>
                {dir && <span className={styles.filepath}>{dir}</span>}
              </Command.Item>
            );
          })}
        </Command.List>
      </Command>
    </div>
  );
};
