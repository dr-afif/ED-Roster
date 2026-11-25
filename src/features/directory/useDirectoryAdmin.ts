import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/platform/supabase';
import type { Tables } from '@/platform/supabase/database.types';

type StaffRow = Tables<'staff_directory'>;
type AllowedRow = Tables<'allowed_users'>;
type ProfileRow = Tables<'staff_profiles'>;
type ServicePeriodRow = Tables<'staff_service_periods'>;

export type ServiceEndReason =
  | 'switched_department'
  | 'masters_program'
  | 'quit_hospital'
  | 'transferred_hospital'
  | 'extended_leave'
  | 'other';

export type StaffServicePeriod = {
  id?: number;
  staff_id?: number;
  start_date: string;
  end_date: string | null;
  end_reason: ServiceEndReason | null;
  end_comment: string | null;
};

export type DirectoryStaffMember = {
  id: number;
  staff_code: string;
  roster_name: string;
  display_name: string;
  staff_group: string;
  employment_status: string;
  active: boolean;
  start_date: string | null;
  end_date: string | null;
  service_periods?: StaffServicePeriod[];
  allowed_user?: {
    id: number;
    email: string;
    role: string;
    status: string;
    activated_at: string | null;
    revoked_at: string | null;
    revocation_reason: string | null;
  } | null;
  staff_profile?: {
    full_name?: string | null;
    email?: string | null;
    phone: string | null;
    registration_number: string | null;
    staff_number?: string | null;
    ic_number?: string | null;
    verification_status: string;
  } | null;
};

function mapReasonToEmploymentStatus(reason?: ServiceEndReason | null): string {
  switch (reason) {
    case 'switched_department':
    case 'transferred_hospital':
      return 'transferred';
    case 'masters_program':
    case 'extended_leave':
      return 'on_leave';
    case 'quit_hospital':
      return 'resigned';
    default:
      return 'inactive';
  }
}

export function useStaffDirectoryQuery() {
  return useQuery({
    queryKey: ['staff_directory', 'admin_view'],
    queryFn: async (): Promise<DirectoryStaffMember[]> => {
      // 1. Fetch all operational staff directory records
      const { data: staffList, error: staffError } = await supabase
        .from('staff_directory')
        .select('*')
        .order('id', { ascending: true });

      if (staffError) {
        throw new Error(staffError.message);
      }

      // 2. Fetch all allowed users
      const { data: allowedUsers, error: allowedError } = await supabase
        .from('allowed_users')
        .select('*');

      if (allowedError) {
        throw new Error(allowedError.message);
      }

      // 3. Fetch all staff profiles
      const { data: profiles, error: profileError } = await supabase
        .from('staff_profiles')
        .select('*');

      if (profileError) {
        throw new Error(profileError.message);
      }

      // 4. Fetch separate staff service periods (graceful fallback if table absent)
      const { data: servicePeriodsData, error: periodsError } = await supabase
        .from('staff_service_periods')
        .select('*')
        .order('start_date', { ascending: true })
        .order('id', { ascending: true });

      const allowedRows: AllowedRow[] = allowedUsers ?? [];
      const profileRows: ProfileRow[] = profiles ?? [];
      const staffRows: StaffRow[] = staffList ?? [];
      const periodRows: ServicePeriodRow[] = periodsError ? [] : (servicePeriodsData ?? []);

      const allowedMap = new Map<number | null, AllowedRow>(
        allowedRows.map((u: AllowedRow) => [u.staff_id, u]),
      );
      const profileMap = new Map<number, ProfileRow>(
        profileRows.map((p: ProfileRow) => [p.staff_id, p]),
      );
      const periodsMap = new Map<number, StaffServicePeriod[]>();
      for (const row of periodRows) {
        const list = periodsMap.get(row.staff_id) ?? [];
        list.push({
          id: row.id,
          staff_id: row.staff_id,
          start_date: row.start_date,
          end_date: row.end_date,
          end_reason: (row.end_reason as ServiceEndReason | null) ?? null,
          end_comment: row.end_comment,
        });
        periodsMap.set(row.staff_id, list);
      }

      return staffRows.map((s: StaffRow) => {
        const periods =
          periodsMap.get(s.id) ??
          (s.start_date
            ? [
                {
                  start_date: s.start_date,
                  end_date: s.end_date,
                  end_reason: null,
                  end_comment: null,
                },
              ]
            : []);
        return {
          id: s.id,
          staff_code: s.staff_code,
          roster_name: s.roster_name,
          display_name: s.display_name,
          staff_group: s.staff_group,
          employment_status: s.employment_status,
          active: s.active,
          start_date: s.start_date,
          end_date: s.end_date,
          service_periods: periods,
          allowed_user: allowedMap.get(s.id) ?? null,
          staff_profile: profileMap.get(s.id) ?? null,
        };
      });
    },
  });
}

export type CreateStaffPayload = {
  email: string;
  role: 'owner' | 'staff';
  staff_code: string;
  roster_name: string;
  display_name: string;
  staff_group: string;
  phone?: string;
  registration_number?: string;
  start_date?: string;
};

