import React, { useState, useEffect } from 'react';
import {
  Terminal,
  AlertCircle,
  FileText,
  ChevronDown,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useLayoutStore } from '../state/layoutStore';
import { diagnosticsService } from '../services';
import { IconButton } from '../components/IconButton/IconButton';
import { Badge } from '../components/Badge/Badge';
import { PanelErrorBoundary } from '../components/ErrorBoundary/PanelErrorBoundary';
import { TerminalPanel } from '../panels/terminal/TerminalPanel';
import { OutputPanel } from '../panels/output/OutputPanel';
import { ProblemsPanel } from '../panels/problems/ProblemsPanel';
import styles from './BottomPanel.module.css';

export const BottomPanel: React.FC = () => {
  const {
    activeBottomTab,
    setActiveBottomTab,
    toggleBottomPanel,
    maximizedPanel,
    toggleMaximizePanel,
  } = useLayoutStore();

  const [problemCount, setProblemCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      setProblemCount(diagnosticsService.list().length);
    };
    updateCount();
    const unbind = diagnosticsService.onDidChange(updateCount);
    return () => unbind();
  }, []);

  const isMaximized = maximizedPanel === 'bottom';

  return (
    <PanelErrorBoundary name="Bottom Panel">
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
              <Badge variant={problemCount > 0 ? 'warning' : 'default'}>{problemCount}</Badge>
            </button>
          </div>

          <div className={styles.actions}>
            <IconButton
              label={isMaximized ? 'Restore Panel' : 'Maximize Panel'}
              size="sm"
              onClick={() => toggleMaximizePanel('bottom')}
            >
              {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </IconButton>
            <IconButton label="Minimize Panel" size="sm" onClick={toggleBottomPanel}>
              <ChevronDown size={14} />
            </IconButton>
            <IconButton label="Close Panel" size="sm" onClick={toggleBottomPanel}>
              <X size={14} />
            </IconButton>
          </div>
        </div>

        <div className={styles.content}>
          {activeBottomTab === 'terminal' && <TerminalPanel />}
          {activeBottomTab === 'output' && <OutputPanel />}
          {activeBottomTab === 'problems' && <ProblemsPanel />}
        </div>
      </div>
    </PanelErrorBoundary>
  );
};
