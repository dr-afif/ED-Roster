import { createContext, useContext } from 'react';
import type { AppRole } from '@/shared/types';

/**
 * Wave A auth boundary state.
 *
 * Security invariants (04_SECURITY_AUTHORIZATION.md):
 * 1. Client auth state is for UX navigation only, never authorization enforcement.
 * 2. user_metadata is untrusted and is never read for role or allowlist status.
 * 3. Wave B binds Google OAuth sessions against public.allowed_users under Postgres RLS.
 */
export type AuthBootstrapStatus =
  'scaffold_pending_wave_b' | 'loading' | 'unauthenticated' | 'unapproved' | 'authenticated';

export type AuthBoundaryState = {
  readonly status: AuthBootstrapStatus;
  readonly uxPreviewRole: AppRole | null;
  readonly isAllowlistBootstrapEnabled: boolean;
};

export const DEFAULT_SCAFFOLD_AUTH_STATE: AuthBoundaryState = Object.freeze({
  status: 'scaffold_pending_wave_b',
  uxPreviewRole: null,
  isAllowlistBootstrapEnabled: false,
});

export const AuthContext = createContext<AuthBoundaryState>(DEFAULT_SCAFFOLD_AUTH_STATE);

export function useAuthBoundary(): AuthBoundaryState {
  return useContext(AuthContext);
}
