import {
  IndexService,
  IndexSymbol,
  IndexStatus,
} from '@ajson/contracts';
import { MockFileSystemService } from './fileSystem';

export class MockIndexService implements IndexService {
  private fs: MockFileSystemService;
  private isIndexing: boolean = false;
  private indexedCount: number = 0;

  constructor(fs: MockFileSystemService) {
    this.fs = fs;
  }

  async indexWorkspace(): Promise<void> {
    this.isIndexing = true;
    const allFiles = Array.from(this.fs.getAllFiles().keys());
    this.indexedCount = allFiles.length;
    this.isIndexing = false;
  }

  async searchSymbols(query: string, limit: number = 20): Promise<IndexSymbol[]> {
    if (!query || !query.trim()) return [];
    const q = query.toLowerCase();
    const symbols: IndexSymbol[] = [];

    for (const [path, content] of this.fs.getAllFiles().entries()) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        // Simple regex to detect functions, classes, interfaces
        const match = /(?:class|interface|function|const|let|type)\s+([a-zA-Z0-9_$]+)/.exec(line);
        if (match && match[1] && match[1].toLowerCase().includes(q)) {
          symbols.push({
            name: match[1],
            kind: line.includes('class')
              ? 'class'
              : line.includes('interface')
              ? 'interface'
              : line.includes('function')
              ? 'function'
              : 'variable',
            path,
            line: i + 1,
            column: match.index + 1,
          });
          if (symbols.length >= limit) return symbols;
        }
      }
    }

    return symbols;
  }

  async getStatus(): Promise<IndexStatus> {
    const total = this.fs.getAllFiles().size;
    return {
      isIndexing: this.isIndexing,
      indexedFiles: this.indexedCount || total,
      totalFiles: total,
      lastIndexedAt: Date.now(),
    };
  }
}
