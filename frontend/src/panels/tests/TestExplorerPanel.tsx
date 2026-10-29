import React, { useState } from 'react';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import styles from './TestExplorerPanel.module.css';

interface TestSuite {
  id: string;
  name: string;
  testsCount: number;
  duration: string;
  passed: boolean;
  cases: string[];
}

const INITIAL_SUITES: TestSuite[] = [
  {
    id: 'a11y',
    name: 'a11y-contrast.test.ts',
    testsCount: 13,
    duration: '14ms',
    passed: true,
    cases: [
      'Dark theme token contrast meets WCAG AA',
      'Light theme text contrast ratio >= 4.5:1',
      'High-contrast theme UI boundary contrast >= 3:1',
      'Focus rings visible across all inputs',
    ],
  },
  {
    id: 'perf',
    name: 'performance-profile.test.ts',
    testsCount: 5,
    duration: '20ms',
    passed: true,
    cases: [
      '10,000 files filter executed in < 50ms',
      'Virtual scroll layout renders in < 16ms frame',
      'safeStorage memory writes execute in < 2ms',
    ],
  },
  {
    id: 'resilience',
    name: 'service-resilience.test.ts',
    testsCount: 3,
    duration: '29ms',
    passed: true,
    cases: [
      'Fallback to memory on QuotaExceededError',
      'Corrupted JSON in localStorage handled gracefully',
      'Null storage targets throw typed AjsonError',
    ],
  },
  {
    id: 'conformance',
    name: 'conformance.test.ts',
    testsCount: 10,
    duration: '20ms',
    passed: true,
    cases: [
      'FileSystemService read/write parity with IPC spec',
      'TerminalService PTY data stream validation',
      'GitService commit graph & diff integrity',
    ],
  },
  {
    id: 'layout',
    name: 'layoutStore.test.ts',
    testsCount: 5,
    duration: '11ms',
    passed: true,
    cases: [
      'initializes with default layout settings',
      'toggles sidebar visibility',
      'switches between editor and manager view',
      'updates theme and sets html data-theme attribute',
      'toggles active sidebar tab or closes on re-click',
    ],
  },
  {
    id: 'command',
    name: 'commandStore.test.ts',
    testsCount: 2,
    duration: '9ms',
    passed: true,
    cases: [
      'registers and unregisters commands dynamically',
      'executes registered command and closes palette',
    ],
  },
  {
    id: 'components',
    name: 'AppShell.test.tsx',
    testsCount: 2,
    duration: '1242ms',
    passed: true,
    cases: [
      'renders title bar, activity bar, editor area, and status bar',
      'renders Mission Control when activeView is manager',
    ],
  },
];

export const TestExplorerPanel: React.FC = () => {
  const [suites] = useState<TestSuite[]>(INITIAL_SUITES);
  const [isRunning, setIsRunning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const totalTests = suites.reduce((acc, s) => acc + s.testsCount, 0);
  const passedTests = suites.filter((s) => s.passed).reduce((acc, s) => acc + s.testsCount, 0);

  const toggleSuite = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRunAll = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
    }, 800);
  };

  const filteredSuites = suites.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={styles.container}>
      {/* Test Explorer Header */}
      <div className={styles.header}>
        <div className={styles.statsBar}>
          <div className={styles.passBadge}>
            <CheckCircle2 size={13} />
            <span>{passedTests}/{totalTests} passed</span>
          </div>
          <span style={{ opacity: 0.4 }}>|</span>
          <span style={{ opacity: 0.7 }}>{suites.length} suites</span>
        </div>

        <div className={styles.actions}>
          <button
            onClick={handleRunAll}
            title="Run All Tests (Vitest)"
            className={styles.actionBtn}
            disabled={isRunning}
          >
            {isRunning ? <div className={styles.runningSpinner} /> : <Play size={13} fill="currentColor" />}
          </button>
          <button
            onClick={() => setExpanded({})}
            title="Collapse All"
            className={styles.actionBtn}
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className={styles.searchBox}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter test files..."
          className={styles.searchInput}
        />
      </div>

      {/* Test Tree */}
      <div className={styles.treeList}>
        {filteredSuites.map((suite) => {
          const isOpen = Boolean(expanded[suite.id]);
          return (
            <div key={suite.id}>
              <div className={styles.suiteRow} onClick={() => toggleSuite(suite.id)}>
                <div className={styles.suiteLeft}>
                  {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <span className={styles.runDot} />
                  <span className={styles.suiteName}>{suite.name}</span>
                </div>
                <div className={styles.suiteRight}>
                  <span>{suite.duration}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRunAll();
                    }}
                    title={`Run ${suite.name}`}
                    style={{ background: 'none', border: 'none', color: 'var(--fg-2)', cursor: 'pointer', padding: 0 }}
                  >
                    <Play size={11} />
                  </button>
                </div>
              </div>

              {isOpen && (
                <div>
                  {suite.cases.map((c, i) => (
                    <div key={i} className={styles.testItem}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle2 size={11} color="var(--color-success)" />
                        <span>{c}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
