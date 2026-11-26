import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { Button, Modal } from '@/shared/ui';
import type { IssueCode, IssueSeverity, RosterIssue } from '../domain/types';

export type GuidanceGroupBy = 'rule' | 'staff' | 'date' | 'flat';
export type GuidanceSortBy = 'severity' | 'date' | 'staff' | 'rule';

export interface RulesGuidanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  issues: readonly RosterIssue[];
  onSelectIssue?: (issue: RosterIssue) => void;
}

const SEVERITY_RANK: Record<IssueSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

const RULE_CATEGORY_LABEL: Record<IssueCode, string> = {
  staffing_shortage: 'Daily Staffing Coverage',
  missing_weekly_off: 'Weekly OFF Compliance',
  compensated_weekly_off: 'Replaced Weekly OFF (Later Week)',
  consecutive_work_exceeded: 'Consecutive Days & Sequences',
  broken_night_bundle: 'Night Bundle & Post-Night Rest',
  insufficient_night_rest: 'Night Bundle & Post-Night Rest',
  goff_unavailable: 'GOFF Balance & Leave',
  unknown_shift_code: 'Shift Code & Boundary Info',
  provisional_boundary_week: 'Shift Code & Boundary Info',
  duplicate_assignment: 'Shift Code & Boundary Info',
};

function getIssueDateKey(issue: RosterIssue): string {
  return issue.date || issue.weekStart || '';
}

function getSeverityBadgeClasses(sev: IssueSeverity): string {
  if (sev === 'error') return 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]';
  if (sev === 'warning') return 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]';
  return 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]';
}

function getIssueCardClasses(sev: IssueSeverity): string {
  if (sev === 'error') return 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]';
  if (sev === 'warning') return 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]';
  return 'border-[#BAE6FD] bg-[#F0F9FF] text-[#0369A1]';
}

