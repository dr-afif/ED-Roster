import React, { useId } from 'react';

export interface SegmentedArcGaugeProps {
  /** Current percentage or progress value (0 to 100, or relative to maxValue) */
  value: number;
  /** Maximum progress value (defaults to 100) */
  maxValue?: number;
  /** Primary center label (e.g. "77%" or "14/15"). Defaults to `${Math.round(percent)}%` */
  title?: string;
  /** Subtitle rendered directly below the title (e.g. "Near complete") */
  subtitle?: string;
  /** Header label rendered above the arc (e.g. "Overall progress") */
  label?: string;
  /** Optional action or dropdown icon next to the header label */
  headerAction?: React.ReactNode;
  /** Visual color theme: rainbow (matches reference images), teal, coral, or emerald */
  palette?: 'rainbow' | 'teal' | 'coral' | 'emerald';
  /** Diameter/size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional wrapper CSS classes */
  className?: string;
}

// 16 curated pastel/vibrant segments matching the reference design:
// Starts with soft rose/pink -> lime/sage -> sky blue -> warm yellow/amber
const RAINBOW_SEGMENTS = [
  '#F472B6', // 0: Rose pink
  '#F472B6', // 1: Rose pink
  '#FB7185', // 2: Coral rose
  '#A3E635', // 3: Lime sage
  '#84CC16', // 4: Olive sage
  '#22C55E', // 5: Green
  '#10B981', // 6: Emerald
  '#38BDF8', // 7: Sky
  '#60A5FA', // 8: Soft blue
  '#818CF8', // 9: Periwinkle
  '#A78BFA', // 10: Lavender
  '#FBBF24', // 11: Honey amber
  '#F59E0B', // 12: Warm amber
  '#FCD34D', // 13: Light gold
  '#FDE68A', // 14: Soft cream gold
  '#FEF08A', // 15: Pastel yellow
];

const TEAL_SEGMENTS = [
  '#2DD4BF', '#14B8A6', '#0D9488', '#0F766E',
  '#115E59', '#134E4A', '#2DD4BF', '#14B8A6',
  '#0D9488', '#0F766E', '#115E59', '#14B8A6',
  '#2DD4BF', '#5EEAD4', '#99F6E4', '#CCFBF1',
];

const CORAL_SEGMENTS = [
  '#FB7185', '#F43F5E', '#E11D48', '#FB923C',
  '#F97316', '#EA580C', '#FBBF24', '#F59E0B',
  '#FB7185', '#F43F5E', '#FB923C', '#F97316',
  '#FBBF24', '#FDE047', '#FED7AA', '#FFE4E6',
];

const EMERALD_SEGMENTS = [
  '#86EFAC', '#4ADE80', '#22C55E', '#16A34A',
  '#15803D', '#166534', '#86EFAC', '#4ADE80',
  '#22C55E', '#16A34A', '#15803D', '#4ADE80',
  '#86EFAC', '#BBF7D0', '#DCFCE7', '#F0FDF4',
];

const TOTAL_SEGMENTS = 16;
const CX = 100;
const CY = 92;
const R_IN = 58;
const R_OUT = 78;

export function SegmentedArcGauge({
  value,
  maxValue = 100,
  title,
  subtitle,
  label,
  headerAction,
  palette = 'rainbow',
  size = 'md',
  className = '',
}: SegmentedArcGaugeProps) {
  const titleId = useId();
  const normalizedPercent = Math.max(0, Math.min(100, (value / (maxValue || 1)) * 100));
  const activeCount = Math.round((normalizedPercent / 100) * TOTAL_SEGMENTS);

  const segmentColors =
    palette === 'teal'
      ? TEAL_SEGMENTS
      : palette === 'coral'
        ? CORAL_SEGMENTS
        : palette === 'emerald'
          ? EMERALD_SEGMENTS
          : RAINBOW_SEGMENTS;

  const displayTitle = title ?? `${Math.round(normalizedPercent)}%`;

  const sizeClasses = {
    sm: 'max-w-[180px]',
    md: 'max-w-[240px]',
    lg: 'max-w-[300px]',
  }[size];

  return (
    <div
      role="region"
      aria-labelledby={label ? titleId : undefined}
      className={`flex flex-col items-center select-none ${sizeClasses} ${className}`}
    >
      {label ? (
        <div className="w-full flex items-center justify-between px-1 mb-2 text-text-secondary">
          <span id={titleId} className="text-xs font-bold tracking-tight text-text-primary">
            {label}
          </span>
          {headerAction}
        </div>
      ) : null}

      <div className="relative w-full aspect-[200/125]">
        <svg
          viewBox="0 0 200 120"
          className="w-full h-full overflow-visible"
          aria-hidden="true"
        >
          {Array.from({ length: TOTAL_SEGMENTS }).map((_, i) => {
            // Semicircular angle: 180° (left) down to 0° (right)
            const angleDeg = 180 - (i * 180) / (TOTAL_SEGMENTS - 1);
            const rad = (angleDeg * Math.PI) / 180;
            const x1 = +(CX + R_IN * Math.cos(rad)).toFixed(2);
            const y1 = +(CY - R_IN * Math.sin(rad)).toFixed(2);
            const x2 = +(CX + R_OUT * Math.cos(rad)).toFixed(2);
            const y2 = +(CY - R_OUT * Math.sin(rad)).toFixed(2);

            const isFilled = i < activeCount;
            const strokeColor = isFilled ? segmentColors[i] : '#E7E5E4'; // stone-200 for unfilled
            const opacity = isFilled ? 1 : 0.45;

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={strokeColor}
                strokeWidth={7.5}
                strokeLinecap="round"
                opacity={opacity}
                className="transition-all duration-300 ease-out"
                style={{
                  transitionDelay: `${i * 16}ms`,
                }}
              />
            );
          })}

          {/* Center Title & Subtitle */}
          <text
            x={CX}
            y={CY - 16}
            textAnchor="middle"
            className="fill-stone-900 font-extrabold text-[28px] tracking-tight tabular-nums select-none"
            style={{ fontFeatureSettings: '"tnum"' }}
          >
            {displayTitle}
          </text>

          {subtitle ? (
            <text
              x={CX}
              y={CY + 5}
              textAnchor="middle"
              className="fill-stone-500 font-medium text-[11px] tracking-tight select-none"
            >
              {subtitle}
            </text>
          ) : null}
        </svg>
      </div>
    </div>
  );
}
