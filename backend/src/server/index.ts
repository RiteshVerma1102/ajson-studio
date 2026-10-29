/**
 * Ajson Studio Backend Server — standalone entry point.
 *
 * Startup sequence:
 *   1. Load and validate environment config
 *   2. Set up pino logger
 *   3. Resolve data directory, open SQLite DB, run migrations
 *   4. Initialize services
 *   5. Create RPC router + register all methods
 *   6. Start WebSocket transport (binds 127.0.0.1:<port>)
 *   7. Write port + token to stdout (one JSON line) for parent process
 *   8. Register SIGTERM/SIGINT graceful shutdown
 *
 * The JSON line written to stdout on startup:
 *   {"ready":true,"port":<n>,"token":"<base64url>"}
 */
import { loadConfig, resolveDataDir } from '../config/env';
import { createLogger } from '../config/logger';
import { openDatabase, runMigrations, type Db } from '../database/client';
import { DefaultWorkspaceService } from '../services/workspaceService';
import { NativeTerminalService } from '../services/nativeTerminal';
import { NativeSearchService } from '../services/nativeSearch';
import { SettingsService } from '../services/settingsService';
import { RpcRouter } from '../api/router';
import { registerAllMethods } from '../api/methods';
import { WsTransport, generateToken } from '../api/wsTransport';
import { InProcessTransport, createRpcClient } from '../api/inProcessTransport';

type ServerHandle = {
  router: RpcRouter;
  inProcess: InProcessTransport;
  client: { call: <T = unknown>(method: string, params?: unknown) => Promise<T>; subscribe: (method: string, cb: (params: unknown) => void) => () => void };
  wsTransport: WsTransport | undefined;
  port: number;
  token: string;
  db: Db;
  services: {
    workspace: DefaultWorkspaceService;
    terminal: NativeTerminalService;
    settings: SettingsService;
    readonly search: NativeSearchService | null;
  };
  shutdown: () => Promise<void>;
};

export async function startServer(options?: {
  /** Skip WebSocket; return an in-process client only (Electron mode). */
  inProcessOnly?: boolean;
  /** Override port (0 = OS-assigned). */
  port?: number;
  /** Initial workspace root to open. */
  workspaceRoot?: string;
}): Promise<ServerHandle> {
  // -------------------------------------------------------------------------
  // 1. Config + logger
  // -------------------------------------------------------------------------
  const cfg = loadConfig();
  const logger = createLogger(cfg);
  logger.info({ pid: process.pid, nodeEnv: cfg.NODE_ENV }, 'Ajson Studio backend starting');

  // -------------------------------------------------------------------------
  // 2. Data directory + SQLite + migrations
  // -------------------------------------------------------------------------
  const dataDir = resolveDataDir(cfg);
  logger.info({ dataDir }, 'Using data directory');

  const db = openDatabase(dataDir, logger);
  runMigrations(db, logger);

  // -------------------------------------------------------------------------
  // 3. Services
  // -------------------------------------------------------------------------
  const workspaceService = new DefaultWorkspaceService(options?.workspaceRoot);
  const terminalService = new NativeTerminalService(options?.workspaceRoot);
  const settingsService = new SettingsService(db);

  // Search service is workspace-relative; created lazily per workspace open.
  // For the RPC layer we pass null initially; workspace.open re-creates it.
  let searchService: NativeSearchService | null = options?.workspaceRoot
    ? new NativeSearchService(options.workspaceRoot)
    : null;

  // Sync search + terminal workspace root when workspace changes
  workspaceService.onDidChange((ws: import('@ajson/contracts').WorkspaceInfo | null) => {
    if (ws) {
      terminalService.setWorkspaceRoot(ws.rootPath);
      searchService = new NativeSearchService(ws.rootPath);
    } else {
      terminalService.setWorkspaceRoot(undefined);
      searchService = null;
    }
  });

  // -------------------------------------------------------------------------
  // 4. RPC router
  // -------------------------------------------------------------------------
  const router = new RpcRouter(logger);

  registerAllMethods(router, {
    workspace: workspaceService,
    terminal: terminalService,
    settings: settingsService,
    getSearch: () => searchService,
  });

  logger.info({ methodCount: router.methods().length }, 'RPC methods registered');

  // -------------------------------------------------------------------------
  // 5. Transport
  // -------------------------------------------------------------------------
  const inProcess = new InProcessTransport(router, logger);
  const client = createRpcClient(inProcess);

  let wsTransport: WsTransport | undefined;
  let port = 0;
  const token = cfg.AJSON_TOKEN ?? generateToken();

  if (!options?.inProcessOnly) {
    wsTransport = new WsTransport(router, {
      token,
      logger,
    });
    port = await wsTransport.listen(options?.port ?? cfg.AJSON_PORT ?? 0);

    // Signal readiness to parent process (Electron spawner or CLI)
    const readyPayload = JSON.stringify({ ready: true, port, token });
    process.stdout.write(readyPayload + '\n');
    logger.info({ port }, 'WebSocket RPC server ready');
  }

  // -------------------------------------------------------------------------
  // 6. Graceful shutdown
  // -------------------------------------------------------------------------
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Graceful shutdown initiated');

    try {
      // Close all terminal PTY sessions
      const sessions = terminalService.listSessions();
      for (const s of sessions) {
        try { terminalService.kill(s.id); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    // Close workspace watchers
    try { await workspaceService.close(); } catch { /* ignore */ }

    // Stop WebSocket transport
    if (wsTransport) {
      try { await wsTransport.close(); } catch { /* ignore */ }
    }

    // Close SQLite
    try { db.close(); } catch { /* ignore */ }

    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.once('SIGINT', () => { void shutdown('SIGINT'); });

  return {
    router,
    inProcess,
    client,
    wsTransport,
    port,
    token,
    db,
    services: {
      workspace: workspaceService,
      terminal: terminalService,
      settings: settingsService,
      get search() { return searchService; },
    },
    shutdown: () => shutdown('manual'),
  };
}

// ---------------------------------------------------------------------------
// Run standalone (direct node invocation or tsx server/index.ts)
// ---------------------------------------------------------------------------
// Check if this file is the entry point (works with tsx + ts-node)
if (
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('server/index.ts') ||
  process.argv[1]?.endsWith('server/index.js')
) {
  startServer().catch((err: unknown) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}
