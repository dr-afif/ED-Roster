/**
 * Canonical error envelope shared across queries, commands, and UI boundaries.
 * Source: MODULAR_APP_BLUEPRINT/02_TARGET_ARCHITECTURE.md
 */
export type AppError = {
  code: string;
  message: string;
  correlationId?: string;
  fieldErrors?: Record<string, string>;
  retryable: boolean;
  currentRevision?: number;
};

export function isAppError(value: unknown): value is AppError {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.retryable === 'boolean'
  );
}
