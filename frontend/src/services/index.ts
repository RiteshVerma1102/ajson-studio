import { MockFileSystemService } from './fileSystem';
import { MockWorkspaceService } from './workspace';
import { DefaultDiagnosticsService } from './diagnostics';
import { DefaultOutputService } from './output';
import { MockGitService } from './git';
import { MockTerminalService } from './terminal';
import { MockSearchService } from './search';
import { MockAiService } from './ai';
import { MockAgentService } from './agent';
import { MockIndexService } from './indexService';

import {
  IpcFileSystemService,
  IpcWorkspaceService,
  IpcTerminalService,
  IpcGitService,
  IpcSearchService,
  IpcDiagnosticsService,
  IpcOutputService,
  IpcAiService,
  IpcAgentService,
  IpcIndexService,
} from './ipcAdapters';

import {
  FileSystemService,
  WorkspaceService,
  TerminalService,
  GitService,
  SearchService,
  DiagnosticsService,
  OutputService,
  AiService,
  AgentService,
  IndexService,
} from '@ajson/contracts';

export * from './types';
export * from './fileSystem';
export * from './workspace';
export * from './diagnostics';
export * from './output';
export * from './git';
export * from './terminal';
export * from './search';
export * from './ai';
export * from './agent';
export * from './indexService';
export * from './ipcAdapters';

/**
 * Checks if the Electron native preload bridge (window.ajson) is available in current runtime.
 */
export const isDesktopBridgeAvailable = (): boolean => {
  return typeof window !== 'undefined' && Boolean((window as unknown as { ajson?: unknown }).ajson);
};

// Singleton Mock Service Instances
const mockFs = new MockFileSystemService();
const mockWorkspace = new MockWorkspaceService();
const mockDiagnostics = new DefaultDiagnosticsService();
const mockOutput = new DefaultOutputService();
const mockGit = new MockGitService(mockFs, mockOutput);
const mockTerminal = new MockTerminalService(mockFs, mockGit, mockDiagnostics);
const mockSearch = new MockSearchService(mockFs);
const mockAi = new MockAiService();
const mockAgent = new MockAgentService();
const mockIndex = new MockIndexService(mockFs);

// Singleton IPC Adapter Instances (Untested against a real backend)
const ipcFs = new IpcFileSystemService();
const ipcWorkspace = new IpcWorkspaceService();
const ipcTerminal = new IpcTerminalService();
const ipcGit = new IpcGitService();
const ipcSearch = new IpcSearchService();
const ipcDiagnostics = new IpcDiagnosticsService();
const ipcOutput = new IpcOutputService();
const ipcAi = new IpcAiService();
const ipcAgent = new IpcAgentService();
const ipcIndex = new IpcIndexService();

/**
 * Service Factory / Selection:
 * Selects IPC adapters when window.ajson is present; otherwise falls back to browser mock suite.
 */
export const fileSystemService: FileSystemService = isDesktopBridgeAvailable() ? ipcFs : mockFs;
export const workspaceService: WorkspaceService = isDesktopBridgeAvailable() ? ipcWorkspace : mockWorkspace;
export const terminalService: TerminalService = isDesktopBridgeAvailable() ? ipcTerminal : mockTerminal;
export const gitService: GitService = isDesktopBridgeAvailable() ? ipcGit : mockGit;
export const searchService: SearchService = isDesktopBridgeAvailable() ? ipcSearch : mockSearch;
export const diagnosticsService: DiagnosticsService = isDesktopBridgeAvailable() ? ipcDiagnostics : mockDiagnostics;
export const outputService: OutputService = isDesktopBridgeAvailable() ? ipcOutput : mockOutput;
export const aiService: AiService = isDesktopBridgeAvailable() ? ipcAi : mockAi;
export const agentService: AgentService = isDesktopBridgeAvailable() ? ipcAgent : mockAgent;
export const indexService: IndexService = isDesktopBridgeAvailable() ? ipcIndex : mockIndex;
