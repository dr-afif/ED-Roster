import { stripShiftModifiers } from '@/shared/ui';

const REQUEST_VARIANT_MAP: Record<string, string> = {
  AM: 'req--am',
  OH: 'req--am',
  PM: 'req--pm',
  ON1: 'req--night',
  ON2: 'req--night',
  ON: 'req--night',
  ND: 'req--night',
  NIGHT: 'req--night',
  PN: 'req--night',
  COURSE: 'req--course',
  COURT: 'req--course',
  MEDSB: 'req--course',
  AL: 'req--leave',
  EL: 'req--leave',
  MC: 'req--leave',
  HKA: 'req--leave',
  GHKA: 'req--leave',
  LEAVE: 'req--leave',
  OFF: 'req--off',
  GOFF: 'req--off',
};

/**
 * Returns the CSS variant class (e.g. `req--pm`) for a request shift code
 * on the Request page calendar and desktop matrix table.
 */
export function getRequestVariant(rawCode?: string | null): string {
  const { cleanShift } = stripShiftModifiers(rawCode ?? undefined);
  if (!cleanShift) {
    return 'req--default';
  }
  if (REQUEST_VARIANT_MAP[cleanShift]) {
    return REQUEST_VARIANT_MAP[cleanShift];
  }
  if (cleanShift.includes('NIGHT')) {
    return 'req--night';
  }
  if (cleanShift.includes('COURSE')) {
    return 'req--course';
  }
  if (cleanShift.includes('LEAVE')) {
    return 'req--leave';
  }
  if (cleanShift.includes('OFF')) {
    return 'req--off';
  }
  return 'req--default';
}

/**
 * Returns Tailwind pill classes for the Request page (NewRequestForm,
 * DateDetailPanel, UserRequests, and mobile RosterTable cards), keeping
 * AM, ON1, and OFF unchanged while styling PM (yellow), Course (orange),
 * and other Leaves (purple).
 */
export function getRequestPillClasses(rawCode?: string | null): string {
  const { cleanShift } = stripShiftModifiers(rawCode ?? undefined);
  if (!cleanShift) {
    return 'bg-transparent text-[#A8A29E] border border-transparent';
  }

  switch (getRequestVariant(rawCode)) {
    case 'req--am':
      return 'bg-[#E5EED8] text-[#2D4A22] border border-[#C6D8B6]';
    case 'req--pm':
      return 'bg-[#FEF9C3] text-[#854D0E] border border-[#FDE047]';
    case 'req--night':
      return 'bg-[#FCE7F1] text-[#9D174D] border border-[#F8B9D4]';
    case 'req--course':
      return 'bg-[#FFEDD5] text-[#9A3412] border border-[#FDBA74]';
    case 'req--leave':
      return 'bg-[#F3E8FF] text-[#6B21A8] border border-[#D8B4FE]';
    case 'req--off':
    default:
      return 'bg-[#F5F5F4] text-[#57534E] border border-[#E7E5E4]';
  }
}
