import React from 'react';
import {
  FileCode,
  FileDiff,
  X,
  Split,
  Pin,
  AlertTriangle,
} from 'lucide-react';
import { useEditorStore, EditorTab } from '../state/editorStore';
import { IconButton } from '../components/IconButton/IconButton';
import styles from './EditorTabs.module.css';

export const EditorTabs: React.FC = () => {
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    closeTab,
    pinTab,
    splitLayout,
    setSplitLayout,
  } = useEditorStore();

  const handleTabClick = (tab: EditorTab) => {
    setActiveTabId(tab.id);
  };

  const handleTabDoubleClick = (tab: EditorTab) => {
    pinTab(tab.id);
  };

  const toggleSplit = () => {
    setSplitLayout(splitLayout === 'none' ? 'vertical' : 'none');
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabList} role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              className={`${styles.tab} ${isActive ? styles.active : ''} ${
                tab.isPreview ? styles.preview : ''
              }`}
              onClick={() => handleTabClick(tab)}
              onDoubleClick={() => handleTabDoubleClick(tab)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleTabClick(tab);
                }
              }}
              title={`${tab.path}${tab.isDirty ? ' (unsaved)' : ''}`}
            >
              {tab.type === 'diff' ? (
                <FileDiff size={14} color="var(--accent)" />
              ) : (
                <FileCode size={14} color="var(--accent)" />
              )}
              <span>{tab.title}</span>

              {tab.hasConflict && (
                <span
                  title="File modified externally. Click save to overwrite or right click to reload."
                  style={{ display: 'inline-flex', alignItems: 'center' }}
                >
                  <AlertTriangle size={12} color="var(--color-warning)" />
                </span>
              )}

              {tab.isPinned && !tab.isDirty && !tab.hasConflict && (
                <Pin size={11} style={{ opacity: 0.5, transform: 'rotate(45deg)' }} />
              )}

              {tab.isDirty ? (
                <button
                  type="button"
                  className={styles.dirtyDot}
                  title="Unsaved changes"
                  aria-label={`Close unsaved tab ${tab.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                />
              ) : (
                <IconButton
                  label="Close Tab"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                >
                  <X size={12} />
                </IconButton>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.actions}>
        <IconButton
          label={splitLayout === 'none' ? 'Split Editor Right' : 'Close Split Editor'}
          size="sm"
          onClick={toggleSplit}
        >
          <Split size={14} />
        </IconButton>
      </div>
    </div>
  );
};
