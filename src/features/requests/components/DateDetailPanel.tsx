import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toIsoDate, type RequestRecord } from '../domain/quota';
import { NewRequestForm } from './NewRequestForm';

const VARIANT_STYLES: Record<string, { background: string; color: string; borderColor: string }> = {
  am: { background: '#ecfdf5', color: '#047857', borderColor: '#34d399' },
  pm: { background: '#fef3c7', color: '#b45309', borderColor: '#facc15' },
  night: { background: '#fee2e2', color: '#b91c1c', borderColor: '#f87171' },
  on: { background: '#fee2e2', color: '#b91c1c', borderColor: '#f87171' },
  course: { background: '#dbeafe', color: '#1d4ed8', borderColor: '#60a5fa' },
  off: { background: '#ede9fe', color: '#5b21b6', borderColor: '#a855f7' },
  leave: { background: '#ede9fe', color: '#5b21b6', borderColor: '#a855f7' },
  al: { background: '#ede9fe', color: '#5b21b6', borderColor: '#a855f7' },
  hka: { background: '#f3e8ff', color: '#7c3aed', borderColor: '#c084fc' },
  ghka: { background: '#e0e7ff', color: '#4338ca', borderColor: '#6366f1' },
};

function getVariantStyle(requestStr?: string) {
  const key = (requestStr ?? '').toString().trim().toLowerCase();
  return (
    VARIANT_STYLES[key] ?? {
      background: '#f8fafc',
      color: '#0f172a',
      borderColor: '#e2e8f0',
    }
  );
}

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
    setTimeout(() => onClose?.(), 300);
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
          <div>
            <p className="date-panel__header-eyebrow">
              {editingRequest ? 'Editing Request' : 'Date Details'}
            </p>
            <h2 className="date-panel__header-title">{displayDate}</h2>
          </div>
          <button
            type="button"
            className="date-panel__close-btn"
            onClick={handleClose}
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>

        <div className="date-panel__body">
          {allDateRequests.length > 0 && (
            <div className="date-panel__section">
              <h3 className="date-panel__section-title">
                {allDateRequests.length} request
                {allDateRequests.length !== 1 ? 's' : ''} on this day
              </h3>
              <ul className="date-panel__request-list">
                {allDateRequests.map((r) => {
                  const style = getVariantStyle(r.request);
                  const isOwn =
                    selectedStaffId && r.staff_id && String(r.staff_id) === String(selectedStaffId);
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
                          className="date-panel__request-badge shrink-0"
                          style={{
                            background: style.background,
                            color: style.color,
                            borderColor: style.borderColor,
                          }}
                        >
                          {r.request}
                        </span>
                        <span className="date-panel__request-name">{r.name}</span>
                        {r.comment ? (
                          <span className="date-panel__request-comment">{r.comment}</span>
                        ) : null}
                      </div>

                      {canManage && (
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
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {error && <div className="date-panel__error">{error}</div>}

          <div className="date-panel__section">
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
