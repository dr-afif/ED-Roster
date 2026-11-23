import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  presentation?: 'modal' | 'drawer';
  headerExtra?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};

const MAX_WIDTHS = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  maxWidth = 'md',
  presentation = 'modal',
  headerExtra,
  footer,
  children,
}: ModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const titleId = `modal-title-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const descId = description ? `${titleId}-desc` : undefined;
  const isDrawer = presentation === 'drawer';

  return (
    <div
      className={`fixed inset-0 z-50 flex ${
        isDrawer
          ? 'items-end sm:items-stretch sm:justify-end'
          : 'items-end sm:items-center sm:justify-center sm:p-4'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      {/* Warm Editorial Backdrop */}
      <div
        className="fixed inset-0 bg-[#18181B]/55 backdrop-blur-[3px] transition-opacity"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Dialog Surface */}
      <div
        className={`relative z-10 flex w-full flex-col overflow-hidden border border-[#E7E5E4] bg-white text-[#1C1917] shadow-2xl ${
          isDrawer
            ? 'max-h-[85dvh] rounded-t-[28px] sm:h-full sm:max-h-full sm:w-[420px] sm:max-w-[92vw] sm:rounded-none sm:rounded-l-[24px] sheet-slide-up sm:drawer-slide-left'
            : `${MAX_WIDTHS[maxWidth]} max-h-[85dvh] sm:max-h-[90vh] rounded-t-[28px] sm:rounded-[24px] sheet-slide-up sm:animate-in`
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Sheet Drag Handle Pill */}
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-[#D6D3D1] sm:hidden" />

        {/* Sticky Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#F4EFE6] bg-white/95 px-5 py-3.5 backdrop-blur-xs">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[16px] font-extrabold tracking-tight text-[#18181B]">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-0.5 text-[11.5px] font-semibold text-[#78716C]">
                {description}
              </p>
            ) : null}
          </div>
          {headerExtra ?? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E7E5E4] bg-white text-[#57534E] hover:bg-[#FAF8F5] hover:text-[#18181B] focus-visible:outline-2 focus-visible:outline-brand-primary cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Scrollable Body */}
        <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {/* Optional Sticky Footer */}
        {footer ? (
          <div className="shrink-0 border-t border-[#F4EFE6] bg-white/95 px-5 py-3.5 backdrop-blur-xs">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
