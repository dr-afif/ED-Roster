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
  readonly staffGroup?: string | null;
};

export function isAdminPtpoUser(
  user: Pick<AuthenticatedUserContext, 'staffGroup' | 'staffCode'> | null | undefined,
): boolean {
  if (!user) return false;
  const group = (user.staffGroup ?? '').toUpperCase();
  const code = (user.staffCode ?? '').toUpperCase();
  return group.includes('PTPO') || code.startsWith('PTPO');
}

export function isEpUser(
  user: Pick<AuthenticatedUserContext, 'staffGroup' | 'staffCode'> | null | undefined,
): boolean {
  if (!user) return false;
  const group = (user.staffGroup ?? '').toUpperCase();
  const code = (user.staffCode ?? '').toUpperCase();
  return (
    group.startsWith('EP |') ||
    group.startsWith('EP') ||
    group.includes('PHYSICIAN') ||
    code.startsWith('EP-')
  );
}

export function getUserRoleSubtitle(user: AuthenticatedUserContext | null | undefined): string {
  if (!user) return 'Medical Officer';
  if (user.role === 'owner') return 'Super Admin · Admin MO';
  if (isAdminPtpoUser(user)) return 'Admin (PTPO)';
  if (isEpUser(user)) return 'Emergency Physician';
  const group = (user.staffGroup ?? '').toUpperCase();
  if (group.includes('ADMIN-MO')) {
    return 'Admin MO';
  }
  return 'Medical Officer';
}

export type TestPersonaMode = 'owner' | 'mo';

export const TEST_NORMAL_MO_USER: AuthenticatedUserContext = Object.freeze({
  authUserId: '00000000-0000-4000-8000-000000000002',
  email: 'siti@hsaas.upm.edu.my',
  role: 'staff',
  staffId: 2,
  staffCode: 'MO-02',
  displayName: 'Dr. Siti Nurhaliza',
  rosterName: 'Dr. Siti',
});

export type AuthBoundaryState = {
  readonly status: AuthBootstrapStatus;
  readonly user: AuthenticatedUserContext | null;
  readonly unapprovedReason: UnapprovedReason | null;
  readonly unapprovedEmail: string | null;
  readonly errorMessage: string | null;
  readonly signInWithGoogle: (returnToPath?: string) => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly retryBootstrap: () => Promise<void>;
  readonly testPersona?: TestPersonaMode;
  readonly canSwitchTestPersona?: boolean;
  readonly toggleTestMoPersona?: () => void;
  readonly signInAsTestMo?: () => Promise<void>;
  readonly previewUser?: AuthenticatedUserContext | null;
  readonly isViewingAsOtherUser?: boolean;
  readonly setPreviewUser?: (target: AuthenticatedUserContext | null) => void;
};

const NOOP_ASYNC = async () => {
  /* noop */
};

const NOOP_SYNC = () => {
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
  testPersona: 'owner',
  canSwitchTestPersona: false,
  toggleTestMoPersona: NOOP_SYNC,
  signInAsTestMo: NOOP_ASYNC,
  previewUser: null,
  isViewingAsOtherUser: false,
  setPreviewUser: NOOP_SYNC,
});

export const AuthContext = createContext<AuthBoundaryState>(DEFAULT_AUTH_STATE);

export function useAuthBoundary(): AuthBoundaryState {
  return useContext(AuthContext);
}

export const useAuth = useAuthBoundary;
