import { EditorTab, FileTreeNode } from '../types/editor'

export const sampleFiles: EditorTab[] = [
  {
    id: 'src/ai/AgentCoordinator.ts',
    name: 'AgentCoordinator.ts',
    path: 'src/ai/AgentCoordinator.ts',
    language: 'typescript',
    isDirty: false,
    content: `/**
 * @file AgentCoordinator.ts
 * @description AI-Native Agent orchestration engine with speculative decoding and AST validation.
 * @package @ajson-studio/core
 */

import { EventEmitter } from 'events';
import { StreamingDiffEngine } from '../core/StreamingDiffEngine';
import { AstValidator, ValidationResult } from '../core/AstValidator';
import type { AgentRequest, PatchChunk, TokenStreamMetrics } from '../types/models';

export interface CoordinatorOptions {
  modelProvider: 'anthropic' | 'openai' | 'gemini' | 'ollama';
  speculativeWindowSize?: number;
  enableAstGuardrails?: boolean;
  maxTokens?: number;
}

export class AgentCoordinator extends EventEmitter {
  private diffEngine: StreamingDiffEngine;
  private astValidator: AstValidator;
  private metrics: TokenStreamMetrics;
  private isProcessing: boolean = false;

  constructor(private readonly options: CoordinatorOptions) {
    super();
    this.diffEngine = new StreamingDiffEngine();
    this.astValidator = new AstValidator();
    this.metrics = {
      tokensGenerated: 0,
      speculativeHits: 0,
      verificationLatencyMs: 0,
      rollbackCount: 0,
    };
  }

  /**
   * Generates a streaming patch sequence from an incoming user prompt,
   * piping intermediate tokens through AST sanity checks.
   */
  public async *generatePatchStream(
    request: AgentRequest
  ): AsyncGenerator<PatchChunk, void, unknown> {
    if (this.isProcessing) {
      throw new Error('[AgentCoordinator] Active session in progress; concurrent streams blocked.');
    }

    this.isProcessing = true;
    this.emit('stream:start', { timestamp: Date.now(), prompt: request.userPrompt });

    const speculativeBuffer: string[] = [];
    const windowSize = this.options.speculativeWindowSize ?? 8;

    try {
      // Initialize contextual AST snapshot for target buffer
      const snapshot = await this.astValidator.createSnapshot(request.targetFilePath);
      
      for await (const rawToken of request.streamSource) {
        speculativeBuffer.push(rawToken);
        this.metrics.tokensGenerated++;

        // Perform speculative sliding window check when delimiter reached
        if (speculativeBuffer.length >= windowSize || rawToken.includes('\\n')) {
          const chunkCandidate = speculativeBuffer.join('');
          const validation: ValidationResult = await this.astValidator.verifyIncremental(
            snapshot,
            chunkCandidate
          );

          if (!validation.isValid && validation.isSyntaxBroken) {
            // Rollback speculative drift and issue AST correction token
            this.metrics.rollbackCount++;
            this.emit('speculative:rollback', { error: validation.errorNode });
            speculativeBuffer.length = 0;
            continue;
          }

          const patchChunk: PatchChunk = this.diffEngine.computeIncrementalPatch(
            request.originalCode,
            chunkCandidate
          );

          this.metrics.speculativeHits++;
          speculativeBuffer.length = 0;
          yield patchChunk;
        }
      }

      // Flush remaining tail tokens
      if (speculativeBuffer.length > 0) {
        const finalChunk = this.diffEngine.computeIncrementalPatch(
          request.originalCode,
          speculativeBuffer.join('')
        );
        yield finalChunk;
      }

      this.emit('stream:complete', { metrics: this.metrics });
    } catch (error) {
      this.emit('stream:error', { error: (error as Error).message });
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Returns live diagnostic metrics for telemetry and status bar reporting.
   */
  public getLiveMetrics(): TokenStreamMetrics {
    return { ...this.metrics };
  }
}
`,
  },
  {
    id: 'src/core/StreamingDiffEngine.ts',
    name: 'StreamingDiffEngine.ts',
    path: 'src/core/StreamingDiffEngine.ts',
    language: 'typescript',
    isDirty: false,
    content: `/**
 * @file StreamingDiffEngine.ts
 * @description Fast chunk-based diff computation using Myers algorithm with inline hunk splitting.
 */

import type { PatchChunk } from '../types/models';

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export class StreamingDiffEngine {
  private hunkIndex: number = 0;

  /**
   * Computes atomic patch hunks between original buffer and streaming candidate.
   */
  public computeIncrementalPatch(original: string, candidate: string): PatchChunk {
    const originalLines = original.split('\\n');
    const candidateLines = candidate.split('\\n');

    const added: string[] = [];
    const removed: string[] = [];

    // Fast linear scan for modified span
    let startIdx = 0;
    while (
      startIdx < originalLines.length &&
      startIdx < candidateLines.length &&
      originalLines[startIdx] === candidateLines[startIdx]
    ) {
      startIdx++;
    }

    this.hunkIndex++;
    return {
      id: \`chunk-\${this.hunkIndex}-\${Date.now()}\`,
      startLine: startIdx + 1,
      endLine: startIdx + candidateLines.length,
      originalSnippet: originalLines.slice(startIdx, startIdx + 5).join('\\n'),
      replacementSnippet: candidateLines.join('\\n'),
      applied: false,
      timestamp: Date.now(),
    };
  }
}
`,
  },
  {
    id: 'src/core/AstValidator.ts',
    name: 'AstValidator.ts',
    path: 'src/core/AstValidator.ts',
    language: 'typescript',
    isDirty: false,
    content: `/**
 * @file AstValidator.ts
 * @description Incremental AST validator verifying language grammar rules in real time.
 */

export interface ValidationResult {
  isValid: boolean;
  isSyntaxBroken: boolean;
  errorNode?: string;
}

export class AstValidator {
  public async createSnapshot(filePath: string): Promise<{ path: string; treeHash: string }> {
    return {
      path: filePath,
      treeHash: \`ast-hash-\${Date.now()}\`,
    };
  }

  public async verifyIncremental(
    _snapshot: { path: string; treeHash: string },
    codeChunk: string
  ): Promise<ValidationResult> {
    // Check for unbalanced braces or unclosed template strings
    const openBraces = (codeChunk.match(/{/g) || []).length;
    const closeBraces = (codeChunk.match(/}/g) || []).length;

    if (closeBraces > openBraces + 2) {
      return {
        isValid: false,
        isSyntaxBroken: true,
        errorNode: 'Unexpected closing brace without matching scope declaration',
      };
    }

    return {
      isValid: true,
      isSyntaxBroken: false,
    };
  }
}
`,
  },
  {
    id: 'package.json',
    name: 'package.json',
    path: 'package.json',
    language: 'json',
    isDirty: false,
    content: `{
  "name": "@ajson-studio/quantum-mesh-core",
  "version": "1.4.0",
  "description": "AI-native desktop development workspace and speculative code agent",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "node --test tests/**/*.test.mjs"
  },
  "dependencies": {
    "@monaco-editor/react": "^4.7.0",
    "lucide-react": "^0.468.0",
    "monaco-editor": "^0.52.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
`,
  },
]

