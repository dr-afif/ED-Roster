import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/platform/supabase';
import { useAuth } from '@/platform/auth';

export type MyProfileData = {
  staff_id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  registration_number: string | null;
  verification_status: string;
  verified_at: string | null;
  directory: {
    staff_code: string;
    roster_name: string;
    display_name: string;
    staff_group: string;
    employment_status: string;
    active: boolean;
  };
};

export function useMyProfileQuery() {
  const { user } = useAuth();
  const staffId = user?.staffId;

  return useQuery({
    queryKey: ['my_profile', staffId],
    enabled: Boolean(staffId),
    queryFn: async (): Promise<MyProfileData | null> => {
      if (!staffId) return null;

      // 1. Fetch staff profile
      const { data: profile, error: profileError } = await supabase
        .from('staff_profiles')
        .select('*')
        .eq('staff_id', staffId)
        .single();

      if (profileError) {
        throw new Error(profileError.message);
      }

      // 2. Fetch staff directory record
      const { data: directory, error: dirError } = await supabase
        .from('staff_directory')
        .select('*')
        .eq('id', staffId)
        .single();

      if (dirError) {
        throw new Error(dirError.message);
      }

      return {
        staff_id: profile.staff_id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        registration_number: profile.registration_number,
        verification_status: profile.verification_status,
        verified_at: profile.verified_at,
        directory: {
          staff_code: directory.staff_code,
          roster_name: directory.roster_name,
          display_name: directory.display_name,
          staff_group: directory.staff_group,
          employment_status: directory.employment_status,
          active: directory.active,
        },
      };
    },
  });
}

export type UpdateProfilePayload = {
  full_name: string;
  phone?: string;
  registration_number?: string;
};

export function useUpdateMyProfileMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const staffId = user?.staffId;

  return useMutation({
    mutationFn: async (payload: UpdateProfilePayload) => {
      if (!staffId) {
        throw new Error('No active staff identity found in current session.');
      }

      const { data, error } = await supabase
        .from('staff_profiles')
        .update({
          full_name: payload.full_name.trim(),
          phone: payload.phone?.trim() || null,
          registration_number: payload.registration_number?.trim() || null,
        })
        .eq('staff_id', staffId)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_profile'] });
    },
  });
}
