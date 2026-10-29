import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { NativeSearchService } from '../services/nativeSearch';

describe('Backend NativeSearchService', () => {
  let tmpDir: string;
  let searchService: NativeSearchService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajson-search-'));
    searchService = new NativeSearchService(tmpDir);

    // Create test files
    fs.writeFileSync(
      path.join(tmpDir, 'main.ts'),
      'function computeAnswer(): number {\n  const secretAnswer = 42;\n  return secretAnswer;\n}\n'
    );
    fs.mkdirSync(path.join(tmpDir, 'sub'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'sub', 'helper.ts'),
      'export const answerHelper = () => {\n  console.log("secretAnswer in helper");\n};\n'
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('finds text occurrences recursively across files in workspace', async () => {
    const matches = await searchService.searchText({
      query: 'secretAnswer',
    });

    expect(matches.length).toBeGreaterThanOrEqual(2);
    const paths = matches.map((m) => m.path.replace(/\\/g, '/'));
    expect(paths).toContain('main.ts');
    expect(paths).toContain('sub/helper.ts');

    const mainMatch = matches.find((m) => m.path.replace(/\\/g, '/') === 'main.ts');
    expect(mainMatch).toBeDefined();
    expect(mainMatch?.lineNumber).toBe(2);
    expect(mainMatch?.lineContent).toContain('const secretAnswer = 42;');
  });

  it('respects case-sensitivity flag', async () => {
    const matchesLower = await searchService.searchText({
      query: 'secretanswer',
      isCaseSensitive: true,
    });
    expect(matchesLower).toHaveLength(0);

    const matchesInsensitive = await searchService.searchText({
      query: 'secretanswer',
      isCaseSensitive: false,
    });
    expect(matchesInsensitive.length).toBeGreaterThanOrEqual(2);
  });

  it('respects matchWholeWord flag', async () => {
    const wholeWordMatches = await searchService.searchText({
      query: 'secret',
      matchWholeWord: true,
    });
    expect(wholeWordMatches).toHaveLength(0);

    const partialMatches = await searchService.searchText({
      query: 'secret',
      matchWholeWord: false,
    });
    expect(partialMatches.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty array when search query is empty string', async () => {
    const matches = await searchService.searchText({ query: '   ' });
    expect(matches).toEqual([]);
  });
});
