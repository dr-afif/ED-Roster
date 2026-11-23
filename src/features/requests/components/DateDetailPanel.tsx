import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getShiftToneClasses } from '@/shared/ui';
import { toIsoDate, type RequestRecord } from '../domain/quota';
import { NewRequestForm } from './NewRequestForm';

function formatDisplayDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export interface DateDetailPanelProps {
  date: Date;
  holidayName?: string;
  requests: RequestRecord[];
  selectedName: string;
  selectedStaffId: number;
  isOwner?: boolean;
  editingRequest?: RequestRecord | null;
  teamMembers?: Array<{
    id: number;
    roster_name: string;
    display_name: string;
    staff_code: string;
  }>;
  onClose: () => void;
  onEdit: (request: RequestRecord) => void;
  onDelete: (request: RequestRecord) => void;
  onSubmit: (payload: {
    id?: number | string;
    staffId: number;
    date: string;
    request: string;
    comment?: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
  error?: string;
}

export function DateDetailPanel({
  date,
  holidayName,
  requests = [],
  selectedName,
  selectedStaffId,
  isOwner = false,
  editingRequest,
  teamMembers = [],
  onClose,
  onEdit,
  onDelete,
  onSubmit,
  isSubmitting = false,
  error = '',
}: DateDetailPanelProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => onClose?.(), 260);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  });

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const dateKey = toIsoDate(date);
  const displayDate = formatDisplayDate(date);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  const allDateRequests = requests.filter((r) => {
    const status = (r.status ?? '').toLowerCase();
    const isActive = status === 'active' || status === 'submitted' || status === 'approved';
    return isActive && toIsoDate(r.date) === dateKey;
  });

  const formInitialValues = editingRequest
    ? {
        id: editingRequest.id,
        date: editingRequest.date,
        request: editingRequest.request,
        comment: editingRequest.comment,
        name: editingRequest.name,
        staffId: editingRequest.staff_id ? Number(editingRequest.staff_id) : undefined,
      }
    : dateKey
      ? { date: dateKey }
      : null;

  return createPortal(
    <>
      <div
        className={`date-panel__backdrop${open ? ' date-panel__backdrop--open' : ''}`}
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        className={`date-panel${open ? ' date-panel--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Details for ${displayDate}`}
      >
        <div className="date-panel__handle" aria-hidden="true" />

        <div className="date-panel__header">
          <div className="min-w-0">
            <p className="date-panel__header-eyebrow">
              {editingRequest ? 'Editing Request' : 'Date Details'}
              {isWeekend ? ' · Weekend' : ''}
            </p>
            <h2 className="date-panel__header-title">{displayDate}</h2>
            {holidayName ? (
              <span className="mt-1 inline-flex items-center rounded-full border border-[#FECACA] bg-[#FFE4E6] px-2.5 py-0.5 text-[10px] font-extrabold text-[#BE123C]">
                Public Holiday: {holidayName}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="date-panel__close-btn"
            onClick={handleClose}
            aria-label="Close panel"
          >
            <X className="h-4 w-4 text-[#1C1917]" />
          </button>
        </div>

        <div className="date-panel__body">
          {allDateRequests.length > 0 ? (
            <div>
              <h3 className="date-panel__section-title">
                {allDateRequests.length} request
                {allDateRequests.length !== 1 ? 's' : ''} on this day
              </h3>
              <ul className="date-panel__request-list">
                {allDateRequests.map((r) => {
                  const isOwn = Boolean(
                    selectedStaffId && r.staff_id && String(r.staff_id) === String(selectedStaffId),
                  );
                  const canManage = isOwner || isOwn;

                  return (
                    <li
                      key={r.id ?? `${r.name}-${r.date}-${r.request}`}
                      className={`date-panel__request-item ${
                        isOwn ? 'date-panel__request-item--own' : ''
                      }`}
                    >
                      <div className="date-panel__request-info flex-1">
                        <span
                          className={`date-panel__request-badge shrink-0 ${getShiftToneClasses(
                            r.request,
                          )}`}
                        >
                          {r.request}
                        </span>
                        <span className="date-panel__request-name">{r.name}</span>
                        {r.comment ? (
                          <span className="date-panel__request-comment">{r.comment}</span>
                        ) : null}
                      </div>

                      {canManage ? (
                        <div className="date-panel__request-actions shrink-0">
                          <button
                            type="button"
                            className="date-panel__btn date-panel__btn--edit"
                            onClick={() => onEdit?.(r)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="date-panel__btn date-panel__btn--delete"
                            onClick={() => onDelete?.(r)}
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {error ? <div className="date-panel__error">{error}</div> : null}

          <div>
            <h3 className="date-panel__section-title">
              {editingRequest ? 'Update Request' : 'Add a Request'}
            </h3>
            <NewRequestForm
              selectedName={selectedName}
              selectedStaffId={selectedStaffId}
              isOwner={isOwner}
              initialValues={formInitialValues}
              requests={requests}
              teamMembers={teamMembers}
              onSubmit={onSubmit}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
