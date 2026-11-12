import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/platform/supabase';
import { mergeHolidays } from './constants';
import {
  buildStaffSummaries,
  buildTrackerMatrix,
  buildTrackerWarnings,
  getGhkaUsages,
  getPublicHolidayCredits,
  matchGhkaToCredits,
  type RosterAssignmentEntry,
} from './phTrackerEngine';
import type { HolidayItem, OpeningBalanceEntry } from './types';

export function usePublicHolidayTracker(yearFilter?: string) {
  const queryClient = useQueryClient();
  const currentYear = yearFilter || String(new Date().getFullYear());

  // 1. Fetch Public Holidays
  const holidaysQuery = useQuery({
    queryKey: ['public-holidays', 'calendar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('public_holidays')
        .select('holiday_date, name, jurisdiction, is_state_specific')
        .order('holiday_date');

      if (error) {
        console.warn('Could not fetch public_holidays from DB, falling back to built-ins:', error);
        return [];
      }

      return (data || []).map((h): HolidayItem => ({
        holidayDate: h.holiday_date,
        name: h.name,
        jurisdiction: h.jurisdiction,
        isStateSpecific: h.is_state_specific,
      }));
    },
    staleTime: 1000 * 60 * 10,
  });

  // 2. Fetch Staff Directory & Profiles
  const staffQuery = useQuery({
    queryKey: ['staff', 'ph-tracker-directory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_directory')
        .select(
          `
          id,
          staff_code,
          roster_name,
          display_name,
          active,
          staff_profiles (
            phone,
            registration_number,
            email,
            full_name
          )
        `,
        )
        .order('display_name');

      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // 3. Fetch Planned Assignments across all published rosters
  const assignmentsQuery = useQuery({
    queryKey: ['rosters', 'ph-tracker-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roster_planned_assignments')
        .select('staff_id, duty_date, shift_code, period_id');

      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 2,
  });

  // 4. Fetch Opening Balances
  const openingBalancesQuery = useQuery({
    queryKey: ['public-holidays', 'opening-balances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ph_opening_balances')
        .select('staff_id, year, opening_balance, note');

      if (error) {
        console.warn('Could not fetch ph_opening_balances, defaulting to empty:', error);
        return [];
      }
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // 5. Fetch Memo Submissions
  const memoSubmissionsQuery = useQuery({
    queryKey: ['public-holidays', 'memo-submissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ph_memo_submissions')
        .select(
          'id, staff_id, holiday_date, replacement_date, memo_month, is_submitted, submitted_at',
        );

      if (error) {
        console.warn('Could not fetch ph_memo_submissions:', error);
        return [];
      }
      return data || [];
    },
    staleTime: 1000 * 60 * 2,
  });

  // Mutations
  const upsertOpeningBalanceMutation = useMutation({
    mutationFn: async ({
      staffId,
      year,
      balance,
      note,
    }: {
      staffId: number;
      year: number;
      balance: number;
      note?: string | null;
    }) => {
      const { data, error } = await supabase.rpc('admin_upsert_ph_opening_balance', {
        p_staff_id: staffId,
        p_year: year,
        p_balance: balance,
        p_note: note || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['public-holidays', 'opening-balances'] });
    },
  });

  const toggleMemoStatusMutation = useMutation({
    mutationFn: async ({
      staffId,
      replacementDate,
      holidayDate,
      memoMonth,
      isSubmitted,
    }: {
      staffId: number;
      replacementDate: string;
      holidayDate?: string | null;
      memoMonth?: string;
      isSubmitted: boolean;
    }) => {
      const { data, error } = await supabase.rpc('toggle_ph_memo_status', {
        p_staff_id: staffId,
        p_replacement_date: replacementDate,
        p_holiday_date: holidayDate || null,
        p_memo_month: memoMonth || '',
        p_is_submitted: isSubmitted,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['public-holidays', 'memo-submissions'] });
    },
  });

  const upsertHolidayMutation = useMutation({
    mutationFn: async ({
      holidayDate,
      name,
      jurisdiction = 'federal_and_selangor',
      isStateSpecific = false,
    }: {
      holidayDate: string;
      name: string;
      jurisdiction?: string;
      isStateSpecific?: boolean;
    }) => {
      const { data, error } = await supabase.rpc('admin_upsert_public_holiday', {
        p_holiday_date: holidayDate,
        p_name: name,
        p_jurisdiction: jurisdiction,
        p_is_state_specific: isStateSpecific,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['public-holidays', 'calendar'] });
    },
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: async (holidayDate: string) => {
      const { error } = await supabase
        .from('public_holidays')
        .delete()
        .eq('holiday_date', holidayDate);

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['public-holidays', 'calendar'] });
    },
  });

  // Data processing
  const holidaysMap = useMemo(() => {
    return mergeHolidays(holidaysQuery.data || []);
  }, [holidaysQuery.data]);

  const staffList = useMemo(() => {
    return (staffQuery.data || []).map((s) => {
      const profile = Array.isArray(s.staff_profiles) ? s.staff_profiles[0] : s.staff_profiles;
      return {
        id: s.id,
        name: s.display_name || s.roster_name,
        rosterName: s.roster_name,
        staffCode: s.staff_code,
        active: s.active,
        phone: profile?.phone || '',
        registrationNumber: profile?.registration_number || '',
        email: profile?.email || '',
        fullName: profile?.full_name || s.display_name,
      };
    });
  }, [staffQuery.data]);

  const activeStaffList = useMemo(() => {
    return staffList.filter((s) => s.active);
  }, [staffList]);

  const activeStaffIds = useMemo(() => {
    return new Set(activeStaffList.map((s) => s.id));
  }, [activeStaffList]);

  const assignments = useMemo((): RosterAssignmentEntry[] => {
    const rawAssignments = assignmentsQuery.data || [];
    const staffMap = new Map(staffList.map((s) => [s.id, s]));

    return rawAssignments.map((a) => {
      const staff = staffMap.get(a.staff_id);
      return {
        staffId: a.staff_id,
        staffName: staff?.name || `Staff #${a.staff_id}`,
        staffCode: staff?.staffCode,
        assignmentDate: a.duty_date,
        shiftCode: a.shift_code,
      };
    });
  }, [assignmentsQuery.data, staffList]);

  const openingBalances = useMemo((): OpeningBalanceEntry[] => {
    return (openingBalancesQuery.data || []).map((ob) => ({
      staffId: ob.staff_id,
      year: ob.year,
      openingBalance: ob.opening_balance,
      note: ob.note,
    }));
  }, [openingBalancesQuery.data]);

  const memoSubmissionsMap = useMemo(() => {
    const map = new Map<string, boolean>();
    (memoSubmissionsQuery.data || []).forEach((m) => {
      map.set(`${m.staff_id}_${m.replacement_date}`, m.is_submitted);
    });
    return map;
  }, [memoSubmissionsQuery.data]);

  // Core Calculations
  const { credits, usages, matched, unmatched, summaries, warnings, matrixRows, totals } =
    useMemo(() => {
      const phCredits = getPublicHolidayCredits(assignments, holidaysMap, activeStaffIds);
      const ghkaUsages = getGhkaUsages(assignments, activeStaffIds);
      const { matchedRecords, unmatchedUsages } = matchGhkaToCredits(
        phCredits,
        ghkaUsages,
        openingBalances,
        activeStaffList,
      );
      const docSummaries = buildStaffSummaries(
        matchedRecords,
        unmatchedUsages,
        activeStaffList,
        openingBalances,
      );
      const docWarnings = buildTrackerWarnings(docSummaries);
      const mRows = buildTrackerMatrix(matchedRecords, assignments, holidaysMap, currentYear);

      let totalOpeningBalance = 0;
      let totalWorked = 0;
      let totalUsed = 0;
      let totalOutstanding = 0;
      let totalExcess = 0;

      docSummaries.forEach((s) => {
        totalOpeningBalance += s.openingBalance;
        totalWorked += s.phWorked;
        totalUsed += s.ghkaUsed;
        totalOutstanding += s.outstanding;
        totalExcess += s.excessGhkaUsed;
      });

      return {
        credits: phCredits,
        usages: ghkaUsages,
        matched: matchedRecords,
        unmatched: unmatchedUsages,
        summaries: docSummaries,
        warnings: docWarnings,
        matrixRows: mRows,
        totals: {
          totalOpeningBalance,
          totalWorked,
          totalUsed,
          totalOutstanding,
          totalExcess,
        },
      };
    }, [assignments, holidaysMap, activeStaffIds, openingBalances, activeStaffList, currentYear]);

  const isLoading =
    holidaysQuery.isLoading ||
    staffQuery.isLoading ||
    assignmentsQuery.isLoading ||
    openingBalancesQuery.isLoading;

  return {
    isLoading,
    holidaysMap,
    staffList,
    activeStaffList,
    credits,
    usages,
    matched,
    unmatched,
    summaries,
    warnings,
    matrixRows,
    totals,
    memoSubmissionsMap,
    holidaysList: holidaysQuery.data || [],
    upsertOpeningBalanceMutation,
    toggleMemoStatusMutation,
    upsertHolidayMutation,
    deleteHolidayMutation,
  };
}
