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
export type RuleVersionRow = Database['public']['Tables']['rule_versions']['Row'];
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

export function useAllRosterPeriodsQuery() {
  return useQuery({
    queryKey: ['roster_periods', 'all_periods'] as const,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('roster_periods')
          .select('*')
          .order('period_start', { ascending: false });

        if (error) return [];
        return data ?? [];
      } catch {
        return [];
      }
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
        .select(
          'id, staff_code, roster_name, display_name, staff_group, active, start_date, end_date',
        )
        .eq('active', true)
        .order('id', { ascending: true });

      if (error) throw error;

      const [
        { data: servicePeriodsData, error: periodsError },
        { data: profilesData, error: profilesError },
      ] = await Promise.all([
        supabase
          .from('staff_service_periods')
          .select('staff_id, start_date, end_date')
          .order('start_date', { ascending: true }),
        supabase.from('staff_profiles').select('staff_id, phone'),
      ]);

      const periodsMap = new Map<number, Array<{ startDate: string; endDate: string | null }>>();
      if (!periodsError && servicePeriodsData) {
        for (const row of servicePeriodsData) {
          const list = periodsMap.get(row.staff_id) ?? [];
          list.push({ startDate: row.start_date, endDate: row.end_date });
          periodsMap.set(row.staff_id, list);
        }
      }

      const phoneMap = new Map<number, string>();
      if (!profilesError && profilesData) {
        for (const row of profilesData) {
          if (row.staff_id != null && row.phone) {
            phoneMap.set(row.staff_id, row.phone);
          }
        }
      }

      return (data ?? []).map(
        (s: {
          id: number;
          staff_code?: string | null;
          roster_name?: string | null;
          display_name?: string | null;
          staff_group?: string | null;
          active?: boolean | null;
          start_date?: string | null;
          end_date?: string | null;
        }) => {
          const staffCode = s.staff_code ?? '';
          const rosterName = s.roster_name ?? s.display_name ?? (staffCode || 'Staff');
          const displayName = s.display_name ?? s.roster_name ?? rosterName;
          const staffGroup = s.staff_group ?? 'medical_officer';
          const active = s.active ?? true;
          const servicePeriods =
            periodsMap.get(s.id) ??
            (s.start_date ? [{ startDate: s.start_date, endDate: s.end_date ?? null }] : undefined);

          return {
            id: s.id,
            staffCode,
            rosterName,
            displayName,
            staffGroup,
            active,
            startDate: s.start_date ?? null,
            endDate: s.end_date ?? null,
            mobileNumber: phoneMap.get(s.id) ?? null,
            servicePeriods,
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

export interface RosterPeriodMeta {
  year: string;
  month: string;
  ruleVersionId?: number | null;
}

async function ensureRosterPeriodId(
  periodId: number,
  periodMeta?: RosterPeriodMeta,
): Promise<number> {
  if (periodId > 0) return periodId;
  if (!periodMeta?.year || !periodMeta?.month) {
    throw new Error('No roster period record found for this month.');
  }
  const periodStart = `${periodMeta.year}-${periodMeta.month}-01`;
  const lastDay = new Date(Number(periodMeta.year), Number(periodMeta.month), 0).getDate();
  const periodEnd = `${periodMeta.year}-${periodMeta.month}-${String(lastDay).padStart(2, '0')}`;

  const { data: existing, error: fetchErr } = await supabase
    .from('roster_periods')
    .select('id')
    .eq('period_start', periodStart)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (existing?.id) return existing.id;

  let activeRuleVersionId = periodMeta.ruleVersionId ?? null;
  if (!activeRuleVersionId) {
    const { data: rv } = await supabase
      .from('rule_versions')
      .select('id')
      .eq('status', 'active')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    activeRuleVersionId = rv?.id ?? 1;
  }

  const { data: created, error: createErr } = await supabase
    .from('roster_periods')
    .upsert(
      {
        period_start: periodStart,
        period_end: periodEnd,
        status: 'draft',
        active_rule_version_id: activeRuleVersionId,
      },
      { onConflict: 'period_start' },
    )
    .select('id')
    .single();

  if (createErr) throw createErr;
  return created.id;
}

export function useUpsertDraftAssignmentMutation(periodId: number, periodMeta?: RosterPeriodMeta) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      staffId: number;
      dutyDate: string;
      shiftCode: string;
      cellNote?: string;
    }) => {
      const resolvedPeriodId = await ensureRosterPeriodId(periodId, periodMeta);
      const attemptUpsert = () =>
        supabase
          .from('roster_draft_assignments')
          .upsert(
            {
              period_id: resolvedPeriodId,
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

      let { data, error } = await attemptUpsert();

      // Ensure MEDSB and modifier variants (e.g. "OFF (S)", "AM (X)") exist in shift_definitions
      if (error && error.code === '23503' && /shift_code_fkey/i.test(error.message ?? '')) {
        const cleanCode = payload.shiftCode.trim();
        const isBaseMedsb = cleanCode.toUpperCase() === 'MEDSB';
        const { error: defError } = await supabase.from('shift_definitions').upsert(
          {
            code: cleanCode,
            label: isBaseMedsb ? 'Medical Standby' : cleanCode,
            short_label: cleanCode,
            color_token: isBaseMedsb ? 'amber' : 'neutral',
            is_active: isBaseMedsb,
            sort_order: isBaseMedsb ? 55 : 999,
          },
          { onConflict: 'code' },
        );
        if (!defError) {
          ({ data, error } = await attemptUpsert());
        }
      }

      if (error) throw error;
      return data;
    },
    onMutate: async (payload) => {
      const key = queryKeys.rosters.draftAssignments(periodId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<DraftAssignmentRow[]>(key);
      queryClient.setQueryData<DraftAssignmentRow[]>(key, (old = []) => {
        const idx = old.findIndex(
          (r) => r.staff_id === payload.staffId && r.duty_date === payload.dutyDate,
        );
        if (idx >= 0) {
          const updated = [...old];
          const existing = updated[idx];
          if (existing) {
            updated[idx] = {
              ...existing,
              shift_code: payload.shiftCode,
              cell_note: payload.cellNote ?? existing.cell_note,
            };
          }
          return updated;
        }
        return [
          ...old,
          {
            id: -Date.now(),
            period_id: periodId,
            staff_id: payload.staffId,
            duty_date: payload.dutyDate,
            shift_code: payload.shiftCode,
            cell_note: payload.cellNote ?? null,
            source_type: 'manual_edit',
            request_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            updated_by: null,
          } as unknown as DraftAssignmentRow,
        ];
      });
      return { previous };
    },
    onError: (_err, _payload, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKeys.rosters.draftAssignments(periodId), context.previous);
      }
    },
    onSettled: (data) => {
      const targetPeriodId = data?.period_id ?? periodId;
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rosters.draftAssignments(targetPeriodId),
      });
      if (periodId <= 0 && periodMeta) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.rosters.period(periodMeta.year, periodMeta.month),
        });
        void queryClient.invalidateQueries({
          queryKey: ['roster_periods', 'all_periods'],
        });
      }
    },
  });
}

