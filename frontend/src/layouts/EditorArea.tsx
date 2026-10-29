import React from 'react';
import { ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import { useEditorStore } from '../state/editorStore';
import { useLayoutStore } from '../state/layoutStore';
import { EditorTabs } from '../editor/EditorTabs';
import { MonacoHost } from '../editor/MonacoHost';
import { WelcomeScreen } from '../components/WelcomeScreen/WelcomeScreen';
import { PanelErrorBoundary } from '../components/ErrorBoundary/PanelErrorBoundary';
import { IconButton } from '../components/IconButton/IconButton';
import styles from './EditorArea.module.css';

export const EditorArea: React.FC = () => {
  const { tabs, activeTabId, splitLayout } = useEditorStore();
  const { maximizedPanel, toggleMaximizePanel } = useLayoutStore();

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const isMaximized = maximizedPanel === 'editor';

  const pathParts = activeTab ? activeTab.path.split('/') : [];

  return (
    <PanelErrorBoundary name="Editor Area">
      <div className={styles.editorArea}>
        {/* Editor Tabs Strip */}
        <div className={styles.topBar}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <EditorTabs />
          </div>
          <div className={styles.maximizeAction}>
            <IconButton
              label={isMaximized ? 'Restore Editor' : 'Maximize Editor'}
              size="sm"
              onClick={() => toggleMaximizePanel('editor')}
            >
              {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </IconButton>
          </div>
        </div>

        {/* Breadcrumb Path Bar */}
        {activeTab && (
          <div className={styles.breadcrumbs} aria-label="Breadcrumb path">
            <span>ajson-studio</span>
            {pathParts.map((part, idx) => (
              <React.Fragment key={idx}>
                <ChevronRight size={12} />
                <span
                  style={{
                    color: idx === pathParts.length - 1 ? 'var(--fg-1)' : 'var(--fg-3)',
                    fontWeight: idx === pathParts.length - 1 ? 500 : 400,
                  }}
                >
                  {part}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Editor Stage */}
        <div className={styles.stage}>
          {tabs.length === 0 || !activeTab ? (
            <WelcomeScreen />
          ) : (
            <div
              className={`${styles.editorContainer} ${
                splitLayout !== 'none' ? styles.splitContainer : ''
              }`}
            >
              <div className={styles.primaryEditor}>
                <MonacoHost tab={activeTab} />
              </div>
              {splitLayout !== 'none' && tabs.length > 1 && (
                <div className={styles.secondaryEditor}>
                  <MonacoHost tab={tabs.find((t) => t.id !== activeTab.id) || activeTab} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PanelErrorBoundary>
  );
};
