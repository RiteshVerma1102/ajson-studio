import React, { useState, useMemo } from 'react';
import {
  FileJson,
  Minimize2,
  Maximize2,
  ArrowUpDown,
  Code2,
  Copy,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useEditorStore } from '../../state/editorStore';
import {
  validateJson,
  formatJson,
  minifyJson,
  computeJsonStats,
  jsonToTypeScript,
} from '../../utils/jsonUtils';
import styles from './JsonToolsPanel.module.css';

export const JsonToolsPanel: React.FC = () => {
  const { tabs, activeTabId, updateContent } = useEditorStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const content = activeTab?.content || '{\n  "name": "ajson-studio",\n  "version": "1.0.0",\n  "status": "ready"\n}';

  const [copied, setCopied] = useState(false);
  const [outputTs, setOutputTs] = useState<string | null>(null);

  const validation = useMemo(() => validateJson(content), [content]);
  const stats = useMemo(() => computeJsonStats(content), [content]);

  const handleFormat = (indent = 2) => {
    const { output } = formatJson(content, indent);
    if (activeTab) updateContent(activeTab.id, output);
  };

  const handleMinify = () => {
    const { output } = minifyJson(content);
    if (activeTab) updateContent(activeTab.id, output);
  };

  const handleSortKeys = () => {
    const { output } = formatJson(content, 2, true);
    if (activeTab) updateContent(activeTab.id, output);
  };

  const handleGenerateTs = () => {
    const ts = jsonToTypeScript(content, 'AjsonPayload');
    setOutputTs(ts);
  };

  const handleCopyTs = () => {
    if (outputTs) {
      navigator.clipboard.writeText(outputTs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>
          <FileJson size={14} />
          <span>JSON Studio Tools</span>
        </span>
        <span style={{ fontSize: '10px', color: validation.valid ? 'var(--color-success)' : 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '3px' }}>
          {validation.valid ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
          <span>{validation.valid ? 'Valid JSON' : 'Syntax Error'}</span>
        </span>
      </div>

      {/* Action Buttons */}
      <div className={styles.actionsGrid}>
        <button className={styles.toolBtn} onClick={() => handleFormat(2)} title="Format with 2-space indentation">
          <Maximize2 size={12} />
          <span>Format (2-sp)</span>
        </button>
        <button className={styles.toolBtn} onClick={handleMinify} title="Remove whitespace">
          <Minimize2 size={12} />
          <span>Minify</span>
        </button>
        <button className={styles.toolBtn} onClick={handleSortKeys} title="Sort keys alphabetically">
          <ArrowUpDown size={12} />
          <span>Sort Keys</span>
        </button>
        <button className={styles.toolBtn} onClick={handleGenerateTs} title="Generate TypeScript Interface">
          <Code2 size={12} />
          <span>To TypeScript</span>
        </button>
      </div>

      {/* JSON Statistics Card */}
      {stats && (
        <div className={styles.statusCard}>
          <span className={styles.statusTitle}>Document Metrics</span>
          <div className={styles.statRow}>
            <span>Size:</span>
            <span className={styles.statVal}>{stats.byteSize} bytes</span>
          </div>
          <div className={styles.statRow}>
            <span>Total Keys:</span>
            <span className={styles.statVal}>{stats.keyCount}</span>
          </div>
          <div className={styles.statRow}>
            <span>Arrays:</span>
            <span className={styles.statVal}>{stats.arrayCount}</span>
          </div>
          <div className={styles.statRow}>
            <span>Max Nesting Depth:</span>
            <span className={styles.statVal}>{stats.maxDepth}</span>
          </div>
        </div>
      )}

      {/* TypeScript Generation Preview */}
      {outputTs && (
        <div className={styles.previewBox}>
          <div className={styles.previewHeader}>
            <span>TypeScript Output</span>
            <button
              onClick={handleCopyTs}
              style={{ background: 'none', border: 'none', color: 'var(--fg-1)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}
            >
              <Copy size={11} />
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
          <textarea readOnly value={outputTs} className={styles.previewArea} />
        </div>
      )}
    </div>
  );
};