export const sampleFileTree: FileTreeNode[] = [
  {
    id: 'node-src',
    name: 'src',
    path: 'src',
    isDirectory: true,
    children: [
      {
        id: 'node-src-ai',
        name: 'ai',
        path: 'src/ai',
        isDirectory: true,
        children: [
          {
            id: 'node-agent-coordinator',
            name: 'AgentCoordinator.ts',
            path: 'src/ai/AgentCoordinator.ts',
            isDirectory: false,
            extension: '.ts',
          },
          {
            id: 'node-streaming-diff',
            name: 'StreamingDiffEngine.ts',
            path: 'src/core/StreamingDiffEngine.ts',
            isDirectory: false,
            extension: '.ts',
          },
          {
            id: 'node-ast-validator',
            name: 'AstValidator.ts',
            path: 'src/core/AstValidator.ts',
            isDirectory: false,
            extension: '.ts',
          },
        ],
      },
      {
        id: 'node-src-core',
        name: 'core',
        path: 'src/core',
        isDirectory: true,
        children: [
          {
            id: 'node-telemetry',
            name: 'Telemetry.ts',
            path: 'src/core/Telemetry.ts',
            isDirectory: false,
            extension: '.ts',
          },
        ],
      },
      {
        id: 'node-src-types',
        name: 'types',
        path: 'src/types',
        isDirectory: true,
        children: [
          {
            id: 'node-models',
            name: 'models.d.ts',
            path: 'src/types/models.d.ts',
            isDirectory: false,
            extension: '.ts',
          },
        ],
      },
      {
        id: 'node-app-tsx',
        name: 'App.tsx',
        path: 'src/App.tsx',
        isDirectory: false,
        extension: '.tsx',
      },
    ],
  },
  {
    id: 'node-tests',
    name: 'tests',
    path: 'tests',
    isDirectory: true,
    children: [
      {
        id: 'node-agent-test',
        name: 'AgentCoordinator.test.ts',
        path: 'tests/AgentCoordinator.test.ts',
        isDirectory: false,
        extension: '.ts',
      },
    ],
  },
  {
    id: 'node-package-json',
    name: 'package.json',
    path: 'package.json',
    isDirectory: false,
    extension: '.json',
  },
  {
    id: 'node-tsconfig',
    name: 'tsconfig.json',
    path: 'tsconfig.json',
    isDirectory: false,
    extension: '.json',
  },
  {
    id: 'node-readme',
    name: 'README.md',
    path: 'README.md',
    isDirectory: false,
    extension: '.md',
  },
]
