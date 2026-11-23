import { useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { OwnerUxBoundary } from '@/platform/auth';
import {
  Button,
  Modal,
  ModuleBackBar,
  SkeletonCardList,
  SkeletonTableCard,
  useIsMobileViewport,
  useToast,
} from '@/shared/ui';
import { FormField } from '@/shared/forms';
import {
  useStaffDirectoryQuery,
  useCreateStaffMemberMutation,
  useUpdateAllowlistStatusMutation,
  useUpdateStaffMemberMutation,
  type DirectoryStaffMember,
  type ServiceEndReason,
  type StaffServicePeriod,
} from './useDirectoryAdmin';

type DirectoryRoleCode = 'MO' | 'EP' | 'ADMIN-MO' | 'ADMIN-PTPO' | 'SUPER-ADMIN';
type WorkModeOption = 'Shift' | 'Office Hour (Clinical)' | 'Office Hour (Non-Clinical)';
type RoleTabKey = 'MO' | 'EP' | 'ADMINS' | 'ALL';
type StatusModeKey = 'active' | 'all' | 'inactive';

const ADMIN_ROLES: readonly DirectoryRoleCode[] = ['SUPER-ADMIN', 'ADMIN-MO', 'ADMIN-PTPO'];

const ROLE_HINTS: Record<DirectoryRoleCode, string> = {
  MO: 'Medical Officer · Requests, Roster, Records & PH, Updates',
  'ADMIN-MO': 'Admin (MO) · Same full admin + MO access as Super Admin',
  'SUPER-ADMIN': 'Super Admin · Full system & department administration',
  'ADMIN-PTPO': 'Admin (PTPO) · Roster (view) & GHKA memo submission only',
  EP: 'Emergency Physician · Home & Roster views only',
};

const END_REASON_OPTIONS: ReadonlyArray<{ value: ServiceEndReason; label: string }> = [
  { value: 'switched_department', label: 'Switched Department' },
  { value: 'masters_program', label: 'Masters Program' },
  { value: 'quit_hospital', label: 'Quit Hospital' },
  { value: 'transferred_hospital', label: 'Transferred Hospital' },
  { value: 'extended_leave', label: 'Extended Leave' },
  { value: 'other', label: 'Other' },
];

const END_REASON_LABELS: Record<ServiceEndReason, string> = {
  switched_department: 'Switched Department',
  masters_program: 'Masters Program',
  quit_hospital: 'Quit Hospital',
  transferred_hospital: 'Transferred Hospital',
  extended_leave: 'Extended Leave',
  other: 'Other',
};

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatPeriodDate(iso?: string | null): string {
  if (!iso) return 'Current';
  const parts = iso.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  if (!year || !month || month < 1 || month > 12) return iso;
  return `${SHORT_MONTHS[month - 1]} ${year}`;
}

function formatDuration(startDate?: string | null, endDate?: string | null): string {
  if (!startDate) return '';
  const startParts = startDate.split('-').map(Number);
  const sy = startParts[0];
  const sm = startParts[1];
  const sd = startParts[2] || 1;
  if (!sy || !sm) return '';

  let ey: number;
  let em: number;
  let ed: number;
  if (endDate) {
    const endParts = endDate.split('-').map(Number);
    ey = endParts[0] || sy;
    em = endParts[1] || sm;
    ed = endParts[2] || 1;
  } else {
    const now = new Date();
    ey = now.getFullYear();
    em = now.getMonth() + 1;
    ed = now.getDate();
  }

  let totalMonths = (ey - sy) * 12 + (em - sm);
  if (sd <= 2 && ed >= 28) {
    totalMonths += 1;
  } else if (ed < sd - 14) {
    totalMonths -= 1;
  }

  if (totalMonths < 0) return '0m';
  if (totalMonths === 0) return '< 1m';
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return `${months}m`;
  return `${years}y ${months}m`;
}

function getMemberPeriods(member: DirectoryStaffMember): StaffServicePeriod[] {
  const raw = member.service_periods ?? [];
  const source =
    raw.length > 0
      ? raw
      : member.start_date
        ? [
            {
              start_date: member.start_date,
              end_date: member.end_date,
              end_reason: null,
              end_comment: null,
            },
          ]
        : [];
  // Show open/current period first, then historical ended periods newest first
  return [...source].sort((a, b) => {
    const aOpen = !a.end_date ? 1 : 0;
    const bOpen = !b.end_date ? 1 : 0;
    if (aOpen !== bOpen) return bOpen - aOpen;
    return b.start_date.localeCompare(a.start_date);
  });
}

function getEndReasonTone(reason?: ServiceEndReason | null): string {
  if (reason === 'quit_hospital' || reason === 'transferred_hospital') {
    return 'border-rose-200 bg-rose-50 text-rose-800';
  }
  if (reason === 'masters_program' || reason === 'switched_department') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  return 'border-[#E7E5E4] bg-[#F5F5F4] text-[#57534E]';
}

function getMockupRole(member: DirectoryStaffMember): DirectoryRoleCode {
  const group = (member.staff_group || '').toUpperCase();
  const code = (member.staff_code || '').toUpperCase();
  if (group.includes('ADMIN-MO')) return 'ADMIN-MO';
  if (group.includes('SUPER-ADMIN')) return 'SUPER-ADMIN';
  if (group.includes('PTPO') || code.startsWith('PTPO')) return 'ADMIN-PTPO';
  if (group.startsWith('EP |') || code.startsWith('EP-')) return 'EP';
  if (group.startsWith('MO |') || group === 'MO' || group === 'MEDICAL OFFICER') return 'MO';
  if (member.allowed_user?.role === 'owner') return 'SUPER-ADMIN';
  if (group.startsWith('EP') || group.includes('PHYSICIAN')) return 'EP';
  return 'MO';
}

function isMoRole(role: DirectoryRoleCode): boolean {
  return role === 'MO' || role === 'ADMIN-MO' || role === 'SUPER-ADMIN';
}

function getWorkMode(member: DirectoryStaffMember): WorkModeOption {
  const group = (member.staff_group || '').toLowerCase();
  if (group.includes('non-clinical')) return 'Office Hour (Non-Clinical)';
  if (group.includes('office hour')) return 'Office Hour (Clinical)';
  return 'Shift';
}

function encodeStaffGroup(role: DirectoryRoleCode, workMode: WorkModeOption): string {
  if (isMoRole(role)) return `${role} | ${workMode}`;
  if (role === 'EP') return 'EP | Emergency Physician';
  return 'ADMIN-PTPO | Admin (PTPO)';
}

function splitCreds(
  raw?: string | null,
  verificationStatus?: string | null,
): { mmc: string; mmcDisplay: string; apc: string; telegram: boolean } {
  if (!raw) {
    return { mmc: '', mmcDisplay: '—', apc: '—', telegram: verificationStatus === 'verified' };
  }
  const parts = raw
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);
  const telegram = parts.some((p) => p.toUpperCase() === 'TG') || verificationStatus === 'verified';
  const nonTgParts = parts.filter((p) => p.toUpperCase() !== 'TG');
  const mmcRaw = nonTgParts.find((p) => !/^APC\b/i.test(p) && !/^PTPO-/i.test(p)) ?? '';
  const apcRaw =
    nonTgParts.find((p) => /^APC\b/i.test(p) || /^PTPO-/i.test(p)) ?? nonTgParts[1] ?? '';

  const mmcDisplay = !mmcRaw || mmcRaw === '—' ? '—' : /^\d+$/.test(mmcRaw) ? `#${mmcRaw}` : mmcRaw;

  return {
    mmc: mmcRaw === '—' ? '' : mmcRaw,
    mmcDisplay,
    apc: apcRaw || '—',
    telegram,
  };
}

function getRoleBadgeClasses(role: DirectoryRoleCode): string {
  if (role === 'SUPER-ADMIN' || role === 'ADMIN-MO') {
    return 'bg-[#FCE7F1] text-[#9D174D] border-[#FBCFE8]';
  }
  if (role === 'ADMIN-PTPO') {
    return 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]';
  }
  if (role === 'EP') {
    return 'bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4]';
  }
  return 'bg-[#F5F5F4] text-[#57534E] border-[#E7E5E4]';
}

