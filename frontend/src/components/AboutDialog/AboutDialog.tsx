import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { Modal } from '../Modal/Modal';
import { Button } from '../Button/Button';
import styles from './AboutDialog.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutDialog: React.FC<Props> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  const sysInfo = `Ajson Studio v0.2.0-frontend-complete\nArchitecture: Chromium Renderer + Electron Main Shell\nReact: 18.3.1\nTypeScript: 5.7.2\nMonaco Editor: 0.52.2\nOS: ${navigator.userAgent}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sysInfo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="About Ajson Studio"
      footer={
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={copied ? <Check size={13} color="var(--color-success)" /> : <Copy size={13} />}
            onClick={handleCopy}
          >
            {copied ? 'Copied System Info' : 'Copy System Info'}
          </Button>
          <Button variant="primary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className={styles.container}>
        <div className={styles.logoWrapper}>
          <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
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

        <h2 className={styles.productName}>Ajson Studio</h2>
        <span className={styles.versionBadge}>v0.2.0-frontend-complete</span>
        <p className={styles.tagline}>
          AI-Native Desktop Development Environment for intelligent coding, project understanding,
          autonomous agents, testing, debugging, and deployment.
        </p>

        <div className={styles.detailsGrid}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>License:</span>
            <span className={styles.detailValue}>MIT License</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Lead Architect:</span>
            <span className={styles.detailValue}>Ritesh Verma</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Contracts Protocol:</span>
            <span className={styles.detailValue}>@ajson/contracts v0.1.0</span>
          </div>
        </div>

        <div className={styles.links}>
          <a
            href="https://github.com/RiteshVerma1102/ajson-studio"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            <span>GitHub Repository</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </Modal>
  );
};
