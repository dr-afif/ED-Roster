import { ArrowRight, CalendarDays, Database, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSupabaseMetadata } from '@/platform/supabase';
import { APP_TIMEZONE, FIRST_NATIVE_ROSTER_PERIOD } from '@/shared/dates';
import { PageHeader, StatusBadge, SurfaceCard } from '@/shared/ui';

const WAVE_READINESS = [
  {
    wave: 'Wave A',
    focus: 'Modular SPA scaffold, env validator, tokens, accessible shell, CI',
    statusLabel: 'Active scaffold',
    tone: 'success' as const,
  },
  {
    wave: 'Wave B',
    focus: 'Supabase staging schema, RLS policies, allowlist Google OAuth bootstrap',
    statusLabel: 'Awaiting approval',
    tone: 'warning' as const,
  },
  {
    wave: 'Wave C–D',
    focus: 'Profiles, requests, pure roster engine, native January 2027 lifecycle',
    statusLabel: 'Deferred',
    tone: 'neutral' as const,
  },
  {
    wave: 'Wave E',
    focus: 'Drive PDF snapshots, private owner Telegram send, Sheets rehearsal & cutover',
    statusLabel: 'Deferred',
    tone: 'neutral' as const,
  },
] as const;

export function DashboardRoute() {
  const metadata = useSupabaseMetadata();
  const targetRosterHref = `/rosters/${FIRST_NATIVE_ROSTER_PERIOD.year}/${FIRST_NATIVE_ROSTER_PERIOD.month}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Emergency Department Workforce Operations"
        title="Operations Overview"
        description="Modular foundation scaffold for roster planning, staff requests, professional records, and controlled Google Drive document navigation."
        actions={
          <StatusBadge
            label={`Environment: ${metadata.appEnv.toUpperCase()} (${metadata.projectRef})`}
            tone={metadata.isProduction ? 'brand' : 'teal'}
          />
        }
      />

      <section aria-label="Architecture summary" className="grid gap-4 md:grid-cols-3">
        <SurfaceCard variant="glass" className="space-y-2">
          <div className="flex items-center gap-2 text-brand-primary">
            <CalendarDays className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            <h2 className="text-xs font-semibold tracking-wide uppercase">First Native Target</h2>
          </div>
          <p className="text-xl font-semibold text-text-primary tabular-nums">January 2027</p>
          <p className="text-xs leading-relaxed text-text-secondary">
            Timezone fixed to <span className="font-medium text-text-primary">{APP_TIMEZONE}</span>.
            Legacy Google Sheets periods remain immutable read-only audit records after import.
          </p>
        </SurfaceCard>

        <SurfaceCard variant="glass" className="space-y-2">
          <div className="flex items-center gap-2 text-brand-secondary">
            <Database className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            <h2 className="text-xs font-semibold tracking-wide uppercase">Backend Isolation</h2>
          </div>
          <p className="text-xl font-semibold text-text-primary capitalize">{metadata.appEnv}</p>
          <p className="text-xs leading-relaxed text-text-secondary">
            Connected via browser publishable key wrapper (<code className="font-mono">PKCE</code>{' '}
            OAuth mode). Zero database tables or production resources are touched in Wave A.
          </p>
        </SurfaceCard>

        <SurfaceCard variant="glass" className="space-y-2">
          <div className="flex items-center gap-2 text-brand-primary">
            <ShieldCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            <h2 className="text-xs font-semibold tracking-wide uppercase">Security Model</h2>
          </div>
          <p className="text-xl font-semibold text-text-primary">Allowlist + RLS</p>
          <p className="text-xs leading-relaxed text-text-secondary">
            Approved Google emails and single-owner administration enforced in Postgres RLS and
            authenticated server functions—never browser state.
          </p>
        </SurfaceCard>
      </section>

      <SurfaceCard variant="solid" className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Delivery Waves &amp; Gate Status
            </h2>
            <p className="text-xs text-text-secondary">
              Opaque surface reserved for structured tables, forms, and dense operational grids.
            </p>
          </div>
          <Link
            to={targetRosterHref}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse transition-colors hover:bg-brand-primary-hover"
          >
            <span>Open Jan 2027 Roster Shell</span>
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-xs font-semibold text-text-secondary uppercase">
                <th scope="col" className="py-2.5 pr-4">
                  Wave
                </th>
                <th scope="col" className="py-2.5 pr-4">
                  Architectural Scope
                </th>
                <th scope="col" className="py-2.5">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {WAVE_READINESS.map((row) => (
                <tr key={row.wave}>
                  <td className="py-3 pr-4 font-medium whitespace-nowrap text-text-primary tabular-nums">
                    {row.wave}
                  </td>
                  <td className="py-3 pr-4 text-text-secondary">{row.focus}</td>
                  <td className="py-3 whitespace-nowrap">
                    <StatusBadge label={row.statusLabel} tone={row.tone} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
    </div>
  );
}
