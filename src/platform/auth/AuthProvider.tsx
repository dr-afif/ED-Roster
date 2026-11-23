import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AuthContext,
  TEST_NORMAL_MO_USER,
  useAuthBoundary,
  type AuthBoundaryState,
  type AuthenticatedUserContext,
  type TestPersonaMode,
  type UnapprovedReason,
} from './authContext';
import { AuthErrorScreen, AuthLoadingScreen, SignInScreen, UnapprovedScreen } from './AuthScreens';
import { sanitizeReturnToPath } from './oauthCallbackGuard';
import { useSupabaseClient, useSupabaseMetadata } from '@/platform/supabase';

const RETURN_TO_STORAGE_KEY = 'resq.auth.v1.returnTo';
const TEST_PERSONA_STORAGE_KEY = 'resq.auth.v1.testPersona';
const CACHED_AUTH_USER_STORAGE_KEY = 'resq.auth.v1.cachedUser';

function readCachedAuthUser(): AuthenticatedUserContext | null {
  try {
    const raw = window.localStorage.getItem(CACHED_AUTH_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthenticatedUserContext;
    if (!parsed || typeof parsed.authUserId !== 'string' || typeof parsed.role !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedAuthUser(user: AuthenticatedUserContext | null) {
  try {
    if (!user) {
      window.localStorage.removeItem(CACHED_AUTH_USER_STORAGE_KEY);
    } else {
      window.localStorage.setItem(CACHED_AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    }
  } catch {
    // Ignore storage restrictions safely
  }
}

function readStoredTestPersona(): TestPersonaMode {
  try {
    return window.localStorage.getItem(TEST_PERSONA_STORAGE_KEY) === 'mo' ? 'mo' : 'owner';
  } catch {
    return 'owner';
  }
}

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

  const [initialCachedUser] = useState<AuthenticatedUserContext | null>(() => readCachedAuthUser());
  const [status, setStatus] = useState<AuthBoundaryState['status']>(() =>
    initialCachedUser ? 'authenticated' : 'loading',
  );
  const [user, setUser] = useState<AuthenticatedUserContext | null>(() => initialCachedUser);
  const [unapprovedReason, setUnapprovedReason] = useState<UnapprovedReason | null>(null);
  const [unapprovedEmail, setUnapprovedEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [testPersona, setTestPersona] = useState<TestPersonaMode>(readStoredTestPersona);

  const updateTestPersona = useCallback((nextPersona: TestPersonaMode) => {
    setTestPersona(nextPersona);
    try {
      window.localStorage.setItem(TEST_PERSONA_STORAGE_KEY, nextPersona);
    } catch {
      // Ignore storage restrictions safely
    }
  }, []);

  const toggleTestMoPersona = useCallback(() => {
    setTestPersona((prev) => {
      const next: TestPersonaMode = prev === 'mo' ? 'owner' : 'mo';
      try {
        window.localStorage.setItem(TEST_PERSONA_STORAGE_KEY, next);
      } catch {
        // Ignore storage restrictions safely
      }
      return next;
    });
  }, []);

  const runBootstrap = useCallback(
    async (emailHint: string | null = null, options?: { background?: boolean }) => {
      const isBackground = Boolean(options?.background);
      try {
        if (!isBackground) {
          setStatus('loading');
        }
        setErrorMessage(null);

        const { data, error } = await supabase.rpc('bootstrap_my_session');
        if (error) {
          if (!isBackground) {
            setErrorMessage(error.message);
            setStatus('error');
          }
          return;
        }

        const record = data && data.length > 0 ? data[0] : null;
        if (!record) {
          writeCachedAuthUser(null);
          setUser(null);
          setStatus('unapproved');
          setUnapprovedReason('unapproved');
          setUnapprovedEmail(emailHint);
          return;
        }

        if (record.access_status === 'active') {
          const authUser = (await supabase.auth.getUser()).data.user;
          if (!authUser) {
            writeCachedAuthUser(null);
            setUser(null);
            setStatus('unauthenticated');
            return;
          }

          const resolvedRole = record.role === 'owner' ? 'owner' : 'staff';
          const resolvedUser: AuthenticatedUserContext = {
            authUserId: authUser.id,
            email: authUser.email ?? null,
            role: resolvedRole,
            staffId: record.staff_id,
            staffCode: record.staff_code,
            displayName: record.display_name ?? 'Approved Workforce User',
            rosterName: record.roster_name,
          };
          writeCachedAuthUser(resolvedUser);
          setUser(resolvedUser);
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
          const matchesCache = initialCachedUser?.authUserId === session.user.id;
          runBootstrap(session.user.email ?? null, { background: matchesCache });
        } else {
          writeCachedAuthUser(null);
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
        writeCachedAuthUser(null);
        setUser(null);
        setStatus('unauthenticated');
        queryClient.clear();
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        const matchesCache = initialCachedUser?.authUserId === session.user.id;
        runBootstrap(session.user.email ?? null, { background: matchesCache });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, queryClient, runBootstrap, initialCachedUser]);

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

  const signInAsTestMo = useCallback(async () => {
    if (metadata.isProduction) return;
    updateTestPersona('mo');
    setStatus('loading');
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'siti@hsaas.upm.edu.my',
        password: 'TestMo123456!',
      });
      if (!error && data.session?.user) {
        await runBootstrap(data.session.user.email ?? 'siti@hsaas.upm.edu.my');
        return;
      }
    } catch {
      // Fall back to local non-production test MO session below
    }
    setUser(TEST_NORMAL_MO_USER);
    setStatus('authenticated');
  }, [metadata.isProduction, supabase, runBootstrap, updateTestPersona]);

  const signOut = useCallback(async () => {
    try {
      try {
        window.sessionStorage.removeItem(RETURN_TO_STORAGE_KEY);
        window.localStorage.removeItem(TEST_PERSONA_STORAGE_KEY);
      } catch {
        // Ignore storage restrictions
      }
      writeCachedAuthUser(null);
      setTestPersona('owner');
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

  const canSwitchTestPersona =
    !metadata.isProduction && status === 'authenticated' && user !== null && user.role === 'owner';

  const effectiveUser = useMemo<AuthenticatedUserContext | null>(() => {
    if (!user) return null;
    if (metadata.isProduction) return user;
    if (user.role === 'owner' && testPersona === 'mo') {
      return TEST_NORMAL_MO_USER;
    }
    return user;
  }, [user, metadata.isProduction, testPersona]);

  const stateValue: AuthBoundaryState = useMemo(
    () => ({
      status,
      user: effectiveUser,
      unapprovedReason,
      unapprovedEmail,
      errorMessage,
      signInWithGoogle,
      signOut,
      retryBootstrap,
      testPersona,
      canSwitchTestPersona,
      toggleTestMoPersona,
      signInAsTestMo,
    }),
    [
      status,
      effectiveUser,
      unapprovedReason,
      unapprovedEmail,
      errorMessage,
      signInWithGoogle,
      signOut,
      retryBootstrap,
      testPersona,
      canSwitchTestPersona,
      toggleTestMoPersona,
      signInAsTestMo,
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
