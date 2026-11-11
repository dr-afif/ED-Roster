import { createContext, useContext } from 'react';
import type { AppRole } from '@/shared/types';

/**
 * Wave B Auth boundary state (04_SECURITY_AUTHORIZATION.md).
 *
 * Security invariants:
 * 1. Client auth state is for UX navigation and UI feedback only, never authorization enforcement.
 * 2. user_metadata is untrusted and is NEVER read for role or allowlist status.
 * 3. Postgres RLS and public.bootstrap_my_session() enforce access based on auth.users verified email.
 * 4. Explicit sign-out clears local session state and TanStack Query cache.
 */
export type AuthBootstrapStatus =
  'loading' | 'unauthenticated' | 'unapproved' | 'authenticated' | 'error';

export type UnapprovedReason = 'unapproved' | 'suspended' | 'revoked' | 'unconfirmed_email';

export type AuthenticatedUserContext = {
  readonly authUserId: string;
  readonly email: string | null;
  readonly role: AppRole;
  readonly staffId: number | null;
  readonly staffCode: string | null;
  readonly displayName: string;
  readonly rosterName: string | null;
};

export type AuthBoundaryState = {
  readonly status: AuthBootstrapStatus;
  readonly user: AuthenticatedUserContext | null;
  readonly unapprovedReason: UnapprovedReason | null;
  readonly unapprovedEmail: string | null;
  readonly errorMessage: string | null;
  readonly signInWithGoogle: (returnToPath?: string) => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly retryBootstrap: () => Promise<void>;
};

const NOOP_ASYNC = async () => {
  /* noop */
};

export const DEFAULT_AUTH_STATE: AuthBoundaryState = Object.freeze({
  status: 'loading',
  user: null,
  unapprovedReason: null,
  unapprovedEmail: null,
  errorMessage: null,
  signInWithGoogle: NOOP_ASYNC,
  signOut: NOOP_ASYNC,
  retryBootstrap: NOOP_ASYNC,
});

export const AuthContext = createContext<AuthBoundaryState>(DEFAULT_AUTH_STATE);

export function useAuthBoundary(): AuthBoundaryState {
  return useContext(AuthContext);
}

export const useAuth = useAuthBoundary;
