import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/platform/query';
import { supabase } from '@/platform/supabase';
import type { Database } from '@/platform/supabase';
import type {
  AmendmentCategory,
  AmendmentEvent,
  AmendmentLineAction,
  AmendmentLineItem,
  GoffLedgerEntry,
  GoffTransactionType,
  StaffRosterIdentity,
} from '../domain/types';

export type RosterPeriodRow = Database['public']['Tables']['roster_periods']['Row'];
export type ShiftDefinitionRow = Database['public']['Tables']['shift_definitions']['Row'];
export type ShiftSemanticRow = Database['public']['Tables']['shift_semantics']['Row'];
export type DraftAssignmentRow = Database['public']['Tables']['roster_draft_assignments']['Row'];
export type StaffingThresholdRow = Database['public']['Tables']['staffing_thresholds']['Row'];
export type PlannedAssignmentRow =
  Database['public']['Tables']['roster_planned_assignments']['Row'];
export type PublicationRow = Database['public']['Tables']['roster_publications']['Row'];
export type AmendmentEventRow = Database['public']['Tables']['roster_amendment_events']['Row'];
export type AmendmentLineRow = Database['public']['Tables']['roster_amendment_lines']['Row'];
export type GoffLedgerRow = Database['public']['Tables']['goff_ledger']['Row'];

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

export function useShiftDefinitionsQuery(includeInactive = false) {
  return useQuery({
    queryKey: includeInactive
      ? ([...queryKeys.rosters.shiftDefinitions(), 'all'] as const)
      : queryKeys.rosters.shiftDefinitions(),
    queryFn: async () => {
      let query = supabase
        .from('shift_definitions')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
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
    queryKey: queryKeys.rosters.staffList(),
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
          staff_code?: string | null;
          roster_name?: string | null;
          display_name?: string | null;
          staff_group?: string | null;
          active?: boolean | null;
        }) => {
          const staffCode = s.staff_code ?? '';
          const rosterName = s.roster_name ?? s.display_name ?? (staffCode || 'Staff');
          const displayName = s.display_name ?? s.roster_name ?? rosterName;
          const staffGroup = s.staff_group ?? 'medical_officer';
          const active = s.active ?? true;

          return {
            id: s.id,
            staffCode,
            rosterName,
            displayName,
            staffGroup,
            active,
          } as StaffRosterIdentity;
        },
      );
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

export function usePlannedAssignmentsQuery(periodId?: number | null) {
  return useQuery({
    queryKey: periodId
      ? queryKeys.rosters.plannedAssignments(periodId)
      : ['rosters', 'planned-empty'],
    queryFn: async () => {
      if (!periodId) return [];
      const { data, error } = await supabase
        .from('roster_planned_assignments')
        .select('*')
        .eq('period_id', periodId);

      if (error) throw error;
      return data;
    },
    enabled: Boolean(periodId),
    staleTime: 1000 * 30,
  });
}

export function usePublicationsQuery(periodId?: number | null) {
  return useQuery({
    queryKey: periodId
      ? queryKeys.rosters.publications(periodId)
      : ['rosters', 'publications-empty'],
    queryFn: async () => {
      if (!periodId) return [];
      const { data, error } = await supabase
        .from('roster_publications')
        .select('*')
        .eq('period_id', periodId)
        .order('publication_version', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: Boolean(periodId),
    staleTime: 1000 * 60,
  });
}

export function useAmendmentEventsQuery(periodId?: number | null) {
  return useQuery({
    queryKey: periodId
      ? queryKeys.rosters.amendmentEvents(periodId)
      : ['rosters', 'amendment-events-empty'],
    queryFn: async () => {
      if (!periodId) return [];
      const { data, error } = await supabase
        .from('roster_amendment_events')
        .select('*, roster_amendment_lines(*)')
        .eq('period_id', periodId)
        .order('id', { ascending: true });

      if (error) throw error;
      return (data ?? []).map((e): AmendmentEvent => ({
        id: e.id,
        periodId: e.period_id,
        category: e.category as AmendmentCategory,
        reason: e.reason,
        status: e.status as 'active' | 'reversed',
        reversedByEventId: e.reversed_by_event_id,
        reversalReason: e.reversal_reason,
        operationId: e.operation_id,
        createdBy: e.created_by,
        createdAt: e.created_at,
        lines: ((e.roster_amendment_lines as AmendmentLineRow[]) ?? []).map(
          (l): AmendmentLineItem => ({
            id: l.id,
            eventId: l.event_id,
            periodId: l.period_id,
            staffId: l.staff_id,
            dutyDate: l.duty_date,
            lineAction: l.line_action as AmendmentLineAction,
            fromShiftCode: l.from_shift_code,
            toShiftCode: l.to_shift_code,
            notes: l.notes,
          }),
        ),
      }));
    },
    enabled: Boolean(periodId),
    staleTime: 1000 * 15,
  });
}

export function useGoffLedgerQuery(staffId?: number) {
  return useQuery({
    queryKey: queryKeys.rosters.goffLedger(staffId),
    queryFn: async () => {
      let query = supabase
        .from('goff_ledger')
        .select('*')
        .order('effective_date', { ascending: true });
      if (staffId) {
        query = query.eq('staff_id', staffId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row): GoffLedgerEntry => ({
        id: row.id,
        staffId: row.staff_id,
        periodId: row.period_id,
        transactionType: row.transaction_type as GoffTransactionType,
        amount: row.amount,
        reason: row.reason,
        effectiveDate: row.effective_date,
        createdBy: row.created_by,
        createdAt: row.created_at,
      }));
    },
    staleTime: 1000 * 30,
  });
}

export function usePublishRosterMutation(periodId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload?: { notes?: string }) => {
      const { data, error } = await supabase.rpc('publish_roster_period', {
        p_period_id: periodId,
        p_notes: payload?.notes ?? undefined,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rosters.all,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.audit.all,
      });
    },
  });
}

