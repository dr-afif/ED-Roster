import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/platform/supabase';
import { queryKeys } from '@/platform/query';
import type { Json } from '@/platform/supabase/database.types';
import type { MigrationBatch, MigrationBatchDetails } from '../domain/migrationEngine';

export function useMigrationBatchesQuery() {
  return useQuery({
    queryKey: queryKeys.migration.batches(),
    queryFn: async (): Promise<MigrationBatch[]> => {
      const { data, error } = await supabase.rpc('get_migration_batches');
      if (error) throw error;
      return (data as unknown as MigrationBatch[]) ?? [];
    },
    staleTime: 10_000,
  });
}

export function useMigrationBatchDetailsQuery(batchId: string | null) {
  return useQuery({
    queryKey: queryKeys.migration.batchDetails(batchId ?? ''),
    queryFn: async (): Promise<MigrationBatchDetails | null> => {
      if (!batchId) return null;
      const { data, error } = await supabase.rpc('get_migration_batch_details', {
        p_batch_id: batchId,
      });
      if (error) throw error;
      return data as unknown as MigrationBatchDetails;
    },
    enabled: Boolean(batchId),
    staleTime: 5_000,
  });
}

export function useCreateMigrationBatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      batchId: string;
      sourceSpreadsheetId: string;
      sourceLabel?: string;
      tabManifest?: unknown;
      fileHashes?: unknown;
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc('create_migration_batch', {
        p_batch_id: payload.batchId,
        p_source_spreadsheet_id: payload.sourceSpreadsheetId,
        p_source_label: payload.sourceLabel ?? 'Google Sheets Master Workbook',
        p_tab_manifest: (payload.tabManifest as unknown as Json) ?? [],
        p_file_hashes: (payload.fileHashes as unknown as Json) ?? {},
        p_notes: payload.notes ?? undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.migration.batches() });
    },
  });
}

export function useStageRawRowsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      batchId: string;
      tabName: string;
      rows: Array<{ row_number: number; payload: Record<string, unknown>; row_hash?: string }>;
    }) => {
      const { data, error } = await supabase.rpc('stage_raw_rows', {
        p_batch_id: payload.batchId,
        p_tab_name: payload.tabName,
        p_rows: payload.rows as unknown as Json,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.migration.batchDetails(variables.batchId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.migration.batches() });
    },
  });
}

export function useSaveIdMappingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      batchId: string;
      sourceEntity: string;
      sourceTab: string;
      sourceKey: string;
      canonicalTable: string;
      canonicalId: string;
      canonicalLabel: string;
      confidence?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc('save_id_mapping', {
        p_batch_id: payload.batchId,
        p_source_entity: payload.sourceEntity,
        p_source_tab: payload.sourceTab,
        p_source_key: payload.sourceKey,
        p_canonical_table: payload.canonicalTable,
        p_canonical_id: payload.canonicalId,
        p_canonical_label: payload.canonicalLabel,
        p_confidence: payload.confidence ?? 'manual_approved',
        p_notes: payload.notes ?? undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.migration.batchDetails(variables.batchId),
      });
    },
  });
}

export function useUpdateReconciliationDispositionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      resultId: number;
      batchId: string;
      disposition: 'pending' | 'approved' | 'flagged' | 'rejected';
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc('update_reconciliation_disposition', {
        p_result_id: payload.resultId,
        p_disposition: payload.disposition,
        p_notes: payload.notes ?? undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.migration.batchDetails(variables.batchId),
      });
    },
  });
}

export function useExecuteTransformMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { batchId: string; dryRun?: boolean }) => {
      const { data, error } = await supabase.rpc('execute_migration_transform', {
        p_batch_id: payload.batchId,
        p_dry_run: payload.dryRun ?? false,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.migration.batchDetails(variables.batchId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.migration.batches() });
      queryClient.invalidateQueries({ queryKey: queryKeys.rosters.all });
    },
  });
}

export function useRevertMigrationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { batchId: string }) => {
      const { data, error } = await supabase.rpc('revert_migration_batch', {
        p_batch_id: payload.batchId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.migration.batchDetails(variables.batchId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.migration.batches() });
      queryClient.invalidateQueries({ queryKey: queryKeys.rosters.all });
    },
  });
}
