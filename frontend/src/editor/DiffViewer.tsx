import React, { useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { Columns, AlignJustify } from 'lucide-react';
import { useLayoutStore } from '../state/layoutStore';
import { IconButton } from '../components/IconButton/IconButton';
import './monacoSetup';

export interface DiffViewerProps {
  original: string;
  modified: string;
  language?: string;
  originalLabel?: string;
  modifiedLabel?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  original,
  modified,
  language = 'typescript',
  originalLabel = 'HEAD',
  modifiedLabel = 'Working Tree',
}) => {
  const theme = useLayoutStore((s) => s.theme);
  const [inline, setInline] = useState(false);

  const monacoTheme = theme === 'light' ? 'light' : theme === 'high-contrast' ? 'hc-black' : 'vs-dark';

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          backgroundColor: 'var(--bg-1)',
          borderBottom: '1px solid var(--color-border)',
          fontSize: '11px',
          color: 'var(--fg-2)',
        }}
      >
        <span>
          Comparing: <span style={{ color: 'var(--fg-1)' }}>{originalLabel}</span> ↔{' '}
          <span style={{ color: 'var(--accent)' }}>{modifiedLabel}</span>
        </span>

        <IconButton
          label={inline ? 'Side-by-side Diff' : 'Inline Diff'}
          size="sm"
          onClick={() => setInline(!inline)}
        >
          {inline ? <Columns size={13} /> : <AlignJustify size={13} />}
        </IconButton>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <DiffEditor
          height="100%"
          theme={monacoTheme}
          language={language}
          original={original}
          modified={modified}
          options={{
            readOnly: true,
            renderSideBySide: !inline,
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        />
      </div>
    </div>
  );
};
