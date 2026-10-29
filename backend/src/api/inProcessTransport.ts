/**
 * In-process transport: for Electron main-process usage where no network hop
 * is needed. Calls the router directly and returns typed responses.
 */
import { type RpcRouter, type RpcRequest, type RpcResponse, type RpcContext } from './router';
import { type Logger } from 'pino';

let _nextId = 1;

export class InProcessTransport {
  private router: RpcRouter;
  private logger?: Logger;
  private subscriptions = new Map<string, Set<(params: unknown) => void>>();

  constructor(router: RpcRouter, logger?: Logger) {
    this.router = router;
    this.logger = logger;
  }

  /**
   * Call an RPC method and return the response.
   * Throws if the response contains an error.
   */
  async call<T = unknown>(method: string, params?: unknown): Promise<T> {
    const id = _nextId++;
    const req: RpcRequest = { id, method, params };

    const notify = (notifyMethod: string, notifyParams?: unknown) => {
      const subs = this.subscriptions.get(notifyMethod);
      if (subs) {
        subs.forEach((cb) => cb(notifyParams));
      }
    };

    const ctx: RpcContext = { notify };
    const response: RpcResponse = await this.router.handle(req, ctx);

    if ('error' in response) {
      const { code, message } = response.error;
      this.logger?.warn({ method, code }, message);
      const err = new Error(message);
      (err as { code?: string }).code = code;
      throw err;
    }

    return response.result as T;
  }

  /**
   * Emit a notification to all subscribers of `method`.
   */
  emit(method: string, params?: unknown): void {
    const subs = this.subscriptions.get(method);
    if (subs) {
      subs.forEach((cb) => cb(params));
    }
  }

  /**
   * Subscribe to server-push notifications for `method`.
   * Returns an unsubscribe function.
   */
  subscribe(method: string, cb: (params: unknown) => void): () => void {
    if (!this.subscriptions.has(method)) {
      this.subscriptions.set(method, new Set());
    }
    this.subscriptions.get(method)!.add(cb);
    return () => {
      this.subscriptions.get(method)?.delete(cb);
    };
  }
}

/**
 * Factory helper: create a typed RPC client from an InProcessTransport.
 * Usage:
 *   const client = createRpcClient(transport);
 *   const result = await client.call<WorkspaceInfo>('workspace.getCurrent');
 */
export function createRpcClient(transport: InProcessTransport) {
  return {
    call: <T = unknown>(method: string, params?: unknown) =>
      transport.call<T>(method, params),
    subscribe: (method: string, cb: (params: unknown) => void) =>
      transport.subscribe(method, cb),
  };
}
