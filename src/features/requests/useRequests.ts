import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../platform/supabase';
import { queryKeys } from '../../platform/query/queryKeys';
import type { RequestRecord } from './domain/quota';

export interface SubmitRequestPayload {
  id?: number | string;
  staffId: number;
  date: string;
  request: string;
  comment?: string;
}

export function useAllRequestsQuery() {
  return useQuery({
    queryKey: queryKeys.requests.all,
    queryFn: async (): Promise<RequestRecord[]> => {
      const { data, error } = await supabase
        .from('roster_requests')
        .select(
          `
          id,
          public_id,
          staff_id,
          start_date,
          end_date,
          requested_shift_code,
          notes,
          status,
          created_at,
          staff:staff_directory!roster_requests_staff_id_fkey (
            id,
            roster_name,
            display_name,
            staff_code
          )
        `,
        )
        .in('status', ['active', 'submitted', 'approved'])
        .order('start_date', { ascending: true });

      if (error) {
        throw new Error(`Failed to load requests: ${error.message}`);
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        public_id: row.public_id,
        staff_id: row.staff_id,
        name: row.staff?.roster_name || row.staff?.display_name || row.staff?.staff_code || 'Staff',
        date: row.start_date,
        request: (row.requested_shift_code || 'OFF').toUpperCase(),
        comment: row.notes,
        status: row.status,
        created_at: row.created_at,
      }));
    },
    staleTime: 30_000,
  });
}

export function useTeamMembersQuery() {
  return useQuery({
    queryKey: queryKeys.directory.activeList(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_directory')
        .select('id, staff_code, roster_name, display_name, active')
        .eq('active', true)
        .order('roster_name', { ascending: true });

      if (error) {
        throw new Error(`Failed to load team members: ${error.message}`);
      }
      return (data ?? []).map((row) => ({
        ...row,
        id: row.id,
        staffCode: row.staff_code ?? '',
        rosterName: row.roster_name ?? row.display_name ?? row.staff_code ?? 'Staff',
        displayName: row.display_name ?? row.roster_name ?? 'Staff',
        staff_code: row.staff_code ?? '',
        roster_name: row.roster_name ?? row.display_name ?? row.staff_code ?? 'Staff',
        display_name: row.display_name ?? row.roster_name ?? 'Staff',
      }));
    },
    staleTime: 60_000,
  });
}

export function usePublicHolidaysQuery() {
  return useQuery({
    queryKey: ['public-holidays'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('public_holidays')
        .select('id, holiday_date, name')
        .order('holiday_date', { ascending: true });

      if (error) {
        throw new Error(`Failed to load public holidays: ${error.message}`);
      }
      return data ?? [];
    },
    staleTime: 300_000,
  });
}

export function useRequestTypesMapQuery() {
  return useQuery({
    queryKey: ['request-types-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('request_types')
        .select('id, code, label')
        .eq('active', true);

      if (error) {
        throw new Error(`Failed to load request types: ${error.message}`);
      }

      const map: Record<string, number> = {};
      (data ?? []).forEach((rt) => {
        map[rt.code.toLowerCase()] = rt.id;
      });
      return map;
    },
    staleTime: 300_000,
  });
}

export function useSubmitRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SubmitRequestPayload) => {
      const { data: requestTypes, error: rtError } = await supabase
        .from('request_types')
        .select('id, code')
        .eq('active', true);

      if (rtError) {
        throw new Error(`Failed to resolve request type: ${rtError.message}`);
      }

      const cleanCode = payload.request.trim().toLowerCase();
      const matched = (requestTypes ?? []).find((rt) => rt.code.toLowerCase() === cleanCode);
      const requestTypeId = matched?.id || requestTypes?.[0]?.id;

      if (!requestTypeId) {
        throw new Error('No valid request type configured in system.');
      }

      if (payload.id) {
        const { data, error } = await supabase
          .from('roster_requests')
          .update({
            start_date: payload.date,
            end_date: payload.date,
            requested_shift_code: payload.request.trim().toUpperCase(),
            request_type_id: requestTypeId,
            notes: payload.comment?.trim() || null,
            status: 'active',
          })
          .eq('id', Number(payload.id))
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to update request: ${error.message}`);
        }
        return data;
      }

      const { data, error } = await supabase
        .from('roster_requests')
        .insert({
          staff_id: payload.staffId,
          start_date: payload.date,
          end_date: payload.date,
          requested_shift_code: payload.request.trim().toUpperCase(),
          request_type_id: requestTypeId,
          notes: payload.comment?.trim() || null,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create request: ${error.message}`);
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    },
  });
}

export function useDeleteRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: number | string) => {
      const { error } = await supabase.from('roster_requests').delete().eq('id', Number(requestId));

      if (error) {
        throw new Error(`Failed to delete request: ${error.message}`);
      }
      return true;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    },
  });
}
