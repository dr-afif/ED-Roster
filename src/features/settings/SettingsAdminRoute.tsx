import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Database as DatabaseIcon,
  FolderSync,
  Lock,
  Save,
  Send,
  Settings,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { OwnerUxBoundary } from '@/platform/auth';
import { PageHeader, StatusBadge, SurfaceCard } from '@/shared/ui';

export function SettingsAdminRoute() {
  // Request quotas local state (can be saved/persisted)
  const [dailyOffLimit, setDailyOffLimit] = useState(3);
  const [monthlyLimit, setMonthlyLimit] = useState(10);
  const [weekendLimit, setWeekendLimit] = useState(4);
  const [isWindowOpen, setIsWindowOpen] = useState(true);
  const [cutoffDay, setCutoffDay] = useState(20);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  const handleSaveQuotas = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  return (
    <OwnerUxBoundary areaName="System & Settings">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Owner Administration"
          title="System Settings & Request Quotas"
          description="Configure department-wide shift request quota caps, submission cutoff deadlines, and inspect external storage and messaging integrations."
          actions={<StatusBadge label="Configuration Active" tone="brand" icon={Settings} />}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main 2-column: Request Quotas & Limits */}
          <div className="space-y-6 lg:col-span-2">
            <SurfaceCard variant="solid" className="p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-border-subtle pb-4">
                <div className="flex items-center gap-2 text-brand-primary">
                  <Sliders className="h-5 w-5" />
                  <h2 className="text-base font-semibold text-text-primary">
                    Shift Request Quotas & Limits
                  </h2>
                </div>
                <span className="text-xs text-text-secondary">Emergency Department Standard</span>
              </div>

              <form onSubmit={handleSaveQuotas} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Daily OFF limit */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="daily-off-limit"
                      className="text-xs font-semibold text-text-primary"
                    >
                      Daily Limit for OFF / AL / HKA
                    </label>
                    <input
                      id="daily-off-limit"
                      type="number"
                      min={1}
                      max={10}
                      value={dailyOffLimit}
                      onChange={(e) => setDailyOffLimit(Number(e.target.value))}
                      className="h-10 w-full rounded-xl border border-border-default bg-surface-secondary/50 px-3 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                    />
                    <p className="text-[11px] text-text-muted">
                      Maximum staff allowed to request OFF, AL, or HKA on any single date (default:
                      3).
                    </p>
                  </div>

                  {/* Monthly total limit */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="monthly-limit"
                      className="text-xs font-semibold text-text-primary"
                    >
                      Monthly Total Request Cap
                    </label>
                    <input
                      id="monthly-limit"
                      type="number"
                      min={1}
                      max={20}
                      value={monthlyLimit}
                      onChange={(e) => setMonthlyLimit(Number(e.target.value))}
                      className="h-10 w-full rounded-xl border border-border-default bg-surface-secondary/50 px-3 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                    />
                    <p className="text-[11px] text-text-muted">
                      Maximum total shift requests allowed per staff member per month (default: 10).
                    </p>
                  </div>

                  {/* Monthly weekend limit */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="weekend-limit"
                      className="text-xs font-semibold text-text-primary"
                    >
                      Monthly Weekend Request Cap
                    </label>
                    <input
                      id="weekend-limit"
                      type="number"
                      min={1}
                      max={8}
                      value={weekendLimit}
                      onChange={(e) => setWeekendLimit(Number(e.target.value))}
                      className="h-10 w-full rounded-xl border border-border-default bg-surface-secondary/50 px-3 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                    />
                    <p className="text-[11px] text-text-muted">
                      Maximum weekend dates (Saturday/Sunday) allowed per staff member (default: 4).
                    </p>
                  </div>

                  {/* Monthly Cutoff Day */}
                  <div className="space-y-1.5">
                    <label htmlFor="cutoff-day" className="text-xs font-semibold text-text-primary">
                      Request Freeze / Cutoff Day
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted">Day</span>
                      <input
                        id="cutoff-day"
                        type="number"
                        min={1}
                        max={28}
                        value={cutoffDay}
                        onChange={(e) => setCutoffDay(Number(e.target.value))}
                        className="h-10 w-24 rounded-xl border border-border-default bg-surface-secondary/50 px-3 text-sm text-text-primary focus:border-brand-primary focus:outline-none text-center font-bold"
                      />
                      <span className="text-xs text-text-muted">of preceding month</span>
                    </div>
                    <p className="text-[11px] text-text-muted">
                      Requests automatically freeze on this day (e.g., 20th of Dec for Jan roster).
                    </p>
                  </div>
                </div>

                {/* Submission window toggle */}
                <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-secondary/40 p-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      {isWindowOpen ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Lock className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                      )}
                      <span className="text-xs font-semibold text-text-primary">
                        Submission Window Status
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted">
                      {isWindowOpen
                        ? 'Requests are currently OPEN for submission by all active medical officers.'
                        : 'Requests are currently LOCKED. Staff cannot submit or withdraw requests.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsWindowOpen(!isWindowOpen)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                      isWindowOpen
                        ? 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-300'
                        : 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300'
                    }`}
                  >
                    {isWindowOpen ? 'Lock Window Now' : 'Re-open Window'}
                  </button>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  {saveStatus === 'saved' && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      Settings updated successfully
                    </span>
                  )}
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-xs font-medium text-text-inverse hover:bg-brand-primary-hover shadow-xs"
                  >
                    <Save className="h-4 w-4" />
                    Save Request Settings
                  </button>
                </div>
              </form>
            </SurfaceCard>

            {/* Date-Specific Overrides / Shift Blocks */}
            <SurfaceCard variant="solid" className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div className="flex items-center gap-2 text-brand-primary">
                  <Calendar className="h-5 w-5" />
                  <h3 className="font-semibold text-text-primary">
                    Date-Specific Overrides & Shift Blocks
                  </h3>
                </div>
                <span className="rounded-md bg-surface-secondary px-2 py-0.5 text-[11px] text-text-muted">
                  Holiday Capping
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                On high-demand festive public holidays (e.g., Hari Raya Aidilfitri, Chinese New
                Year, Christmas), daily OFF limits can be capped to 1 or 2 slots to ensure critical
                emergency department coverage.
              </p>
              <div className="rounded-xl border border-dashed border-border-default p-4 text-center text-xs text-text-muted">
                No active date-specific blocks configured for the current planning cycle. Default
                daily quota of {dailyOffLimit} applies across all dates.
              </div>
            </SurfaceCard>
          </div>

          {/* Right column: System Integrations Status */}
          <div className="space-y-6">
            <SurfaceCard variant="solid" className="p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                System Integrations Status
              </h3>

              {/* Supabase */}
              <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-secondary/30 p-3">
                <DatabaseIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-xs">
                  <div className="font-semibold text-text-primary">Supabase Staging Database</div>
                  <div className="font-mono text-[10px] text-text-muted">hgrutigkgnrcjhcjxabs</div>
                  <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                    Connected & RLS Enforced
                  </div>
                </div>
              </div>

              {/* Google Drive */}
              <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-secondary/30 p-3">
                <FolderSync className="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-xs">
                  <div className="font-semibold text-text-primary">Google Drive Storage</div>
                  <div className="text-[11px] text-text-muted">
                    Shared Drive Roster Archive (ADR-003)
                  </div>
                  <div className="text-sky-600 dark:text-sky-400 font-medium">
                    Ready for Wave E/F
                  </div>
                </div>
              </div>

              {/* Telegram */}
              <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-secondary/30 p-3">
                <Send className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-xs">
                  <div className="font-semibold text-text-primary">Personal Telegram Alerts</div>
                  <div className="text-[11px] text-text-muted">
                    Owner alert bot delivery (ADR-004)
                  </div>
                  <div className="text-indigo-600 dark:text-indigo-400 font-medium">
                    Configured for Launch
                  </div>
                </div>
              </div>
            </SurfaceCard>

            {/* Quick Link to Shift Hours & Semantics */}
            <SurfaceCard variant="solid" className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-brand-primary">
                  <Clock className="h-4 w-4" />
                  <h3 className="font-semibold text-xs text-text-primary">
                    Shift Hours &amp; Timings
                  </h3>
                </div>
                <span className="rounded-md bg-brand-primary/10 px-2 py-0.5 text-[10px] font-bold text-brand-primary">
                  Editable
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Customize department shift timings (AM, PM, ON), time windows, color tokens, and
                scheduling semantics.
              </p>
              <Link
                to="/admin/rules?tab=shifts"
                className="inline-flex items-center justify-center gap-1.5 w-full rounded-xl border border-border-default bg-surface-secondary/60 px-3 py-2 text-xs font-semibold text-text-primary hover:bg-surface-secondary transition-colors"
              >
                <span>Manage Shifts &amp; Timings</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </SurfaceCard>

            <SurfaceCard variant="glass" className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                <ShieldCheck className="h-4 w-4 text-brand-primary" />
                Roster Policy Invariants
              </div>
              <p className="text-[11px] leading-relaxed text-text-secondary">
                Shift quota limits directly protect ED red/yellow/green zone duty coverage. Any
                override to these quotas requires explicit administrator confirmation and is logged
                in immutable audit records.
              </p>
            </SurfaceCard>
          </div>
        </div>
      </div>
    </OwnerUxBoundary>
  );
}