function getAvatarBgClass(role: DirectoryRoleCode): string {
  if (role === 'EP') return 'bg-[#CCFBF1]';
  if (role === 'SUPER-ADMIN' || role === 'ADMIN-MO') return 'bg-[#E0E7FF]';
  if (role === 'ADMIN-PTPO') return 'bg-[#FEF3C7]';
  return 'bg-[#FAF8F5]';
}

function getShortInitials(rosterName: string, displayName: string): string {
  const cleaned = (rosterName || displayName).replace(/^(Dr\.?|En\.?|Pn\.?)\s+/i, '').trim();
  return (cleaned || rosterName || displayName).slice(0, 2).toUpperCase();
}

function WorkModeBadge({ role, workMode }: { role: DirectoryRoleCode; workMode: WorkModeOption }) {
  if (!isMoRole(role)) {
    return <span className="text-[10.5px] text-[#A8A29E]">—</span>;
  }
  if (workMode === 'Office Hour (Clinical)') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-0.5 text-[10px] font-extrabold text-[#B45309] whitespace-nowrap">
        🩺 OH · Clinical
      </span>
    );
  }
  if (workMode === 'Office Hour (Non-Clinical)') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#D6D3D1] bg-[#F5F5F4] px-2.5 py-0.5 text-[10px] font-extrabold text-[#57534E] whitespace-nowrap">
        🏢 OH · Non-Clinical
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#99F6E4] bg-[#F0FDFA] px-2.5 py-0.5 text-[10px] font-extrabold text-[#0F766E] whitespace-nowrap">
      ⚡ Shift
    </span>
  );
}

