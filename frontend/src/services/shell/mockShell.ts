import { MockFileSystemService } from '../fileSystem';
import { GitService, DiagnosticsService } from '../types';
import { safeStorage } from '../../state/storage';

export interface ShellOptions {
  cwd?: string;
  shell?: 'bash' | 'zsh' | 'pwsh';
  fs: MockFileSystemService;
  git: GitService;
  diagnostics?: DiagnosticsService;
}

export class MockShell {
  private cwd: string = '';
  private shellFlavor: 'bash' | 'zsh' | 'pwsh';
  private fs: MockFileSystemService;
  private git: GitService;
  private diagnostics?: DiagnosticsService;

  private lineBuffer: string = '';
  private cursorIndex: number = 0;
  private history: string[] = [];
  private historyIndex: number = -1;
  private env: Map<string, string> = new Map();

  private isRunningAsync: boolean = false;
  private abortController: AbortController | null = null;

  public onOutput?: (data: string) => void;
  public onCommandStart?: (cmd: string) => void;
  public onCommandEnd?: (cmd: string, exitCode: number) => void;
  public onExit?: (code: number) => void;

  constructor(opts: ShellOptions) {
    this.fs = opts.fs;
    this.git = opts.git;
    this.diagnostics = opts.diagnostics;
    this.cwd = opts.cwd || '';
    this.shellFlavor = opts.shell || 'bash';

    this.env.set('USER', 'ajson');
    this.env.set('HOME', '/home/ajson');
    this.env.set('NODE_ENV', 'development');

    this.loadHistory();
  }

  private loadHistory() {
    try {
      const raw = safeStorage.getItem('ajson_shell_history');
      if (raw) {
        this.history = JSON.parse(raw);
      }
    } catch {
      this.history = [];
    }
  }

  private saveHistory() {
    try {
      safeStorage.setItem('ajson_shell_history', JSON.stringify(this.history.slice(-100)));
    } catch {
      // Ignore
    }
  }

  public getCwd(): string {
    return this.cwd;
  }

  public async init() {
    this.writeWelcome();
    await this.renderPrompt();
  }

  private write(data: string) {
    this.onOutput?.(data);
  }

  private writeLine(line: string = '') {
    this.write(line + '\r\n');
  }

  private writeWelcome() {
    this.writeLine('\x1b[38;2;0;242;254m╔═══════════════════════════════════════════════════════════════╗\x1b[0m');
    this.writeLine('\x1b[38;2;0;242;254m║           Ajson Studio — Virtual Embedded Shell v0.1.0        ║\x1b[0m');
    this.writeLine('\x1b[38;2;0;242;254m╚═══════════════════════════════════════════════════════════════╝\x1b[0m');
    this.writeLine('Type \x1b[1mhelp\x1b[0m to list available commands, or \x1b[1mnpm run <script>\x1b[0m to run project tasks.\r\n');
  }

  public async renderPrompt() {
    let branch = '';
    try {
      branch = await this.git.currentBranch();
    } catch {
      branch = 'main';
    }

    const displayCwd = this.cwd ? `/${this.cwd}` : '~';

    if (this.shellFlavor === 'pwsh') {
      this.write(`\x1b[38;2;0;242;254mPS ${displayCwd} [\x1b[38;2;245;158;11m${branch}\x1b[38;2;0;242;254m]>\x1b[0m `);
    } else {
      // bash / zsh
      this.write(
        `\x1b[38;2;16;185;129majson@desktop\x1b[0m:\x1b[38;2;56;189;248m${displayCwd}\x1b[0m (\x1b[38;2;245;158;11m${branch}\x1b[0m)$ `
      );
    }
  }

