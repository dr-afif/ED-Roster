import { ShieldAlert } from 'lucide-react';
import { useMemo } from 'react';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/platform/auth';
import { QueryProvider } from '@/platform/query';
import {
  EnvironmentConfigurationError,
  getSupabaseRuntimeBundle,
  SupabaseProvider,
  type SupabaseRuntimeBundle,
} from '@/platform/supabase';
import { SurfaceCard } from '@/shared/ui';
import { AppErrorBoundary } from './AppErrorBoundary';
import { createAppHashRouter } from './router';

type AppProps = {
  runtimeBundle?: SupabaseRuntimeBundle;
  router?: ReturnType<typeof createAppHashRouter>;
};

export function EnvironmentErrorScreen({ error }: { error: EnvironmentConfigurationError }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <SurfaceCard variant="solid" role="alert" className="max-w-xl space-y-4">
        <div className="flex items-center gap-2.5 text-danger">
          <ShieldAlert className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <h1 className="text-lg font-semibold text-text-primary">
            Environment Configuration Required
          </h1>
        </div>
        <p className="text-sm leading-relaxed text-text-secondary">
          RESQ failed closed at startup because required Supabase browser configuration is absent or
          invalid:
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm font-medium text-danger">
          {error.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
        <p className="text-xs leading-relaxed text-text-secondary">
          Copy <code className="font-mono text-text-primary">.env.example</code> to gitignored{' '}
          <code className="font-mono text-text-primary">.env.local</code> and configure the staging{' '}
          <code className="font-mono text-text-primary">VITE_SUPABASE_URL</code> and{' '}
          <code className="font-mono text-text-primary">VITE_SUPABASE_PUBLISHABLE_KEY</code>.
        </p>
      </SurfaceCard>
    </main>
  );
}

export function App({ runtimeBundle, router }: AppProps) {
  const bootResult = useMemo(() => {
    if (runtimeBundle) {
      return { ok: true as const, bundle: runtimeBundle };
    }
    try {
      return { ok: true as const, bundle: getSupabaseRuntimeBundle() };
    } catch (error) {
      if (error instanceof EnvironmentConfigurationError) {
        return { ok: false as const, error };
      }
      throw error;
    }
  }, [runtimeBundle]);

  const activeRouter = useMemo(() => router ?? createAppHashRouter(), [router]);

  if (!bootResult.ok) {
    return <EnvironmentErrorScreen error={bootResult.error} />;
  }

  return (
    <AppErrorBoundary>
      <SupabaseProvider bundle={bootResult.bundle}>
        <QueryProvider>
          <AuthProvider>
            <RouterProvider router={activeRouter} />
          </AuthProvider>
        </QueryProvider>
      </SupabaseProvider>
    </AppErrorBoundary>
  );
}
