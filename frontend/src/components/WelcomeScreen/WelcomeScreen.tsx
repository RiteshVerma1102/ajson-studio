import React from 'react';
import {
  FolderOpen,
  FilePlus,
  BookOpen,
  Sparkles,
  Command as CommandIcon,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { useEditorStore } from '../../state/editorStore';
import { useCommandStore } from '../../state/commandStore';
import { useLayoutStore } from '../../state/layoutStore';
import { Kbd } from '../Kbd/Kbd';
import styles from './WelcomeScreen.module.css';

const RECENT_PROJECTS = [
  { name: 'ajson-studio/frontend', path: 'src/App.tsx', lastOpened: 'Just now' },
  { name: 'sample-fixtures', path: 'fixtures/valid.json', lastOpened: '2 hours ago' },
  { name: 'math-utils', path: 'src/utils/math.ts', lastOpened: 'Yesterday' },
];

export const WelcomeScreen: React.FC = () => {
  const { openFile } = useEditorStore();
  const { openPalette } = useCommandStore();
  const { setTourOpen } = useLayoutStore();

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.logo}>
          <svg width="56" height="56" viewBox="0 0 32 32" fill="none">
            <path
              d="M16 3 L29 10.5 L29 21.5 L16 29 L3 21.5 L3 10.5 Z"
              stroke="var(--accent)"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path
              d="M16 3 L16 29 M3 10.5 L16 16 L29 10.5"
              stroke="var(--accent)"
              strokeWidth="1.6"
              strokeOpacity="0.8"
            />
            <circle cx="16" cy="16" r="3" fill="var(--accent)" />
          </svg>
        </div>

        <h1 className={styles.title}>Ajson Studio</h1>
        <p className={styles.subtitle}>
          AI-Native Desktop Development Environment — High-speed editing & autonomous cognition
        </p>

        <div className={styles.tourPrompt}>
          <button className={styles.tourBtn} onClick={() => setTourOpen(true)}>
            <Sparkles size={14} color="var(--accent)" />
            <span>New here? Start the 5-step interactive tour</span>
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Start Column */}
        <div className={styles.card}>
          <h2 className={styles.cardHeader}>Start</h2>
          <div className={styles.actionList}>
            <button
              className={styles.actionItem}
              onClick={() => void openFile('src/App.tsx')}
            >
              <FilePlus size={16} color="var(--accent)" />
              <div className={styles.actionText}>
                <span className={styles.actionTitle}>New File / Buffer</span>
                <span className={styles.actionDesc}>Open clean TypeScript scratchpad</span>
              </div>
              <Kbd>Ctrl+N</Kbd>
            </button>

            <button className={styles.actionItem} onClick={openPalette}>
              <CommandIcon size={16} color="var(--color-info)" />
              <div className={styles.actionText}>
                <span className={styles.actionTitle}>Command Palette</span>
                <span className={styles.actionDesc}>Access all actions & tools</span>
              </div>
              <Kbd>Ctrl+Shift+P</Kbd>
            </button>

            <button
              className={styles.actionItem}
              onClick={() => void openFile('README.md')}
            >
              <FolderOpen size={16} color="var(--color-warning)" />
              <div className={styles.actionText}>
                <span className={styles.actionTitle}>Open Project Baseline</span>
                <span className={styles.actionDesc}>View workspace README documentation</span>
              </div>
            </button>
          </div>
        </div>

        {/* Recents Column */}
        <div className={styles.card}>
          <h2 className={styles.cardHeader}>Recent Files</h2>
          <div className={styles.actionList}>
            {RECENT_PROJECTS.map((p) => (
              <button
                key={p.path}
                className={styles.actionItem}
                onClick={() => void openFile(p.path)}
              >
                <Clock size={15} color="var(--fg-3)" />
                <div className={styles.actionText}>
                  <span className={styles.actionTitle}>{p.name}</span>
                  <span className={styles.actionDesc}>{p.path}</span>
                </div>
                <span className={styles.timeTag}>{p.lastOpened}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Help & Documentation Column */}
        <div className={styles.card}>
          <h2 className={styles.cardHeader}>Documentation</h2>
          <div className={styles.actionList}>
            <a
              href="https://github.com/RiteshVerma1102/ajson-studio"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.actionItem}
            >
              <BookOpen size={16} color="var(--color-success)" />
              <div className={styles.actionText}>
                <span className={styles.actionTitle}>Architecture Documentation</span>
                <span className={styles.actionDesc}>Explore IPC contracts & system overview</span>
              </div>
              <ExternalLink size={12} color="var(--fg-3)" />
            </a>

            <div className={styles.shortcutsBox}>
              <span className={styles.shortcutsTitle}>Quick Shortcuts</span>
              <div className={styles.shortcutRow}>
                <span>Toggle Terminal</span>
                <Kbd>Ctrl+`</Kbd>
              </div>
              <div className={styles.shortcutRow}>
                <span>Mission Control</span>
                <Kbd>Ctrl+Shift+M</Kbd>
              </div>
              <div className={styles.shortcutRow}>
                <span>AI Assistant</span>
                <Kbd>Ctrl+Alt+B</Kbd>
              </div>
              <div className={styles.shortcutRow}>
                <span>Toggle SideBar</span>
                <Kbd>Ctrl+B</Kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
