import { SearchService, SearchQuery, SearchMatch } from './types';
import { MockFileSystemService } from './fileSystem';

export class MockSearchService implements SearchService {
  private fs: MockFileSystemService;

  constructor(fs: MockFileSystemService) {
    this.fs = fs;
  }

  async searchText(query: SearchQuery): Promise<SearchMatch[]> {
    if (!query.query || !query.query.trim()) return [];

    const matches: SearchMatch[] = [];
    const files = this.fs.getAllFiles();

    let pattern: RegExp;
    try {
      let flags = 'g';
      if (!query.isCaseSensitive) flags += 'i';

      let q = query.query;
      if (!query.isRegex) {
        q = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      if (query.matchWholeWord) {
        q = `\\b${q}\\b`;
      }
      pattern = new RegExp(q, flags);
    } catch {
      return [];
    }

    for (const [filePath, content] of files.entries()) {
      if (query.includePattern && !filePath.includes(query.includePattern)) continue;
      if (query.excludePattern && filePath.includes(query.excludePattern)) continue;

      const lines = content.split('\n');
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const lineText = lines[lineIdx]!;
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(lineText)) !== null) {
          matches.push({
            path: filePath,
            lineNumber: lineIdx + 1,
            column: match.index + 1,
            lineContent: lineText.trim(),
            matchLength: match[0].length,
          });

          if (!pattern.global) break;
        }
      }
    }

    return matches;
  }
}
