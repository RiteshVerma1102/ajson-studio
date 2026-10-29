import React, { useState } from 'react';
import {
  Play,
  Square,
  RotateCcw,
  StepForward,
  CornerDownRight,
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import styles from './DebugPanel.module.css';

interface Breakpoint {
  id: string;
  file: string;
  line: number;
  enabled: boolean;
}

interface WatchItem {
  id: string;
  expr: string;
  value: string;
}

export const DebugPanel: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState('Launch Node.js (Current File)');
  const [openSections, setOpenSections] = useState({
    variables: true,
    watch: true,
    callstack: true,
    breakpoints: true,
  });

  const [watchItems, setWatchItems] = useState<WatchItem[]>([
    { id: '1', expr: 'this.activeProjectRoot', value: '"ajson-studio"' },
    { id: '2', expr: 'window.ajson.isReady', value: 'true' },
    { id: '3', expr: 'tabs.length', value: '3' },
  ]);
  const [newWatchExpr, setNewWatchExpr] = useState('');

  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([
    { id: '1', file: 'src/layouts/AppShell.tsx', line: 52, enabled: true },
    { id: '2', file: 'src/state/layoutStore.ts', line: 160, enabled: true },
    { id: '3', file: 'src/services/ipcAdapters.ts', line: 88, enabled: false },
  ]);

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleStartDebug = () => {
    setIsRunning(true);
  };

  const handleStopDebug = () => {
    setIsRunning(false);
  };

  const handleAddWatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWatchExpr.trim()) return;
    setWatchItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        expr: newWatchExpr.trim(),
        value: 'undefined',
      },
    ]);
    setNewWatchExpr('');
  };

  const handleRemoveWatch = (id: string) => {
    setWatchItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleToggleBreakpoint = (id: string) => {
    setBreakpoints((prev) =>
      prev.map((bp) => (bp.id === id ? { ...bp, enabled: !bp.enabled } : bp))
    );
  };

  return (
    <div className={styles.container}>
      {/* Top Debug Controls & Configuration Select */}
      <div className={styles.toolbar}>
        <select
          value={selectedConfig}
          onChange={(e) => setSelectedConfig(e.target.value)}
          className={styles.configSelect}
          disabled={isRunning}
        >
          <option>Launch Node.js (Current File)</option>
          <option>Vite Dev Server (Frontend)</option>
          <option>Attach to Process (Port 9229)</option>
          <option>Ajson Core Agent Inspector</option>
        </select>

        <div className={styles.actionControls}>
          {!isRunning ? (
            <button
              onClick={handleStartDebug}
              title="Start Debugging (F5)"
              className={`${styles.ctrlBtn} ${styles.playBtn}`}
            >
              <Play size={13} fill="currentColor" />
            </button>
          ) : (
            <>
              <button
                onClick={() => {}}
                title="Step Over (F10)"
                className={styles.ctrlBtn}
              >
                <StepForward size={13} />
              </button>
              <button
                onClick={() => {}}
                title="Step Into (F11)"
                className={styles.ctrlBtn}
              >
                <CornerDownRight size={13} />
              </button>
              <button
                onClick={() => setIsRunning(false)}
                title="Restart (Ctrl+Shift+F5)"
                className={styles.ctrlBtn}
              >
                <RotateCcw size={13} />
              </button>
              <button
                onClick={handleStopDebug}
                title="Stop (Shift+F5)"
                className={`${styles.ctrlBtn} ${styles.stopBtn}`}
              >
                <Square size={13} fill="currentColor" />
              </button>
            </>
          )}
        </div>
      </div>

      {isRunning && (
        <div className={styles.statusBanner}>
          <span className={`${styles.statusDot} ${styles.statusDotActive}`} />
          <span>Debugger active: listening on ws://127.0.0.1:9229</span>
        </div>
      )}

      {/* Variables Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader} onClick={() => toggleSection('variables')}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {openSections.variables ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <span>Variables</span>
          </span>
          <span style={{ opacity: 0.6 }}>Local Scope</span>
        </div>
        {openSections.variables && (
          <div className={styles.sectionContent}>
            <div className={styles.varRow}>
              <span className={styles.varName}>activeView:</span>
              <span className={styles.varVal}>"editor"</span>
            </div>
            <div className={styles.varRow}>
              <span className={styles.varName}>theme:</span>
              <span className={styles.varVal}>"dark"</span>
            </div>
            <div className={styles.varRow}>
              <span className={styles.varName}>monacoInstance:</span>
              <span className={styles.varVal}>[Object MonacoHost]</span>
            </div>
            <div className={styles.varRow}>
              <span className={styles.varName}>zenMode:</span>
              <span className={styles.varVal}>false</span>
            </div>
          </div>
        )}
      </div>

      {/* Watch Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader} onClick={() => toggleSection('watch')}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {openSections.watch ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <span>Watch</span>
          </span>
          <span style={{ opacity: 0.6 }}>({watchItems.length})</span>
        </div>
        {openSections.watch && (
          <div className={styles.sectionContent}>
            {watchItems.map((item) => (
              <div key={item.id} className={styles.varRow}>
                <span className={styles.varName}>{item.expr}:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className={styles.varVal}>{item.value}</span>
                  <button
                    onClick={() => handleRemoveWatch(item.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', padding: 0 }}
                    title="Remove Expression"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
            <form onSubmit={handleAddWatch} className={styles.watchInputRow}>
              <input
                type="text"
                value={newWatchExpr}
                onChange={(e) => setNewWatchExpr(e.target.value)}
                placeholder="Add expression to watch..."
                className={styles.watchInput}
              />
              <button
                type="submit"
                className={styles.ctrlBtn}
                style={{ width: '22px', height: '22px' }}
                title="Add watch expression"
              >
                <Plus size={12} />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Call Stack Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader} onClick={() => toggleSection('callstack')}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {openSections.callstack ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <span>Call Stack</span>
          </span>
          <span style={{ opacity: 0.6 }}>V8 Engine</span>
        </div>
        {openSections.callstack && (
          <div className={styles.sectionContent}>
            <div className={`${styles.stackRow} ${styles.stackActive}`}>
              <span className={styles.stackFunc}>render()</span>
              <span className={styles.stackLoc}>MonacoHost.tsx:42:15</span>
            </div>
            <div className={styles.stackRow}>
              <span className={styles.stackFunc}>executeCommand()</span>
              <span className={styles.stackLoc}>commandStore.ts:54:9</span>
            </div>
            <div className={styles.stackRow}>
              <span className={styles.stackFunc}>dispatchAction()</span>
              <span className={styles.stackLoc}>react-dom.development.js:839:12</span>
            </div>
          </div>
        )}
      </div>

      {/* Breakpoints Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader} onClick={() => toggleSection('breakpoints')}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {openSections.breakpoints ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <span>Breakpoints</span>
          </span>
          <span style={{ opacity: 0.6 }}>({breakpoints.filter((b) => b.enabled).length}/{breakpoints.length})</span>
        </div>
        {openSections.breakpoints && (
          <div className={styles.sectionContent}>
            {breakpoints.map((bp) => (
              <div
                key={bp.id}
                className={styles.bpRow}
                onClick={() => handleToggleBreakpoint(bp.id)}
              >
                <div className={`${styles.bpDot} ${!bp.enabled ? styles.bpDotInactive : ''}`} />
                <span className={styles.bpFile}>{bp.file.split('/').pop()}</span>
                <span className={styles.bpLine}>:{bp.line}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
