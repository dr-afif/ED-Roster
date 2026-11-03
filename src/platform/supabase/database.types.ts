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
