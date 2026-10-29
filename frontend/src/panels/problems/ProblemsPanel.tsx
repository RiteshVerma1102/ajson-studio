import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, AlertTriangle, Info, Filter } from 'lucide-react';
import { diagnosticsService, DiagnosticMarker } from '../../services';
import { useEditorStore } from '../../state/editorStore';
import styles from './ProblemsPanel.module.css';

export const ProblemsPanel: React.FC = () => {
  const [markers, setMarkers] = useState<DiagnosticMarker[]>([]);
  const [currentFileOnly, setCurrentFileOnly] = useState(false);

  const { activeTabId, openFile } = useEditorStore();

  const loadMarkers = useCallback(() => {
    const list = diagnosticsService.list({
      currentFileOnly,
      activeUri: activeTabId || undefined,
    });
    setMarkers(list);
  }, [currentFileOnly, activeTabId]);

  useEffect(() => {
    loadMarkers();
    const unbind = diagnosticsService.onDidChange(loadMarkers);
    return () => unbind();
  }, [loadMarkers]);

  const errorCount = markers.filter((m) => m.severity === 'error').length;
  const warnCount = markers.filter((m) => m.severity === 'warning').length;

  const handleRowClick = (marker: DiagnosticMarker) => {
    void openFile(marker.uri, {
      preview: false,
      line: marker.startLineNumber,
      column: marker.startColumn,
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.counts}>
          <span className={styles.countItem}>
            <AlertCircle size={13} color="var(--color-danger)" />
            <span>{errorCount} Errors</span>
          </span>
          <span className={styles.countItem}>
            <AlertTriangle size={13} color="var(--color-warning)" />
            <span>{warnCount} Warnings</span>
          </span>
        </div>

        <button
          className={`${styles.filterBtn} ${currentFileOnly ? styles.activeFilter : ''}`}
          onClick={() => setCurrentFileOnly(!currentFileOnly)}
        >
          <Filter size={12} />
          <span>Current File Only</span>
        </button>
      </div>

      <div className={styles.listBody}>
        {markers.map((m, idx) => (
          <div key={idx} className={styles.row} onClick={() => handleRowClick(m)}>
            <div className={styles.icon}>
              {m.severity === 'error' && <AlertCircle size={14} color="var(--color-danger)" />}
              {m.severity === 'warning' && (
                <AlertTriangle size={14} color="var(--color-warning)" />
              )}
              {m.severity === 'info' && <Info size={14} color="var(--color-info)" />}
            </div>
            <span className={styles.msg}>{m.message}</span>
            <span className={styles.fileLocation}>
              {m.uri.split('/').pop()}:[{m.startLineNumber},{m.startColumn}]
            </span>
          </div>
        ))}
        {markers.length === 0 && (
          <div className={styles.empty}>No problems have been detected in the workspace.</div>
        )}
      </div>
    </div>
  );
};