export function useSubmitAmendmentMutation(periodId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      category: AmendmentCategory;
      reason: string;
      lines: readonly AmendmentLineItem[];
    }) => {
      const formattedLines = payload.lines.map((l) => ({
        staff_id: l.staffId,
        duty_date: l.dutyDate,
        line_action: l.lineAction,
        from_shift_code: l.fromShiftCode,
        to_shift_code: l.toShiftCode,
        notes: l.notes ?? null,
      }));

      const { data, error } = await supabase.rpc('submit_roster_amendment', {
        p_period_id: periodId,
        p_category: payload.category,
        p_reason: payload.reason,
        p_lines: formattedLines,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rosters.all,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.audit.all,
      });
    },
  });
}

export function useReverseAmendmentMutation(periodId?: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { eventId: number; reason: string }) => {
      const { data, error } = await supabase.rpc('reverse_roster_amendment', {
        p_event_id: payload.eventId,
        p_reason: payload.reason,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rosters.all,
      });
      if (periodId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.rosters.amendmentEvents(periodId),
        });
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.audit.all,
      });
    },
  });
}

export function useCloseRosterMutation(periodId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload?: { notes?: string }) => {
      const { error } = await supabase.rpc('close_roster_period', {
        p_period_id: periodId,
        p_notes: payload?.notes ?? undefined,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rosters.all,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.audit.all,
      });
    },
  });
}

export function useReopenRosterMutation(periodId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { reason: string }) => {
      const { error } = await supabase.rpc('reopen_roster_period', {
        p_period_id: periodId,
        p_reason: payload.reason,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rosters.all,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.audit.all,
      });
    },
  });
}

export interface UpdateShiftDefinitionPayload {
  code: string;
  label: string;
  shortLabel: string;
  colorToken: string;
  sortOrder: number;
  isActive: boolean;
  semanticClass?: 'worked' | 'transparent' | 'reset' | 'unknown';
  providesCoverage?: boolean;
  nightPolicyBQualifying?: boolean;
  displacesOffEarnsGoff?: boolean;
}

export interface CreateShiftDefinitionPayload {
  code: string;
  label: string;
  shortLabel: string;
  colorToken: string;
  sortOrder: number;
  isActive?: boolean;
  semanticClass: 'worked' | 'transparent' | 'reset' | 'unknown';
  providesCoverage: boolean;
  nightPolicyBQualifying: boolean;
  displacesOffEarnsGoff: boolean;
}

export function useUpdateShiftDefinitionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateShiftDefinitionPayload) => {
      // 1. Update shift_definitions
      const { error: defError } = await supabase
        .from('shift_definitions')
        .update({
          label: payload.label.trim(),
          short_label: payload.shortLabel.trim().toUpperCase(),
          color_token: payload.colorToken,
          sort_order: payload.sortOrder,
          is_active: payload.isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('code', payload.code);

      if (defError) throw defError;

      // 2. Upsert shift_semantics if provided
      if (payload.semanticClass !== undefined) {
        const { error: semError } = await supabase.from('shift_semantics').upsert({
          shift_code: payload.code,
          semantic_class: payload.semanticClass,
          provides_coverage: payload.providesCoverage ?? false,
          night_policy_b_qualifying: payload.nightPolicyBQualifying ?? false,
          displaces_off_earns_goff: payload.displacesOffEarnsGoff ?? false,
          updated_at: new Date().toISOString(),
        });

        if (semError) throw semError;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rosters.shiftDefinitions(),
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.rosters.shiftDefinitions(), 'all'],
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rules.all,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rosters.all,
      });
    },
  });
}

export function useCreateShiftDefinitionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateShiftDefinitionPayload) => {
      const code = payload.code.trim().toUpperCase();

      // 1. Insert into shift_definitions
      const { error: defError } = await supabase.from('shift_definitions').insert({
        code,
        label: payload.label.trim(),
        short_label: payload.shortLabel.trim().toUpperCase(),
        color_token: payload.colorToken,
        sort_order: payload.sortOrder,
        is_active: payload.isActive ?? true,
      });

      if (defError) throw defError;

      // 2. Insert into shift_semantics
      const { error: semError } = await supabase.from('shift_semantics').insert({
        shift_code: code,
        semantic_class: payload.semanticClass,
        provides_coverage: payload.providesCoverage,
        night_policy_b_qualifying: payload.nightPolicyBQualifying,
        displaces_off_earns_goff: payload.displacesOffEarnsGoff,
      });

      if (semError) throw semError;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rosters.shiftDefinitions(),
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.rosters.shiftDefinitions(), 'all'],
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rules.all,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rosters.all,
      });
    },
  });
}
