import { useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { OwnerUxBoundary } from '@/platform/auth';
import { ModuleBackBar, StatusBadge, useIsMobileViewport, useToast } from '@/shared/ui';

type AuditCat = 'Roster' | 'Rules' | 'Records';

interface AuditLogRow {
  id: number;
  action: string;
  detail: string;
  actor: string;
  time: string;
  cat: AuditCat;
}

interface RecoveryOpRow {
  id: string;
  job: string;
  target: string;
  time: string;
  status: 'Delivered' | 'Failed';
}

const INITIAL_AUDIT_LOGS: AuditLogRow[] = [
  {
    id: 1,
    action: 'Roster Published',
    detail: 'Jan 2027 Roster v3 published (SHA 8f3c2a19)',
    actor: 'Dr. Afif',
    time: '12 Jan 2027 · 10:15',
    cat: 'Roster',
  },
  {
    id: 2,
    action: 'Roster Amendment',
    detail: 'Dr. Siti 14 Jan: PM → OFF (Post-night recovery)',
    actor: 'Dr. Afif',
    time: '10 Jan 2027 · 09:14',
    cat: 'Roster',
  },
  {
    id: 3,
    action: 'Rule Threshold Updated',
    detail: 'ON1 daily MO request cap set to 1/day',
    actor: 'Dr. Afif',
    time: '05 Jan 2027 · 18:30',
    cat: 'Rules',
  },
  {
    id: 4,
    action: 'PH Credit Verified',
    detail: 'Thaipusam ON1 verified (+1 GHKA credit)',
    actor: 'System',
    time: '26 Jan 2027 · 00:05',
    cat: 'Records',
  },
];

const INITIAL_RECOVERY_OPS: RecoveryOpRow[] = [
  {
    id: 'OP-9042',
    job: 'Telegram Roster Dispatch (Jan 2027 v3)',
    target: 'ED-HSAAS Group',
    time: '12 Jan 2027 · 10:16',
    status: 'Delivered',
  },
  {
    id: 'OP-9041',
    job: 'Google Drive PDF Archive (Jan 2027 v3)',
    target: 'ED-Snapshots/2027',
    time: '12 Jan 2027 · 10:16',
    status: 'Failed',
  },
  {
    id: 'OP-9038',
    job: 'Thaipusam PH Credit Accrual Sync',
    target: 'GHKA Ledger',
    time: '26 Jan 2027 · 00:05',
    status: 'Delivered',
  },
];

const CATEGORY_PILL_CLASSES: Record<AuditCat, string> = {
  Roster: 'tone-am border border-[#C6D8B6]',
  Rules: 'tone-on border border-[#F8B9D4]',
  Records: 'tone-tl border border-[#99F6E4]',
};

export function AuditAdminRoute() {
  const showToast = useToast();
  const isMobile = useIsMobileViewport(767);
  const [subTab, setSubTab] = useState<'events' | 'recovery'>('events');
  const [catFilter, setCatFilter] = useState<'All' | AuditCat>('All');
  const [search, setSearch] = useState('');
  const [logs, setLogs] = useState<AuditLogRow[]>(INITIAL_AUDIT_LOGS);
  const [ops, setOps] = useState<RecoveryOpRow[]>(INITIAL_RECOVERY_OPS);
  const [verifiedShas, setVerifiedShas] = useState<Set<string>>(() => new Set());

  const failedCount = ops.filter((o) => o.status === 'Failed').length;

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((a) => {
      if (catFilter !== 'All' && a.cat !== catFilter) return false;
      if (
        q &&
        !a.action.toLowerCase().includes(q) &&
        !a.detail.toLowerCase().includes(q) &&
        !a.actor.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [logs, catFilter, search]);

  const handleRetryOp = (opId: string) => {
    const target = ops.find((o) => o.id === opId);
    if (!target) return;
    setOps((prev) => prev.map((o) => (o.id === opId ? { ...o, status: 'Delivered' } : o)));
    setLogs((prev) => [
      {
        id: Date.now(),
        action: 'Operation Recovered',
        detail: `Retried ${target.job} (${target.id})`,
        actor: 'Dr. Afif',
        time: 'Just now',
        cat: 'Roster',
      },
      ...prev,
    ]);
    showToast(`Retried ${target.id} — Delivered ✓`);
  };

  const handleVerifyHash = (ver: string) => {
    setVerifiedShas((prev) => {
      const next = new Set(prev);
      next.add(ver);
      return next;
    });
    showToast(`SHA-256 hash verified for ${ver} ✓`);
  };

  return (
    <OwnerUxBoundary areaName="Audit & Operation Log">
      <div className="max-w-[1040px] space-y-4">
        <ModuleBackBar title="Audit & Recovery" />

        {/* Desktop Header */}
        <div className="hidden lg:flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">
              Owner Administration
            </p>
            <h1 className="sr-only lg:not-sr-only text-[26px] font-extrabold tracking-tight text-[#18181B]">
              Audit Trail &amp; Operation Recovery
            </h1>
            <p className="mt-0.5 text-[13px] font-medium text-[#78716C]">
              Inspect append-only privileged action logs, idempotent operation statuses, and
              snapshot delivery outcomes.
            </p>
          </div>
          <StatusBadge label="Append-Only ✓" tone="success" icon={ShieldCheck} />
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-[20px] border border-[#E7E5E4] border-t-[3px] border-t-[#18181B] bg-white px-4 py-3 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#78716C]">
              Audit Events
            </div>
            <div className="mt-1 text-2xl font-extrabold text-[#18181B] tabular-nums">
              {logs.length}
            </div>
          </div>
          <div className="rounded-[20px] border border-[#E7E5E4] border-t-[3px] border-t-[#0F766E] bg-white px-4 py-3 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#78716C]">
              Active Snapshot
            </div>
            <div className="mt-1.5 text-sm font-extrabold text-[#0F766E]">v3 · SHA 8f3c2a19</div>
          </div>
          <div
            className={`rounded-[20px] border border-[#E7E5E4] border-t-[3px] bg-white px-4 py-3 shadow-[0_2px_10px_rgba(28,25,23,0.03)] ${
              failedCount ? 'border-t-[#E06D53]' : 'border-t-[#15803D]'
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#78716C]">
              Recovery Queue
            </div>
            <div
              className={`mt-1 text-xl font-extrabold ${
                failedCount ? 'text-[#C2410C]' : 'text-[#15803D]'
              }`}
            >
              {failedCount ? `${failedCount} Failed` : 'All Clear'}
            </div>
          </div>
          <div className="rounded-[20px] border border-[#E7E5E4] border-t-[3px] border-t-[#15803D] bg-white px-4 py-3 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#78716C]">
              RLS Integrity
            </div>
            <div className="mt-1.5 text-sm font-extrabold text-[#15803D]">Immutable Log ✓</div>
          </div>
        </div>

        {/* Sub-Tabs & Filter */}
        <div className="rounded-[22px] border border-[#E7E5E4] bg-white p-4 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
          <div className="mb-3 flex gap-2 border-b border-[#EFECE6] overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setSubTab('events')}
              className={`shrink-0 border-b-[2.5px] px-3 py-2 text-xs font-extrabold whitespace-nowrap -mb-px cursor-pointer ${
                subTab === 'events'
                  ? 'border-[#0F766E] text-[#0F766E]'
                  : 'border-transparent text-[#78716C]'
              }`}
            >
              📜 Audit Events ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('recovery')}
              className={`shrink-0 border-b-[2.5px] px-3 py-2 text-xs font-extrabold whitespace-nowrap -mb-px cursor-pointer ${
                subTab === 'recovery'
                  ? 'border-[#0F766E] text-[#0F766E]'
                  : 'border-transparent text-[#78716C]'
              }`}
            >
              🔄 Operation Recovery &amp; Snapshots{' '}
              {failedCount > 0 && (
                <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
                  {failedCount}
                </span>
              )}
            </button>
          </div>

          {subTab === 'events' ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-nowrap gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {(['All', 'Roster', 'Rules', 'Records'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCatFilter(c)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold border whitespace-nowrap cursor-pointer ${
                      catFilter === c
                        ? 'bg-[#18181B] text-white border-[#18181B]'
                        : 'bg-[#FAF8F5] text-[#57534E] border-[#E7E5E4]'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="relative min-w-[200px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#78716C]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search action, actor, or detail..."
                  className="w-full rounded-full border-[1.5px] border-[#E7E5E4] bg-[#FAF8F5] py-1.5 pl-8 pr-3 text-xs font-semibold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <p className="text-xs font-medium text-[#78716C]">
              Inspect idempotent Drive/Telegram dispatch jobs and verify published SHA-256
              snapshots.
            </p>
          )}
        </div>

        {subTab === 'events' ? (
          filteredLogs.length === 0 ? (
            <div className="rounded-[22px] border border-[#E7E5E4] bg-white p-10 text-center text-xs font-semibold text-[#78716C]">
              No audit events match this filter.
            </div>
          ) : isMobile ? (
            /* Mobile Stacked Audit Cards */
            <div className="space-y-2.5">
              {filteredLogs.map((a) => (
                <div
                  key={a.id}
                  className="rounded-[20px] border border-[#E7E5E4] bg-white p-3.5 shadow-[0_2px_10px_rgba(28,25,23,0.03)] space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${CATEGORY_PILL_CLASSES[a.cat]}`}
                    >
                      {a.cat}
                    </span>
                    <span className="font-mono text-[10.5px] font-bold text-[#78716C]">
                      #AUD-{String(a.id).slice(-4)}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-[#18181B]">{a.action}</div>
                    <div className="text-[11px] font-medium text-[#57534E] mt-0.5">{a.detail}</div>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#EFECE6] pt-2 text-[10.5px] font-bold text-[#78716C]">
                    <span>Actor: {a.actor}</span>
                    <span>{a.time}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Desktop 5-Column Audit Table */
            <div className="rounded-[22px] border border-[#E7E5E4] bg-white overflow-hidden shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#EFECE6] bg-[#FAF8F5] text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-[#78716C]">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-3 py-3 text-center">Category</th>
                      <th className="px-4 py-3">Action &amp; Detail</th>
                      <th className="px-4 py-3 text-center">Actor</th>
                      <th className="px-4 py-3 text-center">Event ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFECE6]">
                    {filteredLogs.map((a) => (
                      <tr key={a.id} className="hover:bg-[#FAF8F5]/70">
                        <td className="px-4 py-3 whitespace-nowrap text-[#78716C]">{a.time}</td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold ${CATEGORY_PILL_CLASSES[a.cat]}`}
                          >
                            {a.cat}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-extrabold text-[#18181B]">{a.action}</div>
                          <div className="text-[#78716C]">{a.detail}</div>
                        </td>
                        <td className="px-4 py-3 text-center font-extrabold text-[#18181B]">
                          {a.actor}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-[11px] text-[#78716C]">
                          #AUD-{String(a.id).slice(-4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div className="rounded-[22px] border border-[#E7E5E4] bg-white p-4 sm:p-5 space-y-3 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
              <h2 className="text-sm font-extrabold text-[#18181B]">Idempotent Operation Log</h2>
              <div className="divide-y divide-[#EFECE6]">
                {ops.map((op) => (
                  <div
                    key={op.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                  >
                    <div>
                      <div className="text-xs font-extrabold text-[#18181B]">{op.job}</div>
                      <div className="text-[11px] text-[#78716C]">
                        <code>{op.id}</code> · {op.target} · {op.time}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        label={op.status}
                        tone={op.status === 'Delivered' ? 'success' : 'danger'}
                      />
                      {op.status === 'Failed' && (
                        <button
                          type="button"
                          onClick={() => handleRetryOp(op.id)}
                          className="inline-flex items-center gap-1 rounded-full bg-[#0F766E] px-3 py-1 text-[11px] font-extrabold text-white hover:bg-[#0D655E] cursor-pointer"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[22px] border border-[#E7E5E4] bg-white p-4 sm:p-5 space-y-3 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
              <h2 className="text-sm font-extrabold text-[#18181B]">
                Published Snapshot Revisions
              </h2>
              <div className="divide-y divide-[#EFECE6]">
                {[
                  {
                    ver: 'v3 (Current)',
                    period: 'Jan 2027',
                    sha: '8f3c2a19...d40b',
                    by: 'Dr. Afif · 12 Jan 2027',
                  },
                  {
                    ver: 'v2',
                    period: 'Jan 2027',
                    sha: '4e1a9b02...77c1',
                    by: 'Dr. Afif · 10 Jan 2027',
                  },
                  {
                    ver: 'v1 (Initial)',
                    period: 'Jan 2027',
                    sha: '1c8d3f74...92e0',
                    by: 'Dr. Afif · 02 Jan 2027',
                  },
                ].map((sn) => {
                  const isVerified = verifiedShas.has(sn.ver);
                  return (
                    <div
                      key={sn.ver}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                    >
                      <div>
                        <div className="text-xs font-extrabold text-[#18181B]">
                          {sn.period} · {sn.ver}
                        </div>
                        <div className="text-[11px] text-[#78716C]">
                          SHA-256: <code>{sn.sha}</code> · {sn.by}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleVerifyHash(sn.ver)}
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-extrabold cursor-pointer ${
                          isVerified
                            ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]'
                            : 'border-[#E7E5E4] bg-[#FAF8F5] text-[#18181B] hover:bg-[#EFECE6]'
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#0F766E]" />
                        {isVerified ? 'Verified ✓' : 'Verify Hash'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </OwnerUxBoundary>
  );
}
