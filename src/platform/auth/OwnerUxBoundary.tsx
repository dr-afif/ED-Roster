import { ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { SurfaceCard } from '@/shared/ui';

type OwnerUxBoundaryProps = {
  areaName: string;
  children: ReactNode;
};

/**
 * UX-only route wrapper for Owner Administration views (04_SECURITY_AUTHORIZATION.md, 08_FRONTEND_UX.md).
 * Never treated as the security boundary: every protected read and mutation must be enforced
 * by Postgres RLS and server-side allowlist/owner checks in Wave B+.
 */
export function OwnerUxBoundary({ areaName, children }: OwnerUxBoundaryProps) {
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
              Owner Administration UX Boundary — {areaName}
            </p>
            <p>
              Client-side route guards improve navigation clarity only. Protected reads, lifecycle
              commands, and rule updates are enforced server-side via Postgres Row Level Security
              and verified <code className="font-mono text-text-primary">allowed_users</code> role
              checks (never <code className="font-mono text-text-primary">user_metadata</code>).
            </p>
          </div>
        </div>
      </SurfaceCard>
      {children}
    </div>
  );
}
