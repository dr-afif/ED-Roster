import { useEffect, useState } from 'react';
import { AlertCircle, Calendar, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import type { RuleVersionRow } from '@/features/rosters/data/rosterQueries';
import { useUpdateRuleVersionMutation } from '@/features/rosters/data/rosterQueries';
import type { Json } from '@/platform/supabase/database.types';

export interface EditPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  ruleVersion?: RuleVersionRow | null;
}

export function EditPolicyModal({ isOpen, onClose, ruleVersion }: EditPolicyModalProps) {
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !ruleVersion) return null;

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
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update rule version.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border-default bg-surface-primary p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border-subtle pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand-primary" />
              <h2 id="policy-modal-title" className="text-base font-bold text-text-primary">
                Edit Scheduling Policies &amp; Limits
              </h2>
            </div>
            <p className="text-xs text-text-secondary">
              Configure deterministic scheduling constraints and establish the duration of active use.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={updateMutation.isPending}
            className="rounded-lg p-1.5 text-text-muted hover:bg-surface-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          {/* Section 1: Policies & Limits */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
              1. Deterministic Roster Policies
            </h3>

            {/* Weekly OFF Policy */}
            <div className="space-y-1.5">
              <label htmlFor="weekly-off-select" className="text-xs font-semibold text-text-primary">
                Weekly OFF Entitlement Policy
              </label>
              <select
                id="weekly-off-select"
                value={weeklyOffPolicy}
                onChange={(e) => setWeeklyOffPolicy(e.target.value as 'policy_b' | 'policy_a')}
                className="h-10 w-full rounded-xl border border-border-default bg-surface-secondary/50 px-3 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
              >
                <option value="policy_b">
                  Policy B (Standard ED): 1 OFF with night duty, 2 OFFs without night duty
                </option>
                <option value="policy_a">
                  Policy A: Exactly 1 normal OFF per week for all staff
                </option>
              </select>
              <p className="text-[11px] text-text-muted">
                Evaluated strictly on a per-week basis across Monday–Sunday boundaries.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Max Consecutive Days */}
              <div className="space-y-1.5">
                <label htmlFor="max-consecutive" className="text-xs font-semibold text-text-primary">
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
                    className="h-10 w-24 rounded-xl border border-border-default bg-surface-secondary/50 px-3 text-sm font-bold text-text-primary focus:border-brand-primary focus:outline-none text-center"
                  />
                  <span className="text-xs text-text-muted">days worked</span>
                </div>
                <p className="text-[11px] text-text-muted">
                  Triggers fatigue limit violation if exceeded.
                </p>
              </div>

              {/* Night Rest Requirement */}
              <div className="space-y-1.5">
                <label htmlFor="min-rest-hours" className="text-xs font-semibold text-text-primary">
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
                    className="h-10 w-24 rounded-xl border border-border-default bg-surface-secondary/50 px-3 text-sm font-bold text-text-primary focus:border-brand-primary focus:outline-none text-center"
                  />
                  <span className="text-xs text-text-muted">hours rest</span>
                </div>
                <p className="text-[11px] text-text-muted">
                  Requires Post-Night (PN) buffer before working again.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Duration / Scope of Active Use */}
          <div className="space-y-3 rounded-xl border border-border-subtle bg-surface-secondary/30 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
              <Calendar className="h-4 w-4 text-brand-primary" />
              2. Duration of Active Use &amp; Application Scope
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setScopeType('month')}
                className={`rounded-xl border p-2.5 text-left text-xs transition-colors ${
                  scopeType === 'month'
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-bold'
                    : 'border-border-default bg-surface-primary text-text-secondary hover:text-text-primary'
                }`}
              >
                <div>By Month Basis</div>
                <div className="text-[10px] font-normal text-text-muted mt-0.5">
                  Applies to specific roster month
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScopeType('date_range')}
                className={`rounded-xl border p-2.5 text-left text-xs transition-colors ${
                  scopeType === 'date_range'
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-bold'
                    : 'border-border-default bg-surface-primary text-text-secondary hover:text-text-primary'
                }`}
              >
                <div>Specific Dates Basis</div>
                <div className="text-[10px] font-normal text-text-muted mt-0.5">
                  Custom festive / peak date window
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScopeType('ongoing')}
                className={`rounded-xl border p-2.5 text-left text-xs transition-colors ${
                  scopeType === 'ongoing'
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-bold'
                    : 'border-border-default bg-surface-primary text-text-secondary hover:text-text-primary'
                }`}
              >
                <div>Ongoing / Standard</div>
                <div className="text-[10px] font-normal text-text-muted mt-0.5">
                  Active until next policy version
                </div>
              </button>
            </div>

            {/* Scope Inputs */}
            {scopeType === 'month' && (
              <div className="space-y-1.5 pt-2">
                <label htmlFor="scope-month-input" className="text-xs font-semibold text-text-primary">
                  Select Target Roster Month
                </label>
                <input
                  id="scope-month-input"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="h-9 w-full rounded-xl border border-border-default bg-surface-primary px-3 text-xs font-semibold text-text-primary focus:border-brand-primary focus:outline-none"
                />
                <p className="text-[11px] text-text-muted">
                  Automatically scopes active policy from 1st to last day of {selectedMonth}.
                </p>
              </div>
            )}

            {scopeType === 'date_range' && (
              <div className="grid gap-3 sm:grid-cols-2 pt-2">
                <div className="space-y-1.5">
                  <label htmlFor="scope-start-date" className="text-xs font-semibold text-text-primary">
                    Start Date
                  </label>
                  <input
                    id="scope-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9 w-full rounded-xl border border-border-default bg-surface-primary px-3 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="scope-end-date" className="text-xs font-semibold text-text-primary">
                    End Date
                  </label>
                  <input
                    id="scope-end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9 w-full rounded-xl border border-border-default bg-surface-primary px-3 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
                  />
                </div>
              </div>
            )}

            {scopeType === 'ongoing' && (
              <div className="space-y-1.5 pt-2">
                <label htmlFor="scope-ongoing-start" className="text-xs font-semibold text-text-primary">
                  Effective From Date
                </label>
                <input
                  id="scope-ongoing-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 w-full rounded-xl border border-border-default bg-surface-primary px-3 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
                />
                <p className="text-[11px] text-text-muted">
                  Enforces policies across all weekly cycles indefinitely starting from this date.
                </p>
              </div>
            )}
          </div>

          {/* Section 3: Change Summary */}
          <div className="space-y-1.5">
            <label htmlFor="policy-change-summary" className="text-xs font-semibold text-text-primary">
              Change Summary / Version Note <span className="text-rose-500">*</span>
            </label>
            <input
              id="policy-change-summary"
              type="text"
              required
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="e.g. Adjusted consecutive work limits for January 2027"
              className="h-9 w-full rounded-xl border border-border-default bg-surface-secondary/50 px-3 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              disabled={updateMutation.isPending}
              className="rounded-xl border border-border-default px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-secondary transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-xs font-semibold text-text-inverse hover:bg-brand-primary-hover shadow-xs transition-colors disabled:opacity-50"
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
        </form>
      </div>
    </div>
  );
}
