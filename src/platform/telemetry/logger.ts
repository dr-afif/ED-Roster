const SENSITIVE_FIELD_PATTERN =
  /token|secret|password|key|authorization|cookie|email|phone|credential/i;

export function createCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `corr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function redactDiagnosticContext(
  context: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!context) {
    return undefined;
  }
  const safe: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(context)) {
    if (SENSITIVE_FIELD_PATTERN.test(field)) {
      safe[field] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      safe[field] = redactDiagnosticContext(value as Record<string, unknown>);
    } else {
      safe[field] = value;
    }
  }
  return safe;
}

export function reportDiagnosticError(
  code: string,
  message: string,
  context?: Record<string, unknown>,
): string {
  const correlationId = createCorrelationId();
  const safeContext = redactDiagnosticContext(context);
  console.error(`[RESQ:${code}] (${correlationId}) ${message}`, safeContext ?? '');
  return correlationId;
}
