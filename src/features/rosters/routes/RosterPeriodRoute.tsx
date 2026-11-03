import { AlertTriangle, CalendarRange } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import {
  FIRST_NATIVE_ROSTER_PERIOD,
  formatRosterPeriodLabel,
  isValidRosterYearMonth,
} from '@/shared/dates';
import { rosterRouteParamsSchema } from '@/shared/validation';
import { PageHeader, SaveStatusBar, StatusBadge, SurfaceCard } from '@/shared/ui';
import { RosterActionBarPlaceholder } from '../components/RosterActionBarPlaceholder';

export function RosterPeriodRoute() {
  const params = useParams();
  const parsed = rosterRouteParamsSchema.safeParse(params);

  if (!parsed.success || !isValidRosterYearMonth(parsed.data.yyyy, parsed.data.mm)) {
    const fallbackHref = `/rosters/${FIRST_NATIVE_ROSTER_PERIOD.year}/${FIRST_NATIVE_ROSTER_PERIOD.month}`;
    return (
      <SurfaceCard variant="solid" className="space-y-4">
        <div className="flex items-center gap-2 text-warning">
          <AlertTriangle className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          <h1 className="text-lg font-semibold text-text-primary">Invalid Roster Period URL</h1>
        </div>
        <p className="text-sm text-text-secondary">
          Roster URLs must specify a valid four-digit year and two-digit month (for example,{' '}
          <code className="font-mono text-text-primary">/rosters/2027/01</code>).
        </p>
        <Link
          to={fallbackHref}
          className="inline-flex min-h-11 items-center rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover"
        >
          Go to January 2027 Roster
        </Link>
      </SurfaceCard>
    );
  }

  const { yyyy, mm } = parsed.data;
  const periodLabel = formatRosterPeriodLabel(yyyy, mm);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Roster Workspace · ${yyyy}-${mm}`}
        title={`${periodLabel} Roster`}
        description="Desktop-first editing grid and mobile operational view boundary. Operational roster engine, draft persistence, and lifecycle RPCs are deferred to Waves C and D."
        actions={
          <>
            <StatusBadge label="Scaffold Placeholder" tone="brand" icon={CalendarRange} />
            <SaveStatusBar
              state="idle"
              label="No active database connection in Wave A"
              revision={0}
            />
          </>
        }
      />

      <RosterActionBarPlaceholder periodLabel={periodLabel} />

      <SurfaceCard variant="solid" className="space-y-3">
        <h2 className="text-base font-semibold text-text-primary">
          Solid Grid Surface Boundary (
          <code className="font-mono text-sm">src/features/rosters</code>)
        </h2>
        <p className="text-sm leading-relaxed text-text-secondary">
          Dense roster cells, sticky staff/date headers, roving keyboard focus, Current / Original
          Planned / Changes view modes, and the collapsible advisory issues panel mount on this
          high-contrast solid surface once canonical tables and the pure TypeScript rules engine are
          approved.
        </p>
      </SurfaceCard>
    </div>
  );
}
