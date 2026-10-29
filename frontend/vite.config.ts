/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: '@ajson/contracts/testing', replacement: path.resolve(__dirname, '../contracts/src/testing/index.ts') },
      { find: '@ajson/contracts', replacement: path.resolve(__dirname, '../contracts/src/index.ts') },
      { find: '@ajson-studio/backend', replacement: path.resolve(__dirname, '../backend/src/index.ts') },
      { find: /^monaco-editor$/, replacement: path.resolve(__dirname, '../node_modules/monaco-editor/esm/vs/editor/editor.api.js') },
    ],
  },
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('monaco-editor') || id.includes('@monaco-editor')) {
            return 'monaco-vendor';
          }
          if (id.includes('@xterm')) {
            return 'terminal-vendor';
          }
          if (id.includes('diff')) {
            return 'diff-vendor';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});

