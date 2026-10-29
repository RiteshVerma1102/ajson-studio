/**
 * Pino logger factory with secret redaction.
 * Import `createLogger` and call once at startup; share the instance.
 */
import pino, { type Logger, type LoggerOptions } from 'pino';
import { type BackendEnv } from './env';

// Paths that contain secrets and must never appear in logs
const REDACT_PATHS = [
  'token',
  'bearer',
  'apiKey',
  'api_key',
  'AJSON_TOKEN',
  'key',
  '*.key',
  '*.token',
  '*.apiKey',
  '*.api_key',
  'authorization',
  'Authorization',
  'password',
  'secret',
];

let _logger: Logger | null = null;

export function createLogger(cfg: BackendEnv): Logger {
  if (_logger) return _logger;

  const opts: LoggerOptions = {
    level: cfg.LOG_LEVEL,
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]',
    },
    base: { pid: process.pid, name: 'ajson-backend' },
  };

  if (cfg.LOG_PRETTY) {
    _logger = pino({
      ...opts,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  } else {
    _logger = pino(opts);
  }

  return _logger;
}

/** Reset cached logger (test utility). */
export function _resetLogger(): void {
  _logger = null;
}

/** Returns the cached logger; throws if createLogger() was not called yet. */
export function getLogger(): Logger {
  if (!_logger) throw new Error('Logger not initialized. Call createLogger() first.');
  return _logger;
}
