import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldCheck,
} from 'lucide-react';
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
    <div className="rounded-xl border border-border-default bg-surface-primary shadow-xs">
      {/* Header bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-surface-secondary/40"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {errors.length > 0 ? (
              <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            ) : warnings.length > 0 ? (
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            )}
            <h3 className="text-sm font-semibold text-text-primary">Rules Engine Guidance</h3>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            {errors.length > 0 && (
              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 font-medium text-rose-700 dark:text-rose-300">
                {errors.length} {errors.length === 1 ? 'Error' : 'Errors'}
              </span>
            )}
            {warnings.length > 0 && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-300">
                {warnings.length} {warnings.length === 1 ? 'Warning' : 'Warnings'}
              </span>
            )}
            {infos.length > 0 && (
              <span className="rounded-full bg-sky-500/15 px-2 py-0.5 font-medium text-sky-700 dark:text-sky-300">
                {infos.length} Info
              </span>
            )}
            {issues.length === 0 && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-300">
                All Roster Rules Satisfied
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          aria-label={isExpanded ? 'Collapse issues panel' : 'Expand issues panel'}
          className="text-text-muted hover:text-text-primary"
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className="border-t border-border-subtle p-4 space-y-3">
          {/* Severity filter tabs */}
          {issues.length > 0 && (
            <div className="flex items-center gap-1 border-b border-border-subtle pb-2 text-xs">
              <button
                type="button"
                onClick={() => setFilterSeverity('all')}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  filterSeverity === 'all'
                    ? 'bg-surface-secondary text-text-primary'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                All ({issues.length})
              </button>
              {errors.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterSeverity('error')}
                  className={`rounded-md px-2.5 py-1 font-medium ${
                    filterSeverity === 'error'
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Errors ({errors.length})
                </button>
              )}
              {warnings.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterSeverity('warning')}
                  className={`rounded-md px-2.5 py-1 font-medium ${
                    filterSeverity === 'warning'
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Warnings ({warnings.length})
                </button>
              )}
              {infos.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterSeverity('info')}
                  className={`rounded-md px-2.5 py-1 font-medium ${
                    filterSeverity === 'info'
                      ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Info ({infos.length})
                </button>
              )}
            </div>
          )}

          {/* Issues list */}
          {filteredIssues.length === 0 ? (
            <p className="py-2 text-xs text-text-muted">No issues in this filter category.</p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto divide-y divide-border-subtle text-xs">
              {filteredIssues.map((issue) => (
                <li
                  key={issue.id}
                  onClick={() => onSelectIssue?.(issue)}
                  className="flex cursor-pointer items-start gap-2.5 pt-2 first:pt-0 hover:bg-surface-secondary/40 rounded-lg p-1.5 transition-colors"
                >
                  <div className="mt-0.5 shrink-0">
                    {issue.severity === 'error' && (
                      <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    )}
                    {issue.severity === 'warning' && (
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    )}
                    {issue.severity === 'info' && (
                      <Info className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                    )}
                  </div>

                  <div className="space-y-0.5 flex-1">
                    <p className="font-medium text-text-primary">{issue.message}</p>
                    {issue.suggestion && (
                      <p className="text-[11px] text-text-secondary">
                        <span className="font-semibold text-text-muted">Suggestion:</span>{' '}
                        {issue.suggestion}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
