import { ArrowLeft, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuthBoundary } from './authContext';
import { SurfaceCard } from '@/shared/ui';

type OwnerUxBoundaryProps = {
  areaName: string;
  children: ReactNode;
};

/**
 * UX route wrapper for Owner Administration views (04_SECURITY_AUTHORIZATION.md, 08_FRONTEND_UX.md).
 * While client-side checks guide the user interface, backend access is strictly enforced
 * by Postgres Row Level Security and server-side RPC functions.
 */
export function OwnerUxBoundary({ areaName, children }: OwnerUxBoundaryProps) {
  const { user } = useAuthBoundary();
  const isOwner = user?.role === 'owner';

  if (!isOwner) {
    return (
      <div className="space-y-5">
        <SurfaceCard
          variant="solid"
          role="alert"
          className="space-y-4 border border-warning/30 p-6"
        >
          <div className="flex items-start gap-3 text-warning">
            <ShieldAlert
              className="mt-0.5 h-6 w-6 shrink-0"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <div className="space-y-1">
              <h1 className="text-base font-bold text-text-primary">
                Owner Administration Required — {areaName}
              </h1>
              <p className="text-xs text-text-secondary">
                Your account is currently active with role{' '}
                <strong className="font-semibold text-text-primary capitalize">
                  {user?.role ?? 'Staff'}
                </strong>
                .
              </p>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-text-secondary">
            Operational roster planning, rule configuration, allowlist administration, and audit
            recovery require the sole Roster Administrator (Owner) role. Under Postgres Row Level
            Security, non-owner roles cannot mutate administrative configurations.
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-surface-muted px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted/80"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span>Return to Operations Overview</span>
            </Link>
          </div>
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SurfaceCard variant="glass" className="border-brand-primary/25 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck
            className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <div className="space-y-1 text-xs leading-relaxed text-text-secondary">
            <p className="font-semibold text-text-primary">
              Owner Administration Boundary — {areaName}
            </p>
            <p>
              Authenticated as Roster Administrator{' '}
              <strong className="font-semibold text-text-primary">({user.displayName})</strong>.
              Protected reads, lifecycle commands, and allowlist updates are verified by Postgres
              RLS.
            </p>
          </div>
        </div>
      </SurfaceCard>
      {children}
    </div>
  );
}
