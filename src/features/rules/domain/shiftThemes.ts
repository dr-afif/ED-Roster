export const SHIFT_COLOR_OPTIONS = [
  {
    value: 'am',
    label: 'Morning / Day (Sage Olive)',
    preview: 'bg-[#E5EED8] text-[#2D4A22] border-[#C6D8B6]',
  },
  {
    value: 'pm',
    label: 'Evening (Soft Yellow)',
    preview: 'bg-[#FEF9C3] text-[#854D0E] border-[#FDE047]',
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
    label: 'Annual Leave (Soft Purple)',
    preview: 'bg-[#F3E8FF] text-[#6B21A8] border-[#D8B4FE]',
  },
  {
    value: 'mc',
    label: 'Medical Certificate (Soft Purple)',
    preview: 'bg-[#F3E8FF] text-[#6B21A8] border-[#D8B4FE]',
  },
  {
    value: 'el',
    label: 'Emergency Leave (Soft Purple)',
    preview: 'bg-[#F3E8FF] text-[#6B21A8] border-[#D8B4FE]',
  },
  {
    value: 'hka',
    label: 'Haji / Public Holiday OFF (Soft Purple)',
    preview: 'bg-[#F3E8FF] text-[#6B21A8] border-[#D8B4FE]',
  },
  {
    value: 'course',
    label: 'Course / Training (Soft Orange)',
    preview: 'bg-[#FFEDD5] text-[#9A3412] border-[#FDBA74]',
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
