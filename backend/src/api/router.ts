/**
 * RPC message types and router.
 *
 * Wire format (JSON Lines over WebSocket or in-process):
 *   Request:  { id, method, params }
 *   Response: { id, result }  |  { id, error: { code, message } }
 *   Notification (server → client): { method, params }  (no id)
 */
import { z } from 'zod';
import { AjsonError, ErrorCode } from '@ajson/contracts';
import { type Logger } from 'pino';

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

export const RpcRequestSchema = z.object({
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.unknown().optional(),
});
export type RpcRequest = z.infer<typeof RpcRequestSchema>;

export type RpcSuccessResponse = {
  id: string | number;
  result: unknown;
};

export type RpcErrorResponse = {
  id: string | number;
  error: { code: string; message: string };
};

export type RpcResponse = RpcSuccessResponse | RpcErrorResponse;

export type RpcNotification = {
  method: string;
  params?: unknown;
};

// ---------------------------------------------------------------------------
// Handler types
// ---------------------------------------------------------------------------

export type RpcContext = {
  /** Emit a notification back to the caller's connection. */
  notify: (method: string, params?: unknown) => void;
};

export type RpcHandler<P = unknown, R = unknown> = (
  params: P,
  ctx: RpcContext
) => Promise<R> | R;

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

type AnyHandler = RpcHandler<unknown, unknown>;

export class RpcRouter {
  private handlers = new Map<string, AnyHandler>();
  private logger?: Logger;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  /**
   * Register a typed handler for `method`.
   * The `schema` (Zod) is used to parse & validate params before the handler runs.
   */
  register<P, R>(
    method: string,
    schema: z.ZodType<P>,
    handler: RpcHandler<P, R>
  ): this {
    if (this.handlers.has(method)) {
      throw new Error(`RpcRouter: duplicate handler for method "${method}"`);
    }
    this.handlers.set(method, async (rawParams: unknown, ctx: RpcContext) => {
      const parsed = schema.safeParse(rawParams ?? {});
      if (!parsed.success) {
        throw new AjsonError(
          ErrorCode.INVALID_PAYLOAD,
          `Invalid params for "${method}": ${parsed.error.message}`
        );
      }
      return handler(parsed.data, ctx);
    });
    return this;
  }

  /** Handle an incoming RPC request; returns an RpcResponse. */
  async handle(req: RpcRequest, ctx: RpcContext): Promise<RpcResponse> {
    const handler = this.handlers.get(req.method);
    if (!handler) {
      return {
        id: req.id,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: `Unknown RPC method: "${req.method}"`,
        },
      };
    }

    try {
      const result = await handler(req.params, ctx);
      return { id: req.id, result };
    } catch (err: unknown) {
      if (err instanceof AjsonError) {
        this.logger?.warn({ method: req.method, code: err.code }, err.message);
        return {
          id: req.id,
          error: { code: err.code, message: err.message },
        };
      }
      const message = err instanceof Error ? err.message : String(err);
      this.logger?.error({ method: req.method, err }, 'Unhandled RPC error');
      return {
        id: req.id,
        error: { code: ErrorCode.INTERNAL_ERROR, message },
      };
    }
  }

  /** List all registered method names (for health/introspection). */
  methods(): string[] {
    return [...this.handlers.keys()].sort();
  }
}
