import { WorkspaceService, WorkspaceInfo } from '@ajson/contracts';

export class MockWorkspaceService implements WorkspaceService {
  private current: WorkspaceInfo | null = {
    rootPath: '/workspace',
    name: 'sample-workspace',
  };
  private listeners = new Set<(ws: WorkspaceInfo | null) => void>();

  async open(path?: string): Promise<WorkspaceInfo | null> {
    this.current = {
      rootPath: path || '/workspace',
      name: path ? path.split('/').pop() || 'workspace' : 'sample-workspace',
    };
    this.notify();
    return this.current;
  }

  async getCurrent(): Promise<WorkspaceInfo | null> {
    return this.current;
  }

  async close(): Promise<void> {
    this.current = null;
    this.notify();
  }

  async refresh(): Promise<void> {
    this.notify();
  }

  onDidChange(cb: (workspace: WorkspaceInfo | null) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.current);
    }
  }
}
