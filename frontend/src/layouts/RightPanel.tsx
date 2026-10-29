import React from 'react';
import { Sparkles, X, Maximize2, Minimize2 } from 'lucide-react';
import { useLayoutStore } from '../state/layoutStore';
import { IconButton } from '../components/IconButton/IconButton';
import { Badge } from '../components/Badge/Badge';
import { PanelErrorBoundary } from '../components/ErrorBoundary/PanelErrorBoundary';
import { AiPanel } from '../panels/ai/AiPanel';
import styles from './RightPanel.module.css';

export const RightPanel: React.FC = () => {
  const {
    toggleRightPanel,
    maximizedPanel,
    toggleMaximizePanel,
  } = useLayoutStore();

  const isMaximized = maximizedPanel === 'right';

  return (
    <PanelErrorBoundary name="AI Assistant">
      <div className={styles.rightPanel} role="region" aria-label="AI Assistant Panel">
        <div className={styles.header}>
          <div className={styles.title}>
            <Sparkles size={14} color="var(--accent)" />
            <span>AI Assistant</span>
            <Badge variant="accent">Cognitive Engine</Badge>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <IconButton
              label={isMaximized ? 'Restore Panel' : 'Maximize Panel'}
              size="sm"
              onClick={() => toggleMaximizePanel('right')}
            >
              {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </IconButton>
            <IconButton label="Close AI Panel" size="sm" onClick={toggleRightPanel}>
              <X size={14} />
            </IconButton>
          </div>
        </div>

        <div className={styles.content}>
          <AiPanel />
        </div>
      </div>
    </PanelErrorBoundary>
  );
};
