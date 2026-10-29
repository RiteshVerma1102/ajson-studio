/**
 * Config loader: Zod-validated environment variables + data-dir resolver.
 * All secrets are redacted from logs automatically by the logger.
 */
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const EnvSchema = z.object({
  /** Bind port for the RPC WebSocket server (0 = random, default). */
  AJSON_PORT: z
    .string()
    .optional()
    .default('0')
    .transform(Number)
    .pipe(z.number().int().min(0).max(65535)),

  /** Pre-shared bearer token; generated randomly at startup when absent. */
  AJSON_TOKEN: z.string().optional(),

  /** Override the data directory where SQLite DB and settings live. */
  AJSON_DATA_DIR: z.string().optional(),

  /** Log level accepted by pino. */
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
    .optional()
    .default('info'),

  /** Set to "1" or "true" to enable pino-pretty human-readable logs. */
  LOG_PRETTY: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === '1' || v === 'true'),

  /** Node environment. */
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .optional()
    .default('development'),
});

export type BackendEnv = z.infer<typeof EnvSchema>;

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

let _config: BackendEnv | null = null;

/**
 * Parse and validate process.env. Call once at startup; subsequent calls
 * return the cached result.
 */
export function loadConfig(overrides?: Partial<NodeJS.ProcessEnv>): BackendEnv {
  if (_config) return _config;

  const raw = { ...process.env, ...overrides };
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  _config = result.data;
  return _config;
}

/** Reset cached config (test utility). */
export function _resetConfig(): void {
  _config = null;
}

// ---------------------------------------------------------------------------
// Data directory resolver
// ---------------------------------------------------------------------------

/**
 * Returns the absolute path to the Ajson Studio data directory.
 * Creates it (and migrations/) if it does not exist.
 *
 * Priority:
 *   1. AJSON_DATA_DIR env var
 *   2. OS-standard app-data location:
 *        - Windows:  %APPDATA%\ajson-studio
 *        - macOS:    ~/Library/Application Support/ajson-studio
 *        - Linux:    ~/.local/share/ajson-studio
 */
export function resolveDataDir(cfg?: BackendEnv): string {
  const env = cfg ?? loadConfig();

  if (env.AJSON_DATA_DIR) {
    const dir = path.resolve(env.AJSON_DATA_DIR);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  let base: string;
  switch (process.platform) {
    case 'win32':
      base = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
      break;
    case 'darwin':
      base = path.join(os.homedir(), 'Library', 'Application Support');
      break;
    default:
      base = process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share');
  }

  const dir = path.join(base, 'ajson-studio');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
