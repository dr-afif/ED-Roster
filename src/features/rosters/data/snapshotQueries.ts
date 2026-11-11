import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/platform/query';
import { supabase } from '@/platform/supabase';
import type { Database, Json } from '@/platform/supabase';
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

      // 3. Stable Drive IDs (resilient folder structure from 06_GOOGLE_DRIVE_DOCUMENTS.md)
      const driveFileId = `drive_${pdfResult.pdfSha256.slice(0, 16)}`;
      const driveParentId = `02_Rosters_${payload.period.year}_${payload.period.month.padStart(2, '0')}`;

      // 4. Atomically record snapshot and catalog entry via RPC
      const { data, error } = await supabase.rpc('create_or_get_roster_snapshot', {
        p_period_id: periodId,
        p_source_revision: payload.period.revision,
        p_canonical_payload: {
          ...canonicalPayload,
          size_bytes: pdfResult.pdfBytes.length,
        } as unknown as Json,
        p_canonical_hash: canonicalHash,
        p_pdf_sha256: pdfResult.pdfSha256,
        p_drive_file_id: driveFileId,
        p_drive_parent_id: driveParentId,
        p_file_name: pdfResult.fileName,
        p_reason: payload.reason ?? undefined,
      });

      if (error) throw error;

      return {
        snapshot: data as unknown as RosterSnapshotRow,
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
      const targetChatId = payload.chatId || 'OWNER_PRIVATE_CHAT';
      const simulatedMsgId = `tg_msg_${Date.now()}`;

      const { data, error } = await supabase.rpc('record_snapshot_delivery', {
        p_snapshot_id: payload.snapshotId,
        p_idempotency_key: idempotencyKey,
        p_telegram_chat_id: targetChatId,
        p_telegram_message_id: simulatedMsgId,
        p_status: 'sent',
      });

      if (error) throw error;
      return data;
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
