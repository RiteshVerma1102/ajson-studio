/**
 * Native search service: uses ripgrep (rg) when available, falls back to
 * a pure-Node recursive grep.
 *
 * All paths are jail-checked via PathGuard before use.
 * Implements SearchService from @ajson/contracts.
 */
import { execFile } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {
  SearchService,
  SearchQuery,
  SearchMatch,
  AjsonError,
  ErrorCode,
} from '@ajson/contracts';
import { PathGuard } from '../security/pathGuard';

const MAX_RESULTS = 500;
const MAX_LINE_LENGTH = 2000;

// Binary file extensions skipped by fallback grep
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
  '.pdf', '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.wasm',
  '.mp4', '.mp3', '.wav', '.ogg', '.webm',
  '.ttf', '.otf', '.woff', '.woff2',
  '.db', '.sqlite', '.sqlite3',
]);

function isBinaryExt(filePath: string): boolean {
  return BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

// ---------------------------------------------------------------------------
// ripgrep detection
// ---------------------------------------------------------------------------

let _rgPath: string | null | undefined = undefined;

function findRg(): string | null {
  if (_rgPath !== undefined) return _rgPath;
  const candidates =
    process.platform === 'win32'
      ? ['rg.exe', 'C:\\Program Files\\ripgrep\\rg.exe']
      : ['rg', '/usr/bin/rg', '/usr/local/bin/rg'];

  for (const c of candidates) {
    try {
      execFileSync(c, ['--version'], { stdio: 'ignore' });
      _rgPath = c;
      return _rgPath;
    } catch {
      /* not found */
    }
  }
  _rgPath = null;
  return null;
}

// ---------------------------------------------------------------------------
// ripgrep search
// ---------------------------------------------------------------------------

function searchWithRg(
  pattern: string,
  workspaceRoot: string,
  opts: SearchQuery
): Promise<SearchMatch[]> {
  return new Promise((resolve, reject) => {
    const rg = findRg()!;
    const args: string[] = [
      '--json',
      '--max-count', String(MAX_RESULTS),
      '--max-filesize', '5M',
    ];

    if (!opts.isCaseSensitive) args.push('--ignore-case');
    if (!opts.isRegex) args.push('--fixed-strings');
    if (opts.matchWholeWord) args.push('--word-regexp');
    if (opts.includePattern) args.push('--glob', opts.includePattern);
    if (opts.excludePattern) args.push('--glob', `!${opts.excludePattern}`);

    args.push('--', pattern, workspaceRoot);

    execFile(rg, args, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
      if (err) {
        // ripgrep exits with code 1 when no matches are found — that is NOT an error.
        // Node's execFile populates err.code / err.status with the numeric exit code.
        const exitCode = (err as { code?: number | string; status?: number }).code ??
                         (err as { code?: number | string; status?: number }).status;
        const noMatchesExit =
          exitCode === 1 ||
          exitCode === '1' ||
          err.message.includes('exited with code 1');

        if (!noMatchesExit) {
          reject(new AjsonError(ErrorCode.PROCESS_FAILED, `rg failed: ${err.message}`));
          return;
        }
      }

      const matches: SearchMatch[] = [];
      for (const line of stdout.split('\n')) {
        if (!line.trim()) continue;
        let msg: { type?: string; data?: unknown };
        try { msg = JSON.parse(line); } catch { continue; }

        if (msg.type !== 'match') continue;
        const d = msg.data as {
          path: { text: string };
          line_number: number;
          lines: { text: string };
          submatches: { match: { text: string }; start: number; end: number }[];
        };

        const relPath = path.relative(workspaceRoot, d.path.text).replace(/\\/g, '/');
        const lineContent = d.lines.text.replace(/\n$/, '').slice(0, MAX_LINE_LENGTH);

        for (const sub of d.submatches) {
          matches.push({
            path: relPath,
            lineNumber: d.line_number,
            column: sub.start + 1,
            lineContent,
            matchLength: sub.match.text.length,
          });
          if (matches.length >= MAX_RESULTS) break;
        }
        if (matches.length >= MAX_RESULTS) break;
      }

      resolve(matches);
    });
  });
}

// ---------------------------------------------------------------------------
// Pure-Node fallback search
// ---------------------------------------------------------------------------

async function* walkDir(dir: string): AsyncGenerator<string> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walkDir(full);
    } else if (e.isFile() && !isBinaryExt(full)) {
      yield full;
    }
  }
}

async function searchWithNode(
  pattern: string,
  workspaceRoot: string,
  opts: SearchQuery
): Promise<SearchMatch[]> {
  const flags = opts.isCaseSensitive ? 'g' : 'gi';
  let re: RegExp;
  const escapedPattern = opts.isRegex
    ? pattern
    : pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordBoundary = opts.matchWholeWord ? `\\b${escapedPattern}\\b` : escapedPattern;

  try {
    re = new RegExp(wordBoundary, flags);
  } catch {
    throw new AjsonError(ErrorCode.INVALID_PAYLOAD, `Invalid search pattern: "${pattern}"`);
  }

  const matches: SearchMatch[] = [];

  for await (const filePath of walkDir(workspaceRoot)) {
    if (matches.length >= MAX_RESULTS) break;

    const relPath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');

    try {
      const rl = readline.createInterface({
        input: fs.createReadStream(filePath, { encoding: 'utf8' }),
        crlfDelay: Infinity,
      });

      let lineNo = 0;
      for await (const rawLine of rl) {
        lineNo++;
        const lineContent = rawLine.slice(0, MAX_LINE_LENGTH);
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(lineContent)) !== null) {
          matches.push({
            path: relPath,
            lineNumber: lineNo,
            column: m.index + 1,
            lineContent,
            matchLength: m[0].length,
          });
          if (matches.length >= MAX_RESULTS) break;
          if (!re.global) break;
        }
        if (matches.length >= MAX_RESULTS) break;
      }
    } catch {
      /* skip unreadable files */
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// NativeSearchService
// ---------------------------------------------------------------------------

export class NativeSearchService implements SearchService {
  private guard: PathGuard;

  constructor(workspaceRoot: string) {
    this.guard = new PathGuard(workspaceRoot);
  }

  async searchText(query: SearchQuery): Promise<SearchMatch[]> {
    const { query: pattern } = query;
    if (!pattern || pattern.trim().length === 0) return [];

    const root = this.guard.getWorkspaceRoot();

    try {
      if (findRg()) {
        return await searchWithRg(pattern, root, query);
      }
      return await searchWithNode(pattern, root, query);
    } catch (err: unknown) {
      if (err instanceof AjsonError) throw err;
      throw new AjsonError(
        ErrorCode.IO_ERROR,
        `Search failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
