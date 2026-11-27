/**
 * Canonical Warm Editorial shift palette matching the interactive prototype.
 */
export function stripShiftModifiers(rawCode?: string): {
  cleanShift: string;
  isStandby: boolean;
  isExtended: boolean;
} {
  if (!rawCode) {
    return { cleanShift: '', isStandby: false, isExtended: false };
  }
  const upper = String(rawCode).trim().toUpperCase();
  const isStandby = upper.includes('(S)') || upper.endsWith('-S');
  const strippedStandby = upper.replace(/\(S\)|-S/g, '').trim();
  const isExtended =
    strippedStandby.includes('(X)') ||
    strippedStandby.endsWith('-X') ||
    strippedStandby === 'AMX' ||
    strippedStandby === 'PMX';
  let cleanShift = strippedStandby.replace(/\(X\)|-X/g, '').trim();
  if (cleanShift === 'AMX') cleanShift = 'AM';
  else if (cleanShift === 'PMX') cleanShift = 'PM';
  return { cleanShift, isStandby, isExtended };
}

export function getShiftToneClasses(rawCode?: string, isHonoredRequest = false): string {
  const { cleanShift } = stripShiftModifiers(rawCode);
  if (!cleanShift) {
    return 'bg-transparent text-[#A8A29E] border border-transparent';
  }

  if (isHonoredRequest) {
    if (cleanShift === 'AM' || cleanShift === 'OH') {
      return 'bg-[#3F6212] text-white border border-[#365314] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]';
    }
    if (cleanShift === 'PM') {
      return 'bg-[#CA8A04] text-white border border-[#A16207] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]';
    }
    if (['ON1', 'ON2', 'ON', 'ND', 'NIGHT', 'PN'].includes(cleanShift)) {
      return 'bg-[#BE185D] text-white border border-[#9D174D] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]';
    }
    if (cleanShift === 'COURSE' || cleanShift === 'COURT' || cleanShift === 'MEDSB') {
      return 'bg-[#EA580C] text-white border border-[#C2410C] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]';
    }
    if (['AL', 'EL', 'MC', 'HKA', 'GHKA', 'LEAVE'].includes(cleanShift)) {
      return 'bg-[#7E22CE] text-white border border-[#6B21A8] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]';
    }
    if (cleanShift === 'OFF' || cleanShift === 'GOFF') {
      return 'bg-[#44403C] text-white border border-[#292524] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]';
    }
    return 'bg-[#0F766E] text-white border border-[#115E59] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]';
  }

  if (cleanShift === 'AM' || cleanShift === 'OH') {
    return 'bg-[#E5EED8] text-[#2D4A22] border border-[#C6D8B6]';
  }
  if (cleanShift === 'PM') {
    return 'bg-[#FEF9C3] text-[#854D0E] border border-[#FDE047]';
  }
  if (['ON1', 'ON2', 'ON', 'ND', 'NIGHT', 'PN'].includes(cleanShift)) {
    return 'bg-[#FCE7F1] text-[#9D174D] border border-[#F8B9D4]';
  }
  if (['AL', 'EL', 'MC', 'HKA', 'GHKA', 'LEAVE'].includes(cleanShift)) {
    return 'bg-[#F3E8FF] text-[#6B21A8] border border-[#D8B4FE]';
  }
  if (cleanShift === 'COURSE' || cleanShift === 'COURT' || cleanShift === 'MEDSB') {
    return 'bg-[#FFEDD5] text-[#9A3412] border border-[#FDBA74]';
  }
  return 'bg-[#F5F5F4] text-[#57534E] border border-[#E7E5E4]';
}
