export const SHIFT_COLOR_OPTIONS = [
  {
    value: 'am',
    label: 'Morning / Day (Sky)',
    preview: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  },
  {
    value: 'pm',
    label: 'Evening (Amber)',
    preview: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
  {
    value: 'on',
    label: 'Night Duty (Purple)',
    preview: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
  },
  {
    value: 'pn',
    label: 'Post Night (Violet)',
    preview: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  },
  {
    value: 'off',
    label: 'Rest Day / OFF (Slate)',
    preview: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30 font-bold',
  },
  {
    value: 'goff',
    label: 'Ganti OFF (Teal)',
    preview: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',
  },
  {
    value: 'al',
    label: 'Annual Leave (Emerald)',
    preview: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
  {
    value: 'mc',
    label: 'Medical Certificate (Orange)',
    preview: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  },
  {
    value: 'el',
    label: 'Emergency Leave (Rose)',
    preview: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  },
  {
    value: 'hka',
    label: 'Haji / Special Leave (Indigo)',
    preview: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
  },
  {
    value: 'course',
    label: 'Course / Training (Blue)',
    preview: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  },
  {
    value: 'default',
    label: 'Neutral Neutral (Gray)',
    preview: 'bg-surface-secondary text-text-primary border-border-default',
  },
] as const;

export function getShiftColorClass(token: string): string {
  const match = SHIFT_COLOR_OPTIONS.find((c) => c.value === token);
  return match?.preview ?? 'bg-surface-secondary text-text-primary border-border-default';
}
