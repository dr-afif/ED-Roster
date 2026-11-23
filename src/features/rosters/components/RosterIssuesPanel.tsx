import { useState } from 'react';
import type { RosterIssue } from '../domain/types';

interface RosterIssuesPanelProps {
  issues: readonly RosterIssue[];
  onSelectIssue?: (issue: RosterIssue) => void;
}

export function RosterIssuesPanel({ issues, onSelectIssue }: RosterIssuesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'error' | 'warning' | 'info'>('all');

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const infos = issues.filter((i) => i.severity === 'info');

  const filteredIssues =
    filterSeverity === 'all' ? issues : issues.filter((i) => i.severity === filterSeverity);

  return (
    <div
      id="rules-guidance"
      className="overflow-hidden rounded-[22px] border border-[#E7E5E4] bg-white shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)]"
    >
      {/* Warm Editorial Header bar */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'Collapse issues panel' : 'Expand issues panel'}
        className={`flex w-full cursor-pointer flex-wrap items-center justify-between gap-2 bg-[#FAFAF9] px-4 py-3 text-left ${
          isExpanded ? 'border-b border-[#E7E5E4]' : ''
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[13px] font-extrabold text-[#18181B]">🛡️ Rules Engine Guidance</h3>
          {errors.length > 0 ? (
            <span className="rounded-full bg-[#FEE2E2] px-2.5 py-0.5 text-[10px] font-extrabold text-[#991B1B]">
              {errors.length} {errors.length === 1 ? 'Error' : 'Errors'}
            </span>
          ) : null}
          {warnings.length > 0 ? (
            <span className="rounded-full tone-am px-2.5 py-0.5 text-[10px] font-extrabold">
              {warnings.length} {warnings.length === 1 ? 'Warning' : 'Warnings'}
            </span>
          ) : null}
          {infos.length > 0 ? (
            <span className="rounded-full tone-pm px-2.5 py-0.5 text-[10px] font-extrabold">
              {infos.length} Info
            </span>
          ) : null}
          {issues.length === 0 ? (
            <span className="rounded-full tone-leave px-2.5 py-0.5 text-[10px] font-extrabold">
              All Roster Rules Satisfied
            </span>
          ) : null}
        </div>

        <span className="text-[11px] font-bold text-[#57534E]">
          {isExpanded ? 'Hide ▲' : 'Show ▼'}
        </span>
      </button>

      {/* Expanded body */}
      {isExpanded ? (
        <div className="p-3.5 space-y-2.5">
          {/* Obsidian Pill Filters */}
          {issues.length > 0 ? (
            <div className="no-scrollbar flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5">
              {(['all', 'error', 'warning', 'info'] as const).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setFilterSeverity(sev)}
                  className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold uppercase transition cursor-pointer ${
                    filterSeverity === sev
                      ? 'border-[#18181B] bg-[#18181B] text-white'
                      : 'border-[#E7E5E4] bg-white text-[#57534E] hover:border-stone-400 hover:text-[#18181B]'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          ) : null}

          {/* Tinted Issues Cards */}
          {filteredIssues.length === 0 ? (
            <p className="py-1 text-xs font-bold text-[#15803D]">
              ✓ All rules satisfied for current filter.
            </p>
          ) : (
            <ul className="max-h-56 space-y-1.5 overflow-y-auto">
              {filteredIssues.map((issue) => {
                const boxStyle =
                  issue.severity === 'error'
                    ? 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]'
                    : issue.severity === 'warning'
                      ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]'
                      : 'border-[#BAE6FD] bg-[#F0F9FF] text-[#0369A1]';

                return (
                  <li key={issue.id}>
                    <button
                      type="button"
                      onClick={() => onSelectIssue?.(issue)}
                      className={`w-full rounded-[10px] border px-3 py-2 text-left transition hover:brightness-[0.98] cursor-pointer ${boxStyle}`}
                    >
                      <div className="text-[11.5px] font-extrabold leading-snug">
                        {issue.message}
                      </div>
                      {issue.suggestion ? (
                        <div className="mt-0.5 text-[10.5px] font-medium text-[#57534E]">
                          {issue.suggestion}
                        </div>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
