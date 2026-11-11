import { useState } from 'react';
import { Calendar, CheckCircle2, Clock, Layers, Moon, ShieldCheck, Users } from 'lucide-react';
import { OwnerUxBoundary } from '@/platform/auth';
import { PageHeader, StatusBadge, SurfaceCard } from '@/shared/ui';
import {
  type ShiftDefinitionRow,
  type ShiftSemanticRow,
  type StaffingThresholdRow,
  useRuleVersionQuery,
  useShiftDefinitionsQuery,
  useShiftSemanticsQuery,
  useStaffingThresholdsQuery,
} from '../rosters/data/rosterQueries';

export function RulesAdminRoute() {
  const [activeTab, setActiveTab] = useState<'policies' | 'thresholds' | 'semantics'>('policies');

  const { data: ruleVersion } = useRuleVersionQuery();
  const { data: thresholds = [] } = useStaffingThresholdsQuery(ruleVersion?.id);
  const { data: shiftDefs = [] } = useShiftDefinitionsQuery();
  const { data: shiftSemantics = [] } = useShiftSemanticsQuery();

  const rawConfig = (ruleVersion?.config as Record<string, unknown>) ?? {};
  const weeklyOffPolicy = (rawConfig.weekly_off_policy as string) ?? 'policy_b';
  const maxConsecutive = Number(rawConfig.max_consecutive_days ?? 6);
  const minRestHours = Number(rawConfig.min_rest_hours_after_night ?? 24);

  return (
    <OwnerUxBoundary areaName="Versioned Rules">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Owner Administration"
          title="Roster Rules & Thresholds"
          description="View and manage deterministic rules governing weekly OFF policies, shift classifications, consecutive work limits, and minimum staffing thresholds."
          actions={
            <>
              <StatusBadge
                label={`Rule Version ${ruleVersion?.version ?? 1} (Active)`}
                tone="brand"
                icon={ShieldCheck}
              />
              <span className="text-xs font-mono text-text-muted">
                Effective: {ruleVersion?.effective_from ?? '2026-01-01'}
              </span>
            </>
          }
        />

        {/* Tab Switcher */}
        <div className="flex border-b border-border-default">
          <button
            type="button"
            onClick={() => setActiveTab('policies')}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === 'policies'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            Scheduling Policies & Limits
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('thresholds')}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === 'thresholds'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Users className="h-4 w-4" />
            Staffing Minimums
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('semantics')}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === 'semantics'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Layers className="h-4 w-4" />
            Shift Semantics ({shiftDefs.length})
          </button>
        </div>

        {/* TAB 1: POLICIES */}
        {activeTab === 'policies' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Weekly OFF Policy Card */}
            <SurfaceCard variant="solid" className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-brand-primary">
                <Calendar className="h-5 w-5" />
                <h3 className="font-semibold text-text-primary">Weekly OFF Policy</h3>
              </div>
              <div className="space-y-1">
                <div className="inline-block rounded-md bg-brand-primary/10 px-2 py-0.5 text-xs font-bold text-brand-primary">
                  {weeklyOffPolicy === 'policy_b' ? 'Policy B (Standard ED)' : 'Policy A'}
                </div>
                <p className="text-xs text-text-secondary">
                  {weeklyOffPolicy === 'policy_b'
                    ? 'Staff working night duties (ON, ON1, ON2, PN, NIGHT) are entitled to 1 normal OFF per week; staff without night duties are entitled to 2 normal OFFs.'
                    : 'Requires exactly 1 normal OFF per week for all staff.'}
                </p>
              </div>
              <div className="text-[11px] text-text-muted">
                Evaluated strictly across Monday–Sunday boundaries.
              </div>
            </SurfaceCard>

            {/* Consecutive Days Card */}
            <SurfaceCard variant="solid" className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Clock className="h-5 w-5" />
                <h3 className="font-semibold text-text-primary">Consecutive Work Limit</h3>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-text-primary">
                  {maxConsecutive}{' '}
                  <span className="text-xs font-normal text-text-muted">days max</span>
                </div>
                <p className="text-xs text-text-secondary">
                  A 7th consecutive worked day triggers an advisory fatigue warning. Post-night (PN)
                  is transparent and does not reset the count.
                </p>
              </div>
              <div className="text-[11px] text-text-muted">
                Sequence resets only upon rest days (OFF, GOFF) or approved leave (AL, MC).
              </div>
            </SurfaceCard>

            {/* Night Bundles Card */}
            <SurfaceCard variant="solid" className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                <Moon className="h-5 w-5" />
                <h3 className="font-semibold text-text-primary">Night Shift Bundles & Rest</h3>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-text-primary">
                  {minRestHours} Hours Rest
                </div>
                <p className="text-xs text-text-secondary">
                  Recognized bundles: <code className="font-mono">ON1 → ON2 → PN</code>,{' '}
                  <code className="font-mono">ON1 → PN</code>,{' '}
                  <code className="font-mono">ON → PN</code>.
                </p>
              </div>
              <div className="text-[11px] text-text-muted">
                Directly following a night shift with a working shift triggers an immediate error.
              </div>
            </SurfaceCard>
          </div>
        )}

        {/* TAB 2: STAFFING THRESHOLDS */}
        {activeTab === 'thresholds' && (
          <SurfaceCard variant="solid" className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-text-primary">Minimum Staffing Thresholds</h3>
                <p className="text-xs text-text-secondary">
                  Required number of on-duty doctors per shift bucket and day type.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border-default">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border-default bg-surface-secondary/70">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold text-text-primary">Day Type</th>
                    <th className="px-4 py-2.5 font-semibold text-text-primary">Shift Bucket</th>
                    <th className="px-4 py-2.5 font-semibold text-text-primary text-center">
                      Minimum Staff
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-text-primary text-center">
                      Target Staff
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {thresholds.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-text-muted">
                        No threshold records found.
                      </td>
                    </tr>
                  ) : (
                    thresholds.map((t: StaffingThresholdRow) => (
                      <tr key={t.id} className="hover:bg-surface-secondary/30">
                        <td className="px-4 py-2 font-medium capitalize text-text-primary">
                          {t.day_type}
                        </td>
                        <td className="px-4 py-2 font-mono uppercase text-brand-primary">
                          {t.shift_bucket}
                        </td>
                        <td className="px-4 py-2 text-center font-bold text-text-primary">
                          {t.min_staff}
                        </td>
                        <td className="px-4 py-2 text-center text-text-secondary">
                          {t.target_staff}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        )}

        {/* TAB 3: SHIFT SEMANTICS */}
        {activeTab === 'semantics' && (
          <SurfaceCard variant="solid" className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-text-primary">Shift Definitions & Semantics</h3>
                <p className="text-xs text-text-secondary">
                  Deterministic classification of shifts into worked, transparent, and rest
                  categories.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border-default">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border-default bg-surface-secondary/70">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold text-text-primary">Code</th>
                    <th className="px-4 py-2.5 font-semibold text-text-primary">Description</th>
                    <th className="px-4 py-2.5 font-semibold text-text-primary">Semantic Class</th>
                    <th className="px-4 py-2.5 font-semibold text-text-primary text-center">
                      Provides Coverage
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-text-primary text-center">
                      Policy-B Qualifying
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {shiftDefs.map((s: ShiftDefinitionRow) => {
                    const sem = shiftSemantics.find(
                      (semRow: ShiftSemanticRow) => semRow.shift_code === s.code,
                    );
                    return (
                      <tr key={s.code} className="hover:bg-surface-secondary/30">
                        <td className="px-4 py-2 font-bold font-mono text-text-primary">
                          {s.code}
                        </td>
                        <td className="px-4 py-2 text-text-secondary">{s.label}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                              sem?.semantic_class === 'worked'
                                ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                                : sem?.semantic_class === 'transparent'
                                  ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
                                  : 'bg-slate-500/15 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {sem?.semantic_class ?? 'unknown'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          {sem?.provides_coverage ? (
                            <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {sem?.night_policy_b_qualifying ? (
                            <CheckCircle2 className="mx-auto h-4 w-4 text-purple-600 dark:text-purple-400" />
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        )}

        {/* Blueprint Architecture Note */}
        <SurfaceCard variant="glass" className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
            <ShieldCheck className="h-4 w-4 text-brand-primary" />
            ADR-005: Versioned, Immutable Rule Sets
          </div>
          <p className="text-[11px] leading-relaxed text-text-secondary">
            Roster calculation rules and parameter thresholds are versioned and immutable. In
            accordance with hospital governance, active rules cannot be mutated in place; any
            proposed adjustments create a new draft version verified against historical acceptance
            fixtures before activation.
          </p>
        </SurfaceCard>
      </div>
    </OwnerUxBoundary>
  );
}
