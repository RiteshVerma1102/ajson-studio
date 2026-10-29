import React, { useRef, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { useEditorStore, EditorTab } from '../state/editorStore';
import { useLayoutStore } from '../state/layoutStore';
import { diagnosticsService } from '../services';
import { DiffViewer } from './DiffViewer';
import './monacoSetup';

export interface MonacoHostProps {
  tab: EditorTab;
}

export const MonacoHost: React.FC<MonacoHostProps> = ({ tab }) => {
  const theme = useLayoutStore((s) => s.theme);
  const { updateContent, saveActiveFile } = useEditorStore();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);

  const monacoTheme = theme === 'light' ? 'light' : theme === 'high-contrast' ? 'hc-black' : 'vs-dark';

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Save shortcut: Ctrl+S or Cmd+S
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveActiveFile();
    });

    // Jump to line if provided
    if (tab.cursorLine) {
      editor.revealLineInCenter(tab.cursorLine);
      editor.setPosition({
        lineNumber: tab.cursorLine,
        column: tab.cursorColumn || 1,
      });
    }
  };

  // Sync Diagnostics to Monaco Markers
  useEffect(() => {
    const syncMarkers = () => {
      if (!monacoRef.current || !editorRef.current) return;
      const monaco = monacoRef.current;
      const model = editorRef.current.getModel();
      if (!model) return;

      const markers = diagnosticsService.list({ activeUri: tab.path, currentFileOnly: true });
      const monacoMarkers: Monaco.editor.IMarkerData[] = markers.map((m) => ({
        message: m.message,
        severity:
          m.severity === 'error'
            ? monaco.MarkerSeverity.Error
            : m.severity === 'warning'
            ? monaco.MarkerSeverity.Warning
            : monaco.MarkerSeverity.Info,
        startLineNumber: m.startLineNumber,
        startColumn: m.startColumn,
        endLineNumber: m.endLineNumber,
        endColumn: m.endColumn,
        source: m.source,
      }));

      monaco.editor.setModelMarkers(model, 'ajson-diagnostics', monacoMarkers);
    };

    syncMarkers();
    const unsubscribe = diagnosticsService.onDidChange(syncMarkers);

    return () => {
      unsubscribe();
      if (monacoRef.current && editorRef.current) {
        const model = editorRef.current.getModel();
        if (model) {
          monacoRef.current.editor.setModelMarkers(model, 'ajson-diagnostics', []);
        }
      }
    };
  }, [tab.path]);

  if (tab.type === 'diff') {
    return (
      <DiffViewer
        original={tab.originalContent}
        modified={tab.content}
        language={tab.language}
        originalLabel="HEAD"
        modifiedLabel={tab.diffStaged ? 'Index (Staged)' : 'Working Tree'}
      />
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Editor
        height="100%"
        theme={monacoTheme}
        language={tab.language}
        value={tab.content}
        onChange={(val) => updateContent(tab.id, val || '')}
        onMount={handleEditorMount}
        options={{
          automaticLayout: true,
          minimap: { enabled: true },
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          tabSize: 2,
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
        }}
      />
    </div>
  );
};