  public handleInput(data: string) {
    if (this.isRunningAsync) {
      // Ctrl+C during long-running command cancels it
      if (data === '\x03') {
        this.abortController?.abort();
        this.writeLine('^C');
      }
      return;
    }

    for (let i = 0; i < data.length; i++) {
      const char = data[i]!;

      // Carriage return / Enter
      if (char === '\r' || char === '\n') {
        const cmd = this.lineBuffer.trim();
        this.writeLine();
        this.lineBuffer = '';
        this.cursorIndex = 0;
        this.historyIndex = -1;

        if (cmd) {
          this.history.push(cmd);
          this.saveHistory();
          this.executeCommandLine(cmd);
        } else {
          void this.renderPrompt();
        }
        return;
      }

      // Backspace (\x7F or \x08)
      if (char === '\x7F' || char === '\x08') {
        if (this.cursorIndex > 0) {
          const before = this.lineBuffer.slice(0, this.cursorIndex - 1);
          const after = this.lineBuffer.slice(this.cursorIndex);
          this.lineBuffer = before + after;
          this.cursorIndex--;

          // Move cursor left, rewrite tail, erase leftover char, move cursor back
          this.write('\b');
          this.write(after + ' ');
          this.write(`\x1b[${after.length + 1}D`);
        }
        continue;
      }

      // Tab completion
      if (char === '\t') {
        void this.handleTabCompletion();
        continue;
      }

      // Escape sequences (arrows, home, end, etc.)
      if (char === '\x1b') {
        const remaining = data.slice(i);
        if (remaining.startsWith('\x1b[A')) {
          // Arrow Up
          this.handleHistory(-1);
          i += 2;
          continue;
        } else if (remaining.startsWith('\x1b[B')) {
          // Arrow Down
          this.handleHistory(1);
          i += 2;
          continue;
        } else if (remaining.startsWith('\x1b[C')) {
          // Arrow Right
          if (this.cursorIndex < this.lineBuffer.length) {
            this.cursorIndex++;
            this.write('\x1b[C');
          }
          i += 2;
          continue;
        } else if (remaining.startsWith('\x1b[D')) {
          // Arrow Left
          if (this.cursorIndex > 0) {
            this.cursorIndex--;
            this.write('\x1b[D');
          }
          i += 2;
          continue;
        } else if (remaining.startsWith('\x1b[H') || remaining.startsWith('\x1b[1~')) {
          // Home
          this.setCursor(0);
          i += remaining.startsWith('\x1b[1~') ? 3 : 2;
          continue;
        } else if (remaining.startsWith('\x1b[F') || remaining.startsWith('\x1b[4~')) {
          // End
          this.setCursor(this.lineBuffer.length);
          i += remaining.startsWith('\x1b[4~') ? 3 : 2;
          continue;
        }
      }

      // Ctrl+C: Cancel current line
      if (char === '\x03') {
        this.writeLine('^C');
        this.lineBuffer = '';
        this.cursorIndex = 0;
        void this.renderPrompt();
        continue;
      }

      // Ctrl+U: Erase line before cursor
      if (char === '\x15') {
        this.clearCurrentLine();
        this.lineBuffer = '';
        this.cursorIndex = 0;
        continue;
      }

      // Ctrl+A: Move to beginning
      if (char === '\x01') {
        this.setCursor(0);
        continue;
      }

      // Ctrl+E: Move to end
      if (char === '\x05') {
        this.setCursor(this.lineBuffer.length);
        continue;
      }

      // Ctrl+K: Delete from cursor to end
      if (char === '\x0b') {
        const len = this.lineBuffer.length - this.cursorIndex;
        this.lineBuffer = this.lineBuffer.slice(0, this.cursorIndex);
        this.write(' '.repeat(len) + `\x1b[${len}D`);
        continue;
      }

      // Ctrl+W: Delete word backward
      if (char === '\x17') {
        if (this.cursorIndex > 0) {
          const before = this.lineBuffer.slice(0, this.cursorIndex);
          const match = before.match(/(\s*\S+\s*)$/);
          if (match) {
            const count = match[0].length;
            const newCursor = this.cursorIndex - count;
            this.lineBuffer = this.lineBuffer.slice(0, newCursor) + this.lineBuffer.slice(this.cursorIndex);
            this.cursorIndex = newCursor;
            this.clearCurrentLine();
            this.write(this.lineBuffer);
            const moveBack = this.lineBuffer.length - this.cursorIndex;
            if (moveBack > 0) this.write(`\x1b[${moveBack}D`);
          }
        }
        continue;
      }

      // Ctrl+L: Clear screen
      if (char === '\x0c') {
        this.write('\x1b[2J\x1b[H');
        void this.renderPrompt();
        this.write(this.lineBuffer);
        continue;
      }

      // Normal printable characters
      if (char >= ' ') {
        const before = this.lineBuffer.slice(0, this.cursorIndex);
        const after = this.lineBuffer.slice(this.cursorIndex);
        this.lineBuffer = before + char + after;
        this.cursorIndex++;

        this.write(char + after);
        if (after.length > 0) {
          this.write(`\x1b[${after.length}D`);
        }
      }
    }
  }

