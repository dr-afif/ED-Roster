import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/platform/supabase';
import { useAuth } from '@/platform/auth';

export type RequestTypeRecord = {
  id: number;
  code: string;
  label: string;
  description: string | null;
  category: string;
  requires_dates: boolean;
  requires_shift_code: boolean;
  max_days_per_request: number;
  min_lead_days: number;
  sort_order: number;
};

export type StaffRequestRecord = {
  id: number;
  public_id: string;
  staff_id: number;
  request_type_id: number;
  period_start_date: string | null;
  start_date: string;
  end_date: string;
  requested_shift_code: string | null;
  reason_category: string;
  notes: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'withdrawn' | 'superseded';
  decision_reason: string | null;
  decided_at: string | null;
  submitted_at: string;
  request_type: {
    code: string;
    label: string;
    category: string;
  };
  staff?: {
    id: number;
    roster_name: string;
    display_name: string;
    staff_code: string;
    staff_group: string;
  } | null;
};

export function useRequestTypesQuery() {
  return useQuery({
    queryKey: ['request_types', 'active'],
    queryFn: async (): Promise<RequestTypeRecord[]> => {
      const { data, error } = await supabase
        .from('request_types')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }
      return data ?? [];
    },
  });
}

export function useMyRequestsQuery() {
  const { user } = useAuth();
  const staffId = user?.staffId;

  return useQuery({
    queryKey: ['my_requests', staffId],
    enabled: Boolean(staffId),
    queryFn: async (): Promise<StaffRequestRecord[]> => {
      if (!staffId) return [];

      const { data, error } = await supabase
        .from('roster_requests')
        .select(
          `
          *,
          request_type:request_types (
            code,
            label,
            category
          )
        `,
        )
        .eq('staff_id', staffId)
        .order('submitted_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (data as unknown as StaffRequestRecord[]) ?? [];
    },
  });
}

export type CreateRequestPayload = {
  request_type_id: number;
  start_date: string;
  end_date: string;
  reason_category: string;
  notes?: string;
  requested_shift_code?: string;
  period_start_date?: string;
};

export function useCreateRequestMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const staffId = user?.staffId;

  return useMutation({
    mutationFn: async (payload: CreateRequestPayload) => {
      if (!staffId) {
        throw new Error('No staff identity found in active session.');
      }

      const { data, error } = await supabase
        .from('roster_requests')
        .insert({
          staff_id: staffId,
          request_type_id: payload.request_type_id,
          start_date: payload.start_date,
          end_date: payload.end_date,
          reason_category: payload.reason_category,
          notes: payload.notes?.trim() || null,
          requested_shift_code: payload.requested_shift_code?.trim() || null,
          period_start_date: payload.period_start_date || '2027-01-01',
          status: 'submitted',
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_requests'] });
      queryClient.invalidateQueries({ queryKey: ['all_requests_admin'] });
    },
  });
}

export function useWithdrawRequestMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const staffId = user?.staffId;

  return useMutation({
    mutationFn: async (requestId: number) => {
      if (!staffId) {
        throw new Error('No staff identity found in active session.');
      }

      const { data, error } = await supabase
        .from('roster_requests')
        .update({
          status: 'withdrawn',
          decision_reason: 'Self-withdrawn by applicant',
        })
        .eq('id', requestId)
        .eq('staff_id', staffId)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_requests'] });
      queryClient.invalidateQueries({ queryKey: ['all_requests_admin'] });
    },
  });
}

export function useAllRequestsAdminQuery() {
  return useQuery({
    queryKey: ['all_requests_admin'],
    queryFn: async (): Promise<StaffRequestRecord[]> => {
      const { data, error } = await supabase
        .from('roster_requests')
        .select(
          `
          *,
          request_type:request_types (
            code,
            label,
            category
          ),
          staff:staff_directory (
            id,
            roster_name,
            display_name,
            staff_code,
            staff_group
          )
        `,
        )
        .order('submitted_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (data as unknown as StaffRequestRecord[]) ?? [];
    },
  });
}

export type DecideRequestPayload = {
  request_id: number;
  decision: 'approved' | 'rejected';
  reason?: string;
};

export function useDecideRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ request_id, decision, reason }: DecideRequestPayload) => {
      const { data, error } = await supabase.rpc('decide_roster_request', {
        p_request_id: request_id,
        p_decision: decision,
        p_decision_reason: reason || undefined,
      });

      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_requests_admin'] });
      queryClient.invalidateQueries({ queryKey: ['my_requests'] });
    },
  });
}
