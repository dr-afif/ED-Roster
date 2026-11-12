export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      allowed_users: {
        Row: {
          activated_at: string | null;
          auth_user_id: string | null;
          created_at: string;
          created_by: string | null;
          email: string;
          id: number;
          invited_at: string;
          invited_by: string | null;
          revocation_reason: string | null;
          revoked_at: string | null;
          revoked_by: string | null;
          role: string;
          staff_id: number | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          activated_at?: string | null;
          auth_user_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          email: string;
          id?: never;
          invited_at?: string;
          invited_by?: string | null;
          revocation_reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          role: string;
          staff_id?: number | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          activated_at?: string | null;
          auth_user_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string;
          id?: never;
          invited_at?: string;
          invited_by?: string | null;
          revocation_reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          role?: string;
          staff_id?: number | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'allowed_users_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff_directory';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_events: {
        Row: {
          action: string;
          actor_auth_user_id: string | null;
          actor_staff_id: number | null;
          after_summary: Json | null;
          before_summary: Json | null;
          client_metadata: Json | null;
          created_at: string;
          entity_id: string;
          entity_type: string;
          id: number;
          operation_id: string | null;
          reason: string | null;
        };
        Insert: {
          action: string;
          actor_auth_user_id?: string | null;
          actor_staff_id?: number | null;
          after_summary?: Json | null;
          before_summary?: Json | null;
          client_metadata?: Json | null;
          created_at?: string;
          entity_id: string;
          entity_type: string;
          id?: never;
          operation_id?: string | null;
          reason?: string | null;
        };
        Update: {
          action?: string;
          actor_auth_user_id?: string | null;
          actor_staff_id?: number | null;
          after_summary?: Json | null;
          before_summary?: Json | null;
          client_metadata?: Json | null;
          created_at?: string;
          entity_id?: string;
          entity_type?: string;
          id?: never;
          operation_id?: string | null;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_events_actor_staff_id_fkey';
            columns: ['actor_staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff_directory';
            referencedColumns: ['id'];
          },
        ];
      };
      document_records: {
        Row: {
          created_at: string;
          document_category: string;
          drive_file_id: string;
          drive_parent_id: string;
          drive_web_view_link: string | null;
          file_name: string;
          id: number;
          mime_type: string;
          professional_record_id: number | null;
          roster_snapshot_id: string | null;
          sha256: string;
          size_bytes: number;
          source_system: string;
          staff_id: number | null;
          status: string;
          updated_at: string;
          uploaded_at: string;
          uploaded_by: string | null;
          visibility: string;
        };
        Insert: {
          created_at?: string;
          document_category: string;
          drive_file_id: string;
          drive_parent_id: string;
          drive_web_view_link?: string | null;
          file_name: string;
          id?: never;
          mime_type?: string;
          professional_record_id?: number | null;
          roster_snapshot_id?: string | null;
          sha256: string;
          size_bytes?: number;
          source_system?: string;
          staff_id?: number | null;
          status?: string;
          updated_at?: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
          visibility?: string;
        };
        Update: {
          created_at?: string;
          document_category?: string;
          drive_file_id?: string;
          drive_parent_id?: string;
          drive_web_view_link?: string | null;
          file_name?: string;
          id?: never;
          mime_type?: string;
          professional_record_id?: number | null;
          roster_snapshot_id?: string | null;
          sha256?: string;
          size_bytes?: number;
          source_system?: string;
          staff_id?: number | null;
          status?: string;
          updated_at?: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'document_records_professional_record_id_fkey';
            columns: ['professional_record_id'];
            isOneToOne: false;
            referencedRelation: 'professional_records';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'document_records_roster_snapshot_fkey';
            columns: ['roster_snapshot_id'];
            isOneToOne: false;
            referencedRelation: 'roster_snapshots';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'document_records_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff_directory';
            referencedColumns: ['id'];
          },
        ];
      };
      goff_ledger: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          effective_date: string;
          id: number;
          operation_id: string | null;
          period_id: number | null;
          reason: string;
          staff_id: number;
          transaction_type: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          created_by?: string | null;
          effective_date: string;
          id?: never;
          operation_id?: string | null;
          period_id?: number | null;
          reason: string;
          staff_id: number;
          transaction_type: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          effective_date?: string;
          id?: never;
          operation_id?: string | null;
          period_id?: number | null;
          reason?: string;
          staff_id?: number;
          transaction_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'goff_ledger_period_id_fkey';
            columns: ['period_id'];
            isOneToOne: false;
            referencedRelation: 'roster_periods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'goff_ledger_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff_directory';
            referencedColumns: ['id'];
          },
        ];
      };
      leave_records: {
        Row: {
          approved_at: string;
          approved_by: string | null;
          created_at: string;
          created_by: string | null;
          end_date: string;
          id: number;
          leave_type: string;
          operational_note: string | null;
          request_id: number | null;
          staff_id: number;
          start_date: string;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          approved_at?: string;
          approved_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          end_date: string;
          id?: never;
          leave_type: string;
          operational_note?: string | null;
          request_id?: number | null;
          staff_id: number;
          start_date: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          approved_at?: string;
          approved_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          end_date?: string;
          id?: never;
          leave_type?: string;
          operational_note?: string | null;
          request_id?: number | null;
          staff_id?: number;
          start_date?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'leave_records_request_id_fkey';
            columns: ['request_id'];
            isOneToOne: false;
            referencedRelation: 'roster_requests';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'leave_records_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff_directory';
            referencedColumns: ['id'];
          },
        ];
      };
      operation_log: {
        Row: {
          actor_auth_user_id: string | null;
          actor_staff_id: number | null;
          command_type: string;
          completed_at: string | null;
          created_at: string;
          error_code: string | null;
          error_message: string | null;
          id: number;
          operation_id: string;
          request_hash: string;
          result_ref: Json | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          actor_auth_user_id?: string | null;
          actor_staff_id?: number | null;
          command_type: string;
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          id?: never;
          operation_id: string;
          request_hash: string;
          result_ref?: Json | null;
          status: string;
          updated_at?: string;
        };
        Update: {
          actor_auth_user_id?: string | null;
          actor_staff_id?: number | null;
          command_type?: string;
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          id?: never;
          operation_id?: string;
          request_hash?: string;
          result_ref?: Json | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'operation_log_actor_staff_id_fkey';
            columns: ['actor_staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff_directory';
            referencedColumns: ['id'];
          },
        ];
      };
      professional_records: {
        Row: {
          created_at: string;
          created_by: string | null;
          expiry_date: string | null;
          id: number;
          issue_date: string | null;
          issuer: string;
          record_type_id: number;
          reference_number: string | null;
          source_system: string;
          staff_id: number;
          status: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
          verification_notes: string | null;
          verification_status: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          expiry_date?: string | null;
          id?: never;
          issue_date?: string | null;
          issuer: string;
          record_type_id: number;
          reference_number?: string | null;
          source_system?: string;
          staff_id: number;
          status?: string;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          verification_notes?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          expiry_date?: string | null;
          id?: never;
          issue_date?: string | null;
          issuer?: string;
          record_type_id?: number;
          reference_number?: string | null;
          source_system?: string;
          staff_id?: number;
          status?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          verification_notes?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'professional_records_record_type_id_fkey';
            columns: ['record_type_id'];
            isOneToOne: false;
            referencedRelation: 'record_type_definitions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'professional_records_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff_directory';
            referencedColumns: ['id'];
          },
        ];
      };
      public_holidays: {
        Row: {
          created_at: string;
          created_by: string | null;
          holiday_date: string;
          id: number;
          is_state_specific: boolean;
          jurisdiction: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          holiday_date: string;
          id?: never;
          is_state_specific?: boolean;
          jurisdiction?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          holiday_date?: string;
          id?: never;
          is_state_specific?: boolean;
          jurisdiction?: string;
          name?: string;
        };
        Relationships: [];
      };
      record_type_definitions: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          created_by: string | null;
          default_validity_years: number | null;
          id: number;
          issuer_type: string;
          label: string;
          requires_expiry: boolean;
          requires_reference_number: boolean;
          sort_order: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          created_by?: string | null;
          default_validity_years?: number | null;
          id?: never;
          issuer_type: string;
          label: string;
          requires_expiry?: boolean;
          requires_reference_number?: boolean;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          default_validity_years?: number | null;
          id?: never;
          issuer_type?: string;
          label?: string;
          requires_expiry?: boolean;
          requires_reference_number?: boolean;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      request_status_events: {
        Row: {
          actor_auth_user_id: string | null;
          actor_staff_id: number | null;
          created_at: string;
          id: number;
          new_status: string;
          previous_status: string | null;
          reason: string | null;
          request_id: number;
        };
        Insert: {
          actor_auth_user_id?: string | null;
          actor_staff_id?: number | null;
          created_at?: string;
          id?: never;
          new_status: string;
          previous_status?: string | null;
          reason?: string | null;
          request_id: number;
        };
        Update: {
          actor_auth_user_id?: string | null;
          actor_staff_id?: number | null;
          created_at?: string;
          id?: never;
          new_status?: string;
          previous_status?: string | null;
          reason?: string | null;
          request_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'request_status_events_actor_staff_id_fkey';
            columns: ['actor_staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff_directory';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'request_status_events_request_id_fkey';
            columns: ['request_id'];
            isOneToOne: false;
            referencedRelation: 'roster_requests';
            referencedColumns: ['id'];
          },
        ];
      };
      request_types: {
        Row: {
          active: boolean;
          category: string;
          code: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: number;
          label: string;
          max_days_per_request: number;
          min_lead_days: number;
          requires_dates: boolean;
          requires_shift_code: boolean;
          sort_order: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          active?: boolean;
          category: string;
          code: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: never;
          label: string;
          max_days_per_request?: number;
          min_lead_days?: number;
          requires_dates?: boolean;
          requires_shift_code?: boolean;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          active?: boolean;
          category?: string;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: never;
          label?: string;
          max_days_per_request?: number;
          min_lead_days?: number;
          requires_dates?: boolean;
          requires_shift_code?: boolean;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      roster_amendment_events: {
        Row: {
          category: string;
          created_at: string;
          created_by: string | null;
          id: number;
          operation_id: string | null;
          period_id: number;
          reason: string;
          reversal_reason: string | null;
          reversed_by_event_id: number | null;
          status: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          created_by?: string | null;
          id?: never;
          operation_id?: string | null;
          period_id: number;
          reason: string;
          reversal_reason?: string | null;
          reversed_by_event_id?: number | null;
          status?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          id?: never;
          operation_id?: string | null;
          period_id?: number;
          reason?: string;
          reversal_reason?: string | null;
          reversed_by_event_id?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'roster_amendment_events_period_id_fkey';
            columns: ['period_id'];
            isOneToOne: false;
            referencedRelation: 'roster_periods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'roster_amendment_events_reversed_by_event_id_fkey';
            columns: ['reversed_by_event_id'];
            isOneToOne: false;
            referencedRelation: 'roster_amendment_events';
            referencedColumns: ['id'];
          },
        ];
      };
      roster_amendment_lines: {
        Row: {
          created_at: string;
          duty_date: string;
          event_id: number;
          from_shift_code: string;
          id: number;
          line_action: string;
          notes: string | null;
          period_id: number;
          staff_id: number;
          to_shift_code: string;
        };
        Insert: {
          created_at?: string;
          duty_date: string;
          event_id: number;
          from_shift_code: string;
          id?: never;
          line_action: string;
          notes?: string | null;
          period_id: number;
          staff_id: number;
          to_shift_code: string;
        };
        Update: {
          created_at?: string;
          duty_date?: string;
          event_id?: number;
          from_shift_code?: string;
          id?: never;
          line_action?: string;
          notes?: string | null;
          period_id?: number;
          staff_id?: number;
          to_shift_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'roster_amendment_lines_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'roster_amendment_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'roster_amendment_lines_from_shift_code_fkey';
            columns: ['from_shift_code'];
            isOneToOne: false;
            referencedRelation: 'shift_definitions';
            referencedColumns: ['code'];
          },
          {
            foreignKeyName: 'roster_amendment_lines_period_id_fkey';
            columns: ['period_id'];
            isOneToOne: false;
            referencedRelation: 'roster_periods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'roster_amendment_lines_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff_directory';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'roster_amendment_lines_to_shift_code_fkey';
            columns: ['to_shift_code'];
            isOneToOne: false;
            referencedRelation: 'shift_definitions';
            referencedColumns: ['code'];
          },
        ];
      };
      roster_draft_assignments: {
        Row: {
          cell_note: string | null;
          duty_date: string;
          id: number;
          period_id: number;
          row_revision: number;
          shift_code: string;
          staff_id: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          cell_note?: string | null;
          duty_date: string;
          id?: never;
          period_id: number;
          row_revision?: number;
          shift_code: string;
          staff_id: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          cell_note?: string | null;
          duty_date?: string;
          id?: never;
          period_id?: number;
          row_revision?: number;
          shift_code?: string;
          staff_id?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'roster_draft_assignments_period_id_fkey';
            columns: ['period_id'];
            isOneToOne: false;
            referencedRelation: 'roster_periods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'roster_draft_assignments_shift_code_fkey';
            columns: ['shift_code'];
            isOneToOne: false;
            referencedRelation: 'shift_definitions';
            referencedColumns: ['code'];
          },
          {
            foreignKeyName: 'roster_draft_assignments_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff_directory';
            referencedColumns: ['id'];
          },
        ];
      };
      roster_ep_assignments: {
        Row: {
          created_at: string;
          duty_date: string;
          id: number;
          period_id: number;
          physician_names: string;
          slot_type: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          duty_date: string;
          id?: never;
          period_id: number;
          physician_names?: string;
          slot_type: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          duty_date?: string;
          id?: never;
          period_id?: number;
          physician_names?: string;
          slot_type?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'roster_ep_assignments_period_id_fkey';
            columns: ['period_id'];
            isOneToOne: false;
            referencedRelation: 'roster_periods';
            referencedColumns: ['id'];
          },
        ];
      };
      roster_periods: {
        Row: {
          active_rule_version_id: number | null;
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
          id: number;
          import_batch_id: string | null;
          legacy_read_only: boolean;
          period_end: string;
          period_start: string;
          published_at: string | null;
          published_by: string | null;
          revision: number;
          status: string;
          updated_at: string;
        };
        Insert: {
          active_rule_version_id?: number | null;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          id?: never;
          import_batch_id?: string | null;
          legacy_read_only?: boolean;
          period_end: string;
          period_start: string;
          published_at?: string | null;
          published_by?: string | null;
          revision?: number;
          status?: string;
          updated_at?: string;
        };
        Update: {
          active_rule_version_id?: number | null;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          id?: never;
          import_batch_id?: string | null;
          legacy_read_only?: boolean;
          period_end?: string;
          period_start?: string;
          published_at?: string | null;
          published_by?: string | null;
          revision?: number;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'roster_periods_active_rule_version_id_fkey';
            columns: ['active_rule_version_id'];
            isOneToOne: false;
            referencedRelation: 'rule_versions';
            referencedColumns: ['id'];
          },
        ];
      };
      roster_planned_assignments: {
        Row: {
          cell_note: string | null;
          created_at: string;
          duty_date: string;
          id: number;
          period_id: number;
          publication_id: string;
          shift_code: string;
          staff_id: number;
        };
        Insert: {
          cell_note?: string | null;
          created_at?: string;
          duty_date: string;
          id?: never;
          period_id: number;
          publication_id: string;
          shift_code: string;
          staff_id: number;
        };
        Update: {
          cell_note?: string | null;
          created_at?: string;
          duty_date?: string;
          id?: never;
          period_id?: number;
          publication_id?: string;
          shift_code?: string;
          staff_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'roster_planned_assignments_period_id_fkey';
            columns: ['period_id'];
            isOneToOne: false;
            referencedRelation: 'roster_periods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'roster_planned_assignments_publication_id_fkey';
            columns: ['publication_id'];
            isOneToOne: false;
            referencedRelation: 'roster_publications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'roster_planned_assignments_shift_code_fkey';
            columns: ['shift_code'];
            isOneToOne: false;
            referencedRelation: 'shift_definitions';
            referencedColumns: ['code'];
          },
          {
            foreignKeyName: 'roster_planned_assignments_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff_directory';
            referencedColumns: ['id'];
          },
        ];
      };
      roster_publications: {
        Row: {
          canonical_data_hash: string;
          id: string;
          notes: string | null;
          period_id: number;
          period_revision: number;
          publication_version: number;
          published_at: string;
          published_by: string | null;
          rule_version_id: number | null;
        };
        Insert: {
          canonical_data_hash: string;
          id?: string;
          notes?: string | null;
          period_id: number;
          period_revision?: number;
          publication_version?: number;
          published_at?: string;
          published_by?: string | null;
          rule_version_id?: number | null;
        };
        Update: {
          canonical_data_hash?: string;
          id?: string;
          notes?: string | null;
          period_id?: number;
          period_revision?: number;
          publication_version?: number;
          published_at?: string;
          published_by?: string | null;
          rule_version_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'roster_publications_period_id_fkey';
            columns: ['period_id'];
            isOneToOne: false;
            referencedRelation: 'roster_periods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'roster_publications_rule_version_id_fkey';
            columns: ['rule_version_id'];
            isOneToOne: false;
            referencedRelation: 'rule_versions';
            referencedColumns: ['id'];
          },
        ];
      };
      roster_requests: {
        Row: {
          created_at: string;
          created_by: string | null;
          decided_at: string | null;
          decided_by: string | null;
          decision_reason: string | null;
          end_date: string;
          id: number;
          legacy_source_id: string | null;
          notes: string | null;
          period_start_date: string | null;
          public_id: string;
          reason_category: string;
          request_type_id: number;
          requested_shift_code: string | null;
          source_system: string;
          staff_id: number;
          start_date: string;
          status: string;
          submitted_at: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          end_date: string;
          id?: never;
          legacy_source_id?: string | null;
          notes?: string | null;
          period_start_date?: string | null;
          public_id?: string;
          reason_category?: string;
          request_type_id: number;
          requested_shift_code?: string | null;
          source_system?: string;
          staff_id: number;
          start_date: string;
          status?: string;
          submitted_at?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          end_date?: string;
          id?: never;
          legacy_source_id?: string | null;
          notes?: string | null;
          period_start_date?: string | null;
          public_id?: string;
          reason_category?: string;
          request_type_id?: number;
          requested_shift_code?: string | null;
          source_system?: string;
          staff_id?: number;
          start_date?: string;
          status?: string;
          submitted_at?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'roster_requests_request_type_id_fkey';
            columns: ['request_type_id'];
            isOneToOne: false;
            referencedRelation: 'request_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'roster_requests_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff_directory';
            referencedColumns: ['id'];
          },
        ];
      };
      roster_snapshot_deliveries: {
        Row: {
          attempt_count: number;
          channel: string;
          created_at: string;
          id: number;
          idempotency_key: string;
          last_error: string | null;
          sent_at: string | null;
          sent_by: string | null;
          snapshot_id: string;
          status: string;
          telegram_chat_id: string;
          telegram_message_id: string | null;
        };
        Insert: {
          attempt_count?: number;
          channel?: string;
          created_at?: string;
          id?: never;
          idempotency_key: string;
          last_error?: string | null;
          sent_at?: string | null;
          sent_by?: string | null;
          snapshot_id: string;
          status?: string;
          telegram_chat_id: string;
          telegram_message_id?: string | null;
        };
        Update: {
          attempt_count?: number;
          channel?: string;
          created_at?: string;
          id?: never;
          idempotency_key?: string;
          last_error?: string | null;
          sent_at?: string | null;
          sent_by?: string | null;
          snapshot_id?: string;
          status?: string;
          telegram_chat_id?: string;
          telegram_message_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'roster_snapshot_deliveries_snapshot_id_fkey';
            columns: ['snapshot_id'];
            isOneToOne: false;
            referencedRelation: 'roster_snapshots';
            referencedColumns: ['id'];
          },
        ];
      };
      roster_snapshots: {
        Row: {
          canonical_hash: string;
          canonical_payload: Json;
          created_at: string;
          created_by: string | null;
          drive_file_id: string | null;
          drive_parent_id: string | null;
          error_message: string | null;
          file_name: string;
          id: string;
          pdf_sha256: string | null;
          period_id: number;
          predecessor_snapshot_id: string | null;
          publication_id: string | null;
          reason: string | null;
          snapshot_type: string;
          snapshot_version: number;
          source_revision: number;
          status: string;
        };
        Insert: {
          canonical_hash: string;
          canonical_payload: Json;
          created_at?: string;
          created_by?: string | null;
          drive_file_id?: string | null;
          drive_parent_id?: string | null;
          error_message?: string | null;
          file_name: string;
          id?: string;
          pdf_sha256?: string | null;
          period_id: number;
          predecessor_snapshot_id?: string | null;
          publication_id?: string | null;
          reason?: string | null;
          snapshot_type: string;
          snapshot_version: number;
          source_revision: number;
          status?: string;
        };
        Update: {
          canonical_hash?: string;
          canonical_payload?: Json;
          created_at?: string;
          created_by?: string | null;
          drive_file_id?: string | null;
          drive_parent_id?: string | null;
          error_message?: string | null;
          file_name?: string;
          id?: string;
          pdf_sha256?: string | null;
          period_id?: number;
          predecessor_snapshot_id?: string | null;
          publication_id?: string | null;
          reason?: string | null;
          snapshot_type?: string;
          snapshot_version?: number;
          source_revision?: number;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'roster_snapshots_period_id_fkey';
            columns: ['period_id'];
            isOneToOne: false;
            referencedRelation: 'roster_periods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'roster_snapshots_predecessor_snapshot_id_fkey';
            columns: ['predecessor_snapshot_id'];
            isOneToOne: false;
            referencedRelation: 'roster_snapshots';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'roster_snapshots_publication_id_fkey';
            columns: ['publication_id'];
            isOneToOne: false;
            referencedRelation: 'roster_publications';
            referencedColumns: ['id'];
          },
        ];
      };
      rule_sets: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rule_versions: {
        Row: {
          approved_at: string | null;
          change_summary: string;
          config: Json;
          config_hash: string;
          created_at: string;
          created_by: string | null;
          effective_from: string;
          effective_to: string | null;
          id: number;
          rule_set_id: string;
          status: string;
          version: number;
        };
        Insert: {
          approved_at?: string | null;
          change_summary: string;
          config: Json;
          config_hash: string;
          created_at?: string;
          created_by?: string | null;
          effective_from: string;
          effective_to?: string | null;
          id?: never;
          rule_set_id: string;
          status?: string;
          version: number;
        };
        Update: {
          approved_at?: string | null;
          change_summary?: string;
          config?: Json;
          config_hash?: string;
          created_at?: string;
          created_by?: string | null;
          effective_from?: string;
          effective_to?: string | null;
          id?: never;
          rule_set_id?: string;
          status?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'rule_versions_rule_set_id_fkey';
            columns: ['rule_set_id'];
            isOneToOne: false;
            referencedRelation: 'rule_sets';
            referencedColumns: ['id'];
          },
        ];
      };
      shift_definitions: {
        Row: {
          code: string;
          color_token: string;
          created_at: string;
          is_active: boolean;
          label: string;
          short_label: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          code: string;
          color_token: string;
          created_at?: string;
          is_active?: boolean;
          label: string;
          short_label: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          code?: string;
          color_token?: string;
          created_at?: string;
          is_active?: boolean;
          label?: string;
          short_label?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      shift_semantics: {
        Row: {
          created_at: string;
          displaces_off_earns_goff: boolean;
          modifier_inheritance: string;
          night_policy_b_qualifying: boolean;
          provides_coverage: boolean;
          semantic_class: string;
          shift_code: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          displaces_off_earns_goff?: boolean;
          modifier_inheritance?: string;
          night_policy_b_qualifying?: boolean;
          provides_coverage?: boolean;
          semantic_class: string;
          shift_code: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          displaces_off_earns_goff?: boolean;
          modifier_inheritance?: string;
          night_policy_b_qualifying?: boolean;
          provides_coverage?: boolean;
          semantic_class?: string;
          shift_code?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shift_semantics_shift_code_fkey';
            columns: ['shift_code'];
            isOneToOne: true;
            referencedRelation: 'shift_definitions';
            referencedColumns: ['code'];
          },
        ];
      };
      staff_directory: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          display_name: string;
          employment_status: string;
          end_date: string | null;
          id: number;
          legacy_source_id: string | null;
          roster_name: string;
          source_system: string;
          staff_code: string;
          staff_group: string;
          start_date: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          display_name: string;
          employment_status?: string;
          end_date?: string | null;
          id?: never;
          legacy_source_id?: string | null;
          roster_name: string;
          source_system?: string;
          staff_code: string;
          staff_group: string;
          start_date?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          display_name?: string;
          employment_status?: string;
          end_date?: string | null;
          id?: never;
          legacy_source_id?: string | null;
          roster_name?: string;
          source_system?: string;
          staff_code?: string;
          staff_group?: string;
          start_date?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      staff_profiles: {
        Row: {
          auth_user_id: string | null;
          created_at: string;
          created_by: string | null;
          email: string | null;
          full_name: string;
          phone: string | null;
          registration_number: string | null;
          staff_id: number;
          updated_at: string;
          updated_by: string | null;
          verification_status: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          auth_user_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          full_name: string;
          phone?: string | null;
          registration_number?: string | null;
          staff_id: number;
          updated_at?: string;
          updated_by?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          auth_user_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          full_name?: string;
          phone?: string | null;
          registration_number?: string | null;
          staff_id?: number;
          updated_at?: string;
          updated_by?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_profiles_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: true;
            referencedRelation: 'staff_directory';
            referencedColumns: ['id'];
          },
        ];
      };
      staffing_thresholds: {
        Row: {
          created_at: string;
          day_type: string;
          id: number;
          min_staff: number;
          rule_version_id: number;
          shift_bucket: string;
          target_staff: number;
        };
        Insert: {
          created_at?: string;
          day_type: string;
          id?: never;
          min_staff?: number;
          rule_version_id: number;
          shift_bucket: string;
          target_staff?: number;
        };
        Update: {
          created_at?: string;
          day_type?: string;
          id?: never;
          min_staff?: number;
          rule_version_id?: number;
          shift_bucket?: string;
          target_staff?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'staffing_thresholds_rule_version_id_fkey';
            columns: ['rule_version_id'];
            isOneToOne: false;
            referencedRelation: 'rule_versions';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_create_staff_member: {
        Args: {
          p_display_name: string;
          p_email: string;
          p_phone?: string;
          p_registration_number?: string;
          p_role: string;
          p_roster_name: string;
          p_staff_code: string;
          p_staff_group: string;
        };
        Returns: number;
      };
      admin_update_allowlist_status: {
        Args: {
          p_allowed_user_id: number;
          p_new_status: string;
          p_reason?: string;
        };
        Returns: {
          activated_at: string | null;
          auth_user_id: string | null;
          created_at: string;
          created_by: string | null;
          email: string;
          id: number;
          invited_at: string;
          invited_by: string | null;
          revocation_reason: string | null;
          revoked_at: string | null;
          revoked_by: string | null;
          role: string;
          staff_id: number | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'allowed_users';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_update_staff_member: {
        Args: {
          p_active?: boolean;
          p_display_name: string;
          p_email?: string;
          p_phone?: string;
          p_registration_number?: string;
          p_role?: string;
          p_roster_name: string;
          p_staff_code: string;
          p_staff_group: string;
          p_staff_id: number;
        };
        Returns: boolean;
      };
      bootstrap_my_session: {
        Args: never;
        Returns: {
          access_status: string;
          display_name: string;
          role: string;
          roster_name: string;
          staff_code: string;
          staff_id: number;
        }[];
      };
      close_roster_period: {
        Args: { p_notes?: string; p_period_id: number };
        Returns: undefined;
      };
      create_migration_batch: {
        Args: {
          p_batch_id: string;
          p_file_hashes?: Json;
          p_notes?: string;
          p_source_label?: string;
          p_source_spreadsheet_id: string;
          p_tab_manifest?: Json;
        };
        Returns: Json;
      };
      create_or_get_roster_snapshot: {
        Args: {
          p_canonical_hash: string;
          p_canonical_payload: Json;
          p_drive_file_id: string;
          p_drive_parent_id: string;
          p_file_name: string;
          p_pdf_sha256: string;
          p_period_id: number;
          p_reason?: string;
          p_source_revision: number;
        };
        Returns: Json;
      };
      decide_roster_request: {
        Args: {
          p_decision: string;
          p_decision_reason?: string;
          p_request_id: number;
        };
        Returns: {
          created_at: string;
          created_by: string | null;
          decided_at: string | null;
          decided_by: string | null;
          decision_reason: string | null;
          end_date: string;
          id: number;
          legacy_source_id: string | null;
          notes: string | null;
          period_start_date: string | null;
          public_id: string;
          reason_category: string;
          request_type_id: number;
          requested_shift_code: string | null;
          source_system: string;
          staff_id: number;
          start_date: string;
          status: string;
          submitted_at: string;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'roster_requests';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      execute_migration_transform: {
        Args: { p_batch_id: string; p_dry_run?: boolean };
        Returns: Json;
      };
      get_migration_batch_details: {
        Args: { p_batch_id: string };
        Returns: Json;
      };
      get_migration_batches: { Args: never; Returns: Json };
      publish_roster_period: {
        Args: { p_notes?: string; p_period_id: number };
        Returns: string;
      };
      record_snapshot_delivery: {
        Args: {
          p_error?: string;
          p_idempotency_key: string;
          p_snapshot_id: string;
          p_status?: string;
          p_telegram_chat_id: string;
          p_telegram_message_id?: string;
        };
        Returns: Json;
      };
      reopen_roster_period: {
        Args: { p_period_id: number; p_reason: string };
        Returns: undefined;
      };
      reverse_roster_amendment: {
        Args: { p_event_id: number; p_reason: string };
        Returns: number;
      };
      revert_migration_batch: { Args: { p_batch_id: string }; Returns: Json };
      save_id_mapping: {
        Args: {
          p_batch_id: string;
          p_canonical_id: string;
          p_canonical_label: string;
          p_canonical_table: string;
          p_confidence?: string;
          p_notes?: string;
          p_source_entity: string;
          p_source_key: string;
          p_source_tab: string;
        };
        Returns: Json;
      };
      stage_raw_rows: {
        Args: { p_batch_id: string; p_rows: Json; p_tab_name: string };
        Returns: Json;
      };
      submit_roster_amendment: {
        Args: {
          p_category: string;
          p_lines: Json;
          p_period_id: number;
          p_reason: string;
        };
        Returns: number;
      };
      update_reconciliation_disposition: {
        Args: { p_disposition: string; p_notes?: string; p_result_id: number };
        Returns: Json;
      };
      upsert_roster_ep_assignment: {
        Args: {
          p_duty_date: string;
          p_period_id: number;
          p_physician_names: string;
          p_slot_type: string;
        };
        Returns: {
          created_at: string;
          duty_date: string;
          id: number;
          period_id: number;
          physician_names: string;
          slot_type: string;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'roster_ep_assignments';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
