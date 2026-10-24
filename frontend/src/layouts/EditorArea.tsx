import React from 'react';
import {
  FileCode,
  FilePlus,
  Terminal,
  Bot,
  Command as CommandIcon,
  ChevronRight,
  X,
} from 'lucide-react';
import { useCommandStore } from '../state/commandStore';
import { useLayoutStore } from '../state/layoutStore';
import { Kbd } from '../components/Kbd/Kbd';
import styles from './EditorArea.module.css';

export const EditorArea: React.FC = () => {
  const { openPalette } = useCommandStore();
  const { setActiveView, toggleBottomPanel } = useLayoutStore();

  return (
    <div className={styles.editorArea}>
      {/* Tab Bar */}
      <div className={styles.tabBar} role="tablist">
        <div className={`${styles.tab} ${styles.active}`} role="tab" aria-selected="true">
          <FileCode size={14} color="var(--accent)" />
          <span>App.tsx</span>
          <X size={12} style={{ marginLeft: '4px', opacity: 0.6 }} />
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs} aria-label="Breadcrumb navigation">
        <span>ajson-studio</span>
        <ChevronRight size={12} />
        <span>frontend</span>
        <ChevronRight size={12} />
        <span>src</span>
        <ChevronRight size={12} />
        <span style={{ color: 'var(--fg-1)' }}>App.tsx</span>
      </div>

      {/* Stage / Welcome */}
      <div className={styles.stage}>
        <div className={styles.welcomeCard}>
          <div className={styles.logoIcon}>
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
              <path
                d="M16 4 L28 11 L28 21 L16 28 L4 21 L4 11 Z"
                stroke="var(--accent)"
                strokeWidth="2"
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
          </div>

          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--fg-0)' }}>
              Ajson Studio
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--fg-3)', marginTop: '4px' }}>
              AI-Native Desktop Development Environment
            </p>
          </div>

          <div className={styles.actionsGrid}>
            <button className={styles.actionButton} onClick={openPalette}>
              <CommandIcon size={16} color="var(--accent)" />
              <div style={{ flex: 1 }}>
                <div>Command Palette</div>
                <div style={{ fontSize: '11px', color: 'var(--fg-3)' }}>
                  <Kbd>F1</Kbd> / <Kbd>Ctrl+Shift+P</Kbd>
                </div>
              </div>
            </button>

            <button
              className={styles.actionButton}
              onClick={() => setActiveView('manager')}
            >
              <Bot size={16} color="var(--color-info)" />
              <div style={{ flex: 1 }}>
                <div>Mission Control</div>
                <div style={{ fontSize: '11px', color: 'var(--fg-3)' }}>
                  <Kbd>Ctrl+Shift+M</Kbd>
                </div>
              </div>
            </button>

            <button className={styles.actionButton} onClick={openPalette}>
              <FilePlus size={16} color="var(--color-success)" />
              <div style={{ flex: 1 }}>
                <div>New File</div>
                <div style={{ fontSize: '11px', color: 'var(--fg-3)' }}>
                  <Kbd>Ctrl+N</Kbd>
                </div>
              </div>
            </button>

            <button className={styles.actionButton} onClick={toggleBottomPanel}>
              <Terminal size={16} color="var(--color-warning)" />
              <div style={{ flex: 1 }}>
                <div>Toggle Terminal</div>
                <div style={{ fontSize: '11px', color: 'var(--fg-3)' }}>
                  <Kbd>Ctrl+`</Kbd>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
