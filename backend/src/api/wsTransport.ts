/**
 * WebSocket RPC transport.
 *
 * Security guarantees:
 *   - Binds ONLY to 127.0.0.1 (never 0.0.0.0).
 *   - Every connection must present a valid Bearer token in the
 *     `Authorization` header or the `token` query-string parameter.
 *   - Origin header is validated against an allowlist.
 *   - A per-launch random token is generated if AJSON_TOKEN is not set.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { type Logger } from 'pino';
import { type RpcRouter, type RpcNotification, RpcRequestSchema } from './router';

// ---------------------------------------------------------------------------
// Token generation
// ---------------------------------------------------------------------------

export function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// ---------------------------------------------------------------------------
// Allowed origins
// ---------------------------------------------------------------------------

const ALLOWED_ORIGIN_PATTERNS = [
  /^null$/,                          // Electron renderer (no origin)
  /^file:\/\//,                      // file:// pages
  /^http:\/\/localhost(:\d+)?$/,     // Local dev server
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,  // Loopback
];

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // electron or same-process: no origin header
  return ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(origin));
}

// ---------------------------------------------------------------------------
// Connection context
// ---------------------------------------------------------------------------

function makeNotify(ws: WebSocket) {
  return (method: string, params?: unknown) => {
    const msg: RpcNotification = { method, params };
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };
}

// ---------------------------------------------------------------------------
// WsTransport
// ---------------------------------------------------------------------------

export type WsTransportOptions = {
  token: string;
  port?: number; // 0 = OS-assigned
  logger?: Logger;
};

export class WsTransport {
  private server: http.Server;
  private wss: WebSocketServer;
  private token: string;
  private logger?: Logger;
  private _port = 0;

  constructor(router: RpcRouter, opts: WsTransportOptions) {
    this.token = opts.token;
    this.logger = opts.logger;

    this.server = http.createServer((_req, res) => {
      res.writeHead(404).end();
    });

    this.wss = new WebSocketServer({
      server: this.server,
      verifyClient: ({ req }, done) => {
        // --- Origin check ---
        const origin = req.headers['origin'] as string | undefined;
        if (!isOriginAllowed(origin)) {
          this.logger?.warn({ origin }, 'WebSocket rejected: forbidden origin');
          done(false, 403, 'Forbidden Origin');
          return;
        }

        // --- Bearer token check ---
        const authHeader = req.headers['authorization'] ?? '';
        const queryToken = new URL(
          req.url ?? '/',
          'http://127.0.0.1'
        ).searchParams.get('token');
        const presented =
          authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : (queryToken ?? '');

        if (!crypto.timingSafeEqual(Buffer.from(presented), Buffer.from(this.token))) {
          this.logger?.warn('WebSocket rejected: invalid token');
          done(false, 401, 'Unauthorized');
          return;
        }

        done(true);
      },
    });

    this.wss.on('connection', (ws) => {
      const notify = makeNotify(ws);

      ws.on('message', async (raw: RawData) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw.toString('utf8'));
        } catch {
          ws.send(
            JSON.stringify({ error: { code: 'INVALID_PAYLOAD', message: 'Invalid JSON' } })
          );
          return;
        }

        const req = RpcRequestSchema.safeParse(parsed);
        if (!req.success) {
          ws.send(
            JSON.stringify({
              id: (parsed as { id?: unknown })?.id ?? null,
              error: { code: 'INVALID_PAYLOAD', message: 'Invalid RPC frame' },
            })
          );
          return;
        }

        const response = await router.handle(req.data, { notify });
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(response));
        }
      });

      ws.on('error', (err) => {
        this.logger?.warn({ err }, 'WebSocket connection error');
      });
    });
  }

  /** Start listening. Binds only to 127.0.0.1. */
  listen(port = 0): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(port, '127.0.0.1', () => {
        const addr = this.server.address();
        this._port = typeof addr === 'object' && addr ? addr.port : 0;
        this.logger?.info({ port: this._port }, 'RPC WebSocket server listening');
        resolve(this._port);
      });
    });
  }

  get port(): number {
    return this._port;
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => {
        this.server.close(() => resolve());
      });
    });
  }

  /** Broadcast a notification to ALL connected clients. */
  broadcast(method: string, params?: unknown): void {
    const msg = JSON.stringify({ method, params } satisfies RpcNotification);
    this.wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    });
  }
}
