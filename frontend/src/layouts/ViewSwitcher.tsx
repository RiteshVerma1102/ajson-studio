import React, { useEffect } from 'react';
import { Code2, LayoutDashboard } from 'lucide-react';
import { useLayoutStore } from '../state/layoutStore';
import styles from './ViewSwitcher.module.css';

export const ViewSwitcher: React.FC = () => {
  const { activeView, setActiveView, toggleView } = useLayoutStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
        e.preventDefault();
        toggleView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleView]);

  return (
    <div
      className={styles.switcher}
      role="radiogroup"
      aria-label="Workspace View Switcher (Ctrl+Shift+M)"
    >
      <button
        role="radio"
        aria-checked={activeView === 'editor'}
        className={`${styles.button} ${activeView === 'editor' ? styles.active : ''}`}
        onClick={() => setActiveView('editor')}
        title="Editor View (Ctrl+Shift+M)"
      >
        <Code2 size={13} />
        <span>Editor</span>
      </button>

      <button
        role="radio"
        aria-checked={activeView === 'manager'}
        className={`${styles.button} ${activeView === 'manager' ? styles.active : ''}`}
        onClick={() => setActiveView('manager')}
        title="Mission Control / Agents Manager (Ctrl+Shift+M)"
      >
        <LayoutDashboard size={13} />
        <span>Manager</span>
      </button>
    </div>
  );
};