  private clearCurrentLine() {
    this.write(`\x1b[2K\r`);
    void this.renderPrompt();
  }

  private setCursor(pos: number) {
    const delta = pos - this.cursorIndex;
    if (delta > 0) {
      this.write(`\x1b[${delta}C`);
    } else if (delta < 0) {
      this.write(`\x1b[${-delta}D`);
    }
    this.cursorIndex = pos;
  }

  private handleHistory(direction: number) {
    if (this.history.length === 0) return;

    if (direction === -1) {
      // Up
      if (this.historyIndex === -1) {
        this.historyIndex = this.history.length - 1;
      } else if (this.historyIndex > 0) {
        this.historyIndex--;
      }
    } else {
      // Down
      if (this.historyIndex !== -1) {
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
        } else {
          this.historyIndex = -1;
          this.clearCurrentLine();
          this.lineBuffer = '';
          this.cursorIndex = 0;
          return;
        }
      }
    }

    const item = this.history[this.historyIndex];
    if (item !== undefined) {
      this.clearCurrentLine();
      this.lineBuffer = item;
      this.cursorIndex = item.length;
      this.write(item);
    }
  }

  private async handleTabCompletion() {
    const tokens = this.lineBuffer.split(' ');
    const lastToken = tokens[tokens.length - 1] || '';

    // If first token, complete commands
    if (tokens.length === 1) {
      const builtins = [
        'help', 'clear', 'pwd', 'cd', 'ls', 'cat', 'echo', 'touch', 'mkdir', 'rm',
        'mv', 'cp', 'head', 'tail', 'wc', 'grep', 'find', 'tree', 'seq', 'history',
        'whoami', 'date', 'node', 'npm', 'git', 'exit'
      ];
      const matches = builtins.filter((c) => c.startsWith(lastToken));
      if (matches.length === 1) {
        const completed = matches[0]! + ' ';
        this.lineBuffer = completed;
        this.cursorIndex = completed.length;
        this.clearCurrentLine();
        this.write(completed);
      } else if (matches.length > 1) {
        this.writeLine();
        this.writeLine(matches.join('  '));
        await this.renderPrompt();
        this.write(this.lineBuffer);
      }
      return;
    }

    // Otherwise complete paths in cwd
    try {
      const entries = await this.fs.readDir(this.cwd);
      const matches = entries
        .map((e) => (e.isDirectory ? e.name + '/' : e.name))
        .filter((name) => name.startsWith(lastToken));

      if (matches.length === 1) {
        tokens[tokens.length - 1] = matches[0]!;
        const completed = tokens.join(' ');
        this.lineBuffer = completed;
        this.cursorIndex = completed.length;
        this.clearCurrentLine();
        this.write(completed);
      } else if (matches.length > 1) {
        this.writeLine();
        this.writeLine(matches.join('  '));
        await this.renderPrompt();
        this.write(this.lineBuffer);
      }
    } catch {
      // Ignore
    }
  }

  public async executeCommandLine(raw: string): Promise<number> {
    this.onCommandStart?.(raw);

    // Support sequential chaining with &&, ||, ;
    const parts = this.splitChainedCommands(raw);
    let lastCode = 0;

    for (const part of parts) {
      if (part.op === '&&' && lastCode !== 0) break;
      if (part.op === '||' && lastCode === 0) break;

      lastCode = await this.executeSingleCommand(part.command);
    }

    this.onCommandEnd?.(raw, lastCode);
    await this.renderPrompt();
    return lastCode;
  }

  private splitChainedCommands(input: string): { command: string; op?: '&&' | '||' | ';' }[] {
    const results: { command: string; op?: '&&' | '||' | ';' }[] = [];
    const regex = /(&&|\|\||;)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    let prevOp: '&&' | '||' | ';' | undefined = undefined;

    while ((match = regex.exec(input)) !== null) {
      const cmd = input.slice(lastIndex, match.index).trim();
      if (cmd) {
        results.push({ command: cmd, op: prevOp });
      }
      prevOp = match[0] as '&&' | '||' | ';';
      lastIndex = match.index + match[0].length;
    }

    const finalCmd = input.slice(lastIndex).trim();
    if (finalCmd) {
      results.push({ command: finalCmd, op: prevOp });
    }

    return results;
  }

  private async executeSingleCommand(cmdStr: string): Promise<number> {
    // Check for redirects: > and >>
    let redirectFile: string | null = null;
    let appendRedirect = false;

    let processed = cmdStr;
    const appendMatch = cmdStr.match(/>>\s*(\S+)/);
    if (appendMatch && appendMatch.index !== undefined) {
      redirectFile = appendMatch[1]!;
      appendRedirect = true;
      processed = cmdStr.slice(0, appendMatch.index).trim();
    } else {
      const outMatch = cmdStr.match(/>\s*(\S+)/);
      if (outMatch && outMatch.index !== undefined) {
        redirectFile = outMatch[1]!;
        appendRedirect = false;
        processed = cmdStr.slice(0, outMatch.index).trim();
      }
    }

    // Check for pipes |
    const pipeCommands = processed.split('|').map((s) => s.trim());
    if (pipeCommands.length > 1) {
      return this.executePipeChain(pipeCommands, redirectFile, appendRedirect);
    }

    // Parse arguments respecting quotes
    const argv = this.parseArgs(processed);
    if (argv.length === 0) return 0;

    const [cmd, ...args] = argv;

    // Capture output if redirected
    let redirectedOutput = '';
    const captureWrite = (text: string) => {
      if (redirectFile) {
        redirectedOutput += text;
      } else {
        this.write(text);
      }
    };
    const captureWriteLine = (text: string = '') => {
      if (redirectFile) {
        redirectedOutput += text + '\n';
      } else {
        this.writeLine(text);
      }
    };

    const exitCode = await this.dispatchCommand(cmd!, args, captureWrite, captureWriteLine);

    if (redirectFile && redirectedOutput) {
      try {
        const fullPath = this.resolvePath(redirectFile);
        if (appendRedirect) {
          let existing = '';
          try {
            existing = await this.fs.readFile(fullPath);
          } catch {
            existing = '';
          }
          await this.fs.writeFile(fullPath, existing + redirectedOutput);
        } else {
          await this.fs.writeFile(fullPath, redirectedOutput);
        }
      } catch (err: unknown) {
        this.writeLine(`\x1b[31mbash: ${redirectFile}: ${(err as Error).message}\x1b[0m`);
        return 1;
      }
    }

    return exitCode;
  }

  private parseArgs(commandStr: string): string[] {
    const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
    const args: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(commandStr)) !== null) {
      if (match[1] !== undefined) {
        args.push(match[1]);
      } else if (match[2] !== undefined) {
        args.push(match[2]);
      } else {
        args.push(match[0]);
      }
    }

    return args;
  }

  private resolvePath(target: string): string {
    if (target === '~' || target === '') return '';
    if (target.startsWith('/')) target = target.slice(1);

    const parts = (this.cwd ? `${this.cwd}/${target}` : target).split('/');
    const resolved: string[] = [];

    for (const p of parts) {
      if (!p || p === '.') continue;
      if (p === '..') {
        if (resolved.length === 0) {
          // Block escaping workspace root
          continue;
        }
        resolved.pop();
      } else {
        resolved.push(p);
      }
    }

    return resolved.join('/');
  }

  private async dispatchCommand(
    cmd: string,
    args: string[],
    write: (text: string) => void,
    writeLine: (text: string) => void
  ): Promise<number> {
    switch (cmd) {
      case 'help':
        writeLine('Ajson Studio Builtin Commands:');
        writeLine('  pwd, cd, ls, cat, echo, touch, mkdir, rm, mv, cp');
        writeLine('  head, tail, wc, grep, find, tree, seq, history');
        writeLine('  whoami, date, node -v, npm -v, which, env, clear, exit');
        writeLine('  git <status|add|restore|commit|log|branch|checkout|diff|stash>');
        writeLine('  npm run <dev|build|typecheck|lint|test>');
        return 0;

      case 'clear':
        this.write('\x1b[2J\x1b[H');
        return 0;

      case 'pwd':
        writeLine('/' + this.cwd);
        return 0;

      case 'cd': {
        const dest = args[0] || '';
        if (dest === '' || dest === '~') {
          this.cwd = '';
          return 0;
        }
        const resolved = this.resolvePath(dest);
        const stat = await this.fs.stat(resolved);
        if (!stat || !stat.isDirectory) {
          writeLine(`\x1b[31mcd: no such file or directory: ${dest}\x1b[0m`);
          return 1;
        }
        this.cwd = resolved;
        return 0;
      }

      case 'ls': {
        const showAll = args.includes('-a') || args.includes('-la') || args.includes('-al');
        const showLong = args.includes('-l') || args.includes('-la') || args.includes('-al');
        const pathArg = args.find((a) => !a.startsWith('-')) || '';
        const targetDir = this.resolvePath(pathArg);

        try {
          const entries = await this.fs.readDir(targetDir);
          const visibleEntries = showAll ? entries : entries.filter((e) => !e.name.startsWith('.'));
          if (showLong) {
            writeLine(`total ${visibleEntries.length}`);
            for (const e of visibleEntries) {
              const perm = e.isDirectory ? 'drwxr-xr-x' : '-rw-r--r--';
              const size = (e.size || 0).toString().padStart(6, ' ');
              const name = e.isDirectory ? `\x1b[38;2;56;189;248m${e.name}/\x1b[0m` : e.name;
              writeLine(`${perm} 1 ajson ajson ${size} Oct 24 22:00 ${name}`);
            }
          } else {
            const formatted = visibleEntries
              .map((e) => (e.isDirectory ? `\x1b[38;2;56;189;248m${e.name}/\x1b[0m` : e.name))
              .join('  ');
            writeLine(formatted);
          }
          return 0;
        } catch (err: unknown) {
          writeLine(`\x1b[31mls: cannot access '${pathArg}': ${(err as Error).message}\x1b[0m`);
          return 1;
        }
      }

      case 'cat': {
        if (args.length === 0) {
          writeLine('cat: missing operand');
          return 1;
        }
        for (const f of args) {
          try {
            const content = await this.fs.readFile(this.resolvePath(f));
            write(content);
            if (!content.endsWith('\n')) writeLine('');
          } catch {
            writeLine(`\x1b[31mcat: ${f}: No such file or directory\x1b[0m`);
            return 1;
          }
        }
        return 0;
      }

      case 'echo':
        writeLine(args.join(' '));
        return 0;

      case 'touch':
        for (const f of args) {
          try {
            const resolved = this.resolvePath(f);
            if (!(await this.fs.exists(resolved))) {
              await this.fs.createFile(resolved, '');
            }
          } catch (err: unknown) {
            writeLine(`\x1b[31mtouch: cannot touch '${f}': ${(err as Error).message}\x1b[0m`);
            return 1;
          }
        }
        return 0;

      case 'mkdir': {
        const pathArg = args.find((a) => !a.startsWith('-'));
        if (!pathArg) {
          writeLine('mkdir: missing operand');
          return 1;
        }
        try {
          await this.fs.createDir(this.resolvePath(pathArg));
          return 0;
        } catch (err: unknown) {
          writeLine(`\x1b[31mmkdir: ${(err as Error).message}\x1b[0m`);
          return 1;
        }
      }

      case 'rm': {
        const pathArg = args.find((a) => !a.startsWith('-'));
        if (!pathArg) {
          writeLine('rm: missing operand');
          return 1;
        }
        try {
          await this.fs.delete(this.resolvePath(pathArg));
          return 0;
        } catch (err: unknown) {
          writeLine(`\x1b[31mrm: cannot remove '${pathArg}': ${(err as Error).message}\x1b[0m`);
          return 1;
        }
      }

      case 'seq': {
        const count = parseInt(args[0] || '10', 10);
        return this.runBatchedSequence(count, writeLine);
      }

      case 'whoami':
        writeLine(this.env.get('USER') || 'ajson');
        return 0;

      case 'date':
        writeLine(new Date().toUTCString());
        return 0;

      case 'node':
        if (args[0] === '-v' || args[0] === '--version') {
          writeLine('v20.18.0');
          return 0;
        }
        writeLine('Welcome to Node.js v20.18.0 (Virtual)');
        return 0;

      case 'npm':
        if (args[0] === '-v' || args[0] === '--version') {
          writeLine('10.8.2');
          return 0;
        }
        if (args[0] === 'run') {
          return this.runNpmScript(args[1] || '', writeLine);
        }
        writeLine('Usage: npm run <script>');
        return 0;

      case 'git':
        return this.handleGitCommand(args, writeLine);

      default:
        writeLine(`\x1b[31mbash: ${cmd}: command not found\x1b[0m`);
        return 127;
    }
  }

  private async runBatchedSequence(
    count: number,
    _writeLine: (text: string) => void
  ): Promise<number> {
    this.isRunningAsync = true;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const limit = Math.min(count, 100000);
    const chunkSize = 2000;

    try {
      for (let i = 1; i <= limit; i += chunkSize) {
        if (signal.aborted) {
          return 130; // Terminated by Ctrl+C
        }

        const end = Math.min(i + chunkSize - 1, limit);
        let chunk = '';
        for (let j = i; j <= end; j++) {
          chunk += j + '\r\n';
        }
        this.write(chunk);

        // Yield to event loop to keep UI 60fps and allow Ctrl+C
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      return 0;
    } finally {
      this.isRunningAsync = false;
      this.abortController = null;
    }
  }

  private async runNpmScript(script: string, writeLine: (text: string) => void): Promise<number> {
    if (!script) {
      writeLine('npm run: missing script argument (e.g. npm run typecheck)');
      return 1;
    }

    this.writeLine(`> sample-workspace@1.0.0 ${script}`);

    if (script === 'typecheck') {
      this.writeLine('\x1b[34m$ tsc --noEmit\x1b[0m');
      await new Promise((r) => setTimeout(r, 120));

      // Publish real diagnostic to DiagnosticsService
      this.diagnostics?.publish('mock-tsc', 'src/App.tsx', [
        {
          source: 'mock-tsc',
          uri: 'src/App.tsx',
          message: "Type 'string' is not assignable to type 'number'.",
          severity: 'error',
          startLineNumber: 13,
          startColumn: 9,
          endLineNumber: 13,
          endColumn: 18,
          code: 2322,
        },
      ]);

      this.writeLine(
        '\x1b[31msrc/App.tsx:13:9 - error TS2322: Type \'string\' is not assignable to type \'number\'.\x1b[0m'
      );
      this.writeLine("13   const userScore: number = 'not-a-number';");
      this.writeLine('            ~~~~~~~~~');
      this.writeLine('\r\nFound 1 error in src/App.tsx:13');
      return 2;
    }

    if (script === 'lint') {
      this.writeLine('\x1b[34m$ eslint src/\x1b[0m');
      await new Promise((r) => setTimeout(r, 100));

      // Publish real diagnostic to DiagnosticsService
      this.diagnostics?.publish('mock-lint', 'src/App.tsx', [
        {
          source: 'mock-lint',
          uri: 'src/App.tsx',
          message: "'unusedApiKey' is assigned a value but never used.",
          severity: 'warning',
          startLineNumber: 4,
          startColumn: 7,
          endLineNumber: 4,
          endColumn: 19,
          code: '@typescript-eslint/no-unused-vars',
        },
      ]);

      this.writeLine(
        "\x1b[33msrc/App.tsx:4:7 - warning: 'unusedApiKey' is assigned a value but never used (@typescript-eslint/no-unused-vars)\x1b[0m"
      );
      this.writeLine('\r\n✖ 1 problem (0 errors, 1 warning)');
      return 0;
    }

    if (script === 'build') {
      this.writeLine('Building bundle for production...');
      await new Promise((r) => setTimeout(r, 150));
      this.writeLine('\x1b[31mError: Typecheck failed before bundling.\x1b[0m');
      this.writeLine("src/App.tsx:13:9 - error TS2322: Type 'string' is not assignable to type 'number'.");
      return 1;
    }

    if (script === 'test') {
      this.writeLine('\x1b[34m$ vitest run\x1b[0m');
      this.writeLine('✓ src/utils/math.test.ts (2 tests) 14ms');
      this.writeLine('\x1b[32mTest Files  1 passed (1)\x1b[0m');
      this.writeLine('\x1b[32mTests  2 passed (2)\x1b[0m');
      return 0;
    }

    if (script === 'dev') {
      this.writeLine('\x1b[32m  VITE v5.4.11  ready in 120 ms\x1b[0m');
      this.writeLine('  ➜  Local:   http://localhost:3000/');
      return 0;
    }

    writeLine(`npm ERR! Missing script: "${script}"`);
    return 1;
  }

  private async handleGitCommand(args: string[], writeLine: (text: string) => void): Promise<number> {
    const sub = args[0] || '';

    if (sub === 'status') {
      const statuses = await this.git.status();
      const branch = await this.git.currentBranch();
      writeLine(`On branch ${branch}`);
      if (statuses.length === 0) {
        writeLine('nothing to commit, working tree clean');
        return 0;
      }

      const staged = statuses.filter((s) => s.index !== '-');
      const unstaged = statuses.filter((s) => s.workTree !== '-');

      if (staged.length > 0) {
        writeLine('Changes to be committed:');
        for (const s of staged) {
          writeLine(`  \x1b[32m${s.index === 'A' ? 'new file:' : 'modified:'}   ${s.path}\x1b[0m`);
        }
      }

      if (unstaged.length > 0) {
        writeLine('Changes not staged for commit:');
        for (const s of unstaged) {
          writeLine(`  \x1b[31m${s.workTree === '?' ? 'untracked:' : 'modified:'}   ${s.path}\x1b[0m`);
        }
      }
      return 0;
    }

    if (sub === 'add') {
      const paths = args.slice(1);
      if (paths.length === 0 || paths.includes('.')) {
        const statuses = await this.git.status();
        await this.git.stage(statuses.map((s) => s.path));
      } else {
        await this.git.stage(paths);
      }
      return 0;
    }

    if (sub === 'restore') {
      if (args[1] === '--staged') {
        await this.git.unstage(args.slice(2));
      } else {
        await this.git.discard(args.slice(1));
      }
      return 0;
    }

    if (sub === 'commit') {
      let msg = '';
      const mIdx = args.indexOf('-m');
      if (mIdx !== -1 && args[mIdx + 1]) {
        msg = args[mIdx + 1]!;
      }
      if (!msg) {
        writeLine('error: -m <message> required');
        return 1;
      }
      const c = await this.git.commit(msg, { amend: args.includes('--amend') });
      const branch = await this.git.currentBranch();
      writeLine(`[${branch} ${c.hash}] ${c.message}`);
      return 0;
    }

    if (sub === 'log') {
      const commits = await this.git.log({ limit: 10 });
      for (const c of commits) {
        writeLine(`\x1b[33m${c.hash}\x1b[0m ${c.message}`);
      }
      return 0;
    }

    if (sub === 'branch') {
      const branches = await this.git.branches();
      for (const b of branches) {
        if (b.isCurrent) {
          writeLine(`* \x1b[32m${b.name}\x1b[0m`);
        } else {
          writeLine(`  ${b.name}`);
        }
      }
      return 0;
    }

    if (sub === 'checkout') {
      const isNew = args[1] === '-b';
      const target = isNew ? args[2] : args[1];
      if (!target) {
        writeLine('fatal: missing branch name');
        return 1;
      }
      try {
        if (isNew) {
          await this.git.createBranch(target);
        }
        await this.git.checkout(target);
        writeLine(`Switched to branch '${target}'`);
        return 0;
      } catch (err: unknown) {
        writeLine(`\x1b[31merror: ${(err as Error).message}\x1b[0m`);
        return 1;
      }
    }

    writeLine(`git: '${sub}' is not supported in virtual mock shell`);
    return 1;
  }

  private async executePipeChain(
    commands: string[],
    redirectFile: string | null,
    appendRedirect: boolean
  ): Promise<number> {
    let currentInput = '';

    for (let i = 0; i < commands.length; i++) {
      const cmdStr = commands[i]!;
      const argv = this.parseArgs(cmdStr);
      const [cmd, ...args] = argv;
      let outputBuffer = '';

      const captureWrite = (t: string) => {
        outputBuffer += t;
      };
      const captureWriteLine = (t: string = '') => {
        outputBuffer += t + '\n';
      };

      if (cmd === 'grep') {
        const pattern = args[0] || '';
        const lines = currentInput.split('\n');
        for (const l of lines) {
          if (l.includes(pattern)) {
            captureWriteLine(l);
          }
        }
      } else if (cmd === 'wc') {
        const lines = currentInput.trim() ? currentInput.split('\n').length : 0;
        captureWriteLine(lines.toString());
      } else if (cmd === 'head') {
        const count = parseInt(args[1] || '10', 10);
        const lines = currentInput.split('\n').slice(0, count);
        captureWriteLine(lines.join('\n'));
      } else if (cmd === 'tail') {
        const count = parseInt(args[1] || '10', 10);
        const lines = currentInput.split('\n').slice(-count);
        captureWriteLine(lines.join('\n'));
      } else {
        await this.dispatchCommand(cmd!, args, captureWrite, captureWriteLine);
      }

      currentInput = outputBuffer;
    }

    if (redirectFile) {
      const fullPath = this.resolvePath(redirectFile);
      if (appendRedirect) {
        let existing = '';
        try { existing = await this.fs.readFile(fullPath); } catch { existing = ''; }
        await this.fs.writeFile(fullPath, existing + currentInput);
      } else {
        await this.fs.writeFile(fullPath, currentInput);
      }
    } else {
      this.write(currentInput);
    }

    return 0;
  }
}
