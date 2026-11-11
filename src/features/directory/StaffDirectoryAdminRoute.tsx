import { useState } from 'react';
import { Plus, Search, Shield, UserCheck, UserPlus, UserX } from 'lucide-react';
import { useAuth, OwnerUxBoundary } from '@/platform/auth';
import { Button, Modal, PageHeader, StatusBadge, SurfaceCard } from '@/shared/ui';
import { FormField } from '@/shared/forms';
import {
  useStaffDirectoryQuery,
  useCreateStaffMemberMutation,
  useUpdateAllowlistStatusMutation,
  type DirectoryStaffMember,
} from './useDirectoryAdmin';

export function StaffDirectoryAdminRoute() {
  const { user } = useAuth();
  const { data: staffList = [], isLoading, error } = useStaffDirectoryQuery();
  const createMutation = useCreateStaffMemberMutation();
  const updateStatusMutation = useUpdateAllowlistStatusMutation();

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'invited' | 'suspended' | 'revoked'
  >('all');

  // Modals state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [statusActionTarget, setStatusActionTarget] = useState<{
    member: DirectoryStaffMember;
    action: 'active' | 'suspended' | 'revoked';
  } | null>(null);
  const [revocationReason, setRevocationReason] = useState('');

  // New staff form state
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'staff' as 'owner' | 'staff',
    staff_code: '',
    roster_name: '',
    display_name: '',
    staff_group: 'Medical Officer',
    phone: '',
    registration_number: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Filtered members
  const filteredStaff = staffList.filter((m) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      m.roster_name.toLowerCase().includes(query) ||
      m.display_name.toLowerCase().includes(query) ||
      m.staff_code.toLowerCase().includes(query) ||
      (m.allowed_user?.email.toLowerCase().includes(query) ?? false);

    const status = m.allowed_user?.status ?? (m.active ? 'active' : 'suspended');
    const matchesStatus = statusFilter === 'all' || status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const activeCount = staffList.filter((m) => m.allowed_user?.status === 'active').length;
  const invitedCount = staffList.filter((m) => m.allowed_user?.status === 'invited').length;
  const suspendedCount = staffList.filter(
    (m) => m.allowed_user?.status === 'suspended' || m.allowed_user?.status === 'revoked',
  ).length;

  function handleOpenInvite() {
    setFormError(null);
    setInviteForm({
      email: '',
      role: 'staff',
      staff_code: `MO-${String(staffList.length + 101).padStart(3, '0')}`,
      roster_name: '',
      display_name: '',
      staff_group: 'Medical Officer',
      phone: '',
      registration_number: '',
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
      setFormError('Staff code is required (e.g. MO-105).');
      return;
    }
    if (!inviteForm.roster_name.trim()) {
      setFormError('Roster name is required (e.g. Dr Sarah).');
      return;
    }
    if (!inviteForm.display_name.trim()) {
      setFormError('Display name is required (e.g. Dr Sarah Jenkins).');
      return;
    }

    try {
      await createMutation.mutateAsync({
        email: inviteForm.email.trim().toLowerCase(),
        role: inviteForm.role,
        staff_code: inviteForm.staff_code.trim(),
        roster_name: inviteForm.roster_name.trim(),
        display_name: inviteForm.display_name.trim(),
        staff_group: inviteForm.staff_group,
        phone: inviteForm.phone.trim() || undefined,
        registration_number: inviteForm.registration_number.trim() || undefined,
      });
      setIsInviteOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to register staff member.');
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update account status.');
    }
  }

  return (
    <OwnerUxBoundary areaName="Staff & Allowlist">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Owner Administration"
          title="Staff Directory & Approved Emails"
          description="Manage operational roster identities, clinical grades, and the authoritative Google OAuth email allowlist."
          actions={<StatusBadge label="RLS Enforced" tone="teal" />}
        />

        {/* Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SurfaceCard className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text-secondary">Active Staff Accounts</p>
              <p className="mt-1 text-2xl font-bold text-text-primary">{activeCount}</p>
            </div>
            <div className="rounded-xl bg-success-soft p-3 text-success">
              <UserCheck className="h-6 w-6" aria-hidden="true" />
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text-secondary">Invited / Pending</p>
              <p className="mt-1 text-2xl font-bold text-text-primary">{invitedCount}</p>
            </div>
            <div className="rounded-xl bg-warning-soft p-3 text-warning">
              <UserPlus className="h-6 w-6" aria-hidden="true" />
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text-secondary">Suspended / Inactive</p>
              <p className="mt-1 text-2xl font-bold text-text-primary">{suspendedCount}</p>
            </div>
            <div className="rounded-xl bg-danger-soft p-3 text-danger">
              <UserX className="h-6 w-6" aria-hidden="true" />
            </div>
          </SurfaceCard>
        </div>

        {/* Search, Filter & Actions Toolbar */}
        <SurfaceCard className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1 max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Search name, code, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-surface-solid py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-2 focus-visible:outline-brand-primary"
                />
              </div>

              <div className="flex items-center gap-1 rounded-xl border border-border-subtle bg-surface-muted p-1 text-xs">
                {(['all', 'active', 'invited', 'suspended'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                      statusFilter === s
                        ? 'bg-surface-solid text-text-primary shadow-xs'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <Button variant="primary" onClick={handleOpenInvite} className="shrink-0">
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Invite Staff Member</span>
            </Button>
          </div>
        </SurfaceCard>

        {/* Staff Table */}
        <SurfaceCard className="overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-text-secondary">
              Loading staff directory from Staging...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-danger" role="alert">
              Failed to load staff directory: {error.message}
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="p-12 text-center text-sm text-text-secondary">
              No staff members found matching criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border-subtle bg-surface-muted/60 text-xs font-semibold text-text-secondary uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Staff Identity
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Staff Code
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Grade / Group
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Google Email
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Role
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Account Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredStaff.map((member) => {
                    const status =
                      member.allowed_user?.status ?? (member.active ? 'active' : 'suspended');
                    const isSelf = member.id === user?.staffId;
                    const isOwnerRole = member.allowed_user?.role === 'owner';

                    return (
                      <tr key={member.id} className="hover:bg-surface-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-text-primary">
                          <div>
                            <span className="font-semibold">{member.roster_name}</span>
                            <span className="block text-xs text-text-secondary">
                              {member.display_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                          {member.staff_code}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-md bg-brand-primary/10 px-2 py-1 text-xs font-medium text-brand-primary">
                            {member.staff_group}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-text-secondary">
                          {member.allowed_user?.email ?? 'Unbound email'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                              isOwnerRole
                                ? 'bg-brand-primary/15 text-brand-primary'
                                : 'bg-surface-muted text-text-secondary'
                            }`}
                          >
                            {isOwnerRole && <Shield className="h-3 w-3" />}
                            {isOwnerRole ? 'Owner' : 'Staff'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            label={status.toUpperCase()}
                            tone={
                              status === 'active'
                                ? 'success'
                                : status === 'invited'
                                  ? 'warning'
                                  : 'danger'
                            }
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {member.allowed_user && !isOwnerRole ? (
                            <div className="flex items-center justify-end gap-1.5">
                              {status === 'active' ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setStatusActionTarget({ member, action: 'suspended' })
                                  }
                                  className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg px-2.5 py-1 text-xs font-medium text-warning hover:bg-warning-soft focus-visible:outline-brand-primary"
                                >
                                  Suspend
                                </button>
                              ) : status === 'suspended' ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setStatusActionTarget({ member, action: 'active' })
                                  }
                                  className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg px-2.5 py-1 text-xs font-medium text-success hover:bg-success-soft focus-visible:outline-brand-primary"
                                >
                                  Activate
                                </button>
                              ) : null}

                              {status !== 'revoked' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setStatusActionTarget({ member, action: 'revoked' })
                                  }
                                  className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger-soft focus-visible:outline-brand-primary"
                                >
                                  Revoke
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-text-secondary italic">
                              {isSelf ? '(Current Session)' : 'Protected'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SurfaceCard>

        {/* Invite Staff Member Modal */}
        <Modal
          isOpen={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
          title="Invite Staff Member"
          description="Register a new healthcare worker in the directory and pre-approve their Google OAuth email in the allowlist."
          maxWidth="md"
        >
          <form onSubmit={handleCreateStaff} className="space-y-4">
            {formError && (
              <div
                className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger"
                role="alert"
              >
                {formError}
              </div>
            )}

            <FormField
              id="invite-email"
              label="Google Account Email"
              required
              hint="Must match the Google account the staff member will sign in with."
            >
              <input
                id="invite-email"
                type="email"
                required
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="staff@upm.edu.my or gmail"
                className="w-full rounded-xl border border-border-subtle bg-surface-solid px-3.5 py-2.5 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-brand-primary"
              />
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                id="invite-code"
                label="Staff Code"
                required
                hint="Unique ID (e.g. MO-105)"
              >
                <input
                  id="invite-code"
                  type="text"
                  required
                  value={inviteForm.staff_code}
                  onChange={(e) => setInviteForm({ ...inviteForm, staff_code: e.target.value })}
                  className="w-full rounded-xl border border-border-subtle bg-surface-solid px-3.5 py-2.5 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-brand-primary"
                />
              </FormField>

              <FormField id="invite-role" label="Application Role" required>
                <select
                  id="invite-role"
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, role: e.target.value as 'owner' | 'staff' })
                  }
                  className="w-full rounded-xl border border-border-subtle bg-surface-solid px-3.5 py-2.5 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-brand-primary"
                >
                  <option value="staff">Staff (Medical Officer)</option>
                  <option value="owner">Owner (Administrator)</option>
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                id="invite-roster-name"
                label="Roster Short Name"
                required
                hint="e.g. Dr Sarah"
              >
                <input
                  id="invite-roster-name"
                  type="text"
                  required
                  value={inviteForm.roster_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, roster_name: e.target.value })}
                  placeholder="Dr Sarah"
                  className="w-full rounded-xl border border-border-subtle bg-surface-solid px-3.5 py-2.5 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-brand-primary"
                />
              </FormField>

              <FormField
                id="invite-display-name"
                label="Full Display Name"
                required
                hint="e.g. Dr Sarah Jenkins"
              >
                <input
                  id="invite-display-name"
                  type="text"
                  required
                  value={inviteForm.display_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, display_name: e.target.value })}
                  placeholder="Dr Sarah Jenkins"
                  className="w-full rounded-xl border border-border-subtle bg-surface-solid px-3.5 py-2.5 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-brand-primary"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="invite-group" label="Staff Group / Grade" required>
                <select
                  id="invite-group"
                  value={inviteForm.staff_group}
                  onChange={(e) => setInviteForm({ ...inviteForm, staff_group: e.target.value })}
                  className="w-full rounded-xl border border-border-subtle bg-surface-solid px-3.5 py-2.5 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-brand-primary"
                >
                  <option value="Medical Officer">Medical Officer (MO)</option>
                  <option value="Emergency Physician">Emergency Physician</option>
                  <option value="Specialist">Specialist</option>
                  <option value="Clinical Fellow">Clinical Fellow</option>
                  <option value="House Officer">House Officer</option>
                </select>
              </FormField>

              <FormField
                id="invite-mmc"
                label="MMC Registration No."
                hint="Optional Malaysian Medical Council #"
              >
                <input
                  id="invite-mmc"
                  type="text"
                  value={inviteForm.registration_number}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, registration_number: e.target.value })
                  }
                  placeholder="MMC 12345"
                  className="w-full rounded-xl border border-border-subtle bg-surface-solid px-3.5 py-2.5 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-brand-primary"
                />
              </FormField>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
              <Button variant="secondary" onClick={() => setIsInviteOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Registering...' : 'Invite & Authorize'}
              </Button>
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