export function useDeleteDraftAssignmentMutation(periodId: number, periodMeta?: RosterPeriodMeta) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { staffId: number; dutyDate: string }) => {
      const resolvedPeriodId = await ensureRosterPeriodId(periodId, periodMeta);
      const { error } = await supabase
        .from('roster_draft_assignments')
        .delete()
        .eq('period_id', resolvedPeriodId)
        .eq('staff_id', payload.staffId)
        .eq('duty_date', payload.dutyDate);

      if (error) throw error;
      return resolvedPeriodId;
    },
    onMutate: async (payload) => {
      const key = queryKeys.rosters.draftAssignments(periodId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<DraftAssignmentRow[]>(key);
      queryClient.setQueryData<DraftAssignmentRow[]>(key, (old = []) =>
        old.filter((r) => !(r.staff_id === payload.staffId && r.duty_date === payload.dutyDate)),
      );
      return { previous };
    },
    onError: (_err, _payload, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKeys.rosters.draftAssignments(periodId), context.previous);
      }
    },
    onSettled: (resolvedPeriodId) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rosters.draftAssignments(resolvedPeriodId ?? periodId),
      });
      if (periodId <= 0 && periodMeta) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.rosters.period(periodMeta.year, periodMeta.month),
        });
        void queryClient.invalidateQueries({
          queryKey: ['roster_periods', 'all_periods'],
        });
      }
    },
  });
}

