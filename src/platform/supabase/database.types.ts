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
