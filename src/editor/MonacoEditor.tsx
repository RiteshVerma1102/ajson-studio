import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import Editor, { Monaco, OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { SupportedLanguage, CursorPosition, EditorLocation } from '../types/editor'

export interface MonacoEditorHandle {
  triggerFind: () => void
  triggerReplace: () => void
  focus: () => void
  insertText: (text: string) => void
  replaceSelection: (text: string) => boolean
}

interface MonacoEditorProps {
  value: string
  language: SupportedLanguage
  path?: string
  onChange: (value: string) => void
  onCursorChange?: (pos: CursorPosition) => void
  onSelectionChange?: (sel: {
    text: string
    startLine: number
    startCol: number
    endLine: number
    endCol: number
  } | null) => void
  revealLocation?: (EditorLocation & { timestamp?: number }) | null
}

export const MonacoEditor = forwardRef<MonacoEditorHandle, MonacoEditorProps>((
  {
    value,
    language,
    path,
    onChange,
    onCursorChange,
    onSelectionChange,
    revealLocation,
  },
  ref
) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  useImperativeHandle(ref, () => ({
    triggerFind: () => {
      editorRef.current?.getAction('actions.find')?.run()
      editorRef.current?.focus()
    },
    triggerReplace: () => {
      editorRef.current?.getAction('editor.action.startFindReplaceAction')?.run()
      editorRef.current?.focus()
    },
    focus: () => {
      editorRef.current?.focus()
    },
    insertText: (text: string) => {
      const ed = editorRef.current
      if (!ed) return
      const selection = ed.getSelection()
      if (selection) {
        ed.executeEdits('ajson-ai', [
          {
            range: selection,
            text,
            forceMoveMarkers: true,
          },
        ])
        ed.focus()
      }
    },
    replaceSelection: (text: string): boolean => {
      const ed = editorRef.current
      if (!ed) return false
      const selection = ed.getSelection()
      if (selection && !selection.isEmpty()) {
        ed.executeEdits('ajson-ai-replace', [
          {
            range: selection,
            text,
            forceMoveMarkers: true,
          },
        ])
        ed.focus()
        return true
      }
      // If selection was collapsed/empty, insert at cursor
      if (selection) {
        ed.executeEdits('ajson-ai-insert', [
          {
            range: selection,
            text,
            forceMoveMarkers: true,
          },
        ])
        ed.focus()
        return true
      }
      return false
    },
  }))

  const handleEditorWillMount = (monaco: Monaco) => {
    // Define the Antigravity Workbench Dark theme
    monaco.editor.defineTheme('ajson-studio-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569cd6' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'regexp', foreground: 'd16969' },
        { token: 'type', foreground: '4ec9b0' },
        { token: 'class', foreground: '4ec9b0' },
        { token: 'function', foreground: 'dcdcaa' },
        { token: 'variable', foreground: '9cdcfe' },
        { token: 'constant', foreground: '4fc1ff' },
        { token: 'tag', foreground: '569cd6' },
        { token: 'attribute.name', foreground: '9cdcfe' },
      ],
      colors: {
        'editor.background': '#1E1E1E',
        'editor.foreground': '#D4D4D4',
        'editor.lineHighlightBackground': '#282828',
        'editor.lineHighlightBorder': '#28282800',
        'editor.selectionBackground': '#264F78',
        'editor.inactiveSelectionBackground': '#3A3D41',
        'editorCursor.foreground': '#AEAFAD',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#C6C6C6',
        'editorGutter.background': '#1E1E1E',
        'editorIndentGuide.background': '#404040',
        'editorIndentGuide.activeBackground': '#707070',
        'editorWhitespace.foreground': '#3B3A32',
        'editorBracketMatch.background': '#0064001a',
        'editorBracketMatch.border': '#888888',
        'minimap.background': '#1E1E1E',
        'scrollbarSlider.background': '#79797944',
        'scrollbarSlider.hoverBackground': '#64646477',
        'scrollbarSlider.activeBackground': '#BFBFBF66',
      },
    })
  }

  const handleEditorDidMount: OnMount = (editorInstance, monaco) => {
    editorRef.current = editorInstance
    monaco.editor.setTheme('ajson-studio-dark')

    // Track cursor movement
    editorInstance.onDidChangeCursorPosition((e) => {
      if (onCursorChange) {
        onCursorChange({
          lineNumber: e.position.lineNumber,
          column: e.position.column,
        })
      }
    })

    // Track selection changes for AI code context
    editorInstance.onDidChangeCursorSelection((e) => {
      if (!onSelectionChange) return
      const sel = e.selection
      if (!sel || sel.isEmpty()) {
        onSelectionChange(null)
        return
      }
      const model = editorInstance.getModel()
      const text = model ? model.getValueInRange(sel) : ''
      if (!text || text.trim().length === 0) {
        onSelectionChange(null)
        return
      }
      onSelectionChange({
        text,
        startLine: sel.startLineNumber,
        startCol: sel.startColumn,
        endLine: sel.endLineNumber,
        endCol: sel.endColumn,
      })
    })

    // Initial position trigger
    const initialPos = editorInstance.getPosition()
    if (initialPos && onCursorChange) {
      onCursorChange({
        lineNumber: initialPos.lineNumber,
        column: initialPos.column,
      })
    }

    // Navigate to reveal location if provided on mount
    if (revealLocation) {
      const { lineNumber, column, matchLength = 0 } = revealLocation
      editorInstance.setPosition({ lineNumber, column })
      editorInstance.revealLineInCenter(lineNumber)
      if (matchLength > 0) {
        editorInstance.setSelection({
          startLineNumber: lineNumber,
          startColumn: column,
          endLineNumber: lineNumber,
          endColumn: column + matchLength,
        })
      }
      editorInstance.focus()
    }
  }

  // Navigate when revealLocation changes while editor is already mounted
  useEffect(() => {
    if (revealLocation && editorRef.current) {
      const { lineNumber, column, matchLength = 0 } = revealLocation
      editorRef.current.setPosition({ lineNumber, column })
      editorRef.current.revealLineInCenter(lineNumber)
      if (matchLength > 0) {
        editorRef.current.setSelection({
          startLineNumber: lineNumber,
          startColumn: column,
          endLineNumber: lineNumber,
          endColumn: column + matchLength,
        })
      }
      editorRef.current.focus()
    }
  }, [revealLocation])

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <Editor
        height="100%"
        width="100%"
        language={language}
        value={value}
        path={path}
        beforeMount={handleEditorWillMount}
        onMount={handleEditorDidMount}
        onChange={(val) => onChange(val || '')}
        options={{
          fontSize: 13.5,
          fontFamily: "'JetBrains Mono', 'Fira Code', Cascadia Code, Menlo, Consolas, monospace",
          fontLigatures: true,
          minimap: { enabled: true, side: 'right' },
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          bracketPairColorization: { enabled: true },
          renderLineHighlight: 'all',
          lineNumbersMinChars: 4,
          padding: { top: 12, bottom: 12 },
          lineHeight: 22,
          wordWrap: 'off',
        }}
      />
    </div>
  )
})
