import { useState } from 'react';
import { AlertCircle, Calendar, CheckCircle2 } from 'lucide-react';
import type { RuleVersionRow } from '@/features/rosters/data/rosterQueries';
import { useUpdateRuleVersionMutation } from '@/features/rosters/data/rosterQueries';
import type { Json } from '@/platform/supabase/database.types';
import { Modal, useToast } from '@/shared/ui';

export interface EditPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  ruleVersion?: RuleVersionRow | null;
}

export function EditPolicyModal({ isOpen, onClose, ruleVersion }: EditPolicyModalProps) {
  const showToast = useToast();
  const rawConfig = (ruleVersion?.config as Record<string, unknown>) ?? {};

  const [weeklyOffPolicy, setWeeklyOffPolicy] = useState<'policy_b' | 'policy_a'>(
    (rawConfig.weekly_off_policy as 'policy_b' | 'policy_a') ?? 'policy_b',
  );
  const [maxConsecutiveDays, setMaxConsecutiveDays] = useState<number>(
    Number(rawConfig.max_consecutive_days ?? 6),
  );
  const [minRestHours, setMinRestHours] = useState<number>(
    Number(rawConfig.min_rest_hours_after_night ?? 24),
  );

  // Duration / Scope of Active Use
  const [scopeType, setScopeType] = useState<'month' | 'date_range' | 'ongoing'>(
    ruleVersion?.effective_to ? 'month' : 'ongoing',
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(
    ruleVersion?.effective_from ? ruleVersion.effective_from.slice(0, 7) : '2027-01',
  );
  const [startDate, setStartDate] = useState<string>(ruleVersion?.effective_from ?? '2027-01-01');
  const [endDate, setEndDate] = useState<string>(ruleVersion?.effective_to ?? '2027-01-31');

  const [changeSummary, setChangeSummary] = useState<string>(
    ruleVersion?.change_summary ?? 'Updated scheduling policies and active duration.',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateMutation = useUpdateRuleVersionMutation();

  if (!ruleVersion) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    let effectiveFrom: string;
    let effectiveTo: string | null;

    if (scopeType === 'month') {
      if (!selectedMonth) {
        setErrorMessage('Please select a valid target month.');
        return;
      }
      const parts = selectedMonth.split('-');
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      if (parts.length < 2 || Number.isNaN(year) || Number.isNaN(month)) {
        setErrorMessage('Please select a valid target month.');
        return;
      }
      const lastDay = new Date(year, month, 0).getDate();
      effectiveFrom = `${selectedMonth}-01`;
      effectiveTo = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
    } else if (scopeType === 'ongoing') {
      effectiveFrom = startDate || '2027-01-01';
      effectiveTo = null;
    } else {
      if (!startDate || !endDate) {
        setErrorMessage('Please specify both start and end dates for the active range.');
        return;
      }
      if (endDate < startDate) {
        setErrorMessage('End date cannot precede start date.');
        return;
      }
      effectiveFrom = startDate;
      effectiveTo = endDate;
    }

    const updatedConfig: Record<string, unknown> = {
      ...rawConfig,
      weekly_off_policy: weeklyOffPolicy,
      max_consecutive_days: maxConsecutiveDays,
      min_rest_hours_after_night: minRestHours,
      consecutive_warning_threshold: maxConsecutiveDays + 1,
      scope_type: scopeType,
    };

    try {
      await updateMutation.mutateAsync({
        id: ruleVersion.id,
        effectiveFrom,
        effectiveTo,
        config: updatedConfig as Json,
        changeSummary: changeSummary.trim() || 'Updated scheduling policies & limits.',
      });
      showToast('Scheduling policies saved ✓');
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update rule version.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Scheduling Policies & Limits"
      description="Configure deterministic scheduling constraints and establish the duration of active use."
      presentation="drawer"
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={updateMutation.isPending}
            className="rounded-full border border-[#E7E5E4] bg-white px-4 py-2 text-xs font-extrabold text-[#57534E] hover:bg-[#FAF8F5] transition disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-policy-form"
            disabled={updateMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0F766E] px-5 py-2 text-xs font-extrabold text-white hover:bg-[#115E59] shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {updateMutation.isPending ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Save Policy &amp; Duration</span>
              </>
            )}
          </button>
        </div>
      }
    >
      {errorMessage && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{errorMessage}</div>
        </div>
      )}

      <form id="edit-policy-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Section 1: Policies & Limits */}
        <div className="space-y-4">
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#78716C]">
            1. Deterministic Roster Policies
          </h3>

          <div className="space-y-1.5">
            <label htmlFor="weekly-off-select" className="text-xs font-extrabold text-[#18181B]">
              Weekly OFF Entitlement Policy
            </label>
            <select
              id="weekly-off-select"
              value={weeklyOffPolicy}
              onChange={(e) => setWeeklyOffPolicy(e.target.value as 'policy_b' | 'policy_a')}
              className="h-10 w-full rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] px-3 text-xs font-semibold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
            >
              <option value="policy_b">
                Policy B (Standard ED): 1 OFF with night duty, 2 OFFs without night duty
              </option>
              <option value="policy_a">Policy A: Exactly 1 normal weekly OFF for all staff</option>
            </select>
            <p className="text-[11px] text-[#78716C]">
              Evaluated strictly on a per-week basis across Monday–Sunday boundaries.
            </p>
          </div>

          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="max-consecutive" className="text-xs font-extrabold text-[#18181B]">
                Max Consecutive Days
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="max-consecutive"
                  type="number"
                  min={3}
                  max={14}
                  value={maxConsecutiveDays}
                  onChange={(e) => setMaxConsecutiveDays(Number(e.target.value))}
                  className="h-10 w-20 rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] px-2.5 text-sm font-extrabold text-[#18181B] focus:border-[#0F766E] focus:outline-none text-center"
                />
                <span className="text-xs font-semibold text-[#78716C]">days</span>
              </div>
              <p className="text-[11px] text-[#78716C]">Triggers fatigue warning if exceeded.</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="min-rest-hours" className="text-xs font-extrabold text-[#18181B]">
                Min Rest After Night Duty
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="min-rest-hours"
                  type="number"
                  min={12}
                  max={48}
                  step={6}
                  value={minRestHours}
                  onChange={(e) => setMinRestHours(Number(e.target.value))}
                  className="h-10 w-20 rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] px-2.5 text-sm font-extrabold text-[#18181B] focus:border-[#0F766E] focus:outline-none text-center"
                />
                <span className="text-xs font-semibold text-[#78716C]">hours</span>
              </div>
              <p className="text-[11px] text-[#78716C]">
                Requires Post-Night (PN) recovery buffer.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Duration / Scope of Active Use */}
        <div className="space-y-3 rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] p-4">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#18181B]">
            <Calendar className="h-4 w-4 text-[#0F766E]" />
            <span>2. Duration of Active Use &amp; Application Scope</span>
          </div>

          <div className="grid gap-2 grid-cols-3">
            <button
              type="button"
              onClick={() => setScopeType('month')}
              className={`rounded-xl border p-2.5 text-left text-xs transition-colors cursor-pointer ${
                scopeType === 'month'
                  ? 'border-[#0F766E] bg-[#F0FDFA] text-[#0F766E] font-extrabold'
                  : 'border-[#E7E5E4] bg-white text-[#57534E] font-bold hover:text-[#18181B]'
              }`}
            >
              <div>By Month</div>
              <div className="text-[10px] font-medium text-[#78716C] mt-0.5">Single month</div>
            </button>

            <button
              type="button"
              onClick={() => setScopeType('date_range')}
              className={`rounded-xl border p-2.5 text-left text-xs transition-colors cursor-pointer ${
                scopeType === 'date_range'
                  ? 'border-[#0F766E] bg-[#F0FDFA] text-[#0F766E] font-extrabold'
                  : 'border-[#E7E5E4] bg-white text-[#57534E] font-bold hover:text-[#18181B]'
              }`}
            >
              <div>Date Range</div>
              <div className="text-[10px] font-medium text-[#78716C] mt-0.5">Custom dates</div>
            </button>

            <button
              type="button"
              onClick={() => setScopeType('ongoing')}
              className={`rounded-xl border p-2.5 text-left text-xs transition-colors cursor-pointer ${
                scopeType === 'ongoing'
                  ? 'border-[#0F766E] bg-[#F0FDFA] text-[#0F766E] font-extrabold'
                  : 'border-[#E7E5E4] bg-white text-[#57534E] font-bold hover:text-[#18181B]'
              }`}
            >
              <div>Ongoing</div>
              <div className="text-[10px] font-medium text-[#78716C] mt-0.5">Standard</div>
            </button>
          </div>

          {scopeType === 'month' && (
            <div className="space-y-1.5 pt-1">
              <label htmlFor="scope-month-input" className="text-xs font-bold text-[#18181B]">
                Select Target Roster Month
              </label>
              <input
                id="scope-month-input"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-9 w-full rounded-xl border border-[#E7E5E4] bg-white px-3 text-xs font-semibold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
              />
            </div>
          )}

          {scopeType === 'date_range' && (
            <div className="grid gap-3 grid-cols-2 pt-1">
              <div className="space-y-1.5">
                <label htmlFor="scope-start-date" className="text-xs font-bold text-[#18181B]">
                  Start Date
                </label>
                <input
                  id="scope-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 w-full rounded-xl border border-[#E7E5E4] bg-white px-3 text-xs text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="scope-end-date" className="text-xs font-bold text-[#18181B]">
                  End Date
                </label>
                <input
                  id="scope-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 w-full rounded-xl border border-[#E7E5E4] bg-white px-3 text-xs text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                />
              </div>
            </div>
          )}

          {scopeType === 'ongoing' && (
            <div className="space-y-1.5 pt-1">
              <label htmlFor="scope-ongoing-start" className="text-xs font-bold text-[#18181B]">
                Effective From Date
              </label>
              <input
                id="scope-ongoing-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 w-full rounded-xl border border-[#E7E5E4] bg-white px-3 text-xs text-[#18181B] focus:border-[#0F766E] focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Section 3: Change Summary */}
        <div className="space-y-1.5">
          <label htmlFor="policy-change-summary" className="text-xs font-extrabold text-[#18181B]">
            Change Summary / Version Note <span className="text-rose-500">*</span>
          </label>
          <input
            id="policy-change-summary"
            type="text"
            required
            value={changeSummary}
            onChange={(e) => setChangeSummary(e.target.value)}
            placeholder="e.g. Adjusted consecutive work limits for January 2027"
            className="h-9 w-full rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] px-3 text-xs font-semibold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
          />
        </div>
      </form>
    </Modal>
  );
}
