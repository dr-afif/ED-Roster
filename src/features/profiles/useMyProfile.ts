import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/platform/supabase';
import { useAuth } from '@/platform/auth';

export type MyProfileData = {
  staff_id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  registration_number: string | null;
  staff_number: string | null;
  ic_number: string | null;
  telegram_chat_id: string | null;
  telegram_username: string | null;
  telegram_linked_at: string | null;
  telegram_alerts_enabled: boolean;
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
        staff_number: profile.staff_number ?? null,
        ic_number: profile.ic_number ?? null,
        telegram_chat_id: profile.telegram_chat_id ?? null,
        telegram_username: profile.telegram_username ?? null,
        telegram_linked_at: profile.telegram_linked_at ?? null,
        telegram_alerts_enabled: profile.telegram_alerts_enabled ?? true,
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
  full_name?: string;
  display_name?: string;
  phone?: string;
  registration_number?: string;
  staff_number?: string;
  ic_number?: string;
  telegram_alerts_enabled?: boolean;
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

      const patch: {
        full_name?: string;
        phone?: string | null;
        registration_number?: string | null;
        staff_number?: string | null;
        ic_number?: string | null;
        telegram_alerts_enabled?: boolean;
      } = {};

      if (payload.full_name !== undefined) {
        patch.full_name = payload.full_name.trim();
      }
      if (payload.phone !== undefined) {
        patch.phone = payload.phone.trim() || null;
      }
      if (payload.registration_number !== undefined) {
        patch.registration_number = payload.registration_number.trim() || null;
      }
      if (payload.staff_number !== undefined) {
        patch.staff_number = payload.staff_number.trim() || null;
      }
      if (payload.ic_number !== undefined) {
        patch.ic_number = payload.ic_number.trim() || null;
      }
      if (payload.telegram_alerts_enabled !== undefined) {
        patch.telegram_alerts_enabled = payload.telegram_alerts_enabled;
      }

      let updatedRow = null;
      if (Object.keys(patch).length > 0) {
        const { data, error } = await supabase
          .from('staff_profiles')
          .update(patch)
          .eq('staff_id', staffId)
          .select()
          .single();

        if (error) {
          throw new Error(error.message);
        }
        updatedRow = data;
      }

      if (payload.display_name !== undefined && payload.display_name.trim()) {
        const { error: displayError } = await supabase.rpc('update_my_display_name', {
          p_display_name: payload.display_name.trim(),
        });
        if (displayError) {
          throw new Error(displayError.message);
        }
      }

      return updatedRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_profile'] });
      queryClient.invalidateQueries({ queryKey: ['staff_directory'] });
    },
  });
}

export const TELEGRAM_BOT_USERNAME = 'edroster_bot';

export function useCreateTelegramLinkMutation() {
  return useMutation({
    mutationFn: async () => {
      const { data: token, error } = await supabase.rpc('create_my_telegram_link_token');
      if (error || !token) {
        throw new Error(error?.message || 'Failed to generate Telegram link token.');
      }
      return {
        token,
        url: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(token)}`,
      };
    },
  });
}

export function useUnlinkTelegramMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('unlink_my_telegram');
      if (error) {
        throw new Error(error.message);
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_profile'] });
    },
  });
}