export function useBatchSaveDraftAssignmentsMutation(
  periodId: number,
  periodMeta?: RosterPeriodMeta,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      upserts: Array<{ staffId: number; dutyDate: string; shiftCode: string }>;
      deletes: Array<{ staffId: number; dutyDate: string }>;
    }) => {
      const resolvedPeriodId = await ensureRosterPeriodId(periodId, periodMeta);
      const nowIso = new Date().toISOString();

      if (payload.upserts.length > 0) {
        const rows = payload.upserts.map((u) => ({
          period_id: resolvedPeriodId,
          staff_id: u.staffId,
          duty_date: u.dutyDate,
          shift_code: u.shiftCode,
          updated_at: nowIso,
        }));

        const attemptBatchUpsert = () =>
          supabase
            .from('roster_draft_assignments')
            .upsert(rows, { onConflict: 'period_id,staff_id,duty_date' })
            .select();

        let { error } = await attemptBatchUpsert();

        if (error && error.code === '23503' && /shift_code_fkey/i.test(error.message ?? '')) {
          const uniqueCodes = Array.from(new Set(payload.upserts.map((u) => u.shiftCode.trim())));
          const defRows = uniqueCodes.map((cleanCode) => {
            const isBaseMedsb = cleanCode.toUpperCase() === 'MEDSB';
            return {
              code: cleanCode,
              label: isBaseMedsb ? 'Medical Standby' : cleanCode,
              short_label: cleanCode,
              color_token: isBaseMedsb ? 'amber' : 'neutral',
              is_active: isBaseMedsb,
              sort_order: isBaseMedsb ? 55 : 999,
            };
          });
          const { error: defError } = await supabase
            .from('shift_definitions')
            .upsert(defRows, { onConflict: 'code' });
          if (!defError) {
            ({ error } = await attemptBatchUpsert());
          }
        }

        if (error) throw error;
      }

      if (payload.deletes.length > 0) {
        const results = await Promise.all(
          payload.deletes.map((d) =>
            supabase
              .from('roster_draft_assignments')
              .delete()
              .eq('period_id', resolvedPeriodId)
              .eq('staff_id', d.staffId)
              .eq('duty_date', d.dutyDate),
          ),
        );
        const firstErr = results.find((r) => r.error)?.error;
        if (firstErr) throw firstErr;
      }
      return resolvedPeriodId;
    },
    onSuccess: (resolvedPeriodId) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rosters.draftAssignments(resolvedPeriodId),
      });
      if (periodId <= 0 && periodMeta) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.rosters.period(periodMeta.year, periodMeta.month),
        });
        void queryClient.invalidateQueries({
          queryKey: ['roster_periods', 'all_periods'],
        });
      }
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
  startTime?: string | null;
  endTime?: string | null;
  durationHours?: number | null;
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
  startTime?: string | null;
  endTime?: string | null;
  durationHours?: number | null;
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
          start_time: payload.startTime ?? null,
          end_time: payload.endTime ?? null,
          duration_hours: payload.durationHours ?? null,
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
        start_time: payload.startTime ?? null,
        end_time: payload.endTime ?? null,
        duration_hours: payload.durationHours ?? null,
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

export interface UpdateRuleVersionPayload {
  id: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  config: Database['public']['Tables']['rule_versions']['Update']['config'];
  changeSummary: string;
}

export function useUpdateRuleVersionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateRuleVersionPayload) => {
      const { error } = await supabase
        .from('rule_versions')
        .update({
          effective_from: payload.effectiveFrom,
          effective_to: payload.effectiveTo,
          config: payload.config,
          change_summary: payload.changeSummary,
        })
        .eq('id', payload.id);

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rules.all,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rosters.all,
      });
    },
  });
}

export interface StaffingThresholdInput {
  id?: number;
  day_type: 'weekday' | 'weekend' | 'holiday';
  shift_bucket: 'am' | 'pm' | 'night' | 'total';
  min_staff: number;
  target_staff: number;
}

export function useUpdateStaffingThresholdsMutation(ruleVersionId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (thresholds: StaffingThresholdInput[]) => {
      for (const t of thresholds) {
        if (t.id) {
          const { error } = await supabase
            .from('staffing_thresholds')
            .update({
              min_staff: t.min_staff,
              target_staff: t.target_staff,
            })
            .eq('id', t.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('staffing_thresholds').upsert({
            rule_version_id: ruleVersionId,
            day_type: t.day_type,
            shift_bucket: t.shift_bucket,
            min_staff: t.min_staff,
            target_staff: t.target_staff,
          });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rules.all,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rosters.all,
      });
    },
  });
}

export interface EpAssignmentRow {
  id: number;
  period_id: number;
  duty_date: string;
  slot_type: 'EP_OFFICE_HOUR' | 'EP_ONCALL' | 'EP_PASSIVE';
  physician_names: string;
  updated_at: string;
  updated_by: string | null;
}

export function useRosterEpAssignmentsQuery(periodId?: number) {
  return useQuery<EpAssignmentRow[]>({
    queryKey: periodId
      ? queryKeys.rosters.epAssignments(periodId)
      : ['rosters', 'ep-assignments', 0],
    enabled: Boolean(periodId),
    queryFn: async () => {
      if (!periodId) return [];
      const { data, error } = await supabase
        .from('roster_ep_assignments')
        .select('*')
        .eq('period_id', periodId)
        .order('duty_date', { ascending: true });

      if (error) throw error;
      return (data ?? []) as EpAssignmentRow[];
    },
    staleTime: 1000 * 30,
  });
}

