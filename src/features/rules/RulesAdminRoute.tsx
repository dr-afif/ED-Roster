import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, Layers, Moon, Pencil, Plus, ShieldCheck, Users } from 'lucide-react';
import { OwnerUxBoundary } from '@/platform/auth';
import type { Json } from '@/platform/supabase/database.types';
import {
  formatOrdinalDay,
  getShiftToneClasses,
  Modal,
  ModuleBackBar,
  SkeletonCardList,
  SkeletonTableCard,
  StatusBadge,
  useToast,
} from '@/shared/ui';
import {
  type ShiftDefinitionRow,
  type ShiftSemanticRow,
  type StaffingThresholdRow,
  useRuleVersionQuery,
  useShiftDefinitionsQuery,
  useShiftSemanticsQuery,
  useStaffingThresholdsQuery,
  useUpdateRuleVersionMutation,
} from '../rosters/data/rosterQueries';
import { EditPolicyModal } from './components/EditPolicyModal';
import { EditShiftModal } from './components/EditShiftModal';
import { EditThresholdsModal } from './components/EditThresholdsModal';
import { getShiftColorClass } from './domain/shiftThemes';

export function RulesAdminRoute() {
  const showToast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab =
    tabParam === 'thresholds'
      ? 'thresholds'
      : tabParam === 'shifts' || tabParam === 'semantics'
        ? 'shifts'
        : 'policies';

  const [activeTab, setActiveTabState] = useState<'policies' | 'thresholds' | 'shifts'>(initialTab);

  const setActiveTab = (tab: 'policies' | 'thresholds' | 'shifts') => {
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

  const { data: ruleVersion, isLoading: isRulesLoading } = useRuleVersionQuery();
  const { data: thresholds = [], isLoading: isThresholdsLoading } = useStaffingThresholdsQuery(
    ruleVersion?.id,
  );
  const { data: shiftDefs = [], isLoading: isShiftsLoading } = useShiftDefinitionsQuery(true);
  const { data: shiftSemantics = [] } = useShiftSemanticsQuery();
  const updateRuleMutation = useUpdateRuleVersionMutation();

  // Modals
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [isThresholdsModalOpen, setIsThresholdsModalOpen] = useState(false);
  const [isRequestQuotaModalOpen, setIsRequestQuotaModalOpen] = useState(false);

  const [selectedShiftForEdit, setSelectedShiftForEdit] = useState<{
    def: ShiftDefinitionRow | null;
    semantics: ShiftSemanticRow | null;
  } | null>(null);

  const rawConfig = (ruleVersion?.config as Record<string, unknown>) ?? {};
  const weeklyOffPolicy = (rawConfig.weekly_off_policy as string) ?? 'policy_b';
  const maxConsecutive = Number(rawConfig.max_consecutive_days ?? 6);
  const minRestHours = Number(rawConfig.min_rest_hours_after_night ?? 24);
  const requestMonthlyLimit = Number(rawConfig.request_monthly_limit ?? 10);
  const requestWeekendLimit = Number(rawConfig.request_weekend_limit ?? 4);
  const requestDailyOffLimit = Number(rawConfig.request_daily_off_limit ?? 3);
  const requestOn1DailyLimit = Number(rawConfig.request_on1_daily_limit ?? 1);

  const [quotaMonthlyDraft, setQuotaMonthlyDraft] = useState(requestMonthlyLimit);
  const [quotaWeekendDraft, setQuotaWeekendDraft] = useState(requestWeekendLimit);
  const [quotaDailyOffDraft, setQuotaDailyOffDraft] = useState(requestDailyOffLimit);
  const [quotaOn1DailyDraft, setQuotaOn1DailyDraft] = useState(requestOn1DailyLimit);

  const handleOpenQuotaModal = () => {
    setQuotaMonthlyDraft(requestMonthlyLimit);
    setQuotaWeekendDraft(requestWeekendLimit);
    setQuotaDailyOffDraft(requestDailyOffLimit);
    setQuotaOn1DailyDraft(requestOn1DailyLimit);
    setIsRequestQuotaModalOpen(true);
  };

  const handleSaveRequestQuotas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleVersion) return;
    try {
      await updateRuleMutation.mutateAsync({
        id: ruleVersion.id,
        effectiveFrom: ruleVersion.effective_from,
        effectiveTo: ruleVersion.effective_to,
        config: {
          ...rawConfig,
          request_monthly_limit: Math.max(1, quotaMonthlyDraft),
          request_weekend_limit: Math.max(0, quotaWeekendDraft),
          request_daily_off_limit: Math.max(1, quotaDailyOffDraft),
          request_on1_daily_limit: Math.max(1, quotaOn1DailyDraft),
        } as Json,
        changeSummary: 'Updated request quota caps',
      });
      setIsRequestQuotaModalOpen(false);
      showToast('Request quota thresholds updated ✓');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update request quotas.');
    }
  };

  const handleQuickPolicySwitch = async (nextPolicy: 'policy_a' | 'policy_b') => {
    if (!ruleVersion || weeklyOffPolicy === nextPolicy) return;
    try {
      await updateRuleMutation.mutateAsync({
        id: ruleVersion.id,
        effectiveFrom: ruleVersion.effective_from,
        effectiveTo: ruleVersion.effective_to,
        config: {
          ...rawConfig,
          weekly_off_policy: nextPolicy,
        } as Json,
        changeSummary:
          nextPolicy === 'policy_a'
            ? 'Switched Weekly OFF Policy to Policy A'
            : 'Switched Weekly OFF Policy to Policy B (Standard ED)',
      });
      showToast(
        nextPolicy === 'policy_a'
          ? 'Switched to Policy A ✓'
          : 'Switched to Policy B (Standard ED) ✓',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to switch weekly OFF policy.');
    }
  };

  const handleOpenCreateShift = () => {
    setSelectedShiftForEdit({ def: null, semantics: null });
    setIsShiftModalOpen(true);
  };

  const handleOpenEditShift = (def: ShiftDefinitionRow) => {
    const sem = shiftSemantics.find((semRow) => semRow.shift_code === def.code) ?? null;
    setSelectedShiftForEdit({ def, semantics: sem });
    setIsShiftModalOpen(true);
  };

  const effectiveDurationText = ruleVersion?.effective_to
    ? `${ruleVersion.effective_from} to ${ruleVersion.effective_to}`
    : `From ${ruleVersion?.effective_from ?? '2026-01-01'} (Ongoing)`;

  const isPolB = weeklyOffPolicy === 'policy_b';
  const fatigueDayOrd = formatOrdinalDay(maxConsecutive + 1);

  const thresholdMatrix = (['am', 'pm', 'night'] as const).map((bucket) => {
    const rowLabel =
      bucket === 'am' ? 'Morning (AM)' : bucket === 'pm' ? 'Evening (PM)' : 'Night (ON/ND)';
    const getCell = (
      dayType: 'weekday' | 'weekend' | 'holiday',
    ): StaffingThresholdRow | undefined =>
      thresholds.find((t) => t.shift_bucket === bucket && t.day_type === dayType);
    return {
      bucket,
      rowLabel,
      weekday: getCell('weekday'),
      weekend: getCell('weekend'),
      holiday: getCell('holiday'),
    };
  });

  return (
    <OwnerUxBoundary areaName="Versioned Rules">
      <div className="max-w-[1040px] space-y-4">
        <ModuleBackBar title="Rules & Policies" />

        {/* Desktop Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="hidden lg:block text-[11px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">
              Owner Administration
            </p>
            <h1 className="sr-only lg:not-sr-only text-[26px] font-extrabold tracking-tight text-[#18181B]">
              Roster Rules &amp; Thresholds
            </h1>
            <p className="hidden lg:block mt-0.5 text-[13px] font-medium text-[#78716C]">
              Manage weekly OFF policies, request quota thresholds, staffing minimums, and shift
              timings.
            </p>
          </div>
          <div className="hidden lg:flex flex-wrap items-center gap-2">
            <StatusBadge
              label={`Rule Version ${ruleVersion?.version ?? 1} (Active)`}
              tone="teal"
              icon={ShieldCheck}
            />
            <span className="rounded-full border border-[#E7E5E4] bg-white px-3 py-1 text-[11px] font-mono font-bold text-[#57534E]">
              Active: {effectiveDurationText}
            </span>
          </div>
        </div>

        {/* Scrollable Tab Switcher */}
        <div className="flex border-b border-[#EFECE6] overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('policies')}
            className={`inline-flex shrink-0 items-center gap-2 border-b-[2.5px] px-4 py-2.5 text-xs font-extrabold whitespace-nowrap transition-colors -mb-px cursor-pointer ${
              activeTab === 'policies'
                ? 'border-[#0F766E] text-[#0F766E]'
                : 'border-transparent text-[#78716C] hover:text-[#18181B]'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            Scheduling Policies &amp; Limits
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('thresholds')}
            className={`inline-flex shrink-0 items-center gap-2 border-b-[2.5px] px-4 py-2.5 text-xs font-extrabold whitespace-nowrap transition-colors -mb-px cursor-pointer ${
              activeTab === 'thresholds'
                ? 'border-[#0F766E] text-[#0F766E]'
                : 'border-transparent text-[#78716C] hover:text-[#18181B]'
            }`}
          >
            <Users className="h-4 w-4" />
            Staffing Minimums
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('shifts')}
            className={`inline-flex shrink-0 items-center gap-2 border-b-[2.5px] px-4 py-2.5 text-xs font-extrabold whitespace-nowrap transition-colors -mb-px cursor-pointer ${
              activeTab === 'shifts'
                ? 'border-[#0F766E] text-[#0F766E]'
                : 'border-transparent text-[#78716C] hover:text-[#18181B]'
            }`}
          >
            <Layers className="h-4 w-4" />
            Shifts &amp; Timings ({shiftDefs.length})
          </button>
        </div>

        {/* TAB 1: POLICIES */}
        {activeTab === 'policies' &&
          (isRulesLoading ? (
            <SkeletonCardList count={2} srLabel="Loading scheduling policies..." />
          ) : (
            <div className="space-y-4">
              <div className="rounded-[22px] border border-[#E7E5E4] bg-white p-4 sm:p-5 space-y-4 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-extrabold text-[#18181B]">
                      Scheduling Policies, Fatigue Limits &amp; Active Duration
                    </h2>
                    <p className="text-xs font-medium text-[#78716C]">
                      Active Scope:{' '}
                      <strong className="text-[#18181B]">{effectiveDurationText}</strong> &middot;
                      Evaluated Monday–Sunday.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPolicyModalOpen(true)}
                    className="inline-flex items-center gap-1.5 self-start rounded-full bg-[#0F766E] px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-[#0D655E] shadow-2xs transition-colors cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Edit Policies &amp; Duration</span>
                  </button>
                </div>

                {/* Left-Accented Fatigue & Rest Guardrails */}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex items-center justify-between gap-3 rounded-[16px] border border-[#EFECE6] border-l-[3px] border-l-[#0F766E] bg-[#FAF8F5] px-4 py-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-[#78716C]">
                        <Clock className="h-3.5 w-3.5 text-[#0F766E]" />
                        <span>Consecutive Work Limit</span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-[#57534E]">
                        {fatigueDayOrd} consecutive day triggers fatigue warning. Resets on OFF /
                        GOFF / leave.
                      </p>
                    </div>
                    <span className="text-2xl font-extrabold text-[#0F766E] tabular-nums shrink-0">
                      {maxConsecutive}d
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-[16px] border border-[#EFECE6] border-l-[3px] border-l-[#D97706] bg-[#FAF8F5] px-4 py-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-[#78716C]">
                        <Moon className="h-3.5 w-3.5 text-[#D97706]" />
                        <span>Night Shift Bundles &amp; Rest</span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-[#57534E]">
                        Bundles <code className="font-mono font-bold">ON1→ON2→PN</code>,{' '}
                        <code className="font-mono font-bold">ON1→PN</code>,{' '}
                        <code className="font-mono font-bold">ON→PN</code> protect recovery window.
                      </p>
                    </div>
                    <span className="text-2xl font-extrabold text-[#B45309] tabular-nums shrink-0">
                      {minRestHours}h
                    </span>
                  </div>
                </div>

                {/* 1-Tap Clickable Weekly OFF Policy Cards */}
                <div>
                  <p className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[#78716C] mb-2">
                    Weekly OFF Policy (1-Tap Switch)
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      disabled={updateRuleMutation.isPending}
                      onClick={() => void handleQuickPolicySwitch('policy_a')}
                      className={`rounded-[16px] border-[1.5px] p-3.5 text-left transition cursor-pointer disabled:opacity-60 ${
                        !isPolB
                          ? 'border-[#0F766E] bg-[#F0FDFA]'
                          : 'border-[#E7E5E4] bg-[#FAF8F5] hover:border-[#A8A29E]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          className={`text-[13px] font-extrabold ${
                            !isPolB ? 'text-[#0F766E]' : 'text-[#18181B]'
                          }`}
                        >
                          Policy A
                        </span>
                        {!isPolB ? (
                          <span className="rounded-full border border-[#99F6E4] bg-white px-2.5 py-0.5 text-[10px] font-extrabold text-[#0F766E]">
                            ✓ Active
                          </span>
                        ) : (
                          <span className="text-[10.5px] font-bold text-[#78716C]">
                            Tap to Activate
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-[#57534E]">
                        Exactly 1 normal weekly OFF for all staff regardless of night shifts.
                      </p>
                    </button>

                    <button
                      type="button"
                      disabled={updateRuleMutation.isPending}
                      onClick={() => void handleQuickPolicySwitch('policy_b')}
                      className={`rounded-[16px] border-[1.5px] p-3.5 text-left transition cursor-pointer disabled:opacity-60 ${
                        isPolB
                          ? 'border-[#0F766E] bg-[#F0FDFA]'
                          : 'border-[#E7E5E4] bg-[#FAF8F5] hover:border-[#A8A29E]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          className={`text-[13px] font-extrabold ${
                            isPolB ? 'text-[#0F766E]' : 'text-[#18181B]'
                          }`}
                        >
                          Policy B (Standard ED)
                        </span>
                        {isPolB ? (
                          <span className="rounded-full border border-[#99F6E4] bg-white px-2.5 py-0.5 text-[10px] font-extrabold text-[#0F766E]">
                            ✓ Active
                          </span>
                        ) : (
                          <span className="text-[10.5px] font-bold text-[#78716C]">
                            Tap to Activate
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-[#57534E]">
                        1 normal OFF after night block (ON/ON1/ON2/PN/ND); 2 normal OFFs otherwise.
                      </p>
                    </button>
                  </div>
                </div>
              </div>

              {/* Request Quota Thresholds Summary Card */}
              <div className="rounded-[22px] border border-[#E7E5E4] bg-white p-4 sm:p-5 space-y-3 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-[15px] font-extrabold text-[#18181B]">
                      Request Quota Thresholds
                    </h3>
                    <p className="text-xs font-medium text-[#78716C]">
                      Default monthly &amp; daily guardrails enforced on staff shift request
                      submissions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenQuotaModal}
                    className="inline-flex items-center gap-1 rounded-full border border-[#E7E5E4] bg-[#FAF8F5] px-3 py-1.5 text-[11px] font-extrabold text-[#18181B] hover:bg-[#EFECE6] cursor-pointer"
                  >
                    ✏️ Edit Thresholds
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-[16px] border border-[#EFECE6] border-t-[3px] border-t-[#D97706] bg-[#FAF8F5] p-3.5">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#78716C]">
                      Monthly Cap
                    </p>
                    <div className="mt-1.5 flex items-baseline justify-between">
                      <span className="text-2xl font-extrabold text-[#18181B] tabular-nums">
                        {requestMonthlyLimit}
                      </span>
                      <span className="text-[10.5px] font-bold text-[#B45309]">reqs / mo</span>
                    </div>
                  </div>
                  <div className="rounded-[16px] border border-[#EFECE6] border-t-[3px] border-t-[#0F766E] bg-[#FAF8F5] p-3.5">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#78716C]">
                      Weekend Cap
                    </p>
                    <div className="mt-1.5 flex items-baseline justify-between">
                      <span className="text-2xl font-extrabold text-[#0F766E] tabular-nums">
                        {requestWeekendLimit}
                      </span>
                      <span className="text-[10.5px] font-bold text-[#0F766E]">Fri–Sun / mo</span>
                    </div>
                  </div>
                  <div className="rounded-[16px] border border-[#EFECE6] border-t-[3px] border-t-[#15803D] bg-[#FAF8F5] p-3.5">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#78716C]">
                      OFF Group / Day
                    </p>
                    <div className="mt-1.5 flex items-baseline justify-between">
                      <span className="text-2xl font-extrabold text-[#15803D] tabular-nums">
                        {requestDailyOffLimit}
                      </span>
                      <span className="text-[10.5px] font-bold text-[#15803D]">reqs / day</span>
                    </div>
                  </div>
                  <div className="rounded-[16px] border border-[#EFECE6] border-t-[3px] border-t-[#E06D53] bg-[#FAF8F5] p-3.5">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#78716C]">
                      ON1 / Day
                    </p>
                    <div className="mt-1.5 flex items-baseline justify-between">
                      <span className="text-2xl font-extrabold text-[#E06D53] tabular-nums">
                        {requestOn1DailyLimit}
                      </span>
                      <span className="text-[10.5px] font-bold text-[#C2410C]">req / day</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

        {/* TAB 2: COMPACT 3-ROW PIVOTED STAFFING THRESHOLDS */}
        {activeTab === 'thresholds' && (
          <div className="rounded-[22px] border border-[#E7E5E4] bg-white space-y-4 p-4 sm:p-5 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-extrabold text-[#18181B]">
                  Minimum Staffing Thresholds
                </h2>
                <p className="text-xs font-medium text-[#78716C]">
                  Required on-duty MOs per shift bucket (Min / Target · Active:{' '}
                  {effectiveDurationText}).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsThresholdsModalOpen(true)}
                className="inline-flex items-center gap-1.5 self-start rounded-full bg-[#0F766E] px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-[#0D655E] shadow-2xs transition-colors cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Edit Staffing Minimums</span>
              </button>
            </div>

            {isThresholdsLoading ? (
              <SkeletonTableCard
                rows={3}
                cols={4}
                hasHeaderBar={false}
                srLabel="Loading staffing minimums..."
              />
            ) : (
              <div className="overflow-x-auto rounded-[16px] border border-[#EFECE6]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#EFECE6] bg-[#FAF8F5]">
                    <tr>
                      <th className="px-3.5 py-2.5 font-extrabold text-[#18181B]">Shift Bucket</th>
                      <th className="px-3 py-2.5 font-extrabold text-[#18181B] text-center">
                        Weekday
                      </th>
                      <th className="px-3 py-2.5 font-extrabold text-[#18181B] text-center">
                        Weekend
                      </th>
                      <th className="px-3 py-2.5 font-extrabold text-[#18181B] text-center">
                        Holiday
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFECE6]">
                    {thresholdMatrix.map((row) => (
                      <tr key={row.bucket} className="hover:bg-[#FAF8F5]/70">
                        <td className="px-3.5 py-3 font-extrabold text-[#0F766E]">
                          {row.rowLabel}
                        </td>
                        {(['weekday', 'weekend', 'holiday'] as const).map((dt) => {
                          const cell = row[dt];
                          return (
                            <td key={dt} className="px-3 py-3 text-center">
                              {cell ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-[#EFECE6] bg-[#FAF8F5] px-2.5 py-0.5 font-extrabold text-[#18181B] tabular-nums">
                                  <span>{cell.min_staff}</span>
                                  <span className="text-[#78716C] font-semibold">
                                    / {cell.target_staff}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-[#A8A29E]">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: RESPONSIVE TAP-TO-EDIT SHIFTS & TIMINGS CARDS */}
        {activeTab === 'shifts' && (
          <div className="rounded-[22px] border border-[#E7E5E4] bg-white space-y-4 p-4 sm:p-5 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-extrabold text-[#18181B]">
                  Shift Definitions, Hours &amp; Timings
                </h2>
                <p className="text-xs font-medium text-[#78716C]">
                  Manage department shift timing hours, working windows, color badges, and GOFF
                  eligibility.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCreateShift}
                className="inline-flex items-center gap-1.5 self-start rounded-full bg-[#0F766E] px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-[#0D655E] shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add Shift Definition</span>
              </button>
            </div>

            {isShiftsLoading ? (
              <SkeletonTableCard
                rows={6}
                cols={5}
                hasHeaderBar={false}
                srLabel="Loading shift definitions..."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {shiftDefs.map((s: ShiftDefinitionRow) => {
                  const sem = shiftSemantics.find(
                    (semRow: ShiftSemanticRow) => semRow.shift_code === s.code,
                  );
                  const canonicalTone = getShiftToneClasses(s.code);
                  const themeFallback = getShiftColorClass(s.color_token);

                  return (
                    <div
                      key={s.code}
                      onClick={() => handleOpenEditShift(s)}
                      className="rounded-[18px] border border-[#E7E5E4] bg-[#FAF8F5]/60 p-3.5 hover:border-[#0F766E] hover:bg-white transition cursor-pointer space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`inline-flex shrink-0 items-center justify-center rounded-xl px-2.5 py-1 text-xs font-extrabold font-mono border ${
                              canonicalTone ? `${canonicalTone} border-[#E7E5E4]` : themeFallback
                            }`}
                          >
                            {s.code}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-[#18181B] truncate">
                              {s.label}
                            </div>
                            <div className="text-[10.5px] font-semibold text-[#78716C]">
                              {s.start_time && s.end_time
                                ? `${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)}${
                                    s.duration_hours ? ` · ${Number(s.duration_hours)}h` : ''
                                  }`
                                : 'Full-Day Rest / Leave'}
                              {s.short_label && s.short_label !== s.code
                                ? ` · Grid: ${s.short_label}`
                                : ''}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditShift(s);
                          }}
                          className="shrink-0 inline-flex items-center gap-1 rounded-full border border-[#E7E5E4] bg-white px-2.5 py-1 text-[11px] font-extrabold text-[#18181B] hover:bg-[#EFECE6] cursor-pointer"
                          aria-label={`Edit ${s.code}`}
                        >
                          <Pencil className="h-3 w-3 text-[#0F766E]" />
                          <span>Edit</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-extrabold">
                        <span
                          className={`rounded-full px-2 py-0.5 ${
                            sem?.semantic_class === 'worked'
                              ? 'bg-[#DCE7F9] text-[#1E3A8A]'
                              : sem?.semantic_class === 'transparent'
                                ? 'bg-[#E9E4FA] text-[#4C1D95]'
                                : 'bg-[#F5F5F4] text-[#57534E]'
                          }`}
                        >
                          {sem?.semantic_class === 'worked'
                            ? 'Worked Duty'
                            : sem?.semantic_class === 'transparent'
                              ? 'Post-Night Buffer'
                              : 'Rest / Leave'}
                        </span>

                        {sem?.night_policy_b_qualifying && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#FCE7F1] text-[#9D174D] px-2 py-0.5">
                            <Moon className="h-2.5 w-2.5" />
                            Night
                          </span>
                        )}

                        {sem?.provides_coverage && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#F0FDFA] text-[#0F766E] px-2 py-0.5">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Coverage
                          </span>
                        )}

                        {sem?.displaces_off_earns_goff && (
                          <span className="rounded-full bg-[#FAF0CA] text-[#78350F] px-2 py-0.5">
                            GOFF Eligible
                          </span>
                        )}

                        <span
                          className={`rounded-full px-2 py-0.5 ${
                            s.is_active
                              ? 'bg-[#D1FAE5] text-[#065F46]'
                              : 'bg-[#F5F5F4] text-[#78716C]'
                          }`}
                        >
                          {s.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Request Quota Thresholds Edit Modal */}
        <Modal
          isOpen={isRequestQuotaModalOpen}
          onClose={() => setIsRequestQuotaModalOpen(false)}
          title="Edit Request Quota Thresholds"
          description="Set monthly and daily request submission caps for Medical Officers."
          presentation="drawer"
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRequestQuotaModalOpen(false)}
                className="rounded-full border border-[#E7E5E4] bg-white px-4 py-2 text-xs font-extrabold text-[#57534E] hover:bg-[#FAF8F5] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-request-quotas-form"
                disabled={updateRuleMutation.isPending}
                className="rounded-full bg-[#0F766E] px-5 py-2 text-xs font-extrabold text-white hover:bg-[#115E59] disabled:opacity-50 cursor-pointer"
              >
                {updateRuleMutation.isPending ? 'Saving...' : 'Save Quota Thresholds'}
              </button>
            </div>
          }
        >
          <form
            id="edit-request-quotas-form"
            onSubmit={handleSaveRequestQuotas}
            className="space-y-3.5"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-extrabold text-[#18181B] mb-1">
                  Monthly Cap (reqs / mo)
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={quotaMonthlyDraft}
                  onChange={(e) => setQuotaMonthlyDraft(Number(e.target.value))}
                  className="h-10 w-full rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] px-3 text-sm font-extrabold text-[#18181B]"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-[#18181B] mb-1">
                  Weekend Cap (Fri–Sun)
                </label>
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={quotaWeekendDraft}
                  onChange={(e) => setQuotaWeekendDraft(Number(e.target.value))}
                  className="h-10 w-full rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] px-3 text-sm font-extrabold text-[#18181B]"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-[#18181B] mb-1">
                  OFF Group / Day
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={quotaDailyOffDraft}
                  onChange={(e) => setQuotaDailyOffDraft(Number(e.target.value))}
                  className="h-10 w-full rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] px-3 text-sm font-extrabold text-[#18181B]"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-[#18181B] mb-1">
                  ON1 / Day Cap
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={quotaOn1DailyDraft}
                  onChange={(e) => setQuotaOn1DailyDraft(Number(e.target.value))}
                  className="h-10 w-full rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] px-3 text-sm font-extrabold text-[#18181B]"
                />
              </div>
            </div>
          </form>
        </Modal>

        {/* Edit Shift Modal */}
        <EditShiftModal
          isOpen={isShiftModalOpen}
          onClose={() => setIsShiftModalOpen(false)}
          shiftDef={selectedShiftForEdit?.def}
          semantics={selectedShiftForEdit?.semantics}
        />

        {/* Edit Policy Modal */}
        <EditPolicyModal
          isOpen={isPolicyModalOpen}
          onClose={() => setIsPolicyModalOpen(false)}
          ruleVersion={ruleVersion}
        />

        {/* Edit Staffing Thresholds Modal */}
        {ruleVersion && (
          <EditThresholdsModal
            isOpen={isThresholdsModalOpen}
            onClose={() => setIsThresholdsModalOpen(false)}
            ruleVersionId={ruleVersion.id}
            thresholds={thresholds}
            effectiveFrom={ruleVersion.effective_from}
            effectiveTo={ruleVersion.effective_to}
          />
        )}
      </div>
    </OwnerUxBoundary>
  );
}
