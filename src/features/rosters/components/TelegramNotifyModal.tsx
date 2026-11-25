import { useMemo, useState } from 'react';
import { CheckCircle2, Send, XCircle } from 'lucide-react';
import { Button, Modal, useToast } from '@/shared/ui';
import {
  useRosterTelegramDeliveriesQuery,
  useSendStaffTelegramMutation,
  useStaffTelegramStatusQuery,
  type SendStaffTelegramResult,
} from '../data/rosterQueries';
import type { AmendmentEvent, Assignment, StaffRosterIdentity } from '../domain/types';

export type TelegramNotifyMode = 'published_broadcast' | 'amendment_update';

export interface TelegramNotifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: TelegramNotifyMode;
  periodId: number;
  periodLabel: string;
  staffList: StaffRosterIdentity[];
  amendmentEvents?: AmendmentEvent[];
  focusEventId?: number | null;
  plannedAssignments?: Assignment[];
  currentAssignments?: Assignment[];
}

function formatShortDutyDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
    timeZone: 'UTC',
  });
}

function formatSentTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type DraftRecipient = {
  staff: StaffRosterIdentity;
  defaultMessage: string;
  amendmentEventIds?: number[];
  changeCount: number;
};

export function TelegramNotifyModal({
  isOpen,
  onClose,
  mode,
  periodId,
  periodLabel,
  staffList,
  amendmentEvents = [],
  focusEventId = null,
  plannedAssignments = [],
  currentAssignments = [],
}: TelegramNotifyModalProps) {
  const showToast = useToast();
  const { data: statusRows = [], isLoading: isLoadingStatus } = useStaffTelegramStatusQuery(isOpen);
  const { data: deliveryRows = [] } = useRosterTelegramDeliveriesQuery(periodId, isOpen);
  const sendMutation = useSendStaffTelegramMutation(periodId);

  const statusByStaffId = useMemo(
    () => new Map(statusRows.map((s) => [s.staff_id, s])),
    [statusRows],
  );

  const lastSentByStaffId = useMemo(() => {
    const map = new Map<number, (typeof deliveryRows)[number]>();
    for (const row of deliveryRows) {
      if (row.notification_type !== mode || row.status !== 'sent') continue;
      if (!map.has(row.staff_id)) {
        map.set(row.staff_id, row);
      }
    }
    return map;
  }, [deliveryRows, mode]);

  const draftRecipients = useMemo<DraftRecipient[]>(() => {
    const staffMap = new Map(staffList.map((s) => [s.id, s]));

    if (mode === 'published_broadcast') {
      return staffList.map((staff) => ({
        staff,
        changeCount: 0,
        defaultMessage: [
          `ED-Roster Published (${periodLabel})`,
          `Hi ${staff.rosterName || staff.displayName}, the ${periodLabel} roster is now published. Please check your shifts in the ED-Roster app.`,
        ].join('\n'),
      }));
    }

    const activeEvents = amendmentEvents.filter((ev) => {
      if (ev.status !== 'active') return false;
      if (focusEventId !== null && focusEventId !== undefined) {
        return ev.id === focusEventId;
      }
      return true;
    });

    if (focusEventId !== null && focusEventId !== undefined) {
      const byStaff = new Map<
        number,
        { lines: string[]; eventIds: Set<number>; reasons: Set<string> }
      >();
      for (const ev of activeEvents) {
        for (const line of ev.lines) {
          let entry = byStaff.get(line.staffId);
          if (!entry) {
            entry = { lines: [], eventIds: new Set(), reasons: new Set() };
            byStaff.set(line.staffId, entry);
          }
          entry.lines.push(
            `• ${formatShortDutyDate(line.dutyDate)}: ${line.fromShiftCode} → ${line.toShiftCode}`,
          );
          entry.eventIds.add(ev.id);
          if (ev.reason) entry.reasons.add(ev.reason);
        }
      }

      return Array.from(byStaff.entries())
        .map(([staffId, info]) => {
          const staff = staffMap.get(staffId);
          if (!staff) return null;
          const reasonLine =
            info.reasons.size > 0 ? `\nReason: ${Array.from(info.reasons).join('; ')}` : '';
          return {
            staff,
            changeCount: info.lines.length,
            amendmentEventIds: Array.from(info.eventIds),
            defaultMessage:
              [
                `ED-Roster Update (${periodLabel})`,
                `Hi ${staff.rosterName || staff.displayName}, your roster has been updated:`,
                ...info.lines,
              ].join('\n') + reasonLine,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    }

    // Batch mode: compute net diff per affected staff member (planned vs current)
    const plannedMap = new Map<string, string>();
    for (const a of plannedAssignments) {
      plannedMap.set(`${a.staffId}:${a.dutyDate}`, a.shiftCode);
    }
    const currentMap = new Map<string, string>();
    for (const a of currentAssignments) {
      currentMap.set(`${a.staffId}:${a.dutyDate}`, a.shiftCode);
    }

    const touchedByStaff = new Map<
      number,
      { dates: Set<string>; eventIds: Set<number>; reasons: Set<string> }
    >();
    for (const ev of activeEvents) {
      for (const line of ev.lines) {
        let entry = touchedByStaff.get(line.staffId);
        if (!entry) {
          entry = { dates: new Set(), eventIds: new Set(), reasons: new Set() };
          touchedByStaff.set(line.staffId, entry);
        }
        entry.dates.add(line.dutyDate);
        entry.eventIds.add(ev.id);
        if (ev.reason) entry.reasons.add(ev.reason);
      }
    }

    const results: DraftRecipient[] = [];
    for (const [staffId, info] of touchedByStaff.entries()) {
      const staff = staffMap.get(staffId);
      if (!staff) continue;
      const sortedDates = Array.from(info.dates).sort();
      const diffLines: string[] = [];
      for (const dutyDate of sortedDates) {
        const key = `${staffId}:${dutyDate}`;
        const fromCode = plannedMap.get(key) ?? 'OFF';
        const toCode = currentMap.get(key) ?? 'OFF';
        if (fromCode !== toCode) {
          diffLines.push(`• ${formatShortDutyDate(dutyDate)}: ${fromCode} → ${toCode}`);
        }
      }
      if (diffLines.length === 0) continue;
      const reasonLine =
        info.reasons.size > 0 ? `\nReason: ${Array.from(info.reasons).join('; ')}` : '';
      results.push({
        staff,
        changeCount: diffLines.length,
        amendmentEventIds: Array.from(info.eventIds),
        defaultMessage:
          [
            `ED-Roster Update (${periodLabel})`,
            `Hi ${staff.rosterName || staff.displayName}, your roster has been updated:`,
            ...diffLines,
          ].join('\n') + reasonLine,
      });
    }
    return results;
  }, [
    mode,
    staffList,
    periodLabel,
    amendmentEvents,
    focusEventId,
    plannedAssignments,
    currentAssignments,
  ]);

  const [selectedOverrides, setSelectedOverrides] = useState<Record<number, boolean>>({});
  const [messageOverrides, setMessageOverrides] = useState<Record<number, string>>({});
  const [broadcastNote, setBroadcastNote] = useState('');
  const [sendResults, setSendResults] = useState<Record<number, SendStaffTelegramResult>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isSelected = (staffId: number): boolean => {
    const st = statusByStaffId.get(staffId);
    if (!st?.telegram_linked) return false;
    if (staffId in selectedOverrides) {
      return Boolean(selectedOverrides[staffId]);
    }
    return Boolean(st.telegram_alerts_enabled);
  };

  const getMessageText = (r: DraftRecipient): string => {
    if (r.staff.id in messageOverrides) {
      return messageOverrides[r.staff.id] ?? r.defaultMessage;
    }
    return r.defaultMessage;
  };

  const selectedRecipients = draftRecipients.filter((r) => isSelected(r.staff.id));

  const handleSelectAllReady = (checked: boolean) => {
    const next: Record<number, boolean> = {};
    for (const r of draftRecipients) {
      const st = statusByStaffId.get(r.staff.id);
      if (st?.telegram_linked) {
        next[r.staff.id] = checked;
      }
    }
    setSelectedOverrides(next);
  };

  const handleApplyBroadcastNote = () => {
    const note = broadcastNote.trim();
    const next: Record<number, string> = {};
    for (const r of draftRecipients) {
      next[r.staff.id] = note ? `${r.defaultMessage}\n\nNote: ${note}` : r.defaultMessage;
    }
    setMessageOverrides(next);
    showToast('Updated all message previews');
  };

  const handleSend = async () => {
    if (selectedRecipients.length === 0) return;
    setSubmitError(null);
    try {
      const results = await sendMutation.mutateAsync({
        notificationType: mode,
        recipients: selectedRecipients.map((r) => ({
          staffId: r.staff.id,
          messageText: getMessageText(r).trim() || r.defaultMessage,
          amendmentEventIds: r.amendmentEventIds,
        })),
      });
      const resultMap: Record<number, SendStaffTelegramResult> = {};
      let sentCount = 0;
      let failedCount = 0;
      for (const res of results) {
        resultMap[res.staffId] = res;
        if (res.status === 'sent') sentCount += 1;
        else if (res.status === 'failed') failedCount += 1;
      }
      setSendResults(resultMap);
      showToast(
        failedCount > 0
          ? `Sent ${sentCount}, failed ${failedCount}`
          : `Sent ${sentCount} Telegram update${sentCount === 1 ? '' : 's'} ✓`,
      );
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to send Telegram updates.');
    }
  };

  const modalTitle =
    mode === 'published_broadcast'
      ? `Broadcast ${periodLabel} Roster`
      : focusEventId
        ? 'Notify Staff of Amendment'
        : `Notify Staff of ${periodLabel} Changes`;

  const modalDesc =
    mode === 'published_broadcast'
      ? 'Preview, customize, and send the roster published alert via @edroster_bot.'
      : 'Review net shift changes per doctor, edit messages if needed, and send when ready.';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      description={modalDesc}
      maxWidth="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#78716C]">
            {selectedRecipients.length} of {draftRecipients.length} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={sendMutation.isPending}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSend()}
              disabled={sendMutation.isPending || selectedRecipients.length === 0}
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {sendMutation.isPending
                ? 'Sending...'
                : `Send Telegram (${selectedRecipients.length})`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {submitError ? (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700"
          >
            {submitError}
          </div>
        ) : null}

        {mode === 'published_broadcast' && draftRecipients.length > 0 ? (
          <div className="rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] p-3 space-y-2">
            <label
              htmlFor="broadcast-global-note"
              className="block text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[#57534E]"
            >
              Optional Global Note (Apply to All Previews)
            </label>
            <div className="flex gap-2">
              <input
                id="broadcast-global-note"
                type="text"
                value={broadcastNote}
                onChange={(e) => setBroadcastNote(e.target.value)}
                placeholder="e.g. Please report any urgent swap requests by Friday."
                className="flex-1 rounded-xl border border-[#E7E5E4] bg-white px-3 py-1.5 text-xs font-medium text-[#18181B] focus:border-[#0F766E] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleApplyBroadcastNote}
                className="shrink-0 rounded-xl border border-[#E7E5E4] bg-white px-3 py-1.5 text-xs font-extrabold text-[#18181B] hover:bg-[#EFECE6] cursor-pointer"
              >
                Apply to All
              </button>
            </div>
          </div>
        ) : null}

        {draftRecipients.length > 0 ? (
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#57534E]">
              {isLoadingStatus
                ? 'Checking Telegram link status...'
                : `${draftRecipients.filter((r) => statusByStaffId.get(r.staff.id)?.telegram_linked).length} linked to @edroster_bot`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectAllReady(true)}
                className="font-extrabold text-[#0F766E] hover:underline cursor-pointer"
              >
                Select All Linked
              </button>
              <span className="text-[#D6D3D1]">|</span>
              <button
                type="button"
                onClick={() => handleSelectAllReady(false)}
                className="font-bold text-[#78716C] hover:underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}

        {draftRecipients.length === 0 ? (
          <div className="rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] p-6 text-center text-xs font-semibold text-[#78716C]">
            No net shift changes found to notify.
          </div>
        ) : (
          <div className="space-y-3">
            {draftRecipients.map((r) => {
              const st = statusByStaffId.get(r.staff.id);
              const linked = Boolean(st?.telegram_linked);
              const alertsEnabled = st?.telegram_alerts_enabled ?? true;
              const checked = isSelected(r.staff.id);
              const lastSent = lastSentByStaffId.get(r.staff.id);
              const result = sendResults[r.staff.id];

              return (
                <div
                  key={r.staff.id}
                  className={`rounded-2xl border p-3.5 space-y-2 transition ${
                    checked
                      ? 'border-[#99F6E4] bg-[#F0FDFA]/40'
                      : 'border-[#E7E5E4] bg-white opacity-85'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!linked || sendMutation.isPending}
                        checked={checked}
                        onChange={(e) =>
                          setSelectedOverrides((prev) => ({
                            ...prev,
                            [r.staff.id]: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-[#D6D3D1] text-[#0F766E] focus:ring-[#0F766E]"
                      />
                      <span className="text-xs font-extrabold text-[#18181B]">
                        {r.staff.rosterName || r.staff.displayName}
                      </span>
                      <span className="text-[10.5px] font-mono text-[#78716C]">
                        ({r.staff.staffCode})
                      </span>
                    </label>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {result ? (
                        result.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> Sent
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-extrabold text-rose-700">
                            <XCircle className="h-3 w-3" /> {result.error || 'Failed'}
                          </span>
                        )
                      ) : null}

                      {linked ? (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${
                            alertsEnabled
                              ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]'
                              : 'border-amber-200 bg-amber-50 text-amber-800'
                          }`}
                        >
                          {alertsEnabled
                            ? st?.telegram_username
                              ? `Ready (${st.telegram_username})`
                              : 'Ready'
                            : 'Alerts paused by user'}
                        </span>
                      ) : (
                        <span className="rounded-full border border-[#E7E5E4] bg-[#F5F5F4] px-2 py-0.5 text-[10px] font-bold text-[#78716C]">
                          Not linked
                        </span>
                      )}

                      {lastSent ? (
                        <span className="text-[10px] font-semibold text-[#78716C]">
                          Last sent: {formatSentTime(lastSent.sent_at)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <textarea
                    rows={mode === 'published_broadcast' ? 2 : Math.min(6, r.changeCount + 3)}
                    disabled={!linked || sendMutation.isPending}
                    value={getMessageText(r)}
                    onChange={(e) =>
                      setMessageOverrides((prev) => ({
                        ...prev,
                        [r.staff.id]: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[#E7E5E4] bg-white px-3 py-2 text-xs font-medium text-[#18181B] focus:border-[#0F766E] focus:outline-none disabled:bg-[#FAF8F5] disabled:text-[#78716C]"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