export function useCreateStaffMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateStaffPayload) => {
      const { data, error } = await supabase.rpc('admin_create_staff_member', {
        p_email: payload.email,
        p_role: payload.role,
        p_staff_code: payload.staff_code,
        p_roster_name: payload.roster_name,
        p_display_name: payload.display_name,
        p_staff_group: payload.staff_group,
        p_phone: payload.phone || undefined,
        p_registration_number: payload.registration_number || undefined,
      });

      if (error) {
        throw new Error(error.message);
      }

      const newStaffId = Number(data);
      const startDate = payload.start_date || new Date().toISOString().slice(0, 10);
      if (Number.isFinite(newStaffId) && newStaffId > 0) {
        await supabase.from('staff_service_periods').insert({
          staff_id: newStaffId,
          start_date: startDate,
          end_date: null,
          end_reason: null,
          end_comment: null,
        });
        await supabase
          .from('staff_directory')
          .update({ start_date: startDate, end_date: null })
          .eq('id', newStaffId);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_directory'] });
    },
  });
}

export type UpdateAllowlistStatusPayload = {
  allowed_user_id: number;
  new_status: 'active' | 'suspended' | 'revoked';
  reason?: string;
};

export function useUpdateAllowlistStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ allowed_user_id, new_status, reason }: UpdateAllowlistStatusPayload) => {
      const { data, error } = await supabase.rpc('admin_update_allowlist_status', {
        p_allowed_user_id: allowed_user_id,
        p_new_status: new_status,
        p_reason: reason || undefined,
      });

      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_directory'] });
    },
  });
}

export type UpdateStaffPayload = {
  staff_id: number;
  staff_code: string;
  roster_name: string;
  display_name: string;
  staff_group: string;
  phone?: string;
  registration_number?: string;
  staff_number?: string;
  ic_number?: string;
  email?: string;
  role?: 'owner' | 'staff';
  active?: boolean;
  service_periods?: StaffServicePeriod[];
  allowed_user_id?: number | null;
  current_allowed_status?: string | null;
};

export function useUpdateStaffMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateStaffPayload) => {
      const periods = payload.service_periods ?? [];
      const hasPeriods = periods.length > 0;
      const hasOpenPeriod = hasPeriods
        ? periods.some((p) => !p.end_date)
        : (payload.active ?? true);

      const { data, error } = await supabase.rpc('admin_update_staff_member', {
        p_staff_id: payload.staff_id,
        p_staff_code: payload.staff_code,
        p_roster_name: payload.roster_name,
        p_display_name: payload.display_name,
        p_staff_group: payload.staff_group,
        p_phone: payload.phone || undefined,
        p_registration_number: payload.registration_number || undefined,
        p_staff_number: payload.staff_number ?? '',
        p_ic_number: payload.ic_number ?? '',
        p_email: payload.email || undefined,
        p_role: payload.role || undefined,
        p_active: hasOpenPeriod,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (hasPeriods) {
        const { error: deleteErr } = await supabase
          .from('staff_service_periods')
          .delete()
          .eq('staff_id', payload.staff_id);
        if (deleteErr) throw new Error(deleteErr.message);

        const orderedPeriods = [...periods].sort((a, b) =>
          a.start_date.localeCompare(b.start_date),
        );
        const rowsToInsert = orderedPeriods.map((p) => ({
          staff_id: payload.staff_id,
          start_date: p.start_date,
          end_date: p.end_date || null,
          end_reason: p.end_date ? (p.end_reason ?? 'other') : null,
          end_comment: p.end_date ? p.end_comment?.trim() || null : null,
        }));
        const { error: insertErr } = await supabase
          .from('staff_service_periods')
          .insert(rowsToInsert);
        if (insertErr) throw new Error(insertErr.message);

        const primaryPeriod =
          orderedPeriods.find((p) => !p.end_date) ?? orderedPeriods[orderedPeriods.length - 1];
        if (primaryPeriod) {
          await supabase
            .from('staff_directory')
            .update({
              start_date: primaryPeriod.start_date,
              end_date: primaryPeriod.end_date || null,
              employment_status: hasOpenPeriod
                ? 'active'
                : mapReasonToEmploymentStatus(primaryPeriod.end_reason),
            })
            .eq('id', payload.staff_id);
        }
      }

      if (
        payload.allowed_user_id &&
        payload.role !== 'owner' &&
        payload.current_allowed_status &&
        payload.current_allowed_status !== 'invited' &&
        payload.current_allowed_status !== 'revoked'
      ) {
        const desiredAllowedStatus = hasOpenPeriod ? 'active' : 'suspended';
        if (payload.current_allowed_status !== desiredAllowedStatus) {
          await supabase.rpc('admin_update_allowlist_status', {
            p_allowed_user_id: payload.allowed_user_id,
            p_new_status: desiredAllowedStatus,
            p_reason: hasOpenPeriod
              ? 'Reactivated with new service period'
              : 'All service periods ended',
          });
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_directory'] });
      queryClient.invalidateQueries({ queryKey: ['rosters'] });
    },
  });
}
