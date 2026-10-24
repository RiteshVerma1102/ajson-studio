import React from 'react';
import { Terminal, AlertCircle, FileText, ChevronDown, X } from 'lucide-react';
import { useLayoutStore } from '../state/layoutStore';
import { IconButton } from '../components/IconButton/IconButton';
import { Badge } from '../components/Badge/Badge';
import styles from './BottomPanel.module.css';

export const BottomPanel: React.FC = () => {
  const { activeBottomTab, setActiveBottomTab, toggleBottomPanel } = useLayoutStore();

  return (
    <div className={styles.bottomPanel} role="region" aria-label="Bottom Panel">
      <div className={styles.header}>
        <div className={styles.tabs} role="tablist">
          <button
            role="tab"
            aria-selected={activeBottomTab === 'terminal'}
            className={`${styles.tab} ${activeBottomTab === 'terminal' ? styles.active : ''}`}
            onClick={() => setActiveBottomTab('terminal')}
          >
            <Terminal size={14} />
            <span>Terminal</span>
          </button>

          <button
            role="tab"
            aria-selected={activeBottomTab === 'output'}
            className={`${styles.tab} ${activeBottomTab === 'output' ? styles.active : ''}`}
            onClick={() => setActiveBottomTab('output')}
          >
            <FileText size={14} />
            <span>Output</span>
          </button>

          <button
            role="tab"
            aria-selected={activeBottomTab === 'problems'}
            className={`${styles.tab} ${activeBottomTab === 'problems' ? styles.active : ''}`}
            onClick={() => setActiveBottomTab('problems')}
          >
            <AlertCircle size={14} />
            <span>Problems</span>
            <Badge variant="default">0</Badge>
          </button>
        </div>

        <div className={styles.actions}>
          <IconButton label="Minimize Panel" size="sm" onClick={toggleBottomPanel}>
            <ChevronDown size={14} />
          </IconButton>
          <IconButton label="Close Panel" size="sm" onClick={toggleBottomPanel}>
            <X size={14} />
          </IconButton>
        </div>
      </div>

      <div className={styles.content}>
        {activeBottomTab === 'terminal' && (
          <div className={styles.terminalOutput}>
            <div>[Ajson Studio Integrated Terminal — Phase 1 Shell Initialized]</div>
            <div>
              <span className={styles.prompt}>ajson-studio@desktop</span>:
              <span style={{ color: 'var(--color-info)' }}>~/frontend</span>$ npm run dev
            </div>
            <div style={{ color: 'var(--color-success)', marginTop: '4px' }}>
              ✓ Vite dev server ready on http://localhost:3000
            </div>
          </div>
        )}

        {activeBottomTab === 'output' && (
          <div className={styles.terminalOutput}>
            [Ajson Studio Task Output]
            {"\n"}Language Server Protocol (LSP) connection ready.
            {"\n"}Ready for agent logs and compilation output.
          </div>
        )}

        {activeBottomTab === 'problems' && (
          <div style={{ color: 'var(--fg-3)', fontSize: '13px', padding: '12px' }}>
            No problems have been detected in the workspace.
          </div>
        )}
      </div>
    </div>
  );
};
