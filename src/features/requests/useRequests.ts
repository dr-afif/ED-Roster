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
      const pageSize = 1000;
      const allRows: Array<{
        id: number;
        public_id: string | null;
        staff_id: number;
        start_date: string;
        end_date: string;
        requested_shift_code: string | null;
        notes: string | null;
        status: string;
        submitted_at: string;
        created_at: string;
        staff: {
          id: number;
          roster_name: string | null;
          display_name: string | null;
          staff_code: string | null;
        } | null;
      }> = [];

      let from = 0;
      while (true) {
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
            submitted_at,
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
          .order('start_date', { ascending: true })
          .order('submitted_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) {
          throw new Error(`Failed to load requests: ${error.message}`);
        }

        const batch = data ?? [];
        allRows.push(...batch);
        if (batch.length < pageSize) {
          break;
        }
        from += pageSize;
      }

      return allRows.map((row) => ({
        id: row.id,
        public_id: row.public_id ?? undefined,
        staff_id: row.staff_id,
        name: row.staff?.roster_name || row.staff?.display_name || row.staff?.staff_code || 'Staff',
        date: row.start_date,
        request: (row.requested_shift_code || 'OFF').toUpperCase(),
        comment: row.notes,
        status: row.status,
        submitted_at: row.submitted_at,
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
        .select('id, staff_code, roster_name, display_name, staff_group, active')
        .eq('active', true)
        .order('id', { ascending: true });

      if (error) {
        throw new Error(`Failed to load team members: ${error.message}`);
      }
      return (data ?? [])
        .filter(
          (row) =>
            !/^(EP|PTPO)-/i.test(row.staff_code ?? '') &&
            !/\bADMIN-PTPO\b/i.test(row.staff_group ?? '') &&
            !(row.staff_group ?? '').toLowerCase().startsWith('ep |'),
        )
        .map((row) => ({
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

export function useRequestShiftDefinitionsQuery() {
  return useQuery({
    queryKey: ['shift_definitions', 'request_catalog'] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_definitions')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        throw new Error(`Failed to load shift definitions: ${error.message}`);
      }
      return data ?? [];
    },
    staleTime: 300_000,
  });
}

export function useSubmitRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SubmitRequestPayload) => {
      const { data, error } = await supabase.rpc('submit_roster_request', {
        p_staff_id: payload.staffId,
        p_request_date: payload.date,
        p_requested_shift_code: payload.request.trim().toUpperCase(),
        p_notes: payload.comment?.trim() || null,
        p_edit_request_id: payload.id ? Number(payload.id) : null,
      });

      if (error) {
        throw new Error(`Failed to save request: ${error.message}`);
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
      const { error } = await supabase
        .from('roster_requests')
        .update({
          status: 'withdrawn',
          decision_reason: 'Withdrawn by user',
        })
        .eq('id', Number(requestId));

      if (error) {
        throw new Error(`Failed to withdraw request: ${error.message}`);
      }
      return true;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    },
  });
}
