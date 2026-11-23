export const SHIFT_COLOR_OPTIONS = [
  {
    value: 'am',
    label: 'Morning / Day (Sage Olive)',
    preview: 'bg-[#E5EED8] text-[#2D4A22] border-[#C6D8B6]',
  },
  {
    value: 'pm',
    label: 'Evening (Periwinkle Blue)',
    preview: 'bg-[#DCE7F9] text-[#1E3A8A] border-[#B8CEF2]',
  },
  {
    value: 'on',
    label: 'Night Duty (Rose Pink)',
    preview: 'bg-[#FCE7F1] text-[#9D174D] border-[#F8B9D4]',
  },
  {
    value: 'pn',
    label: 'Post Night (Lavender)',
    preview: 'bg-[#E9E4FA] text-[#4C1D95] border-[#D0C6F5]',
  },
  {
    value: 'off',
    label: 'Rest Day / OFF (Stone)',
    preview: 'bg-[#F5F5F4] text-[#57534E] border-[#E7E5E4] font-bold',
  },
  {
    value: 'goff',
    label: 'Ganti OFF (Cream Gold)',
    preview: 'bg-[#FAF0CA] text-[#78350F] border-[#E6D490]',
  },
  {
    value: 'al',
    label: 'Annual Leave (Mint)',
    preview: 'bg-[#DCF5E8] text-[#14532D] border-[#A7DEC1]',
  },
  {
    value: 'mc',
    label: 'Medical Certificate (Amber)',
    preview: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
  },
  {
    value: 'el',
    label: 'Emergency Leave (Crimson)',
    preview: 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]',
  },
  {
    value: 'hka',
    label: 'Haji / Public Holiday OFF (Sand)',
    preview: 'bg-[#FEF3C7] text-[#854D0E] border-[#FDE047]',
  },
  {
    value: 'course',
    label: 'Course / Training (Teal)',
    preview: 'bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4]',
  },
  {
    value: 'default',
    label: 'Neutral (Warm Stone)',
    preview: 'bg-[#FAF8F5] text-[#18181B] border-[#E7E5E4]',
  },
] as const;

export function getShiftColorClass(token: string): string {
  const match = SHIFT_COLOR_OPTIONS.find((c) => c.value === token);
  return match?.preview ?? 'bg-[#FAF8F5] text-[#18181B] border-[#E7E5E4]';
}
