import React from 'react';
import { Sparkles, X, ChevronRight, Cpu } from 'lucide-react';
import { useLayoutStore } from '../state/layoutStore';
import { IconButton } from '../components/IconButton/IconButton';
import { Badge } from '../components/Badge/Badge';
import { EmptyState } from '../components/EmptyState/EmptyState';
import styles from './RightPanel.module.css';

export const RightPanel: React.FC = () => {
  const { toggleRightPanel } = useLayoutStore();

  return (
    <div className={styles.rightPanel} role="region" aria-label="AI Copilot Panel">
      <div className={styles.header}>
        <div className={styles.title}>
          <Sparkles size={14} color="var(--accent)" />
          <span>AI Assistant</span>
          <Badge variant="accent">Agent Mode</Badge>
        </div>

        <IconButton label="Close AI Panel" size="sm" onClick={toggleRightPanel}>
          <X size={14} />
        </IconButton>
      </div>

      <div className={styles.content}>
        <EmptyState
          icon={<Cpu size={24} color="var(--accent)" />}
          title="Cognitive Engine Ready"
          description="In Phase 4, interactive streaming chat with multi-model support, context chips, and autonomous tool calling will be mounted here."
        />

        <div>
          <div className={styles.promptCard}>
            <div className={styles.cardTitle}>Human-in-the-Loop Security</div>
            <div className={styles.cardDesc}>
              Every autonomous file edit or shell execution is protected by mandatory visual approval.
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: 'var(--fg-3)',
              marginTop: '12px',
            }}
          >
            <span>Model: Claude 3.5 Sonnet</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Context: 0 / 128k</span>
              <ChevronRight size={12} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
