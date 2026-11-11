import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AuthContext,
  useAuthBoundary,
  type AuthBoundaryState,
  type AuthenticatedUserContext,
  type UnapprovedReason,
} from './authContext';
import { AuthErrorScreen, AuthLoadingScreen, SignInScreen, UnapprovedScreen } from './AuthScreens';
import { sanitizeReturnToPath } from './oauthCallbackGuard';
import { useSupabaseClient, useSupabaseMetadata } from '@/platform/supabase';

const RETURN_TO_STORAGE_KEY = 'resq.auth.v1.returnTo';

type AuthProviderProps = {
  value?: AuthBoundaryState;
  children: ReactNode;
};

export function AuthProvider({ value, children }: AuthProviderProps) {
  // If an external test value is provided, bypass live Supabase session subscriptions.
  if (value) {
    return (
      <AuthContext.Provider value={value}>
        <AuthGate>{children}</AuthGate>
      </AuthContext.Provider>
    );
  }

  return <LiveAuthProvider>{children}</LiveAuthProvider>;
}

function LiveAuthProvider({ children }: { children: ReactNode }) {
  const supabase = useSupabaseClient();
  const metadata = useSupabaseMetadata();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<AuthBoundaryState['status']>('loading');
  const [user, setUser] = useState<AuthenticatedUserContext | null>(null);
  const [unapprovedReason, setUnapprovedReason] = useState<UnapprovedReason | null>(null);
  const [unapprovedEmail, setUnapprovedEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runBootstrap = useCallback(
    async (emailHint: string | null = null) => {
      try {
        setStatus('loading');
        setErrorMessage(null);

        const { data, error } = await supabase.rpc('bootstrap_my_session');
        if (error) {
          setErrorMessage(error.message);
          setStatus('error');
          return;
        }

        const record = data && data.length > 0 ? data[0] : null;
        if (!record) {
          setStatus('unapproved');
          setUnapprovedReason('unapproved');
          setUnapprovedEmail(emailHint);
          return;
        }

        if (record.access_status === 'active') {
          const authUser = (await supabase.auth.getUser()).data.user;
          if (!authUser) {
            setStatus('unauthenticated');
            return;
          }

          const resolvedRole = record.role === 'owner' ? 'owner' : 'staff';
          setUser({
            authUserId: authUser.id,
            email: authUser.email ?? null,
            role: resolvedRole,
            staffId: record.staff_id,
            staffCode: record.staff_code,
            displayName: record.display_name ?? 'Approved Workforce User',
            rosterName: record.roster_name,
          });
          setStatus('authenticated');

          // ADR-007: Restore post-login target path from sessionStorage if present.
          try {
            const storedReturnTo = window.sessionStorage.getItem(RETURN_TO_STORAGE_KEY);
            if (storedReturnTo) {
              window.sessionStorage.removeItem(RETURN_TO_STORAGE_KEY);
              const sanitized = sanitizeReturnToPath(storedReturnTo);
              if (sanitized && sanitized !== '/' && window.location.hash !== `#${sanitized}`) {
                window.location.hash = sanitized;
              }
            }
          } catch {
            // Ignore storage restrictions safely
          }
          return;
        }

        if (
          record.access_status === 'unapproved' ||
          record.access_status === 'suspended' ||
          record.access_status === 'revoked'
        ) {
          setUser(null);
          setStatus('unapproved');
          setUnapprovedReason(record.access_status);
          setUnapprovedEmail(emailHint);
          return;
        }

        setUser(null);
        setStatus('unauthenticated');
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'An unexpected error occurred during session check.',
        );
        setStatus('error');
      }
    },
    [supabase],
  );

  useEffect(() => {
    let isMounted = true;

    // Check initial session
    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (!isMounted) return;
        if (error) {
          setErrorMessage(error.message);
          setStatus('error');
          return;
        }
        if (session?.user) {
          runBootstrap(session.user.email ?? null);
        } else {
          setStatus('unauthenticated');
          setUser(null);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMessage(err instanceof Error ? err.message : 'Failed to retrieve session.');
        setStatus('error');
      });

    // Listen to OAuth and token refresh events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setStatus('unauthenticated');
        queryClient.clear();
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        runBootstrap(session.user.email ?? null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, queryClient, runBootstrap]);

  const signInWithGoogle = useCallback(
    async (returnToPath?: string) => {
      try {
        const candidatePath =
          returnToPath ??
          (window.location.hash.startsWith('#')
            ? window.location.hash.slice(1)
            : window.location.pathname);
        const sanitized = sanitizeReturnToPath(candidatePath);

        try {
          window.sessionStorage.setItem(RETURN_TO_STORAGE_KEY, sanitized);
        } catch {
          // Ignore storage restrictions safely
        }

        const canonicalBase = `${window.location.origin}${metadata.basePath}`;
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: canonicalBase,
            queryParams: {
              access_type: 'offline',
              prompt: 'select_account',
            },
          },
        });
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to launch Google sign-in dialog.',
        );
        setStatus('error');
      }
    },
    [supabase, metadata.basePath],
  );

  const signOut = useCallback(async () => {
    try {
      try {
        window.sessionStorage.removeItem(RETURN_TO_STORAGE_KEY);
      } catch {
        // Ignore storage restrictions
      }
      queryClient.clear();
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setUnapprovedReason(null);
      setUnapprovedEmail(null);
      setStatus('unauthenticated');
    }
  }, [supabase, queryClient]);

  const retryBootstrap = useCallback(async () => {
    const sessionRes = await supabase.auth.getSession();
    const email = sessionRes.data.session?.user?.email ?? null;
    await runBootstrap(email);
  }, [supabase, runBootstrap]);

  const stateValue: AuthBoundaryState = useMemo(
    () => ({
      status,
      user,
      unapprovedReason,
      unapprovedEmail,
      errorMessage,
      signInWithGoogle,
      signOut,
      retryBootstrap,
    }),
    [
      status,
      user,
      unapprovedReason,
      unapprovedEmail,
      errorMessage,
      signInWithGoogle,
      signOut,
      retryBootstrap,
    ],
  );

  return (
    <AuthContext.Provider value={stateValue}>
      <AuthGate>{children}</AuthGate>
    </AuthContext.Provider>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuthBoundary();

  switch (status) {
    case 'loading':
      return <AuthLoadingScreen />;
    case 'unauthenticated':
      return <SignInScreen />;
    case 'unapproved':
      return <UnapprovedScreen />;
    case 'error':
      return <AuthErrorScreen />;
    case 'authenticated':
      return <>{children}</>;
    default:
      return <AuthLoadingScreen />;
  }
}
