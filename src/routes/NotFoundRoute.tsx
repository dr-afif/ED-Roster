import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SurfaceCard } from '@/shared/ui';

export function NotFoundRoute() {
  return (
    <SurfaceCard variant="solid" className="space-y-4">
      <div className="flex items-center gap-2 text-brand-primary">
        <Compass className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        <h1 className="text-lg font-semibold text-text-primary">Page Not Found</h1>
      </div>
      <p className="text-sm text-text-secondary">
        The requested route does not exist in the RESQ application route map. Check the address or
        return to the operations overview.
      </p>
      <Link
        to="/"
        className="inline-flex min-h-11 items-center rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover"
      >
        Return to Operations Overview
      </Link>
    </SurfaceCard>
  );
}
