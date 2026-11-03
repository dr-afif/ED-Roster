import { describe, expect, it } from 'vitest';
import { inspectOAuthUrlState, sanitizeReturnToPath } from '@/platform/auth';

describe('oauthCallbackGuard (ADR-007)', () => {
  it('allows only internal relative return paths', () => {
    expect(sanitizeReturnToPath('/rosters/2027/01')).toBe('/rosters/2027/01');
    expect(sanitizeReturnToPath('//malicious.example/path')).toBe('/');
    expect(sanitizeReturnToPath('https://malicious.example')).toBe('/');
    expect(sanitizeReturnToPath('javascript:alert(1)')).toBe('/');
    expect(sanitizeReturnToPath('')).toBe('/');
  });

  it('detects PKCE authorization code in query string alongside hash routes', () => {
    const result = inspectOAuthUrlState({
      search: '?code=pkce_one_time_code',
      hash: '#/requests',
    });
    expect(result).toEqual({ kind: 'pkce_code', hasCode: true });
  });

  it('detects OAuth errors in query or non-route hash fragments', () => {
    const queryErr = inspectOAuthUrlState({
      search: '?error=access_denied&error_description=Account+not+permitted',
      hash: '#/',
    });
    expect(queryErr.kind).toBe('oauth_error');

    const hashErr = inspectOAuthUrlState({
      search: '',
      hash: '#error=unauthorized_client&error_description=Disallowed',
    });
    expect(hashErr.kind).toBe('oauth_error');
  });

  it('ignores normal HashRouter application paths and flags unexpected implicit tokens', () => {
    expect(
      inspectOAuthUrlState({
        search: '',
        hash: '#/rosters/2027/01',
      }),
    ).toEqual({ kind: 'none' });

    expect(
      inspectOAuthUrlState({
        search: '',
        hash: '#access_token=legacy_implicit_token',
      }),
    ).toEqual({ kind: 'unexpected_implicit_fragment' });
  });
});
