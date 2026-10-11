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
    // Define the signature Ajson Dark Graphite & Violet theme
    monaco.editor.defineTheme('ajson-studio-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c084fc', fontStyle: 'bold' },
        { token: 'string', foreground: '34d399' },
        { token: 'number', foreground: 'fbbf24' },
        { token: 'regexp', foreground: 'f472b6' },
        { token: 'type', foreground: 'a78bfa' },
        { token: 'class', foreground: 'a78bfa', fontStyle: 'bold' },
        { token: 'function', foreground: '60a5fa' },
        { token: 'variable', foreground: 'f3f4f6' },
        { token: 'constant', foreground: 'e879f9' },
        { token: 'tag', foreground: 'c084fc' },
        { token: 'attribute.name', foreground: '34d399' },
      ],
      colors: {
        'editor.background': '#101115',
        'editor.foreground': '#f3f4f6',
        'editor.lineHighlightBackground': '#16171f',
        'editor.lineHighlightBorder': '#22242e',
        'editor.selectionBackground': '#3b2d54',
        'editor.inactiveSelectionBackground': '#252035',
        'editorCursor.foreground': '#a78bfa',
        'editorLineNumber.foreground': '#4b5563',
        'editorLineNumber.activeForeground': '#c4b5fd',
        'editorGutter.background': '#101115',
        'editorIndentGuide.background': '#1e202a',
        'editorIndentGuide.activeBackground': '#3a344d',
        'editorWhitespace.foreground': '#2a2d3b',
        'editorBracketMatch.background': '#31254a',
        'editorBracketMatch.border': '#8b5cf6',
        'minimap.background': '#101115',
        'scrollbarSlider.background': '#25273380',
        'scrollbarSlider.hoverBackground': '#393c4eaa',
        'scrollbarSlider.activeBackground': '#8b5cf666',
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
