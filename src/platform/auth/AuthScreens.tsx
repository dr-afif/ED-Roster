import { AlertCircle, LogIn, LogOut, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuthBoundary } from './authContext';
import { useSupabaseMetadata } from '@/platform/supabase';
import { Button, StatusBadge, SurfaceCard } from '@/shared/ui';

export function AuthLoadingScreen() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <SurfaceCard
        variant="glass"
        role="status"
        aria-live="polite"
        className="w-full max-w-md space-y-4 p-8 text-center"
      >
        <div className="mx-auto inline-flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary">
          <ShieldCheck className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h1 className="text-base font-semibold text-text-primary">
            Verifying Workforce Identity
          </h1>
          <p className="text-xs text-text-secondary">
            Connecting to Supabase Staging and validating allowlist status...
          </p>
        </div>
      </SurfaceCard>
    </main>
  );
}

export function SignInScreen() {
  const { signInWithGoogle } = useAuthBoundary();
  const metadata = useSupabaseMetadata();

  const handleSignIn = async () => {
    await signInWithGoogle();
  };

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <SurfaceCard variant="glass" className="w-full max-w-md space-y-6 p-8">
        <div className="space-y-3 text-center">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary text-xl font-bold text-text-inverse shadow-sm">
            RQ
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-text-primary">RESQ Workforce</h1>
            <p className="text-xs text-text-secondary">
              Emergency Department Roster &amp; Operational Management
            </p>
          </div>
          {!metadata.isProduction ? (
            <div className="flex justify-center pt-1">
              <StatusBadge
                label={`Environment: ${metadata.appEnv.toUpperCase()} (${metadata.projectRef})`}
                tone="warning"
                icon={ShieldAlert}
              />
            </div>
          ) : null}
        </div>

        <div className="space-y-4 rounded-xl border border-border-subtle bg-surface-muted/50 p-4 text-xs leading-relaxed text-text-secondary">
          <p className="font-semibold text-text-primary">Approved Identity Access Only</p>
          <p>
            Access is strictly gated by the Emergency Department Google OAuth allowlist and Postgres
            Row Level Security. Unapproved accounts cannot read or mutate any workforce records.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            type="button"
            variant="primary"
            onClick={handleSignIn}
            className="w-full justify-center gap-2.5 py-3 text-sm font-semibold shadow-sm"
          >
            <LogIn className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span>Sign in with Google</span>
          </Button>
          <p className="text-center text-[11px] text-text-muted">
            Uses Google OAuth via Supabase Auth PKCE flow.
          </p>
        </div>
      </SurfaceCard>
    </main>
  );
}

export function UnapprovedScreen() {
  const { unapprovedEmail, unapprovedReason, signOut } = useAuthBoundary();

  const reasonMessage = (() => {
    switch (unapprovedReason) {
      case 'suspended':
        return 'This account is currently suspended from active workforce rosters.';
      case 'revoked':
        return 'Access permissions for this account have been revoked by the roster administrator.';
      case 'unconfirmed_email':
        return 'Your Google email address is unconfirmed.';
      default:
        return 'This Google account is not on the Emergency Department approved allowlist.';
    }
  })();

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <SurfaceCard
        variant="solid"
        role="alert"
        className="w-full max-w-lg space-y-6 border border-danger/30 p-8"
      >
        <div className="flex items-start gap-3 text-danger">
          <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-text-primary">Access Not Approved</h1>
            <p className="text-xs text-text-secondary">Emergency Department Security Boundary</p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-danger/20 bg-danger-soft/30 p-4 text-xs leading-relaxed text-text-secondary">
          <p>
            Signed in as:{' '}
            <strong className="font-mono font-semibold text-text-primary">
              {unapprovedEmail ?? 'Unknown user'}
            </strong>
          </p>
          <p className="font-medium text-danger">{reasonMessage}</p>
          <p>
            Under Postgres Row Level Security, non-allowlisted accounts are granted zero application
            read or write access. If you are an active MO or ED staff member, contact your Roster
            Administrator to be added to the allowlist.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={signOut}
            className="w-full justify-center gap-2 sm:w-auto"
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span>Sign Out / Switch Account</span>
          </Button>
        </div>
      </SurfaceCard>
    </main>
  );
}

export function AuthErrorScreen() {
  const { errorMessage, retryBootstrap, signOut } = useAuthBoundary();

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <SurfaceCard
        variant="solid"
        role="alert"
        className="w-full max-w-lg space-y-6 border border-warning/30 p-8"
      >
        <div className="flex items-start gap-3 text-warning">
          <AlertCircle className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-text-primary">Session Verification Issue</h1>
            <p className="text-xs text-text-secondary">Authentication &amp; Bootstrap Check</p>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-text-secondary">
          {errorMessage ??
            'Could not complete allowlist session bootstrap. Please check your connection and retry.'}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={signOut}
            className="w-full justify-center sm:w-auto"
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span>Sign Out</span>
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={retryBootstrap}
            className="w-full justify-center sm:w-auto"
          >
            <RefreshCw className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span>Retry Connection</span>
          </Button>
        </div>
      </SurfaceCard>
    </main>
  );
}
