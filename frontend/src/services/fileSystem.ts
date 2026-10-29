import { FileSystemService, FileEntry, FileStat } from './types';

export const SEEDED_FILES: Record<string, string> = {
  'package.json': `{
  "name": "sample-workspace",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
`,
  'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true
  },
  "include": ["src"]
}
`,
  '.gitignore': `node_modules/
dist/
.env
*.log
`,
  'README.md': `# Sample Workspace

Demo workspace for testing Ajson Studio features:
- Monaco Editor & Syntax Highlighting
- Integrated Shell & Terminal
- Git Staging & Diffing
- Problems & Diagnostics Aggregation
`,
  // Deliberate demo problem 1 & 2 & 3 & 4 (type error, unused variable, TODO/FIXME, console.log)
  'src/App.tsx': `import React from 'react';

// Demo Problem: Deliberate unused variable
const unusedApiKey = 'secret_token_12345';

export const App: React.FC = () => {
  // Demo Problem: Deliberate console.log
  console.log('App component rendered inside sample project');

  // TODO: implement caching layer for data queries
  // FIXME: handle null pointer edge case when user profile is undefined

  // Demo Problem: Deliberate TypeScript type error (assigning string to number)
  const userScore: number = 'not-a-number';

  return (
    <main>
      <h1>Ajson Studio Demo App</h1>
      <p>Score: {userScore}</p>
    </main>
  );
};
`,
  'src/main.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
  'src/utils/math.ts': `/**
 * Math utility functions
 */
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
`,
  // Deliberate demo problem 5 (intentionally invalid json in /fixtures)
  'fixtures/broken.json': `{
  "title": "Broken Json Fixture",
  "valid": false,
  "syntaxError": unquoted_value_here
}
`,
  'fixtures/valid.json': `{
  "title": "Valid Fixture",
  "count": 42,
  "tags": ["demo", "ajson"]
}
`,
};

export class MockFileSystemService implements FileSystemService {
  private files: Map<string, string>;
  private directories: Set<string>;
  private listeners: Set<(event: 'change' | 'add' | 'unlink', path: string) => void> = new Set();

  constructor(initialFiles: Record<string, string> = SEEDED_FILES) {
    this.files = new Map();
    this.directories = new Set(['', 'src', 'src/utils', 'fixtures']);

    for (const [filePath, content] of Object.entries(initialFiles)) {
      const normalized = this.normalize(filePath);
      this.files.set(normalized, content);
      this.ensureParentDirs(normalized);
    }
  }

  private normalize(p: string): string {
    return p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  }

  private ensureParentDirs(filePath: string) {
    const parts = filePath.split('/');
    let current = '';
    for (let i = 0; i < parts.length - 1; i++) {
      current = current ? `${current}/${parts[i]}` : parts[i]!;
      this.directories.add(current);
    }
  }

  private notify(event: 'change' | 'add' | 'unlink', path: string) {
    for (const listener of this.listeners) {
      try {
        listener(event, path);
      } catch (err) {
        console.error('Error in FS watcher listener', err);
      }
    }
  }

  async readDir(dirPath: string): Promise<FileEntry[]> {
    const norm = this.normalize(dirPath);
    const results: FileEntry[] = [];
    const directChildDirs = new Set<string>();

    // Collect child directories
    for (const dir of this.directories) {
      if (!dir) continue;
      if (norm === '') {
        if (!dir.includes('/')) {
          directChildDirs.add(dir);
        }
      } else if (dir.startsWith(norm + '/') && dir.indexOf('/', norm.length + 1) === -1) {
        directChildDirs.add(dir.slice(norm.length + 1));
      }
    }

    for (const d of directChildDirs) {
      results.push({
        name: d,
        path: norm ? `${norm}/${d}` : d,
        isDirectory: true,
      });
    }

    // Collect child files
    for (const [filePath, content] of this.files.entries()) {
      if (norm === '') {
        if (!filePath.includes('/')) {
          results.push({
            name: filePath,
            path: filePath,
            isDirectory: false,
            size: content.length,
          });
        }
      } else if (filePath.startsWith(norm + '/') && filePath.indexOf('/', norm.length + 1) === -1) {
        const name = filePath.slice(norm.length + 1);
        results.push({
          name,
          path: filePath,
          isDirectory: false,
          size: content.length,
        });
      }
    }

    // Sort: directories first, then alphabetical
    results.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return results;
  }

  async readFile(filePath: string): Promise<string> {
    const norm = this.normalize(filePath);
    const content = this.files.get(norm);
    if (content === undefined) {
      throw new Error(`File not found: ${filePath}`);
    }
    return content;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const norm = this.normalize(filePath);
    const exists = this.files.has(norm);
    this.files.set(norm, content);
    this.ensureParentDirs(norm);
    this.notify(exists ? 'change' : 'add', norm);
  }

  async createFile(filePath: string, content: string = ''): Promise<void> {
    const norm = this.normalize(filePath);
    if (this.files.has(norm)) {
      throw new Error(`File already exists: ${filePath}`);
    }
    this.files.set(norm, content);
    this.ensureParentDirs(norm);
    this.notify('add', norm);
  }

  async createDir(dirPath: string): Promise<void> {
    const norm = this.normalize(dirPath);
    this.directories.add(norm);
    this.ensureParentDirs(norm);
    this.notify('add', norm);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const normOld = this.normalize(oldPath);
    const normNew = this.normalize(newPath);

    if (this.files.has(normOld)) {
      const content = this.files.get(normOld)!;
      this.files.delete(normOld);
      this.files.set(normNew, content);
      this.ensureParentDirs(normNew);
      this.notify('unlink', normOld);
      this.notify('add', normNew);
      return;
    }

    if (this.directories.has(normOld)) {
      this.directories.delete(normOld);
      this.directories.add(normNew);
      // Update child files
      for (const [fPath, content] of Array.from(this.files.entries())) {
        if (fPath.startsWith(normOld + '/')) {
          const updated = normNew + fPath.slice(normOld.length);
          this.files.delete(fPath);
          this.files.set(updated, content);
          this.ensureParentDirs(updated);
        }
      }
      this.notify('unlink', normOld);
      this.notify('add', normNew);
      return;
    }

    throw new Error(`Path not found to rename: ${oldPath}`);
  }

  async delete(targetPath: string): Promise<void> {
    const norm = this.normalize(targetPath);

    if (this.files.has(norm)) {
      this.files.delete(norm);
      this.notify('unlink', norm);
      return;
    }

    if (this.directories.has(norm)) {
      this.directories.delete(norm);
      // Delete child files
      for (const fPath of Array.from(this.files.keys())) {
        if (fPath.startsWith(norm + '/')) {
          this.files.delete(fPath);
          this.notify('unlink', fPath);
        }
      }
      this.notify('unlink', norm);
      return;
    }

    throw new Error(`Path not found to delete: ${targetPath}`);
  }

  async stat(targetPath: string): Promise<FileStat | null> {
    const norm = this.normalize(targetPath);
    if (this.directories.has(norm) || norm === '') {
      return { isDirectory: true, size: 0, mtime: Date.now() };
    }
    const content = this.files.get(norm);
    if (content !== undefined) {
      return { isDirectory: false, size: content.length, mtime: Date.now() };
    }
    return null;
  }

  async exists(targetPath: string): Promise<boolean> {
    const norm = this.normalize(targetPath);
    return norm === '' || this.directories.has(norm) || this.files.has(norm);
  }

  watch(cb: (event: 'change' | 'add' | 'unlink', path: string) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  // Helper for Git & Search
  getAllFiles(): Map<string, string> {
    return new Map(this.files);
  }
}
