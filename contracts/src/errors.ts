import { z } from 'zod';

export enum ErrorCode {
  OK = 'OK',
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  PATH_TRAVERSAL = 'PATH_TRAVERSAL',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
  CONFLICT = 'CONFLICT',
  INVALID_KEY = 'INVALID_KEY',
  NOT_CONFIGURED = 'NOT_CONFIGURED',
  RATE_LIMITED = 'RATE_LIMITED',
  TIMEOUT = 'TIMEOUT',
  CANCELLED = 'CANCELLED',
  PROCESS_FAILED = 'PROCESS_FAILED',
  UNSUPPORTED_OPERATION = 'UNSUPPORTED_OPERATION',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  IO_ERROR = 'IO_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export const ErrorCodeSchema = z.nativeEnum(ErrorCode);

export const AjsonErrorPayloadSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  timestamp: z.number().default(() => Date.now()),
});

export type AjsonErrorPayload = z.infer<typeof AjsonErrorPayloadSchema>;

export class AjsonError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: number;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AjsonError';
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();
    Object.setPrototypeOf(this, AjsonError.prototype);
  }

  toJSON(): AjsonErrorPayload {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }

  static fromJSON(payload: AjsonErrorPayload): AjsonError {
    return new AjsonError(payload.code, payload.message, payload.details);
  }
}