export function RulesGuidanceModal({
  isOpen,
  onClose,
  issues,
  onSelectIssue,
}: RulesGuidanceModalProps) {
  const [groupBy, setGroupBy] = useState<GuidanceGroupBy>('rule');
  const [sortBy, setSortBy] = useState<GuidanceSortBy>('severity');
  const [severityFilter, setSeverityFilter] = useState<'all' | IssueSeverity>('all');
  const [hideInfo, setHideInfo] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const counts = useMemo(() => {
    let error = 0;
    let warning = 0;
    let info = 0;
    for (const i of issues) {
      if (i.severity === 'error') error += 1;
      else if (i.severity === 'warning') warning += 1;
      else info += 1;
    }
    return { error, warning, info, total: issues.length };
  }, [issues]);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = issues.filter((issue) => {
      if (hideInfo && issue.severity === 'info') return false;
      if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
      if (!q) return true;
      return (
        issue.message.toLowerCase().includes(q) ||
        (issue.suggestion ?? '').toLowerCase().includes(q) ||
        (issue.staffName ?? '').toLowerCase().includes(q) ||
        getIssueDateKey(issue).toLowerCase().includes(q) ||
        RULE_CATEGORY_LABEL[issue.code].toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'severity') {
        const diff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
        if (diff !== 0) return diff;
        return getIssueDateKey(a).localeCompare(getIssueDateKey(b));
      }
      if (sortBy === 'date') {
        const dDiff = getIssueDateKey(a).localeCompare(getIssueDateKey(b));
        if (dDiff !== 0) return dDiff;
        return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      }
      if (sortBy === 'staff') {
        const sA = a.staffName ?? 'zzz_Department';
        const sB = b.staffName ?? 'zzz_Department';
        const sDiff = sA.localeCompare(sB);
        if (sDiff !== 0) return sDiff;
        return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      }
      const rDiff = RULE_CATEGORY_LABEL[a.code].localeCompare(RULE_CATEGORY_LABEL[b.code]);
      if (rDiff !== 0) return rDiff;
      return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    });
  }, [issues, hideInfo, severityFilter, searchQuery, sortBy]);

  const grouped = useMemo(() => {
    if (groupBy === 'flat') {
      return [
        {
          key: 'all',
          label: `All Guidance (${filteredAndSorted.length})`,
          items: filteredAndSorted,
        },
      ];
    }

    const map = new Map<string, RosterIssue[]>();
    for (const issue of filteredAndSorted) {
      let groupKey: string;
      if (groupBy === 'rule') {
        groupKey = RULE_CATEGORY_LABEL[issue.code];
      } else if (groupBy === 'staff') {
        groupKey = issue.staffName || 'Department Coverage';
      } else {
        groupKey = issue.date
          ? issue.date
          : issue.weekStart
            ? `Week of ${issue.weekStart}`
            : 'Period-Wide';
      }
      const arr = map.get(groupKey);
      if (arr) arr.push(issue);
      else map.set(groupKey, [issue]);
    }

    const entries = Array.from(map.entries()).map(([key, items]) => ({
      key,
      label: key,
      items,
    }));

    if (groupBy === 'date') {
      entries.sort((a, b) => a.key.localeCompare(b.key));
    } else if (groupBy === 'staff') {
      entries.sort((a, b) => {
        if (a.key === 'Department Coverage') return 1;
        if (b.key === 'Department Coverage') return -1;
        return a.key.localeCompare(b.key);
      });
    }
    return entries;
  }, [filteredAndSorted, groupBy]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rules Engine Guidance Workspace"
      description="Group, sort, and jump directly to any roster cell to resolve compliance or coverage issues."
      maxWidth="xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#78716C]">
            Showing {filteredAndSorted.length} of {counts.total} items
          </span>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        {/* Top Severity Pills + Hide Info */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: `All (${counts.total})` },
                { id: 'error', label: `Errors (${counts.error})` },
                { id: 'warning', label: `Warnings (${counts.warning})` },
                { id: 'info', label: `Info (${counts.info})` },
              ] as const
            ).map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setSeverityFilter(pill.id)}
                className={`rounded-full border px-3 py-1 text-[11px] font-extrabold transition cursor-pointer ${
                  severityFilter === pill.id
                    ? 'border-[#18181B] bg-[#18181B] text-white'
                    : 'border-[#E7E5E4] bg-white text-[#57534E] hover:border-stone-400'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[#57534E] cursor-pointer">
            <input
              type="checkbox"
              checked={hideInfo}
              onChange={(e) => setHideInfo(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-[#D6D3D1] text-[#0F766E] focus:ring-[#0F766E]"
            />
            Hide Info / Provisional
          </label>
        </div>

        {/* Controls Bar: Search, Group By, Sort By */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] p-2.5">
          <div className="relative sm:col-span-5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#78716C]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search doctor, date, or rule..."
              className="w-full rounded-xl border border-[#E7E5E4] bg-white py-1.5 pl-8 pr-3 text-xs font-medium text-[#18181B] focus:border-[#0F766E] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-4 flex items-center gap-1.5">
            <span className="text-[10.5px] font-extrabold uppercase text-[#78716C] shrink-0">
              Group:
            </span>
            <select
              aria-label="Group issues by"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GuidanceGroupBy)}
              className="w-full rounded-xl border border-[#E7E5E4] bg-white px-2.5 py-1.5 text-xs font-bold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
            >
              <option value="rule">Rule Category</option>
              <option value="staff">Staff Member</option>
              <option value="date">Date / Week</option>
              <option value="flat">Flat List</option>
            </select>
          </div>

          <div className="sm:col-span-3 flex items-center gap-1.5">
            <span className="text-[10.5px] font-extrabold uppercase text-[#78716C] shrink-0">
              Sort:
            </span>
            <select
              aria-label="Sort issues by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as GuidanceSortBy)}
              className="w-full rounded-xl border border-[#E7E5E4] bg-white px-2.5 py-1.5 text-xs font-bold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
            >
              <option value="severity">Severity</option>
              <option value="date">Date</option>
              <option value="staff">Staff Name</option>
              <option value="rule">Rule</option>
            </select>
          </div>
        </div>

        {/* Grouped Issues List */}
        {filteredAndSorted.length === 0 ? (
          <div className="rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] p-6 text-center text-xs font-bold text-[#15803D]">
            ✓ No matching issues for current filters.
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map((group) => {
              const isCollapsed = Boolean(collapsedGroups[group.key]);
              const errCount = group.items.filter((i) => i.severity === 'error').length;
              const warnCount = group.items.filter((i) => i.severity === 'warning').length;
              const infoCount = group.items.filter((i) => i.severity === 'info').length;

              return (
                <div
                  key={group.key}
                  className="overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="flex w-full items-center justify-between gap-2 bg-[#FAFAF9] px-3.5 py-2.5 text-left hover:bg-[#F5F5F4] cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 shrink-0 text-[#78716C]" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-[#78716C]" />
                      )}
                      <span className="text-xs font-extrabold text-[#18181B] truncate">
                        {group.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {errCount > 0 ? (
                        <span className="rounded-full border border-[#FECACA] bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-extrabold text-[#991B1B]">
                          {errCount}E
                        </span>
                      ) : null}
                      {warnCount > 0 ? (
                        <span className="rounded-full border border-[#FDE68A] bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-extrabold text-[#92400E]">
                          {warnCount}W
                        </span>
                      ) : null}
                      {infoCount > 0 ? (
                        <span className="rounded-full border border-[#BAE6FD] bg-[#E0F2FE] px-2 py-0.5 text-[10px] font-extrabold text-[#0369A1]">
                          {infoCount}I
                        </span>
                      ) : null}
                    </div>
                  </button>

                  {!isCollapsed ? (
                    <ul className="divide-y divide-[#F4EFE6] p-2 space-y-1.5">
                      {group.items.map((issue) => {
                        const canJump = Boolean(issue.staffId && (issue.date || issue.weekStart));
                        return (
                          <li key={issue.id} className="pt-1.5 first:pt-0">
                            <button
                              type="button"
                              onClick={() => {
                                if (onSelectIssue) {
                                  onSelectIssue(issue);
                                  if (canJump) onClose();
                                }
                              }}
                              className={`w-full rounded-xl border px-3 py-2 text-left transition hover:brightness-[0.98] cursor-pointer ${getIssueCardClasses(
                                issue.severity,
                              )}`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-1.5 mb-0.5">
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase ${getSeverityBadgeClasses(
                                    issue.severity,
                                  )}`}
                                >
                                  {issue.severity}
                                </span>
                                {canJump ? (
                                  <span className="text-[10px] font-extrabold text-[#0F766E]">
                                    Jump to cell →
                                  </span>
                                ) : null}
                              </div>
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
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
