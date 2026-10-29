import React, { useState } from 'react';
import {
  Search as SearchIcon,
  CaseSensitive,
  WholeWord,
  Regex,
  ChevronDown,
  ChevronRight,
  FileCode,
  X,
} from 'lucide-react';
import { searchService, SearchMatch } from '../../services';
import { useEditorStore } from '../../state/editorStore';
import { IconButton } from '../../components/IconButton/IconButton';
import styles from './SearchPanel.module.css';

export const SearchPanel: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [matchWholeWord, setMatchWholeWord] = useState(false);
  const [isRegex, setIsRegex] = useState(false);
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [openFiles, setOpenFiles] = useState<Set<string>>(new Set());

  const { openFile } = useEditorStore();

  const handleSearch = async () => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    const matches = await searchService.searchText({
      query: query.trim(),
      isCaseSensitive,
      matchWholeWord,
      isRegex,
    });
    setResults(matches);
    setHasSearched(true);

    // Auto-expand all matching files
    const filePaths = new Set(matches.map((m) => m.path));
    setOpenFiles(filePaths);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      void handleSearch();
    }
  };

  const toggleFile = (path: string) => {
    setOpenFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // Group matches by file
  const grouped = results.reduce<Record<string, SearchMatch[]>>((acc, match) => {
    if (!acc[match.path]) acc[match.path] = [];
    acc[match.path]!.push(match);
    return acc;
  }, {});

  return (
    <div className={styles.container}>
      <div className={styles.searchBar}>
        <div className={styles.inputWrapper}>
          <input
            className={styles.input}
            placeholder="Search files..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              className={styles.clearBtn}
              onClick={() => {
                setQuery('');
                setResults([]);
                setHasSearched(false);
              }}
            >
              <X size={12} />
            </button>
          )}
          <div className={styles.toggles}>
            <button
              className={`${styles.toggleBtn} ${isCaseSensitive ? styles.activeToggle : ''}`}
              title="Match Case"
              onClick={() => setIsCaseSensitive(!isCaseSensitive)}
            >
              <CaseSensitive size={14} />
            </button>
            <button
              className={`${styles.toggleBtn} ${matchWholeWord ? styles.activeToggle : ''}`}
              title="Match Whole Word"
              onClick={() => setMatchWholeWord(!matchWholeWord)}
            >
              <WholeWord size={14} />
            </button>
            <button
              className={`${styles.toggleBtn} ${isRegex ? styles.activeToggle : ''}`}
              title="Use Regular Expression"
              onClick={() => setIsRegex(!isRegex)}
            >
              <Regex size={14} />
            </button>
          </div>
        </div>

        <IconButton label="Execute Search" size="sm" onClick={() => void handleSearch()}>
          <SearchIcon size={14} />
        </IconButton>
      </div>

      <div className={styles.resultsArea}>
        {hasSearched && (
          <div className={styles.summaryBar}>
            {results.length} {results.length === 1 ? 'match' : 'matches'} in{' '}
            {Object.keys(grouped).length} {Object.keys(grouped).length === 1 ? 'file' : 'files'}
          </div>
        )}

        {hasSearched && results.length === 0 && (
          <div className={styles.emptyResults}>No results found for "{query}".</div>
        )}

        {Object.entries(grouped).map(([filePath, matches]) => {
          const isOpen = openFiles.has(filePath);
          const fileName = filePath.split('/').pop() || filePath;
          return (
            <div key={filePath} className={styles.fileGroup}>
              <div className={styles.fileHeader} onClick={() => toggleFile(filePath)}>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <FileCode size={14} color="var(--accent)" />
                <span className={styles.fileName}>{fileName}</span>
                <span className={styles.matchCount}>{matches.length}</span>
              </div>

              {isOpen && (
                <div className={styles.matchList}>
                  {matches.map((m, idx) => (
                    <div
                      key={idx}
                      className={styles.matchRow}
                      onClick={() =>
                        void openFile(m.path, {
                          preview: false,
                          line: m.lineNumber,
                          column: m.column,
                        })
                      }
                    >
                      <span className={styles.lineNum}>{m.lineNumber}:</span>
                      <span className={styles.lineText}>{m.lineContent}</span>
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
