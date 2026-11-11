import { useMemo, useState } from 'react';
import { AlertCircle, Award, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button, Modal } from '@/shared/ui';
import { type ShiftDefinitionRow, useSubmitAmendmentMutation } from '../data/rosterQueries';
import {
  validateAbsenceOnly,
  validateAbsencePlusReplacement,
  validateAdminCorrection,
  validateShiftSwap,
} from '../domain/amendments';
import type {
  AmendmentCategory,
  AmendmentLineItem,
  Assignment,
  ShiftSemanticDefinition,
  StaffRosterIdentity,
} from '../domain/types';

type AmendRosterModalProps = {
  isOpen: boolean;
  onClose: () => void;
  periodId: number;
  periodDates: string[];
  staffList: StaffRosterIdentity[];
  shiftDefinitions: ShiftDefinitionRow[];
  currentAssignments: Assignment[];
  shiftSemantics: readonly ShiftSemanticDefinition[];
  initialStaffId?: number;
  initialDate?: string;
  initialShiftCode?: string;
  onSuccess?: () => void;
};

export function AmendRosterModal({
  isOpen,
  onClose,
  periodId,
  periodDates,
  staffList,
  shiftDefinitions,
  currentAssignments,
  shiftSemantics,
  initialStaffId,
  initialDate,
  initialShiftCode,
  onSuccess,
}: AmendRosterModalProps) {
  const [category, setCategory] = useState<AmendmentCategory>('absence_plus_replacement');
  const [staffAId, setStaffAId] = useState<number>(initialStaffId ?? staffList[0]?.id ?? 0);
  const [staffBId, setStaffBId] = useState<number>(
    staffList.find((s) => s.id !== (initialStaffId ?? staffList[0]?.id))?.id ?? 0,
  );
  const [dateA, setDateA] = useState<string>(initialDate ?? periodDates[0] ?? '');
  const [dateB, setDateB] = useState<string>(initialDate ?? periodDates[0] ?? '');

  const [toShiftCodeA, setToShiftCodeA] = useState<string>('EL');
  const [toShiftCodeB, setToShiftCodeB] = useState<string>(initialShiftCode ?? 'AM');

  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submitMutation = useSubmitAmendmentMutation(periodId);

  // Look up current shift codes for staff A and staff B
  const currentShiftA = useMemo(() => {
    return (
      currentAssignments.find((a) => a.staffId === staffAId && a.dutyDate === dateA)?.shiftCode ??
      'OFF'
    );
  }, [currentAssignments, staffAId, dateA]);

  const currentShiftB = useMemo(() => {
    return (
      currentAssignments.find((a) => a.staffId === staffBId && a.dutyDate === dateB)?.shiftCode ??
      'OFF'
    );
  }, [currentAssignments, staffBId, dateB]);

  // Check if replacement staff is on planned OFF/GOFF to alert GOFF compensatory rest accrual
  const replacementEarnsGoff = useMemo(() => {
    if (category !== 'absence_plus_replacement') return false;
    const isBOff = ['OFF', 'GOFF'].includes(currentShiftB.toUpperCase());
    const semantic = shiftSemantics.find(
      (s) => s.shiftCode.toUpperCase() === toShiftCodeB.toUpperCase(),
    );
    const providesCoverage = semantic ? semantic.providesCoverage : true;
    return isBOff && providesCoverage;
  }, [category, currentShiftB, toShiftCodeB, shiftSemantics]);

  const handleSubmit = async () => {
    setValidationErrors([]);
    setSubmitError(null);

    let preparedLines: AmendmentLineItem[] = [];

    if (category === 'absence_only') {
      const res = validateAbsenceOnly({
        staffId: staffAId,
        dutyDate: dateA,
        fromShiftCode: currentShiftA,
        toShiftCode: toShiftCodeA,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      });
      if (!res.isValid || !res.line) {
        setValidationErrors(res.errors);
        return;
      }
      preparedLines = [res.line];
    } else if (category === 'absence_plus_replacement') {
      const res = validateAbsencePlusReplacement({
        absentStaffId: staffAId,
        replacementStaffId: staffBId,
        dutyDate: dateA,
        absentFromShiftCode: currentShiftA,
        absentToShiftCode: toShiftCodeA,
        replacementFromShiftCode: currentShiftB,
        replacementToShiftCode: toShiftCodeB,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      });
      if (!res.isValid || !res.lines) {
        setValidationErrors(res.errors);
        return;
      }
      preparedLines = [...res.lines];
    } else if (category === 'shift_swap') {
      const res = validateShiftSwap({
        staffAId,
        staffBId,
        dateA,
        dateB,
        shiftA: currentShiftA,
        shiftB: currentShiftB,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      });
      if (!res.isValid || !res.lines) {
        setValidationErrors(res.errors);
        return;
      }
      preparedLines = [...res.lines];
    } else if (category === 'admin_correction') {
      const res = validateAdminCorrection({
        staffId: staffAId,
        dutyDate: dateA,
        fromShiftCode: currentShiftA,
        toShiftCode: toShiftCodeA,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      });
      if (!res.isValid || !res.line) {
        setValidationErrors(res.errors);
        return;
      }
      preparedLines = [res.line];
    }

    try {
      await submitMutation.mutateAsync({
        category,
        reason: reason.trim(),
        lines: preparedLines,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to submit amendment. Please try again.',
      );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Submit Operational Roster Amendment"
      description="Apply audited schedule changes with automatic rest protection and GOFF tracking."
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Category Selector Tabs */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Amendment Workflow
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-xl border border-border-default bg-surface-primary p-1 text-xs">
            <button
              type="button"
              onClick={() => setCategory('absence_plus_replacement')}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                category === 'absence_plus_replacement'
                  ? 'bg-brand-primary text-text-inverse'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Absence + Cover
            </button>
            <button
              type="button"
              onClick={() => setCategory('absence_only')}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                category === 'absence_only'
                  ? 'bg-brand-primary text-text-inverse'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Absence Only
            </button>
            <button
              type="button"
              onClick={() => setCategory('shift_swap')}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                category === 'shift_swap'
                  ? 'bg-brand-primary text-text-inverse'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Mutual Swap
            </button>
            <button
              type="button"
              onClick={() => setCategory('admin_correction')}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                category === 'admin_correction'
                  ? 'bg-brand-primary text-text-inverse'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Correction
            </button>
          </div>
        </div>

        {/* Dynamic Fields */}
        <div className="space-y-3 rounded-xl border border-border-default bg-surface-primary p-3.5">
          {/* Absence + Replacement Form */}
          {category === 'absence_plus_replacement' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="staff-a-select"
                    className="block text-xs font-medium text-text-secondary mb-1"
                  >
                    Absent Doctor
                  </label>
                  <select
                    id="staff-a-select"
                    value={staffAId}
                    onChange={(e) => setStaffAId(Number(e.target.value))}
                    className="w-full rounded-xl border border-border-default bg-surface-solid px-3 py-2 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
                  >
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.rosterName} ({s.staffCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="duty-date-select"
                    className="block text-xs font-medium text-text-secondary mb-1"
                  >
                    Duty Date
                  </label>
                  <select
                    id="duty-date-select"
                    value={dateA}
                    onChange={(e) => {
                      setDateA(e.target.value);
                      setDateB(e.target.value);
                    }}
                    className="w-full rounded-xl border border-border-default bg-surface-solid px-3 py-2 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
                  >
                    {periodDates.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="to-shift-a"
                    className="block text-xs font-medium text-text-secondary mb-1"
                  >
                    Absent Doctor Status ({currentShiftA} → ?)
                  </label>
                  <select
                    id="to-shift-a"
                    value={toShiftCodeA}
                    onChange={(e) => setToShiftCodeA(e.target.value)}
                    className="w-full rounded-xl border border-border-default bg-surface-solid px-3 py-2 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
                  >
                    {['EL', 'MC', 'AL', 'OFF', 'HKA'].map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="staff-b-select"
                    className="block text-xs font-medium text-text-secondary mb-1"
                  >
                    Replacement Doctor
                  </label>
                  <select
                    id="staff-b-select"
                    value={staffBId}
                    onChange={(e) => setStaffBId(Number(e.target.value))}
                    className="w-full rounded-xl border border-border-default bg-surface-solid px-3 py-2 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
                  >
                    {staffList
                      .filter((s) => s.id !== staffAId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.rosterName} ({s.staffCode})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="to-shift-b"
                  className="block text-xs font-medium text-text-secondary mb-1"
                >
                  Replacement Doctor Assigned Shift ({currentShiftB} → ?)
                </label>
                <select
                  id="to-shift-b"
                  value={toShiftCodeB}
                  onChange={(e) => setToShiftCodeB(e.target.value)}
                  className="w-full rounded-xl border border-border-default bg-surface-solid px-3 py-2 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
                >
                  {shiftDefinitions.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} · {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* GOFF compensatory rest alert banner */}
              {replacementEarnsGoff && (
                <div className="flex items-center gap-2 rounded-xl border border-brand-primary/30 bg-brand-primary/10 p-3 text-xs text-brand-primary">
                  <Award className="h-4 w-4 shrink-0 text-brand-primary" />
                  <span>
                    <strong>Compensatory Rest Alert:</strong> The replacement doctor is being called
                    in from scheduled off-duty ({currentShiftB}). This displaces normal rest and
                    will accrue <strong>+1 GOFF</strong> upon roster reconciliation.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Absence Only Form */}
          {category === 'absence_only' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="absent-only-staff"
                    className="block text-xs font-medium text-text-secondary mb-1"
                  >
                    Absent Doctor
                  </label>
                  <select
                    id="absent-only-staff"
                    value={staffAId}
                    onChange={(e) => setStaffAId(Number(e.target.value))}
                    className="w-full rounded-xl border border-border-default bg-surface-solid px-3 py-2 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
                  >
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.rosterName} ({s.staffCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="absent-only-date"
                    className="block text-xs font-medium text-text-secondary mb-1"
                  >
                    Duty Date
                  </label>
                  <select
                    id="absent-only-date"
                    value={dateA}
                    onChange={(e) => setDateA(e.target.value)}
                    className="w-full rounded-xl border border-border-default bg-surface-solid px-3 py-2 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
                  >
                    {periodDates.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="absent-only-shift"
                  className="block text-xs font-medium text-text-secondary mb-1"
                >
                  Absence Shift Code ({currentShiftA} → ?)
                </label>
                <select
                  id="absent-only-shift"
                  value={toShiftCodeA}
                  onChange={(e) => setToShiftCodeA(e.target.value)}
                  className="w-full rounded-xl border border-border-default bg-surface-solid px-3 py-2 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
                >
                  {['EL', 'MC', 'AL', 'OFF', 'HKA'].map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Mutual Shift Swap Form */}
          {category === 'shift_swap' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2 rounded-lg border border-border-default bg-surface-solid p-3">
                  <div className="text-xs font-semibold text-text-primary">First Doctor (A)</div>
                  <select
                    value={staffAId}
                    onChange={(e) => setStaffAId(Number(e.target.value))}
                    className="w-full rounded-xl border border-border-default bg-surface-solid px-3 py-1.5 text-xs text-text-primary"
                  >
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.rosterName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={dateA}
                    onChange={(e) => setDateA(e.target.value)}
                    className="w-full rounded-xl border border-border-default bg-surface-solid px-3 py-1.5 text-xs text-text-primary"
                  >
                    {periodDates.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-text-muted">
                    Original Shift:{' '}
                    <span className="font-semibold text-text-primary">{currentShiftA}</span>
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-border-default bg-surface-solid p-3">
                  <div className="text-xs font-semibold text-text-primary">Second Doctor (B)</div>
                  <select
                    value={staffBId}
                    onChange={(e) => setStaffBId(Number(e.target.value))}
                    className="w-full rounded-xl border border-border-default bg-surface-solid px-3 py-1.5 text-xs text-text-primary"
                  >
                    {staffList
                      .filter((s) => s.id !== staffAId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.rosterName}
                        </option>
                      ))}
                  </select>
                  <select
                    value={dateB}
                    onChange={(e) => setDateB(e.target.value)}
                    className="w-full rounded-xl border border-border-default bg-surface-solid px-3 py-1.5 text-xs text-text-primary"
                  >
                    {periodDates.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-text-muted">
                    Original Shift:{' '}
                    <span className="font-semibold text-text-primary">{currentShiftB}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-brand-primary bg-brand-primary/10 rounded-lg p-2 font-medium">
                <RefreshCw className="h-3.5 w-3.5" />
                <span>
                  Dr A will take {currentShiftB} · Dr B will take {currentShiftA}
                </span>
              </div>
            </div>
          )}

          {/* Admin Correction Form */}
          {category === 'admin_correction' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="admin-corr-staff"
                    className="block text-xs font-medium text-text-secondary mb-1"
                  >
                    Doctor
                  </label>
                  <select
                    id="admin-corr-staff"
                    value={staffAId}
                    onChange={(e) => setStaffAId(Number(e.target.value))}
                    className="w-full rounded-xl border border-border-default bg-surface-solid px-3 py-2 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
                  >
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.rosterName} ({s.staffCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="admin-corr-date"
                    className="block text-xs font-medium text-text-secondary mb-1"
                  >
                    Duty Date
                  </label>
                  <select
                    id="admin-corr-date"
                    value={dateA}
                    onChange={(e) => setDateA(e.target.value)}
                    className="w-full rounded-xl border border-border-default bg-surface-solid px-3 py-2 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
                  >
                    {periodDates.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-corr-shift"
                  className="block text-xs font-medium text-text-secondary mb-1"
                >
                  Corrected Shift Code ({currentShiftA} → ?)
                </label>
                <select
                  id="admin-corr-shift"
                  value={toShiftCodeA}
                  onChange={(e) => setToShiftCodeA(e.target.value)}
                  className="w-full rounded-xl border border-border-default bg-surface-solid px-3 py-2 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
                >
                  {shiftDefinitions.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} · {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Operational Reason (Mandatory) */}
          <div>
            <label
              htmlFor="amend-reason"
              className="block text-xs font-medium text-text-secondary mb-1"
            >
              Mandatory Operational Reason <span className="text-danger">*</span>
            </label>
            <textarea
              id="amend-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. Acute gastroenteritis with MC; clinical coverage confirmed..."
              className="w-full rounded-xl border border-border-default bg-surface-solid px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none"
            />
          </div>

          {/* Internal Notes (Optional) */}
          <div>
            <label
              htmlFor="amend-notes"
              className="block text-xs font-medium text-text-secondary mb-1"
            >
              Internal Amendment Notes (Optional)
            </label>
            <input
              id="amend-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. WhatsApp confirmation attached, logged by MO IC"
              className="w-full rounded-xl border border-border-default bg-surface-solid px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="space-y-1 rounded-xl bg-danger/10 p-3 text-xs text-danger">
            {validationErrors.map((err, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{err}</span>
              </div>
            ))}
          </div>
        )}

        {/* Submit Error */}
        {submitError && (
          <div className="flex items-center gap-2 rounded-xl bg-danger/10 p-3 text-xs text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
          <Button variant="secondary" onClick={onClose} disabled={submitMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitMutation.isPending || reason.trim().length < 3}
            className="gap-2"
          >
            {submitMutation.isPending ? (
              'Submitting...'
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Submit Amendment
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