export function useUpsertEpAssignmentMutation(periodId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      dutyDate: string;
      slotType: 'EP_OFFICE_HOUR' | 'EP_ONCALL' | 'EP_PASSIVE';
      physicianNames: string;
    }) => {
      const { data, error } = await supabase
        .from('roster_ep_assignments')
        .upsert(
          {
            period_id: periodId,
            duty_date: payload.dutyDate,
            slot_type: payload.slotType,
            physician_names: payload.physicianNames.trim(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'period_id,duty_date,slot_type',
          },
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rosters.epAssignments(periodId),
      });
    },
  });
}

export function usePeriodShiftRequestsQuery(periodStart?: string, periodEnd?: string) {
  return useQuery({
    queryKey: ['rosters', 'period-requests', periodStart ?? '', periodEnd ?? ''] as const,
    queryFn: async (): Promise<
      Array<{ staff_id?: number | string; date: string; request: string }>
    > => {
      if (!periodStart || !periodEnd) return [];
      try {
        const { data, error } = await supabase
          .from('roster_requests')
          .select('staff_id, start_date, requested_shift_code')
          .gte('start_date', periodStart)
          .lte('start_date', periodEnd)
          .in('status', ['active', 'submitted', 'approved']);

        if (error) return [];
        return (data ?? []).map((row) => ({
          staff_id: row.staff_id,
          date: row.start_date,
          request: (row.requested_shift_code || '').toUpperCase(),
        }));
      } catch {
        return [];
      }
    },
    enabled: Boolean(periodStart && periodEnd),
    staleTime: 1000 * 30,
  });
}

export function useBatchUpsertEpAssignmentsMutation(periodId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payloads: Array<{
        dutyDate: string;
        slotType: 'EP_OFFICE_HOUR' | 'EP_ONCALL' | 'EP_PASSIVE';
        physicianNames: string;
      }>,
    ) => {
      if (!payloads.length) return [];
      const records = payloads.map((p) => ({
        period_id: periodId,
        duty_date: p.dutyDate,
        slot_type: p.slotType,
        physician_names: p.physicianNames.trim(),
        updated_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase
        .from('roster_ep_assignments')
        .upsert(records, {
          onConflict: 'period_id,duty_date,slot_type',
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rosters.epAssignments(periodId),
      });
    },
  });
}

export type StaffTelegramStatusRow = {
  staff_id: number;
  telegram_linked: boolean;
  telegram_username: string | null;
  telegram_alerts_enabled: boolean;
};

export type RosterTelegramDeliveryRow =
  Database['public']['Tables']['roster_telegram_deliveries']['Row'];

export function useStaffTelegramStatusQuery(enabled = true) {
  return useQuery({
    queryKey: ['rosters', 'staff-telegram-status'] as const,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_staff_telegram_status');
      if (error) throw error;
      return (data ?? []) as StaffTelegramStatusRow[];
    },
    enabled,
    staleTime: 1000 * 30,
  });
}

export function useRosterTelegramDeliveriesQuery(periodId?: number | null, enabled = true) {
  return useQuery({
    queryKey: ['rosters', 'telegram-deliveries', periodId ?? 0] as const,
    queryFn: async () => {
      if (!periodId) return [];
      const { data, error } = await supabase
        .from('roster_telegram_deliveries')
        .select('*')
        .eq('period_id', periodId)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as RosterTelegramDeliveryRow[];
    },
    enabled: Boolean(periodId) && enabled,
    staleTime: 1000 * 15,
  });
}

export type SendStaffTelegramPayload = {
  notificationType: 'published_broadcast' | 'amendment_update';
  recipients: Array<{
    staffId: number;
    messageText: string;
    amendmentEventIds?: number[];
  }>;
};

export type SendStaffTelegramResult = {
  staffId: number;
  status: 'sent' | 'failed' | 'skipped';
  telegramMessageId?: string;
  error?: string;
};

export function useSendStaffTelegramMutation(periodId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SendStaffTelegramPayload) => {
      const { data, error } = await supabase.functions.invoke<{
        results: SendStaffTelegramResult[];
      }>('send-staff-telegram', {
        body: {
          periodId,
          notificationType: payload.notificationType,
          recipients: payload.recipients,
        },
      });

      if (error) {
        let detailedMsg = error.message || 'Telegram Edge Function failed';
        try {
          const ctx = (error as { context?: Response }).context;
          if (ctx && typeof ctx.json === 'function') {
            const errBody = (await ctx.json()) as { error?: string };
            if (errBody?.error) detailedMsg = errBody.error;
          }
        } catch {
          // Ignore JSON parse failures
        }
        throw new Error(detailedMsg);
      }

      return data?.results ?? [];
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['rosters', 'telegram-deliveries', periodId],
      });
    },
  });
}
