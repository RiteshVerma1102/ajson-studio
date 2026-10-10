import { EditorTab } from '../types/editor'

export const sampleFiles: EditorTab[] = [
  {
    id: 'tab-app-tsx',
    name: 'App.tsx',
    path: 'src/App.tsx',
    language: 'typescript',
    content: `import React, { useState } from 'react';

/**
 * Ajson Studio - Application Root
 * Architecture: AI-Native Desktop Development Environment
 */
export interface StudioConfig {
  readonly appName: string;
  readonly version: string;
  readonly aiEnabled: boolean;
}

export const studioConfig: StudioConfig = {
  appName: 'Ajson Studio',
  version: '0.1.0-alpha',
  aiEnabled: false,
};

export const App: React.FC = () => {
  const [activeFile, setActiveFile] = useState<string>('App.tsx');

  return (
    <div className="ajson-root">
      <h1>{studioConfig.appName}</h1>
      <p>Active Buffer: {activeFile}</p>
    </div>
  );
};
`,
  },
  {
    id: 'tab-pipeline-py',
    name: 'pipeline.py',
    path: 'scripts/pipeline.py',
    language: 'python',
    content: `"""
Ajson Studio - Python Code Analyzer & Task Pipeline
Day 1 Verification Sample
"""

import os
import sys
from typing import List, Dict, Any

class CodePipeline:
    def __init__(self, workspace_path: str):
        self.workspace = workspace_path
        self.stages: List[str] = ["plan", "code", "test", "deploy"]

    def run_analysis(self) -> Dict[str, Any]:
        """Analyzes active project files and builds dependency graph."""
        print(f"[Ajson] Scanning workspace: {self.workspace}")
        return {
            "status": "healthy",
            "files_scanned": 12,
            "stages": self.stages
        }

if __name__ == "__main__":
    pipeline = CodePipeline(os.getcwd())
    results = pipeline.run_analysis()
    print("Execution complete:", results)
`,
  },
  {
    id: 'tab-benchmark-js',
    name: 'benchmark.js',
    path: 'scripts/benchmark.js',
    language: 'javascript',
    content: `// Ajson Studio JavaScript Benchmark & Profiling Utility
const { performance } = require('perf_hooks');

function measureLatency(taskName, fn) {
  const start = performance.now();
  const result = fn();
  const duration = (performance.now() - start).toFixed(3);
  console.log(\`[\${taskName}] Completed in \${duration}ms\`);
  return result;
}

const mockTask = () => {
  let acc = 0;
  for (let i = 0; i < 100000; i++) {
    acc += Math.sqrt(i);
  }
  return acc;
};

measureLatency('Core Engine Tick', mockTask);
`,
  },
  {
    id: 'tab-package-json',
    name: 'package.json',
    path: 'package.json',
    language: 'json',
    content: `{
  "name": "ajson-studio",
  "version": "0.1.0",
  "private": true,
  "description": "Ajson Studio - AI-Native Desktop Development Environment",
  "architecture": {
    "engine": "Electron + React + TypeScript + Monaco",
    "phase": "Day 1 Foundation Scaffold",
    "supportedLanguages": [
      "typescript",
      "javascript",
      "python",
      "json",
      "html",
      "css"
    ]
  }
}
`,
  },
  {
    id: 'tab-index-html',
    name: 'index.html',
    path: 'public/index.html',
    language: 'html',
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Ajson Studio Preview</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main id="app-container">
      <header>
        <h1>Ajson Studio</h1>
        <p class="tagline">Next-Generation AI-Native IDE</p>
      </header>
      <section class="viewport-canvas"></section>
    </main>
  </body>
</html>
`,
  },
  {
    id: 'tab-styles-css',
    name: 'styles.css',
    path: 'src/styles.css',
    language: 'css',
    content: `/* Ajson Studio - Signature Dark Theme Styles */
:root {
  --ajson-primary: #090b10;
  --ajson-accent: #38bdf8;
  --ajson-violet: #818cf8;
  --ajson-emerald: #10b981;
}

.ajson-editor-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--ajson-primary);
  color: #f8fafc;
  font-family: 'JetBrains Mono', monospace;
}

.ajson-glow-banner {
  border-left: 3px solid var(--ajson-accent);
  padding: 8px 16px;
  background: rgba(56, 189, 248, 0.05);
}
`,
  },
]
