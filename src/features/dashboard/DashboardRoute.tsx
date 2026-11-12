import {
  ArrowRight,
  Calendar,
  CalendarDays,
  ClipboardList,
  Database,
  Palmtree,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAllRequestsQuery, usePublicHolidaysQuery, useTeamMembersQuery } from '@/features/requests/useRequests';
import { useRosterPeriodQuery } from '@/features/rosters/data/rosterQueries';
import { useSupabaseMetadata } from '@/platform/supabase';
import { APP_TIMEZONE, FIRST_NATIVE_ROSTER_PERIOD } from '@/shared/dates';
import { PageHeader, StatusBadge, SurfaceCard } from '@/shared/ui';

export function DashboardRoute() {
  const metadata = useSupabaseMetadata();
  const targetRosterHref = `/rosters/${FIRST_NATIVE_ROSTER_PERIOD.year}/${FIRST_NATIVE_ROSTER_PERIOD.month}`;

  // Live operational data queries
  const { data: periodRow } = useRosterPeriodQuery(
    FIRST_NATIVE_ROSTER_PERIOD.year,
    FIRST_NATIVE_ROSTER_PERIOD.month,
  );
  const { data: teamMembers = [] } = useTeamMembersQuery();
  const { data: requests = [] } = useAllRequestsQuery();
  const { data: publicHolidays = [] } = usePublicHolidaysQuery();

  const rosterStatus = periodRow?.status ? periodRow.status.toUpperCase() : 'PLANNING';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Emergency Department Workforce Operations"
        title="Operations Overview"
        description="Unified workforce command center for medical officer duty scheduling, shift requests, public holiday credits, and staffing governance."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={`Env: ${metadata.appEnv.toUpperCase()} (${metadata.projectRef})`}
              tone={metadata.isProduction ? 'brand' : 'teal'}
            />
            <StatusBadge
              label={APP_TIMEZONE}
              tone="neutral"
            />
          </div>
        }
      />

      {/* 1. Clinical KPI Metric Cards */}
      <section aria-label="Clinical workforce metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Roster Cycle */}
        <SurfaceCard variant="solid" className="flex flex-col justify-between p-4 transition-all duration-150 hover:border-teal-500/30 hover:shadow-xs">
          <div>
            <div className="flex items-center justify-between text-text-secondary mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Active Roster Cycle</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-200/60 dark:bg-teal-900/40 dark:text-teal-300">
                <CalendarDays className="h-4 w-4" />
              </span>
            </div>
            <p className="text-xl font-bold text-text-primary tracking-tight">January 2027</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700 ring-1 ring-inset ring-teal-600/20 dark:bg-teal-900/30 dark:text-teal-300">
                {rosterStatus}
              </span>
              <span className="text-[11px] text-text-muted">Auto-enforces on month arrival</span>
            </div>
          </div>
          <Link
            to={targetRosterHref}
            aria-label="Open Jan 2027 Roster Shell"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 dark:text-teal-400 group"
          >
            <span>Open Jan 2027 Roster Shell</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
        </SurfaceCard>

        {/* Medical Officers Count */}
        <SurfaceCard variant="solid" className="flex flex-col justify-between p-4 transition-all duration-150 hover:border-teal-500/30 hover:shadow-xs">
          <div>
            <div className="flex items-center justify-between text-text-secondary mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Medical Officers</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-700 ring-1 ring-sky-200/60 dark:bg-sky-900/40 dark:text-sky-300">
                <Users className="h-4 w-4" />
              </span>
            </div>
            <p className="text-xl font-bold text-text-primary tabular-nums tracking-tight">
              {teamMembers.length} Doctors
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Active departmental staff roster registry
            </p>
          </div>
          <Link
            to="/admin/staff"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:text-sky-800 dark:text-sky-400 group"
          >
            <span>View staff directory</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
        </SurfaceCard>

        {/* Shift Requests */}
        <SurfaceCard variant="solid" className="flex flex-col justify-between p-4 transition-all duration-150 hover:border-teal-500/30 hover:shadow-xs">
          <div>
            <div className="flex items-center justify-between text-text-secondary mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Shift Requests</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/60 dark:bg-indigo-900/40 dark:text-indigo-300">
                <ClipboardList className="h-4 w-4" />
              </span>
            </div>
            <p className="text-xl font-bold text-text-primary tabular-nums tracking-tight">
              {requests.length} Requests
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Monthly limits &amp; weekend quotas enforced
            </p>
          </div>
          <Link
            to="/requests"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-800 dark:text-indigo-400 group"
          >
            <span>Review submitted requests</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
        </SurfaceCard>

        {/* Public Holidays & GHKA */}
        <SurfaceCard variant="solid" className="flex flex-col justify-between p-4 transition-all duration-150 hover:border-teal-500/30 hover:shadow-xs">
          <div>
            <div className="flex items-center justify-between text-text-secondary mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Public Holidays</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60 dark:bg-emerald-900/40 dark:text-emerald-300">
                <Palmtree className="h-4 w-4" />
              </span>
            </div>
            <p className="text-xl font-bold text-text-primary tabular-nums tracking-tight">
              {publicHolidays.length} Holidays
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Gazetted dates &amp; GHKA replacement credit tracking
            </p>
          </div>
          <Link
            to="/holidays"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 group"
          >
            <span>Open holiday tracker</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
        </SurfaceCard>
      </section>

      {/* 2. Operations Command Grid */}
      <section aria-label="Operations shortcuts" className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">
          Operational Command
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to={targetRosterHref}
            className="group flex flex-col justify-between rounded-2xl border border-border-default bg-surface-primary p-4 shadow-2xs transition-all duration-150 hover:border-teal-500/50 hover:shadow-xs"
          >
            <div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-200/60 dark:bg-teal-900/40 dark:text-teal-300">
                <Calendar className="h-4 w-4" />
              </span>
              <h3 className="mt-3 text-sm font-bold text-text-primary group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                Roster Workspace
              </h3>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                Interactive duty timetable, emergency physician coverage, and real-time staffing distribution tallies.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400">
              <span>Enter timetable</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            to="/requests"
            className="group flex flex-col justify-between rounded-2xl border border-border-default bg-surface-primary p-4 shadow-2xs transition-all duration-150 hover:border-teal-500/50 hover:shadow-xs"
          >
            <div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-200/60 dark:bg-teal-900/40 dark:text-teal-300">
                <ClipboardList className="h-4 w-4" />
              </span>
              <h3 className="mt-3 text-sm font-bold text-text-primary group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                Staff Shift Requests
              </h3>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                Calendar and spreadsheet views for MO preference submissions, monthly quota usage, and limits.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400">
              <span>Manage requests</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            to="/holidays"
            className="group flex flex-col justify-between rounded-2xl border border-border-default bg-surface-primary p-4 shadow-2xs transition-all duration-150 hover:border-teal-500/50 hover:shadow-xs"
          >
            <div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-200/60 dark:bg-teal-900/40 dark:text-teal-300">
                <Palmtree className="h-4 w-4" />
              </span>
              <h3 className="mt-3 text-sm font-bold text-text-primary group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                Public Holiday Matrix
              </h3>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                Annual replacement credit matrix, earned duty classification, and official memo status tracking.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400">
              <span>View holiday matrix</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            to="/admin/rules"
            className="group flex flex-col justify-between rounded-2xl border border-border-default bg-surface-primary p-4 shadow-2xs transition-all duration-150 hover:border-teal-500/50 hover:shadow-xs"
          >
            <div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-200/60 dark:bg-teal-900/40 dark:text-teal-300">
                <SlidersHorizontal className="h-4 w-4" />
              </span>
              <h3 className="mt-3 text-sm font-bold text-text-primary group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                Scheduling Rules
              </h3>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                Unified shift working hours, fatigue policy limits, time-bounded duration scoping, and staffing minimums.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400">
              <span>Configure rules</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </section>

      {/* 3. Platform Architecture & Security Posture */}
      <SurfaceCard variant="solid" className="space-y-4">
        <div>
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
            Platform Architecture &amp; Data Isolation
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Strict isolation boundaries ensuring non-production safety and cryptographic audit trails.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border-subtle bg-surface-secondary/40 p-3 space-y-1">
            <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
              <Database className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wide">Postgres RLS</span>
            </div>
            <p className="text-xs text-text-secondary">
              Row-Level Security active on all clinical tables. Zero client-state authority bypass.
            </p>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface-secondary/40 p-3 space-y-1">
            <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wide">Auth Guard</span>
            </div>
            <p className="text-xs text-text-secondary">
              Google OAuth via PKCE browser flow. Role-based owner administrative controls.
            </p>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface-secondary/40 p-3 space-y-1">
            <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
              <CalendarDays className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wide">Timezone Lock</span>
            </div>
            <p className="text-xs text-text-secondary">
              Fixed to <span className="font-semibold text-text-primary">{APP_TIMEZONE}</span> across all duty rosters.
            </p>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