export function StaffDirectoryAdminRoute() {
  const showToast = useToast();
  const isMobile = useIsMobileViewport(639);
  const { data: staffList = [], isLoading, error } = useStaffDirectoryQuery();
  const createMutation = useCreateStaffMemberMutation();
  const updateStatusMutation = useUpdateAllowlistStatusMutation();
  const updateStaffMutation = useUpdateStaffMemberMutation();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleTab, setRoleTab] = useState<RoleTabKey>('MO');
  const [statusMode, setStatusMode] = useState<StatusModeKey>('active');
  const [viewModeOverride, setViewModeOverride] = useState<'list' | 'cards' | null>(null);
  const viewMode = viewModeOverride ?? (isMobile ? 'cards' : 'list');

  // Modals state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<DirectoryStaffMember | null>(null);
  const [statusActionTarget, setStatusActionTarget] = useState<{
    member: DirectoryStaffMember;
    action: 'active' | 'suspended' | 'revoked';
  } | null>(null);
  const [revocationReason, setRevocationReason] = useState('');

  // Invite form state matching mockup 3-panel layout + start date
  const [inviteForm, setInviteForm] = useState({
    salutation: 'Dr.' as 'Dr.' | 'En.' | 'Pn.' | '-',
    display_name: '',
    roster_name: '',
    staff_code: '',
    email: '',
    phone: '',
    start_date: getTodayIso(),
    role: 'MO' as DirectoryRoleCode,
    workMode: 'Shift' as WorkModeOption,
    mmc: '',
    apc: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Edit form state matching mockup fields + service periods
  const [editForm, setEditForm] = useState({
    staff_code: '',
    roster_name: '',
    display_name: '',
    role: 'MO' as DirectoryRoleCode,
    workMode: 'Shift' as WorkModeOption,
    mmc: '',
    apc: '',
    hadTelegramTag: false,
    email: '',
    phone: '',
    active: true,
    servicePeriods: [] as StaffServicePeriod[],
  });
  const [editFormError, setEditFormError] = useState<string | null>(null);

  const isMemberActive = (m: DirectoryStaffMember): boolean =>
    m.active && m.allowed_user?.status !== 'suspended' && m.allowed_user?.status !== 'revoked';

  const matchesFilter = (m: DirectoryStaffMember, tabKey: RoleTabKey): boolean => {
    const memberActive = isMemberActive(m);
    if (statusMode === 'active' && !memberActive) return false;
    if (statusMode === 'inactive' && memberActive) return false;

    const r = getMockupRole(m);
    if (tabKey === 'MO') {
      if (!isMoRole(r)) return false;
    } else if (tabKey === 'ADMINS') {
      if (!ADMIN_ROLES.includes(r)) return false;
    } else if (tabKey !== 'ALL' && r !== tabKey) {
      return false;
    }

    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const creds = splitCreds(
        m.staff_profile?.registration_number,
        m.staff_profile?.verification_status,
      );
      const periodText = getMemberPeriods(m)
        .map((p) => `${p.end_reason ? END_REASON_LABELS[p.end_reason] : ''} ${p.end_comment ?? ''}`)
        .join(' ');
      const haystack = [
        m.display_name,
        m.roster_name,
        m.staff_code,
        r,
        m.allowed_user?.email ?? '',
        creds.mmc,
        creds.apc,
        m.staff_profile?.phone ?? '',
        periodText,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  };

  const filteredStaff = staffList.filter((m) => matchesFilter(m, roleTab));

  const activeStaff = staffList.filter(isMemberActive);
  const moCount = activeStaff.filter((m) => isMoRole(getMockupRole(m))).length;
  const epCount = activeStaff.filter((m) => getMockupRole(m) === 'EP').length;
  const inactiveCount = staffList.filter((m) => !isMemberActive(m)).length;

  function handleOpenInvite() {
    setFormError(null);
    const moNumericCount = staffList.filter((m) => /^MO-\d+$/i.test(m.staff_code)).length;
    setInviteForm({
      salutation: 'Dr.',
      display_name: '',
      roster_name: '',
      staff_code: `MO-${String(moNumericCount + 1).padStart(2, '0')}`,
      email: '',
      phone: '',
      start_date: getTodayIso(),
      role: 'MO',
      workMode: 'Shift',
      mmc: '',
      apc: '',
    });
    setIsInviteOpen(true);
  }

  async function handleCreateStaff(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!inviteForm.email || !inviteForm.email.includes('@')) {
      setFormError('Please enter a valid Google email address.');
      return;
    }
    if (!inviteForm.staff_code.trim()) {
      setFormError('Staff code is required (e.g. MO-10).');
      return;
    }
    if (!inviteForm.display_name.trim()) {
      setFormError('Full name is required.');
      return;
    }

    const rawName = inviteForm.display_name.trim().replace(/^(Dr\.?|En\.?|Pn\.?)\s+/i, '');
    const fullDisplayName =
      inviteForm.salutation === '-' ? rawName : `${inviteForm.salutation} ${rawName}`;
    const rosterName =
      inviteForm.roster_name.trim() ||
      (inviteForm.salutation === '-'
        ? rawName.split(/\s+/)[0] || rawName
        : `${inviteForm.salutation} ${rawName.split(/\s+/)[0] || rawName}`);

    const mmcClean = inviteForm.mmc.trim();
    const apcClean = inviteForm.apc.trim();
    const regCombined = [mmcClean, apcClean].filter(Boolean).join(' | ');
    const hasExistingOwner = staffList.some((m) => m.allowed_user?.role === 'owner');
    const allowlistRole: 'owner' | 'staff' =
      inviteForm.role === 'SUPER-ADMIN' && !hasExistingOwner ? 'owner' : 'staff';

    try {
      await createMutation.mutateAsync({
        email: inviteForm.email.trim().toLowerCase(),
        role: allowlistRole,
        staff_code: inviteForm.staff_code.trim(),
        roster_name: rosterName,
        display_name: fullDisplayName,
        staff_group: encodeStaffGroup(inviteForm.role, inviteForm.workMode),
        phone: inviteForm.phone.trim() || undefined,
        registration_number: regCombined || undefined,
        start_date: inviteForm.start_date || getTodayIso(),
      });
      setIsInviteOpen(false);
      showToast('Staff member invited & registered ✓');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to register staff member.');
    }
  }

  function handleOpenEdit(member: DirectoryStaffMember) {
    setEditFormError(null);
    setEditingMember(member);
    const creds = splitCreds(
      member.staff_profile?.registration_number,
      member.staff_profile?.verification_status,
    );
    const existingPeriods = getMemberPeriods(member);
    const initialPeriods: StaffServicePeriod[] =
      existingPeriods.length > 0
        ? existingPeriods.map((p) => ({ ...p }))
        : [
            {
              start_date: getTodayIso(),
              end_date: isMemberActive(member) ? null : getTodayIso(),
              end_reason: isMemberActive(member) ? null : 'switched_department',
              end_comment: null,
            },
          ];

    setEditForm({
      staff_code: member.staff_code,
      roster_name: member.roster_name,
      display_name: member.display_name,
      role: getMockupRole(member),
      workMode: getWorkMode(member),
      mmc: creds.mmc,
      apc: creds.apc === '—' ? '' : creds.apc,
      hadTelegramTag: Boolean(member.staff_profile?.registration_number?.includes('| TG')),
      email: member.allowed_user?.email ?? '',
      phone: member.staff_profile?.phone ?? '',
      active: isMemberActive(member),
      servicePeriods: initialPeriods,
    });
  }

  function handleAccountStatusSelectChange(nextActive: boolean) {
    const today = getTodayIso();
    setEditForm((prev) => {
      if (!nextActive) {
        // Closing active periods with today's end date & default reason so owner can choose exact reason
        const nextPeriods = prev.servicePeriods.map((p) =>
          !p.end_date
            ? {
                ...p,
                end_date: today,
                end_reason: p.end_reason ?? 'switched_department',
              }
            : p,
        );
        return { ...prev, active: false, servicePeriods: nextPeriods };
      }

      // Reactivating: if there is already an open period keep it; otherwise add a new active period
      const alreadyOpen = prev.servicePeriods.some((p) => !p.end_date);
      if (alreadyOpen) {
        return { ...prev, active: true };
      }
      return {
        ...prev,
        active: true,
        servicePeriods: [
          {
            start_date: today,
            end_date: null,
            end_reason: null,
            end_comment: null,
          },
          ...prev.servicePeriods,
        ],
      };
    });
  }

  function handleUpdatePeriod(index: number, patch: Partial<StaffServicePeriod>) {
    setEditForm((prev) => {
      const updated = prev.servicePeriods.map((p, idx) => (idx === index ? { ...p, ...patch } : p));
      const anyOpen = updated.some((p) => !p.end_date);
      return {
        ...prev,
        servicePeriods: updated,
        active: anyOpen,
      };
    });
  }

  function handleAddServicePeriod() {
    const today = getTodayIso();
    setEditForm((prev) => ({
      ...prev,
      active: true,
      servicePeriods: [
        {
          start_date: today,
          end_date: null,
          end_reason: null,
          end_comment: null,
        },
        ...prev.servicePeriods,
      ],
    }));
  }

  function handleRemoveServicePeriod(index: number) {
    setEditForm((prev) => {
      if (prev.servicePeriods.length <= 1) return prev;
      const updated = prev.servicePeriods.filter((_, idx) => idx !== index);
      return {
        ...prev,
        servicePeriods: updated,
        active: updated.some((p) => !p.end_date),
      };
    });
  }

  async function handleUpdateStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!editingMember) return;
    setEditFormError(null);

    if (!editForm.staff_code.trim()) {
      setEditFormError('Staff code is required.');
      return;
    }
    if (!editForm.roster_name.trim()) {
      setEditFormError('Roster short name is required.');
      return;
    }
    if (!editForm.display_name.trim()) {
      setEditFormError('Full name is required.');
      return;
    }

    for (let i = 0; i < editForm.servicePeriods.length; i += 1) {
      const p = editForm.servicePeriods[i];
      if (!p) continue;
      if (!p.start_date) {
        setEditFormError(`Period #${i + 1} requires a Start Date.`);
        return;
      }
      if (p.end_date && p.end_date < p.start_date) {
        setEditFormError(`Period #${i + 1} End Date cannot be earlier than Start Date.`);
        return;
      }
    }

    const regCombined = [
      editForm.mmc.trim(),
      editForm.apc.trim(),
      editForm.hadTelegramTag ? 'TG' : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const isExistingOwner = editingMember.allowed_user?.role === 'owner';
    const hasOtherOwner = staffList.some(
      (m) => m.id !== editingMember.id && m.allowed_user?.role === 'owner',
    );
    const dbRole: 'owner' | 'staff' =
      isExistingOwner || (editForm.role === 'SUPER-ADMIN' && !hasOtherOwner) ? 'owner' : 'staff';

    try {
      await updateStaffMutation.mutateAsync({
        staff_id: editingMember.id,
        staff_code: editForm.staff_code.trim(),
        roster_name: editForm.roster_name.trim(),
        display_name: editForm.display_name.trim(),
        staff_group: encodeStaffGroup(editForm.role, editForm.workMode),
        phone: editForm.phone.trim() || undefined,
        registration_number: regCombined || undefined,
        email: editForm.email.trim() || undefined,
        role: dbRole,
        active: editForm.servicePeriods.some((p) => !p.end_date),
        service_periods: editForm.servicePeriods,
        allowed_user_id: editingMember.allowed_user?.id ?? null,
        current_allowed_status: editingMember.allowed_user?.status ?? null,
      });
      setEditingMember(null);
      showToast('Staff profile updated ✓');
    } catch (err) {
      setEditFormError(err instanceof Error ? err.message : 'Failed to update staff member.');
    }
  }

  async function handleConfirmStatusAction() {
    if (!statusActionTarget || !statusActionTarget.member.allowed_user) return;
    if (statusActionTarget.action === 'revoked' && !revocationReason.trim()) {
      return;
    }

    try {
      await updateStatusMutation.mutateAsync({
        allowed_user_id: statusActionTarget.member.allowed_user.id,
        new_status: statusActionTarget.action,
        reason: revocationReason.trim() || undefined,
      });
      setStatusActionTarget(null);
      setRevocationReason('');
      setEditingMember(null);
      showToast('Account status updated ✓');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update account status.');
    }
  }

  const renderStaffCollection = (items: DirectoryStaffMember[], emptyMessage: string) => {
    if (isLoading) {
      return isMobile ? (
        <SkeletonCardList count={5} srLabel="Loading staff directory..." />
      ) : (
        <SkeletonTableCard
          rows={6}
          cols={5}
          hasHeaderBar={false}
          srLabel="Loading staff directory..."
        />
      );
    }
    if (error) {
      return (
        <div
          className="rounded-[24px] border border-rose-200 bg-rose-50 p-6 text-center text-xs font-semibold text-rose-700"
          role="alert"
        >
          Failed to load staff directory: {error.message}
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <div className="rounded-[24px] border border-[#E7E5E4] bg-white p-8 text-center text-xs font-semibold text-[#78716C] shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)]">
          {emptyMessage}
        </div>
      );
    }

    if (viewMode === 'cards') {
      return (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((member) => {
            const r = getMockupRole(member);
            const wm = getWorkMode(member);
            const active = isMemberActive(member);
            const creds = splitCreds(
              member.staff_profile?.registration_number,
              member.staff_profile?.verification_status,
            );
            const periods = getMemberPeriods(member);
            const openPeriod = periods.find((p) => !p.end_date);
            const latestEnded = periods.find((p) => Boolean(p.end_date));
            const activeDur = openPeriod ? formatDuration(openPeriod.start_date, null) : '';

            return (
              <div
                key={member.id}
                className={`flex flex-col justify-between gap-2.5 rounded-[24px] border border-[#E7E5E4] bg-white p-4 shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)] ${
                  active ? '' : 'opacity-75'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E7E5E4] text-xs font-extrabold text-[#18181B] ${getAvatarBgClass(r)}`}
                      >
                        {getShortInitials(member.roster_name, member.display_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-extrabold text-[#18181B] leading-snug">
                          {member.display_name}
                        </div>
                        <div className="text-[10.5px] font-bold text-[#78716C]">
                          Roster: {member.roster_name} &middot; {member.staff_code}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold whitespace-nowrap ${getRoleBadgeClasses(r)}`}
                    >
                      {r}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-2.5 gap-y-1.5 rounded-[12px] border border-[#EFECE6] bg-[#FAF8F5] px-2.5 py-2 text-[11px]">
                    <div>
                      <div className="text-[9px] font-extrabold uppercase text-[#78716C]">
                        MMC #
                      </div>
                      <div className="font-bold text-[#18181B]">{creds.mmcDisplay}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-extrabold uppercase text-[#78716C]">
                        APC #
                      </div>
                      <div className="font-bold text-[#18181B] truncate">{creds.apc}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-extrabold uppercase text-[#78716C]">
                        Phone
                      </div>
                      <div className="font-bold text-[#18181B]">
                        {member.staff_profile?.phone || '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-extrabold uppercase text-[#78716C]">
                        Telegram
                      </div>
                      <div
                        className={`font-bold ${creds.telegram ? 'text-[#0F766E]' : 'text-[#A8A29E]'}`}
                      >
                        {creds.telegram ? '✓ Linked' : 'Not linked'}
                      </div>
                    </div>
                    <div className="col-span-2 truncate border-t border-[#EFECE6] pt-1 text-[#57534E]">
                      ✉️ {member.allowed_user?.email ?? '—'}
                    </div>
                  </div>

                  {/* Separate Service Periods & Tenure block */}
                  {periods.length > 0 && (
                    <div className="rounded-[12px] border border-[#EFECE6] bg-[#FAF8F5] px-2.5 py-2 space-y-1.5">
                      <div className="flex items-center justify-between text-[9px] font-extrabold uppercase tracking-[0.04em] text-[#78716C]">
                        <span>Service Periods ({periods.length})</span>
                        {activeDur && <span className="text-[#0F766E]">Active: {activeDur}</span>}
                      </div>
                      <div className="space-y-1">
                        {periods.map((p, idx) => {
                          const dur = formatDuration(p.start_date, p.end_date);
                          const isOpen = !p.end_date;
                          const reasonLbl = p.end_reason
                            ? END_REASON_LABELS[p.end_reason]
                            : 'Ended';
                          return (
                            <div
                              key={`${member.id}-card-p-${idx}-${p.start_date}`}
                              className="rounded-lg border border-[#EFECE6] bg-white px-2 py-1 text-[10px]"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <span className="font-bold text-[#18181B]">
                                  {formatPeriodDate(p.start_date)} –{' '}
                                  {isOpen ? 'Current' : formatPeriodDate(p.end_date)}
                                </span>
                                <span
                                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-extrabold ${
                                    isOpen
                                      ? 'bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4]'
                                      : getEndReasonTone(p.end_reason) + ' border'
                                  }`}
                                >
                                  {isOpen ? dur : `${dur} · ${reasonLbl}`}
                                </span>
                              </div>
                              {!isOpen && p.end_comment && (
                                <div className="mt-0.5 text-[9.5px] text-[#78716C] truncate">
                                  {p.end_comment}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-[#F4EFE6] pt-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9.5px] font-extrabold ${
                        active ? 'bg-[#D1FAE5] text-[#065F46]' : 'bg-[#F5F5F4] text-[#57534E]'
                      }`}
                    >
                      {active ? `● Active${activeDur ? ` · ${activeDur}` : ''}` : 'Inactive'}
                    </span>
                    {!active && latestEnded?.end_reason && (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold ${getEndReasonTone(latestEnded.end_reason)}`}
                      >
                        {END_REASON_LABELS[latestEnded.end_reason]}
                      </span>
                    )}
                    {isMoRole(r) && <WorkModeBadge role={r} workMode={wm} />}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(member)}
                    className="rounded-full border border-[#E7E5E4] bg-white px-2.5 py-1 text-[10.5px] font-extrabold text-[#18181B] hover:bg-[#FAF8F5] transition cursor-pointer"
                  >
                    ✏️ Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (isMobile) {
      return (
        /* Mobile Compact Row List (matches mockup mobile List mode + tenure info) */
        <div className="rounded-[24px] border border-[#E7E5E4] bg-white px-3.5 py-1 shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)]">
          {items.map((member, idx) => {
            const r = getMockupRole(member);
            const wm = getWorkMode(member);
            const active = isMemberActive(member);
            const creds = splitCreds(
              member.staff_profile?.registration_number,
              member.staff_profile?.verification_status,
            );
            const periods = getMemberPeriods(member);
            const openPeriod = periods.find((p) => !p.end_date);
            const latestEnded = periods.find((p) => Boolean(p.end_date));
            const activeDur = openPeriod ? formatDuration(openPeriod.start_date, null) : '';

            return (
              <div
                key={member.id}
                onClick={() => handleOpenEdit(member)}
                className={`flex items-center justify-between gap-2 py-2.5 cursor-pointer ${
                  idx < items.length - 1 ? 'border-b border-[#F4EFE6]' : ''
                } ${active ? '' : 'opacity-70'}`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E7E5E4] text-[10.5px] font-extrabold text-[#18181B] ${getAvatarBgClass(r)}`}
                  >
                    {getShortInitials(member.roster_name, member.display_name)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="truncate text-[12.5px] font-extrabold text-[#18181B]">
                        {member.display_name}
                      </span>
                      {active && activeDur && (
                        <span className="rounded-full border border-[#99F6E4] bg-[#F0FDFA] px-1.5 py-0.5 text-[8.5px] font-extrabold text-[#0F766E]">
                          {activeDur}
                        </span>
                      )}
                      {!active && (
                        <span className="rounded-full bg-[#F5F5F4] px-1.5 py-0.5 text-[8.5px] font-extrabold text-[#57534E]">
                          {latestEnded?.end_reason
                            ? END_REASON_LABELS[latestEnded.end_reason]
                            : 'Inactive'}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] font-semibold text-[#78716C]">
                      <span>
                        {creds.mmcDisplay !== '—' ? `MMC ${creds.mmcDisplay} · ` : ''}
                        {member.staff_profile?.phone || '—'}
                      </span>
                      {isMoRole(r) && (
                        <span
                          className={`font-extrabold ${
                            wm === 'Office Hour (Clinical)'
                              ? 'text-[#B45309]'
                              : wm === 'Office Hour (Non-Clinical)'
                                ? 'text-[#57534E]'
                                : 'text-[#0F766E]'
                          }`}
                        >
                          ·{' '}
                          {wm === 'Office Hour (Clinical)'
                            ? 'OH Clinical'
                            : wm === 'Office Hour (Non-Clinical)'
                              ? 'OH Non-Clin'
                              : 'Shift'}
                        </span>
                      )}
                      {periods[0] && (
                        <span className="text-[#57534E]">
                          · {formatPeriodDate(periods[0].start_date)} –{' '}
                          {periods[0].end_date ? formatPeriodDate(periods[0].end_date) : 'Current'}
                          {periods.length > 1 ? ` (+${periods.length - 1} past)` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold ${getRoleBadgeClasses(r)}`}
                  >
                    {r}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEdit(member);
                    }}
                    aria-label={`Edit ${member.display_name}`}
                    className="text-xs font-extrabold text-[#78716C] px-1 cursor-pointer"
                  >
                    ›
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      /* Desktop 8-Column Roster Table (matches mockup Desktop List mode + Status & Tenure periods) */
      <div className="rounded-[24px] border border-[#E7E5E4] bg-white overflow-hidden shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)]">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-[#EFECE6] bg-[#FAF8F5] text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[#78716C]">
              <tr>
                <th scope="col" className="py-2.5 px-3.5 text-left">
                  Staff Member
                </th>
                <th scope="col" className="py-2.5 px-2 text-center">
                  Role
                </th>
                <th scope="col" className="py-2.5 px-2 text-center">
                  Work Mode
                </th>
                <th scope="col" className="py-2.5 px-2 text-left">
                  MMC #
                </th>
                <th scope="col" className="py-2.5 px-2 text-left">
                  APC #
                </th>
                <th scope="col" className="py-2.5 px-2 text-left">
                  Contact
                </th>
                <th scope="col" className="py-2.5 px-2.5 text-left">
                  Status &amp; Tenure
                </th>
                <th scope="col" className="py-2.5 pr-3.5 pl-2 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4EFE6]">
              {items.map((member) => {
                const r = getMockupRole(member);
                const wm = getWorkMode(member);
                const active = isMemberActive(member);
                const creds = splitCreds(
                  member.staff_profile?.registration_number,
                  member.staff_profile?.verification_status,
                );
                const periods = getMemberPeriods(member);
                const openPeriod = periods.find((p) => !p.end_date);
                const latestEnded = periods.find((p) => Boolean(p.end_date));
                const activeDur = openPeriod ? formatDuration(openPeriod.start_date, null) : '';

                return (
                  <tr
                    key={member.id}
                    className={`hover:bg-[#FAF8F5]/80 transition-colors align-top ${
                      active ? '' : 'opacity-75'
                    }`}
                  >
                    <td className="py-2.5 px-3.5 text-left">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E7E5E4] text-[11px] font-extrabold text-[#18181B] ${getAvatarBgClass(r)}`}
                        >
                          {getShortInitials(member.roster_name, member.display_name)}
                        </div>
                        <div>
                          <div className="font-extrabold text-[#18181B]">
                            {member.display_name}{' '}
                            <span className="text-[10.5px] font-bold text-[#78716C]">
                              (<span>{member.roster_name}</span> &middot;{' '}
                              <span className="font-mono">{member.staff_code}</span>)
                            </span>
                          </div>
                          <div className="text-[10.5px] text-[#78716C]">
                            {member.allowed_user?.email ?? '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold whitespace-nowrap ${getRoleBadgeClasses(r)}`}
                      >
                        {r}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <WorkModeBadge role={r} workMode={wm} />
                    </td>
                    <td className="py-2.5 px-2 text-left font-bold text-[#18181B]">
                      {creds.mmcDisplay}
                    </td>
                    <td className="py-2.5 px-2 text-left font-bold text-[#57534E]">{creds.apc}</td>
                    <td className="py-2.5 px-2 text-left">
                      <div className="font-bold text-[#18181B]">
                        {member.staff_profile?.phone || '—'}
                      </div>
                      <div
                        className={`text-[10px] font-bold ${
                          creds.telegram ? 'text-[#0F766E]' : 'text-[#A8A29E]'
                        }`}
                      >
                        {creds.telegram ? '✓ Telegram Linked' : 'Not linked'}
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 text-left min-w-[205px]">
                      <div className="flex flex-wrap items-center gap-1 mb-1">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[9.5px] font-extrabold whitespace-nowrap ${
                            active ? 'bg-[#D1FAE5] text-[#065F46]' : 'bg-[#F5F5F4] text-[#57534E]'
                          }`}
                        >
                          {active ? '● Active' : 'Inactive'}
                        </span>
                        {active && activeDur && (
                          <span className="inline-flex rounded-full border border-[#99F6E4] bg-[#F0FDFA] px-2 py-0.5 text-[9.5px] font-extrabold text-[#0F766E] whitespace-nowrap">
                            {activeDur}
                          </span>
                        )}
                        {!active && latestEnded?.end_reason && (
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[9.5px] font-extrabold whitespace-nowrap ${getEndReasonTone(latestEnded.end_reason)}`}
                          >
                            {END_REASON_LABELS[latestEnded.end_reason]}
                          </span>
                        )}
                      </div>
                      {periods.length > 0 && (
                        <div className="space-y-0.5">
                          {periods.map((p, idx) => {
                            const isOpen = !p.end_date;
                            const dur = formatDuration(p.start_date, p.end_date);
                            const reasonLabel = p.end_reason
                              ? END_REASON_LABELS[p.end_reason]
                              : 'Ended';
                            return (
                              <div
                                key={`${member.id}-tbl-p-${idx}-${p.start_date}`}
                                title={p.end_comment || undefined}
                                className="text-[10px] leading-tight text-[#57534E]"
                              >
                                <span className="font-bold text-[#18181B]">
                                  {formatPeriodDate(p.start_date)} –{' '}
                                  {isOpen ? 'Current' : formatPeriodDate(p.end_date)}
                                </span>{' '}
                                <span className="text-[#78716C]">({dur})</span>
                                {!isOpen && (
                                  <span className="font-bold text-[#B45309]">
                                    {' '}
                                    &middot; {reasonLabel}
                                  </span>
                                )}
                                {!isOpen && p.end_comment && (
                                  <span className="block text-[9.5px] text-[#78716C] truncate max-w-[220px]">
                                    {p.end_comment}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3.5 pl-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(member)}
                        className="rounded-full border border-[#E7E5E4] bg-white px-2.5 py-1 text-[10.5px] font-extrabold text-[#18181B] hover:bg-[#FAF8F5] transition cursor-pointer whitespace-nowrap"
                      >
                        ✏️ Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const roleTabs: ReadonlyArray<{ key: RoleTabKey; label: string }> = [
    { key: 'MO', label: 'MO' },
    { key: 'EP', label: 'EP' },
    { key: 'ADMINS', label: 'Admins' },
    { key: 'ALL', label: 'All Staff' },
  ];

  const adminGroups: ReadonlyArray<{
    role: DirectoryRoleCode;
    title: string;
    desc: string;
  }> = [
    { role: 'SUPER-ADMIN', title: 'Super Admin', desc: 'Full system & MO access' },
    { role: 'ADMIN-MO', title: 'Admin (MO)', desc: 'Same access as Super Admin' },
    { role: 'ADMIN-PTPO', title: 'Admin (PTPO)', desc: 'GHKA tracker memo submission only' },
  ];

  const isInviteMo = isMoRole(inviteForm.role);

  return (
    <OwnerUxBoundary areaName="Staff & Allowlist">
      <div className="space-y-3.5 max-w-[1280px]">
        <ModuleBackBar title="Staff & Accounts" />

        {/* Desktop 24px Page Header */}
        <div className="hidden lg:flex flex-wrap items-end justify-between gap-3 border-b border-[#EFECE6] pb-3.5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">
              Owner Administration
            </p>
            <h1 className="text-[24px] font-extrabold tracking-tight text-[#18181B]">
              Staff &amp; Accounts
            </h1>
            <p className="mt-0.5 text-[12.5px] font-medium text-[#78716C]">
              Manage MO/EP/PTPO accounts, roles, MMC/APC credentials, and multi-period service
              tenure.
            </p>
          </div>
        </div>

        {/* KPI Strip matching mockup */}
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <div className="rounded-[24px] border border-[#E7E5E4] border-t-[3px] border-t-[#18181B] bg-white px-3.5 py-3 shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)]">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#78716C]">
              Active Accounts
            </div>
            <div className="mt-1 text-[22px] font-extrabold text-[#18181B] tabular-nums">
              {activeStaff.length}
            </div>
          </div>
          <div className="rounded-[24px] border border-[#E7E5E4] border-t-[3px] border-t-[#0F766E] bg-white px-3.5 py-3 shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)]">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#78716C]">
              Medical Officers
            </div>
            <div className="mt-1 text-[22px] font-extrabold text-[#0F766E] tabular-nums">
              {moCount}
            </div>
          </div>
          <div className="rounded-[24px] border border-[#E7E5E4] border-t-[3px] border-t-[#15803D] bg-white px-3.5 py-3 shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)]">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#78716C]">
              Emergency Physicians
            </div>
            <div className="mt-1 text-[22px] font-extrabold text-[#15803D] tabular-nums">
              {epCount}
            </div>
          </div>
          <div className="rounded-[24px] border border-[#E7E5E4] border-t-[3px] border-t-[#D97706] bg-white px-3.5 py-3 shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)]">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#78716C]">
              Inactive / Archived
            </div>
            <div className="mt-1 text-[22px] font-extrabold text-[#D97706] tabular-nums">
              {inactiveCount}
            </div>
          </div>
        </div>

        {/* Role Tabs + Search & Status Card matching mockup */}
        <div className="rounded-[24px] border border-[#E7E5E4] bg-white px-4 pt-3.5 pb-3 shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)]">
          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
            <div>
              <h2 className="text-[15px] font-extrabold text-[#18181B]">
                Staff Directory &amp; Access
                <span className="sr-only">Staff Directory &amp; Approved Emails</span>
              </h2>
              <p className="text-[11.5px] font-semibold text-[#78716C]">
                Manage MO/EP/PTPO accounts, roles, MMC/APC credentials &amp; service tenure
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="inline-flex rounded-full border border-[#E7E5E4] bg-[#FAF8F5] p-0.5">
                <button
                  type="button"
                  onClick={() => setViewModeOverride('list')}
                  className={`rounded-full px-2.5 py-1 text-[10.5px] font-extrabold transition cursor-pointer ${
                    viewMode === 'list' ? 'bg-[#18181B] text-white' : 'text-[#78716C]'
                  }`}
                >
                  ☰ List
                </button>
                <button
                  type="button"
                  onClick={() => setViewModeOverride('cards')}
                  className={`rounded-full px-2.5 py-1 text-[10.5px] font-extrabold transition cursor-pointer ${
                    viewMode === 'cards' ? 'bg-[#18181B] text-white' : 'text-[#78716C]'
                  }`}
                >
                  ⊞ Cards
                </button>
              </div>
              <button
                type="button"
                aria-label="Invite Staff Member"
                onClick={handleOpenInvite}
                className="rounded-full bg-[#0F766E] px-3.5 py-1.5 text-[11.5px] font-extrabold text-white shadow-2xs hover:bg-[#0D655E] transition cursor-pointer"
              >
                + Invite Staff
              </button>
            </div>
          </div>

          {/* Role Tabs: MO -> EP -> Admins -> All Staff */}
          <div className="flex gap-1 overflow-x-auto no-scrollbar border-b-[1.5px] border-[#EFECE6] mb-2.5">
            {roleTabs.map((rt) => {
              const cnt = staffList.filter((m) => {
                const memberActive = isMemberActive(m);
                if (statusMode === 'active' && !memberActive) return false;
                if (statusMode === 'inactive' && memberActive) return false;
                const r = getMockupRole(m);
                if (rt.key === 'MO') return isMoRole(r);
                if (rt.key === 'ADMINS') return ADMIN_ROLES.includes(r);
                return rt.key === 'ALL' ? true : r === rt.key;
              }).length;
              const active = roleTab === rt.key;
              return (
                <button
                  key={rt.key}
                  type="button"
                  onClick={() => setRoleTab(rt.key)}
                  className={`inline-flex items-center gap-1.5 border-b-[2.5px] px-3 py-2 text-[11.5px] whitespace-nowrap transition-colors -mb-[1.5px] cursor-pointer ${
                    active
                      ? 'border-[#0F766E] text-[#0F766E] font-extrabold'
                      : 'border-transparent text-[#78716C] font-bold hover:text-[#18181B]'
                  }`}
                >
                  <span>{rt.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold ${
                      active ? 'bg-[#CCFBF1] text-[#0F766E]' : 'bg-[#F4F1EA] text-[#57534E]'
                    }`}
                  >
                    {cnt}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Status & Search Bar */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { k: 'active', l: 'Active' },
                  { k: 'all', l: 'All Status' },
                  { k: 'inactive', l: `Inactive (${inactiveCount})` },
                ] as const
              ).map((st) => {
                const active = statusMode === st.k;
                return (
                  <button
                    key={st.k}
                    type="button"
                    onClick={() => setStatusMode(st.k)}
                    className={`rounded-full border px-3 py-1 text-[10.5px] font-extrabold transition cursor-pointer ${
                      active
                        ? 'border-[#18181B] bg-[#18181B] text-white'
                        : 'border-[#E7E5E4] bg-[#FAF8F5] text-[#57534E] hover:bg-[#EFECE6]'
                    }`}
                  >
                    {st.l}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, code, email, MMC #, or phone..."
              className="w-full sm:w-64 rounded-full border-[1.5px] border-[#E7E5E4] bg-[#FAF8F5] px-3.5 py-1.5 text-[11.5px] font-semibold text-[#18181B] placeholder:text-[#78716C] focus:border-[#0F766E] focus:outline-none"
            />
          </div>
        </div>

        {/* Collection: Admins 3-group breakdown vs standard list/cards */}
        {roleTab === 'ADMINS' ? (
          <div className="space-y-3.5">
            {adminGroups.map((grp) => {
              const grpItems = filteredStaff.filter((m) => getMockupRole(m) === grp.role);
              return (
                <div key={grp.role}>
                  <div className="flex flex-wrap items-center justify-between gap-2 px-0.5 mb-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${getRoleBadgeClasses(grp.role)}`}
                      >
                        {grp.title}
                      </span>
                      <span className="text-[11px] font-semibold text-[#78716C]">{grp.desc}</span>
                    </div>
                    <span className="text-[10.5px] font-extrabold text-[#57534E]">
                      {grpItems.length}
                    </span>
                  </div>
                  {renderStaffCollection(grpItems, `No ${grp.title} accounts in this filter.`)}
                </div>
              );
            })}
          </div>
        ) : (
          renderStaffCollection(filteredStaff, 'No staff accounts match this filter.')
        )}

        {/* Invite Staff Member Modal (Mockup 3-Panel Layout + Initial Start Date) */}
        <Modal
          isOpen={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
          title="Invite Staff Member"
          description="Create account, assign role & send onboarding invite"
          presentation="drawer"
          maxWidth="md"
          headerExtra={
            <div className="flex items-center gap-2 shrink-0">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F0FDFA] border border-[#99F6E4] text-[#0F766E]"
              >
                <UserPlus className="h-4 w-4" />
              </span>
              <button
                type="button"
                onClick={() => setIsInviteOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E7E5E4] bg-white text-[#57534E] hover:bg-[#FAF8F5] hover:text-[#18181B] cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          }
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setIsInviteOpen(false)}>
                Cancel
              </Button>
              <button
                type="submit"
                form="invite-staff-form"
                disabled={createMutation.isPending}
                className="rounded-full bg-[#0F766E] px-5 py-2 text-xs font-extrabold text-white shadow-[0_4px_14px_rgba(15,118,110,0.25)] hover:bg-[#0D655E] disabled:opacity-60 cursor-pointer"
              >
                {createMutation.isPending ? 'Registering...' : 'Send Invite & Add Staff →'}
              </button>
            </div>
          }
        >
          <form id="invite-staff-form" onSubmit={handleCreateStaff} className="space-y-3">
            {formError && (
              <div
                className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700"
                role="alert"
              >
                {formError}
              </div>
            )}

            {/* 1. Personal Details */}
            <div className="rounded-[16px] border border-[#EFECE6] bg-[#FAF8F5] p-3.5 space-y-2.5">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.05em] text-[#0F766E]">
                1. Personal Details
              </div>
              <div>
                <label
                  htmlFor="invite-display-name"
                  className="block text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#57534E] mb-1"
                >
                  Full Name
                </label>
                <div className="grid grid-cols-[76px_1fr] gap-2">
                  <select
                    aria-label="Salutation"
                    value={inviteForm.salutation}
                    onChange={(e) =>
                      setInviteForm({
                        ...inviteForm,
                        salutation: e.target.value as 'Dr.' | 'En.' | 'Pn.' | '-',
                      })
                    }
                    className="rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white px-2 py-2 text-[13px] font-extrabold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                  >
                    <option value="Dr.">Dr.</option>
                    <option value="En.">En.</option>
                    <option value="Pn.">Pn.</option>
                    <option value="-">-</option>
                  </select>
                  <input
                    id="invite-display-name"
                    type="text"
                    required
                    value={inviteForm.display_name}
                    onChange={(e) => setInviteForm({ ...inviteForm, display_name: e.target.value })}
                    placeholder="e.g. Aina Sofea"
                    className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white px-3 py-2 text-[13px] text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="invite-roster-name"
                    className="block text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#57534E] mb-1"
                  >
                    Roster Short Name
                  </label>
                  <input
                    id="invite-roster-name"
                    type="text"
                    value={inviteForm.roster_name}
                    onChange={(e) => setInviteForm({ ...inviteForm, roster_name: e.target.value })}
                    placeholder="e.g. Dr. Aina"
                    className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white px-3 py-2 text-[12.5px] text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="invite-code"
                    className="block text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#57534E] mb-1"
                  >
                    Staff Code
                  </label>
                  <input
                    id="invite-code"
                    type="text"
                    required
                    value={inviteForm.staff_code}
                    onChange={(e) => setInviteForm({ ...inviteForm, staff_code: e.target.value })}
                    className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white px-3 py-2 text-[12.5px] font-mono text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label
                    htmlFor="invite-start-date"
                    className="block text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#57534E] mb-1"
                  >
                    Start Date
                  </label>
                  <input
                    id="invite-start-date"
                    type="date"
                    required
                    value={inviteForm.start_date}
                    onChange={(e) => setInviteForm({ ...inviteForm, start_date: e.target.value })}
                    className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white px-2.5 py-2 text-[12px] text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="invite-email"
                    className="block text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#57534E] mb-1"
                  >
                    Google Account Email
                  </label>
                  <input
                    id="invite-email"
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="aina@hsaas.upm.edu.my"
                    className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white px-3 py-2 text-[12.5px] text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="invite-phone"
                    className="block text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#57534E] mb-1"
                  >
                    Phone
                  </label>
                  <input
                    id="invite-phone"
                    type="text"
                    value={inviteForm.phone}
                    onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                    placeholder="012-3456789"
                    className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white px-3 py-2 text-[12.5px] text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 2. Role & Working Mode */}
            <div className="rounded-[16px] border border-[#EFECE6] bg-[#FAF8F5] p-3.5 space-y-2">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.05em] text-[#0F766E]">
                2. Role &amp; Working Mode
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(['MO', 'EP', 'ADMIN-MO', 'ADMIN-PTPO', 'SUPER-ADMIN'] as const).map((r) => {
                  const active = inviteForm.role === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setInviteForm({ ...inviteForm, role: r })}
                      className={`rounded-full border-[1.5px] px-2.5 py-1 text-[10.5px] font-extrabold cursor-pointer transition ${
                        active
                          ? 'border-[#18181B] bg-[#18181B] text-white'
                          : 'border-[#E7E5E4] bg-white text-[#57534E] hover:border-[#A8A29E]'
                      }`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10.5px] font-semibold text-[#57534E]">
                {ROLE_HINTS[inviteForm.role]}
              </p>

              {isInviteMo && (
                <div className="pt-1">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#57534E] mb-1">
                    Working Mode (MO)
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { v: 'Shift', l: '⚡ Shift' },
                        { v: 'Office Hour (Clinical)', l: '🩺 OH Clin' },
                        { v: 'Office Hour (Non-Clinical)', l: '🏢 OH Non-Clin' },
                      ] as const
                    ).map((wm) => {
                      const active = inviteForm.workMode === wm.v;
                      return (
                        <button
                          key={wm.v}
                          type="button"
                          onClick={() => setInviteForm({ ...inviteForm, workMode: wm.v })}
                          className={`rounded-[11px] border-[1.5px] py-1.5 px-1 text-[10px] font-extrabold whitespace-nowrap cursor-pointer transition ${
                            active
                              ? 'border-[#0F766E] bg-[#F0FDFA] text-[#0F766E]'
                              : 'border-[#E7E5E4] bg-white text-[#57534E]'
                          }`}
                        >
                          {wm.l}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Registration Numbers */}
            <div className="rounded-[16px] border border-[#EFECE6] bg-[#FAF8F5] p-3.5 space-y-2">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.05em] text-[#0F766E]">
                3. Registration Numbers
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="invite-mmc"
                    className="block text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#57534E] mb-1"
                  >
                    MMC #
                  </label>
                  <input
                    id="invite-mmc"
                    type="text"
                    value={inviteForm.mmc}
                    onChange={(e) => setInviteForm({ ...inviteForm, mmc: e.target.value })}
                    placeholder="e.g. 75120"
                    className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white px-3 py-2 text-[12.5px] text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="invite-apc"
                    className="block text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#57534E] mb-1"
                  >
                    APC #
                  </label>
                  <input
                    id="invite-apc"
                    type="text"
                    value={inviteForm.apc}
                    onChange={(e) => setInviteForm({ ...inviteForm, apc: e.target.value })}
                    placeholder="e.g. APC-2027-0610"
                    className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white px-3 py-2 text-[12.5px] text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </form>
        </Modal>

        {/* Edit Staff Member Modal (with Multi-Period Tenure History & End Reasons) */}
        <Modal
          isOpen={editingMember !== null}
          onClose={() => setEditingMember(null)}
          title={`Edit Staff: ${editingMember?.display_name ?? ''}`}
          description="Update identity, role, credentials, and service tenure periods."
          presentation="drawer"
          maxWidth="md"
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {editingMember?.allowed_user && editingMember.allowed_user.role !== 'owner' && (
                  <>
                    {editingMember.allowed_user.status === 'active' ? (
                      <button
                        type="button"
                        onClick={() =>
                          setStatusActionTarget({ member: editingMember, action: 'suspended' })
                        }
                        className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 cursor-pointer"
                      >
                        Suspend
                      </button>
                    ) : editingMember.allowed_user.status === 'suspended' ? (
                      <button
                        type="button"
                        onClick={() =>
                          setStatusActionTarget({ member: editingMember, action: 'active' })
                        }
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                      >
                        Activate
                      </button>
                    ) : null}
                    {editingMember.allowed_user.status !== 'revoked' && (
                      <button
                        type="button"
                        onClick={() =>
                          setStatusActionTarget({ member: editingMember, action: 'revoked' })
                        }
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
                      >
                        Revoke
                      </button>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <Button variant="secondary" onClick={() => setEditingMember(null)}>
                  Cancel
                </Button>
                <button
                  type="submit"
                  form="edit-staff-form"
                  disabled={updateStaffMutation.isPending}
                  className="rounded-full bg-[#0F766E] px-5 py-2 text-xs font-extrabold text-white shadow-2xs hover:bg-[#0D655E] disabled:opacity-60 cursor-pointer"
                >
                  {updateStaffMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          }
        >
          <form id="edit-staff-form" onSubmit={handleUpdateStaff} className="space-y-3">
            {editFormError && (
              <div
                className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700"
                role="alert"
              >
                {editFormError}
              </div>
            )}

            <div>
              <label
                htmlFor="edit-display-name"
                className="block text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#57534E] mb-1"
              >
                Full Name
              </label>
              <input
                id="edit-display-name"
                type="text"
                required
                value={editForm.display_name}
                onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white px-3 py-2 text-[13px] text-[#18181B] focus:border-[#0F766E] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="edit-roster-name"
                  className="block text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#57534E] mb-1"
                >
                  Short Roster Name
                </label>
                <input
                  id="edit-roster-name"
                  type="text"
                  required
                  value={editForm.roster_name}
                  onChange={(e) => setEditForm({ ...editForm, roster_name: e.target.value })}
                  className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white px-3 py-2 text-[13px] text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-code"
                  className="block text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#57534E] mb-1"
                >
                  Staff Code
                </label>
                <input
                  id="edit-code"
                  type="text"
                  required
                  value={editForm.staff_code}
                  onChange={(e) => setEditForm({ ...editForm, staff_code: e.target.value })}
                  className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white px-3 py-2 text-[13px] font-mono text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label
                  htmlFor="edit-role"
                  className="block text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#57534E] mb-1"
                >
                  Role
                </label>
                <select
                  id="edit-role"
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm({ ...editForm, role: e.target.value as DirectoryRoleCode })
                  }
                  className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white px-3 py-2 text-[13px] text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                >
                  <option value="MO">MO</option>
                  <option value="ADMIN-MO">ADMIN-MO</option>
                  <option value="SUPER-ADMIN">SUPER-ADMIN</option>
                  <option value="ADMIN-PTPO">ADMIN-PTPO</option>
                  <option value="EP">EP</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="edit-mmc"
                  className="block text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#57534E] mb-1"
                >
                  MMC #
                </label>
                <input
                  id="edit-mmc"
                  type="text"
                  value={editForm.mmc}
                  onChange={(e) => setEditForm({ ...editForm, mmc: e.target.value })}
                  className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white px-3 py-2 text-[13px] text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-apc"
                  className="block text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#57534E] mb-1"
                >
                  APC #
                </label>
                <input
                  id="edit-apc"
                  type="text"
                  value={editForm.apc}
                  onChange={(e) => setEditForm({ ...editForm, apc: e.target.value })}
                  className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white px-3 py-2 text-[13px] text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="edit-phone"
                  className="block text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#57534E] mb-1"
                >
                  Phone
                </label>
                <input
                  id="edit-phone"
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white px-3 py-2 text-[13px] text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-email"
                  className="block text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#57534E] mb-1"
                >
                  Google Account Email
                </label>
                <input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white px-3 py-2 text-[13px] text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {isMoRole(editForm.role) && (
                <div>
                  <label
                    htmlFor="edit-work-mode"
                    className="block text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#57534E] mb-1"
                  >
                    Working Mode (MO)
                  </label>
                  <select
                    id="edit-work-mode"
                    value={editForm.workMode}
                    onChange={(e) =>
                      setEditForm({ ...editForm, workMode: e.target.value as WorkModeOption })
                    }
                    className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white px-3 py-2 text-[12.5px] text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                  >
                    <option value="Shift">Shift</option>
                    <option value="Office Hour (Clinical)">Office Hour (Clinical)</option>
                    <option value="Office Hour (Non-Clinical)">Office Hour (Non-Clinical)</option>
                  </select>
                </div>
              )}
              <div className={isMoRole(editForm.role) ? '' : 'col-span-2'}>
                <label
                  htmlFor="edit-status"
                  className="block text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#57534E] mb-1"
                >
                  Account Status
                </label>
                <select
                  id="edit-status"
                  value={editForm.active ? 'active' : 'inactive'}
                  onChange={(e) => handleAccountStatusSelectChange(e.target.value === 'active')}
                  className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white px-3 py-2 text-[12.5px] text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                >
                  <option value="active">● Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* Separate Service Periods & Tenure History Panel */}
            <div className="rounded-[16px] border border-[#EFECE6] bg-[#FAF8F5] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.05em] text-[#0F766E]">
                    Service Periods &amp; Tenure History
                  </div>
                  <div className="text-[10.5px] font-semibold text-[#78716C]">
                    Track each service stint separately (rotations, Masters, or returns)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddServicePeriod}
                  className="rounded-full border border-[#99F6E4] bg-white px-2.5 py-1 text-[10px] font-extrabold text-[#0F766E] hover:bg-[#F0FDFA] cursor-pointer"
                >
                  + Add Period
                </button>
              </div>

              <div className="space-y-2">
                {editForm.servicePeriods.map((period, idx) => {
                  const isOpen = !period.end_date;
                  const dur = formatDuration(period.start_date, period.end_date);
                  return (
                    <div
                      key={`edit-period-${idx}`}
                      className="rounded-[12px] border border-[#E7E5E4] bg-white p-2.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10.5px] font-extrabold text-[#18181B]">
                            Period #{idx + 1}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9.5px] font-extrabold ${
                              isOpen
                                ? 'border border-[#99F6E4] bg-[#F0FDFA] text-[#0F766E]'
                                : 'bg-[#F5F5F4] text-[#57534E]'
                            }`}
                          >
                            {isOpen ? `Current · ${dur}` : `Ended · ${dur}`}
                          </span>
                        </div>
                        {editForm.servicePeriods.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveServicePeriod(idx)}
                            className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label
                            htmlFor={`edit-period-start-${idx}`}
                            className="block text-[9.5px] font-extrabold uppercase text-[#78716C] mb-0.5"
                          >
                            Start Date
                          </label>
                          <input
                            id={`edit-period-start-${idx}`}
                            aria-label={`Period ${idx + 1} Start Date`}
                            type="date"
                            required
                            value={period.start_date}
                            onChange={(e) =>
                              handleUpdatePeriod(idx, { start_date: e.target.value })
                            }
                            className="w-full rounded-[10px] border-[1.5px] border-[#E7E5E4] bg-[#FAF8F5] px-2.5 py-1.5 text-[12px] text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`edit-period-state-${idx}`}
                            className="block text-[9.5px] font-extrabold uppercase text-[#78716C] mb-0.5"
                          >
                            Period Status
                          </label>
                          <select
                            id={`edit-period-state-${idx}`}
                            aria-label={`Period ${idx + 1} Status`}
                            value={isOpen ? 'current' : 'ended'}
                            onChange={(e) => {
                              const nextEnded = e.target.value === 'ended';
                              handleUpdatePeriod(
                                idx,
                                nextEnded
                                  ? {
                                      end_date: period.end_date || getTodayIso(),
                                      end_reason: period.end_reason || 'switched_department',
                                    }
                                  : {
                                      end_date: null,
                                      end_reason: null,
                                      end_comment: null,
                                    },
                              );
                            }}
                            className="w-full rounded-[10px] border-[1.5px] border-[#E7E5E4] bg-[#FAF8F5] px-2.5 py-1.5 text-[12px] font-bold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                          >
                            <option value="current">Current (Active)</option>
                            <option value="ended">Ended (Set End Date &amp; Reason)</option>
                          </select>
                        </div>
                      </div>

                      {!isOpen && (
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#F4EFE6]">
                          <div>
                            <label
                              htmlFor={`edit-period-end-${idx}`}
                              className="block text-[9.5px] font-extrabold uppercase text-[#78716C] mb-0.5"
                            >
                              End Date
                            </label>
                            <input
                              id={`edit-period-end-${idx}`}
                              aria-label={`Period ${idx + 1} End Date`}
                              type="date"
                              required
                              value={period.end_date || ''}
                              onChange={(e) =>
                                handleUpdatePeriod(idx, {
                                  end_date: e.target.value || getTodayIso(),
                                })
                              }
                              className="w-full rounded-[10px] border-[1.5px] border-[#E7E5E4] bg-white px-2.5 py-1.5 text-[12px] text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`edit-period-reason-${idx}`}
                              className="block text-[9.5px] font-extrabold uppercase text-[#78716C] mb-0.5"
                            >
                              Reason for Ending
                            </label>
                            <select
                              id={`edit-period-reason-${idx}`}
                              aria-label={`Period ${idx + 1} End Reason`}
                              value={period.end_reason || 'switched_department'}
                              onChange={(e) =>
                                handleUpdatePeriod(idx, {
                                  end_reason: e.target.value as ServiceEndReason,
                                })
                              }
                              className="w-full rounded-[10px] border-[1.5px] border-[#E7E5E4] bg-white px-2.5 py-1.5 text-[12px] font-bold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                            >
                              {END_REASON_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-2">
                            <label
                              htmlFor={`edit-period-comment-${idx}`}
                              className="block text-[9.5px] font-extrabold uppercase text-[#78716C] mb-0.5"
                            >
                              Comment / Notes (Optional)
                            </label>
                            <input
                              id={`edit-period-comment-${idx}`}
                              aria-label={`Period ${idx + 1} End Comment`}
                              type="text"
                              value={period.end_comment || ''}
                              onChange={(e) =>
                                handleUpdatePeriod(idx, { end_comment: e.target.value })
                              }
                              placeholder="e.g. MMed Emergency Medicine Phase 1, Anaesthesiology rotation..."
                              className="w-full rounded-[10px] border-[1.5px] border-[#E7E5E4] bg-white px-2.5 py-1.5 text-[12px] text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </form>
        </Modal>

        {/* Status Confirmation Modal */}
        <Modal
          isOpen={statusActionTarget !== null}
          onClose={() => setStatusActionTarget(null)}
          title={`Confirm Account ${statusActionTarget?.action ? statusActionTarget.action.charAt(0).toUpperCase() + statusActionTarget.action.slice(1) : ''}`}
          description={`Update allowlist status for ${statusActionTarget?.member.display_name} (${statusActionTarget?.member.allowed_user?.email}).`}
          maxWidth="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              {statusActionTarget?.action === 'suspended' &&
                'Suspended users lose query and mutation permissions immediately via RLS, even if their OAuth token has not expired.'}
              {statusActionTarget?.action === 'revoked' &&
                'Revoking an account permanently disables application access and records the revocation in the immutable audit log.'}
              {statusActionTarget?.action === 'active' &&
                'Reactivating this account restores standard staff self-service and roster viewing capabilities.'}
            </p>

            {statusActionTarget?.action === 'revoked' && (
              <FormField
                id="revoke-reason"
                label="Reason for Revocation"
                required
                hint="Provide a formal administrative justification."
              >
                <textarea
                  id="revoke-reason"
                  required
                  rows={3}
                  value={revocationReason}
                  onChange={(e) => setRevocationReason(e.target.value)}
                  placeholder="e.g. Transferred to another hospital or resigned."
                  className="w-full rounded-xl border border-border-subtle bg-surface-solid p-3 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-brand-primary"
                />
              </FormField>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
              <Button variant="secondary" onClick={() => setStatusActionTarget(null)}>
                Cancel
              </Button>
              <Button
                variant={statusActionTarget?.action === 'revoked' ? 'danger' : 'primary'}
                onClick={handleConfirmStatusAction}
                disabled={
                  updateStatusMutation.isPending ||
                  (statusActionTarget?.action === 'revoked' && !revocationReason.trim())
                }
              >
                {updateStatusMutation.isPending
                  ? 'Updating...'
                  : `Confirm ${statusActionTarget?.action.toUpperCase()}`}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </OwnerUxBoundary>
  );
}
