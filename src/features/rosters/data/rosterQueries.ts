import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/platform/query';
import { supabase } from '@/platform/supabase';
import type { Database } from '@/platform/supabase';
import type { StaffRosterIdentity } from '../domain/types';

export type RosterPeriodRow = Database['public']['Tables']['roster_periods']['Row'];
export type ShiftDefinitionRow = Database['public']['Tables']['shift_definitions']['Row'];
export type ShiftSemanticRow = Database['public']['Tables']['shift_semantics']['Row'];
export type DraftAssignmentRow = Database['public']['Tables']['roster_draft_assignments']['Row'];
export type StaffingThresholdRow = Database['public']['Tables']['staffing_thresholds']['Row'];

export function getRosterPeriodQueryKey(year: string, month: string) {
  return queryKeys.rosters.period(year, month);
}

export function useRosterPeriodQuery(year: string, month: string) {
  const periodStart = `${year}-${month}-01`;

  return useQuery({
    queryKey: queryKeys.rosters.period(year, month),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roster_periods')
        .select('*')
        .eq('period_start', periodStart)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60,
  });
}

export function useShiftDefinitionsQuery() {
  return useQuery({
    queryKey: queryKeys.rosters.shiftDefinitions(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_definitions')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useShiftSemanticsQuery() {
  return useQuery({
    queryKey: [...queryKeys.rules.all, 'shift-semantics'] as const,
    queryFn: async () => {
      const { data, error } = await supabase.from('shift_semantics').select('*');

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useRuleVersionQuery(versionId?: number | null) {
  return useQuery({
    queryKey: versionId ? queryKeys.rules.version(versionId) : ['rules', 'default-active'],
    queryFn: async () => {
      let query = supabase.from('rule_versions').select('*');
      if (versionId) {
        query = query.eq('id', versionId);
      } else {
        query = query.eq('status', 'active').order('version', { ascending: false }).limit(1);
      }
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useStaffingThresholdsQuery(ruleVersionId?: number | null) {
  return useQuery({
    queryKey: ruleVersionId
      ? queryKeys.rules.thresholds(ruleVersionId)
      : ['rules', 'thresholds', 'default'],
    queryFn: async () => {
      if (!ruleVersionId) return [];
      const { data, error } = await supabase
        .from('staffing_thresholds')
        .select('*')
        .eq('rule_version_id', ruleVersionId);

      if (error) throw error;
      return data;
    },
    enabled: Boolean(ruleVersionId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useDraftAssignmentsQuery(periodId?: number | null) {
  return useQuery({
    queryKey: periodId ? queryKeys.rosters.draftAssignments(periodId) : ['rosters', 'draft-empty'],
    queryFn: async () => {
      if (!periodId) return [];
      const { data, error } = await supabase
        .from('roster_draft_assignments')
        .select('*')
        .eq('period_id', periodId);

      if (error) throw error;
      return data;
    },
    enabled: Boolean(periodId),
    staleTime: 1000 * 15,
  });
}

export function useRosterStaffQuery() {
  return useQuery({
    queryKey: queryKeys.directory.activeList(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_directory')
        .select('id, staff_code, roster_name, display_name, staff_group, active')
        .eq('active', true)
        .order('roster_name', { ascending: true });

      if (error) throw error;
      return (data ?? []).map(
        (s: {
          id: number;
          staff_code: string;
          roster_name: string;
          display_name: string;
          staff_group: string;
          active: boolean;
        }) => ({
          id: s.id,
          staffCode: s.staff_code,
          rosterName: s.roster_name,
          displayName: s.display_name,
          staffGroup: s.staff_group,
          active: s.active,
        }),
      ) as StaffRosterIdentity[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function usePublicHolidaysQuery() {
  return useQuery({
    queryKey: ['public-holidays', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('public_holidays')
        .select('holiday_date, name, jurisdiction');

      if (error) throw error;
      return (data ?? []).map(
        (h: { holiday_date: string; name: string; jurisdiction: string | null }) => ({
          date: h.holiday_date,
          name: h.name,
          jurisdiction: h.jurisdiction ?? undefined,
        }),
      );
    },
    staleTime: 1000 * 60 * 60,
  });
}

export function useUpsertDraftAssignmentMutation(periodId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      staffId: number;
      dutyDate: string;
      shiftCode: string;
      cellNote?: string;
    }) => {
      const { data, error } = await supabase
        .from('roster_draft_assignments')
        .upsert(
          {
            period_id: periodId,
            staff_id: payload.staffId,
            duty_date: payload.dutyDate,
            shift_code: payload.shiftCode,
            cell_note: payload.cellNote ?? null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'period_id,staff_id,duty_date',
          },
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rosters.draftAssignments(periodId),
      });
    },
  });
}

export function useDeleteDraftAssignmentMutation(periodId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { staffId: number; dutyDate: string }) => {
      const { error } = await supabase
        .from('roster_draft_assignments')
        .delete()
        .eq('period_id', periodId)
        .eq('staff_id', payload.staffId)
        .eq('duty_date', payload.dutyDate);

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rosters.draftAssignments(periodId),
      });
    },
  });
}
