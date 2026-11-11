import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/platform/supabase';
import type { Tables } from '@/platform/supabase/database.types';

type StaffRow = Tables<'staff_directory'>;
type AllowedRow = Tables<'allowed_users'>;
type ProfileRow = Tables<'staff_profiles'>;

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
    phone: string | null;
    registration_number: string | null;
    verification_status: string;
  } | null;
};

export function useStaffDirectoryQuery() {
  return useQuery({
    queryKey: ['staff_directory', 'admin_view'],
    queryFn: async (): Promise<DirectoryStaffMember[]> => {
      // 1. Fetch all operational staff directory records
      const { data: staffList, error: staffError } = await supabase
        .from('staff_directory')
        .select('*')
        .order('staff_code', { ascending: true });

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

      const allowedRows: AllowedRow[] = allowedUsers ?? [];
      const profileRows: ProfileRow[] = profiles ?? [];
      const staffRows: StaffRow[] = staffList ?? [];

      const allowedMap = new Map<number | null, AllowedRow>(
        allowedRows.map((u: AllowedRow) => [u.staff_id, u]),
      );
      const profileMap = new Map<number, ProfileRow>(
        profileRows.map((p: ProfileRow) => [p.staff_id, p]),
      );

      return staffRows.map((s: StaffRow) => ({
        id: s.id,
        staff_code: s.staff_code,
        roster_name: s.roster_name,
        display_name: s.display_name,
        staff_group: s.staff_group,
        employment_status: s.employment_status,
        active: s.active,
        start_date: s.start_date,
        end_date: s.end_date,
        allowed_user: allowedMap.get(s.id) ?? null,
        staff_profile: profileMap.get(s.id) ?? null,
      }));
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
