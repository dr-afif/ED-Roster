import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/platform/query';
import { supabase } from '@/platform/supabase';
import type { Database } from '@/platform/supabase';
import { computeSha256Hex } from '@/shared/crypto/sha256';
import { generateRosterPdf } from '../domain/pdfGenerator';
import type { Assignment, StaffRosterIdentity } from '../domain/types';
import type { ShiftDefinitionRow } from './rosterQueries';

export type RosterSnapshotRow = Database['public']['Tables']['roster_snapshots']['Row'];
export type SnapshotDeliveryRow = Database['public']['Tables']['roster_snapshot_deliveries']['Row'];

export function useRosterSnapshotsQuery(periodId?: number | null) {
  return useQuery({
    queryKey: periodId
      ? queryKeys.rosters.snapshotsByPeriod(periodId)
      : (['rosters', 'snapshots-all'] as const),
    queryFn: async () => {
      if (!periodId) return [];
      const { data, error } = await supabase
        .from('roster_snapshots')
        .select('*')
        .eq('period_id', periodId)
        .order('snapshot_version', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: Boolean(periodId),
    staleTime: 1000 * 30,
  });
}

export function useRosterSnapshotDeliveriesQuery(snapshotId?: string | null) {
  return useQuery({
    queryKey: snapshotId
      ? queryKeys.rosters.snapshotDeliveries(snapshotId)
      : (['rosters', 'snapshot-deliveries-none'] as const),
    queryFn: async () => {
      if (!snapshotId) return [];
      const { data, error } = await supabase
        .from('roster_snapshot_deliveries')
        .select('*')
        .eq('snapshot_id', snapshotId);

      if (error) throw error;
      return data;
    },
    enabled: Boolean(snapshotId),
    staleTime: 1000 * 15,
  });
}

export interface ArchiveSnapshotPayload {
  period: {
    year: string;
    month: string;
    periodStart: string;
    revision: number;
  };
  staffList: readonly StaffRosterIdentity[];
  assignments: readonly Assignment[];
  shiftDefinitions: readonly ShiftDefinitionRow[];
  reason?: string;
}

export function useArchiveRosterSnapshotMutation(periodId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ArchiveSnapshotPayload) => {
      // 1. Serialize canonical payload
      const canonicalPayload = {
        period: payload.period,
        staffCount: payload.staffList.length,
        assignmentCount: payload.assignments.length,
        assignments: payload.assignments.map((a) => ({
          staffId: a.staffId,
          dutyDate: a.dutyDate,
          shiftCode: a.shiftCode,
        })),
      };
      const canonicalHash = await computeSha256Hex(JSON.stringify(canonicalPayload));

      // 2. Generate deterministic PDF
      const pdfResult = await generateRosterPdf({
        period: payload.period,
        snapshotVersion: 1, // Will be computed by RPC
        snapshotType: payload.period.revision === 0 ? 'initial' : 'amendment',
        reason: payload.reason,
        staffList: payload.staffList,
        assignments: payload.assignments,
        shiftDefinitions: payload.shiftDefinitions,
        generatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        canonicalHash,
      });

      // 3. Invoke Edge Function to upload PDF to Google Drive + record snapshot atomically
      let binary = '';
      for (let i = 0; i < pdfResult.pdfBytes.length; i += 1) {
        binary += String.fromCharCode(pdfResult.pdfBytes[i] ?? 0);
      }
      const pdfBase64 = btoa(binary);

      const { data: fnData, error: fnErr } = await supabase.functions.invoke<{
        snapshot: RosterSnapshotRow;
        driveFileId: string;
        driveParentId: string;
      }>('archive-roster-snapshot', {
        body: {
          periodId,
          fileName: pdfResult.fileName,
          pdfBase64,
          year: payload.period.year,
          month: payload.period.month,
          periodStart: payload.period.periodStart,
          revision: payload.period.revision,
          canonicalPayload: {
            ...canonicalPayload,
            size_bytes: pdfResult.pdfBytes.length,
          },
          canonicalHash,
          pdfSha256: pdfResult.pdfSha256,
          reason: payload.reason,
        },
      });

      if (fnErr) {
        let detailedMsg = fnErr.message || 'Archive Edge Function failed';
        try {
          const ctx = (fnErr as { context?: Response }).context;
          if (ctx && typeof ctx.json === 'function') {
            const errBody = (await ctx.json()) as { error?: string };
            if (errBody?.error) detailedMsg = errBody.error;
          }
        } catch {
          // Ignore JSON parse failures on error context
        }
        throw new Error(detailedMsg);
      }

      if (!fnData?.snapshot) {
        throw new Error('Archive Edge Function returned no snapshot record.');
      }

      return {
        snapshot: fnData.snapshot,
        pdfResult,
      };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rosters.snapshotsByPeriod(periodId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documents.all,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.audit.all,
      });
    },
  });
}

export interface SendToTelegramPayload {
  snapshotId: string;
  chatId?: string;
  caption?: string;
}

export function useSendToTelegramMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SendToTelegramPayload) => {
      const idempotencyKey = crypto.randomUUID();
      const { data: fnData, error: fnErr } = await supabase.functions.invoke<{
        delivery: SnapshotDeliveryRow;
      }>('send-snapshot-telegram', {
        body: {
          snapshotId: payload.snapshotId,
          idempotencyKey,
          caption: payload.caption,
        },
      });

      if (fnErr) {
        let detailedMsg = fnErr.message || 'Telegram Edge Function failed';
        try {
          const ctx = (fnErr as { context?: Response }).context;
          if (ctx && typeof ctx.json === 'function') {
            const errBody = (await ctx.json()) as { error?: string };
            if (errBody?.error) detailedMsg = errBody.error;
          }
        } catch {
          // Ignore JSON parse failures on error context
        }
        throw new Error(detailedMsg);
      }

      if (!fnData?.delivery) {
        throw new Error('Telegram Edge Function returned no delivery record.');
      }

      return fnData.delivery;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rosters.snapshotDeliveries(variables.snapshotId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.audit.all,
      });
    },
  });
}
