import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  Moon,
  Pencil,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
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
import { EditShiftModal } from './components/EditShiftModal';
import { getShiftColorClass } from './domain/shiftThemes';

export function RulesAdminRoute() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab = tabParam === 'thresholds' || tabParam === 'semantics' ? tabParam : 'policies';
  const [activeTab, setActiveTabState] = useState<'policies' | 'thresholds' | 'semantics'>(
    initialTab,
  );

  const setActiveTab = (tab: 'policies' | 'thresholds' | 'semantics') => {
    setActiveTabState(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'policies') {
        next.delete('tab');
      } else {
        next.set('tab', tab);
      }
      return next;
    });
  };

  const { data: ruleVersion } = useRuleVersionQuery();
  const { data: thresholds = [] } = useStaffingThresholdsQuery(ruleVersion?.id);
  const { data: shiftDefs = [] } = useShiftDefinitionsQuery(true);
  const { data: shiftSemantics = [] } = useShiftSemanticsQuery();

  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [selectedShiftForEdit, setSelectedShiftForEdit] = useState<{
    def: ShiftDefinitionRow | null;
    semantics: ShiftSemanticRow | null;
  } | null>(null);

  const handleOpenCreateShift = () => {
    setSelectedShiftForEdit({ def: null, semantics: null });
    setIsShiftModalOpen(true);
  };

  const handleOpenEditShift = (def: ShiftDefinitionRow) => {
    const sem = shiftSemantics.find((semRow) => semRow.shift_code === def.code) ?? null;
    setSelectedShiftForEdit({ def, semantics: sem });
    setIsShiftModalOpen(true);
  };

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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-semibold text-text-primary">
                  Shift Definitions, Timings & Semantics
                </h3>
                <p className="text-xs text-text-secondary">
                  Configure department shift timing hours, color badges, rest displacement and
                  coverage semantics.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCreateShift}
                className="inline-flex items-center gap-1.5 self-start rounded-xl bg-brand-primary px-3 py-1.5 text-xs font-semibold text-text-inverse hover:bg-brand-primary-hover shadow-xs transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add Shift Definition</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border-default">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border-default bg-surface-secondary/70">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold text-text-primary">Shift</th>
                    <th className="px-4 py-2.5 font-semibold text-text-primary">
                      Timing & Description
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-text-primary">Semantic Class</th>
                    <th className="px-4 py-2.5 font-semibold text-text-primary text-center">
                      Coverage
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-text-primary text-center">
                      Policy-B Night
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-text-primary text-center">
                      Status
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-text-primary text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {shiftDefs.map((s: ShiftDefinitionRow) => {
                    const sem = shiftSemantics.find(
                      (semRow: ShiftSemanticRow) => semRow.shift_code === s.code,
                    );
                    const colorClass = getShiftColorClass(s.color_token);
                    return (
                      <tr key={s.code} className="hover:bg-surface-secondary/30">
                        <td className="px-4 py-2.5 font-mono">
                          <div
                            className={`inline-flex items-center justify-center rounded px-2.5 py-0.5 text-xs font-bold border ${colorClass}`}
                          >
                            {s.code}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-text-primary">{s.label}</div>
                          {s.short_label && s.short_label !== s.code && (
                            <div className="text-[11px] text-text-muted">
                              Short: {s.short_label}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
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
                        <td className="px-4 py-2.5 text-center">
                          {sem?.provides_coverage ? (
                            <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {sem?.night_policy_b_qualifying ? (
                            <CheckCircle2 className="mx-auto h-4 w-4 text-purple-600 dark:text-purple-400" />
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {s.is_active ? (
                            <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                              Active
                            </span>
                          ) : (
                            <span className="rounded-md bg-slate-500/15 px-2 py-0.5 text-[10px] font-bold text-text-muted">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenEditShift(s)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-primary px-2.5 py-1 text-xs font-semibold text-text-primary hover:bg-surface-secondary transition-colors"
                            aria-label={`Edit ${s.code}`}
                          >
                            <Pencil className="h-3 w-3 text-brand-primary" />
                            <span>Edit</span>
                          </button>
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

        {/* Edit Shift Modal */}
        <EditShiftModal
          isOpen={isShiftModalOpen}
          onClose={() => setIsShiftModalOpen(false)}
          shiftDef={selectedShiftForEdit?.def}
          semantics={selectedShiftForEdit?.semantics}
        />
      </div>
    </OwnerUxBoundary>
  );
}
