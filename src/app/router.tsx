import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';
import {
  createHashRouter,
  createMemoryRouter,
  isRouteErrorResponse,
  useRouteError,
  type RouteObject,
} from 'react-router-dom';
import { appChildRoutes } from '@/routes';
import { Button, SurfaceCard } from '@/shared/ui';
import { AppShell } from './AppShell';

const CHUNK_RELOAD_STORAGE_KEY = 'ed_roster_chunk_reload_at';

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /Loading chunk [\d]+ failed/i.test(message) ||
    /ChunkLoadError/i.test(message)
  );
}

function RouteErrorFallback() {
  const error = useRouteError();
  const isStaleChunk = isChunkLoadError(error);

  useEffect(() => {
    if (!isStaleChunk) return;
    try {
      const lastReloadRaw = window.sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY);
      const lastReload = lastReloadRaw ? Number(lastReloadRaw) : 0;
      if (!lastReload || Date.now() - lastReload > 10_000) {
        window.sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(Date.now()));
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  }, [isStaleChunk]);

  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : null;

  return (
    <div className="flex min-h-dvh items-center justify-center p-4 bg-[#FAF8F5]">
      <SurfaceCard variant="solid" role="alert" className="max-w-lg space-y-4">
        <div className="flex items-center gap-2.5 text-danger">
          <AlertTriangle className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <h1 className="text-lg font-semibold text-text-primary">
            {isStaleChunk ? 'New App Version Available' : 'Application Display Interrupted'}
          </h1>
        </div>
        <p className="text-sm leading-relaxed text-text-secondary">
          {isStaleChunk
            ? 'A newer version of ED Roster was just deployed. Reloading to load the latest files…'
            : 'An unexpected error stopped this screen from rendering. No roster snapshots or audit records were modified. Reload the page to recover.'}
        </p>
        {detail && !isStaleChunk ? (
          <p className="text-xs font-mono text-text-secondary break-all">{detail}</p>
        ) : null}
        <Button variant="primary" onClick={() => window.location.reload()}>
          <RotateCcw className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          <span>Reload Application</span>
        </Button>
      </SurfaceCard>
    </div>
  );
}

export const rootRouteTree: RouteObject[] = [
  {
    path: '/',
    Component: AppShell,
    HydrateFallback: AppShell,
    ErrorBoundary: RouteErrorFallback,
    children: appChildRoutes,
  },
];

/**
 * ADR-007: HashRouter is the canonical browser router for GitHub Pages (/ED-Roster/),
 * paired with Supabase Auth PKCE (?code=) callbacks.
 * Router instantiation is isolated here so test suites can inject createMemoryRouter
 * and any future hosting migration changes only this factory.
 */
export function createAppHashRouter() {
  return createHashRouter(rootRouteTree);
}

export function createTestAppRouter(initialEntries: string[] = ['/']) {
  return createMemoryRouter(rootRouteTree, { initialEntries });
}
