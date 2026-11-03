import { describe, expect, it } from 'vitest';
import { createCorrelationId, redactDiagnosticContext } from '@/platform/telemetry';

describe('telemetry privacy-safe diagnostics', () => {
  it('generates non-empty correlation IDs', () => {
    const id = createCorrelationId();
    expect(id.length).toBeGreaterThan(8);
  });

  it('redacts tokens, secrets, keys, emails, and phone numbers recursively', () => {
    const redacted = redactDiagnosticContext({
      operation: 'roster_view',
      period: '2027-01',
      accessToken: 'sensitive-bearer',
      staffEmail: 'person@example.org',
      nested: {
        phone: '+60123456789',
        publishableKey: 'sb_publishable_anything',
        revision: 4,
      },
    });

    expect(redacted).toEqual({
      operation: 'roster_view',
      period: '2027-01',
      accessToken: '[REDACTED]',
      staffEmail: '[REDACTED]',
      nested: {
        phone: '[REDACTED]',
        publishableKey: '[REDACTED]',
        revision: 4,
      },
    });
  });
});
