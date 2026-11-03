export type OAuthCallbackInspection =
  | { readonly kind: 'none' }
  | { readonly kind: 'pkce_code'; readonly hasCode: true }
  | { readonly kind: 'oauth_error'; readonly errorCode: string; readonly description: string }
  | { readonly kind: 'unexpected_implicit_fragment' };

/**
 * Sanitizes internal post-sign-in return paths (ADR-007).
 * Rejects protocol-relative (//) and external URLs to prevent open redirects.
 */
export function sanitizeReturnToPath(candidate: unknown): string {
  if (typeof candidate !== 'string') {
    return '/';
  }
  const trimmed = candidate.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return '/';
  }
  return trimmed;
}

/**
 * Inspects URL query and hash state before HashRouter interprets fragments (ADR-007).
 * Ensures PKCE (?code=) and OAuth error callbacks are recognized safely.
 */
export function inspectOAuthUrlState(locationLike: {
  readonly search: string;
  readonly hash: string;
}): OAuthCallbackInspection {
  const searchParams = new URLSearchParams(locationLike.search);
  const queryError = searchParams.get('error');
  if (queryError) {
    return {
      kind: 'oauth_error',
      errorCode: queryError,
      description:
        searchParams.get('error_description') ??
        'Google sign-in could not be completed. Please try again.',
    };
  }

  if (searchParams.has('code')) {
    return { kind: 'pkce_code', hasCode: true };
  }

  const rawHash = locationLike.hash.startsWith('#')
    ? locationLike.hash.slice(1)
    : locationLike.hash;

  // Normal HashRouter paths start with "/" (e.g. "#/rosters/2027/01").
  if (rawHash && !rawHash.startsWith('/')) {
    const hashParams = new URLSearchParams(rawHash);
    const hashError = hashParams.get('error');
    if (hashError) {
      return {
        kind: 'oauth_error',
        errorCode: hashError,
        description:
          hashParams.get('error_description') ??
          'Authentication returned an error before establishing a session.',
      };
    }
    if (hashParams.has('access_token')) {
      return { kind: 'unexpected_implicit_fragment' };
    }
  }

  return { kind: 'none' };
}
