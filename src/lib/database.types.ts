export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_email: string
          created_at: string
          details: Json
          id: string
        }
        Insert: {
          action: string
          actor_email: string
          created_at?: string
          details?: Json
          id?: string
        }
        Update: {
          action?: string
          actor_email?: string
          created_at?: string
          details?: Json
          id?: string
        }
        Relationships: []
      }
      admin_runtime_settings: {
        Row: {
          created_at: string
          global_low_cost_override: boolean
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          global_low_cost_override?: boolean
          id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          global_low_cost_override?: boolean
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event: string
          id: string
          metadata: Json | null
          session_id: string
          user_id: string | null
          value: number | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          metadata?: Json | null
          session_id: string
          user_id?: string | null
          value?: number | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          metadata?: Json | null
          session_id?: string
          user_id?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          created_at: string
          dodo_event_id: string | null
          event_type: string
          id: string
          payload: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dodo_event_id?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dodo_event_id?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          archetype: string
          avatar_url: string | null
          color: string
          created_at: string | null
          id: string
          name: string
          personality_prompt: string
          prompt_block: string | null
          sample_line: string
          typing_style: string
          vibe: string
          voice_description: string
        }
        Insert: {
          archetype: string
          avatar_url?: string | null
          color: string
          created_at?: string | null
          id: string
          name: string
          personality_prompt: string
          prompt_block?: string | null
          sample_line: string
          typing_style: string
          vibe: string
          voice_description: string
        }
        Update: {
          archetype?: string
          avatar_url?: string | null
          color?: string
          created_at?: string | null
          id?: string
          name?: string
          personality_prompt?: string
          prompt_block?: string | null
          sample_line?: string
          typing_style?: string
          vibe?: string
          voice_description?: string
        }
        Relationships: []
      }
      chat_history: {
        Row: {
          client_message_id: string | null
          content: string
          created_at: string
          gang_id: string
          id: string
          reaction: string | null
          reply_to_client_message_id: string | null
          source: string
          speaker: string
          user_id: string
        }
        Insert: {
          client_message_id?: string | null
          content: string
          created_at?: string
          gang_id: string
          id?: string
          reaction?: string | null
          reply_to_client_message_id?: string | null
          source?: string
          speaker: string
          user_id: string
        }
        Update: {
          client_message_id?: string | null
          content?: string
          created_at?: string
          gang_id?: string
          id?: string
          reaction?: string | null
          reply_to_client_message_id?: string | null
          source?: string
          speaker?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_history_gang_id_fkey"
            columns: ["gang_id"]
            isOneToOne: false
            referencedRelation: "gangs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gang_members: {
        Row: {
          character_id: string
          created_at: string
          gang_id: string
          id: string
          relationship_score: number | null
          updated_at: string | null
        }
        Insert: {
          character_id: string
          created_at?: string
          gang_id: string
          id?: string
          relationship_score?: number | null
          updated_at?: string | null
        }
        Update: {
          character_id?: string
          created_at?: string
          gang_id?: string
          id?: string
          relationship_score?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gang_members_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gang_members_gang_id_fkey"
            columns: ["gang_id"]
            isOneToOne: false
            referencedRelation: "gangs"
            referencedColumns: ["id"]
          },
        ]
      }
      gangs: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gangs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          category: string | null
          content: string
          created_at: string
          embedding: string | null
          expires_at: string | null
          id: string
          importance: number | null
          kind: string | null
          last_used_at: string | null
          tags: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          embedding?: string | null
          expires_at?: string | null
          id?: string
          importance?: number | null
          kind?: string | null
          last_used_at?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          embedding?: string | null
          expires_at?: string | null
          id?: string
          importance?: number | null
          kind?: string | null
          last_used_at?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          abuse_score: number
          avatar_style_preference: string
          chat_mode: string | null
          chat_wallpaper: string | null
          created_at: string
          custom_character_names: Json | null
          daily_msg_count: number
          dodo_customer_id: string | null
          gang_vibe_score: number | null
          id: string
          last_active_at: string | null
          last_msg_reset: string | null
          last_wywa_generated_at: string | null
          low_cost_mode: boolean
          onboarding_completed: boolean
          pending_squad_downgrade: boolean | null
          preferred_squad: string[] | null
          purchase_celebration_pending: string | null
          relationship_state: Json | null
          restored_members_pending: string[] | null
          session_summary: string | null
          subscription_tier: string
          summary_turns: number | null
          theme: string | null
          updated_at: string | null
          user_profile: Json | null
          username: string | null
          vibe_profile: Json | null
        }
        Insert: {
          abuse_score?: number
          avatar_style_preference?: string
          chat_mode?: string | null
          chat_wallpaper?: string | null
          created_at?: string
          custom_character_names?: Json | null
          daily_msg_count?: number
          dodo_customer_id?: string | null
          gang_vibe_score?: number | null
          id: string
          last_active_at?: string | null
          last_msg_reset?: string | null
          last_wywa_generated_at?: string | null
          low_cost_mode?: boolean
          onboarding_completed?: boolean
          pending_squad_downgrade?: boolean | null
          preferred_squad?: string[] | null
          purchase_celebration_pending?: string | null
          relationship_state?: Json | null
          restored_members_pending?: string[] | null
          session_summary?: string | null
          subscription_tier?: string
          summary_turns?: number | null
          theme?: string | null
          updated_at?: string | null
          user_profile?: Json | null
          username?: string | null
          vibe_profile?: Json | null
        }
        Update: {
          abuse_score?: number
          avatar_style_preference?: string
          chat_mode?: string | null
          chat_wallpaper?: string | null
          created_at?: string
          custom_character_names?: Json | null
          daily_msg_count?: number
          dodo_customer_id?: string | null
          gang_vibe_score?: number | null
          id?: string
          last_active_at?: string | null
          last_msg_reset?: string | null
          last_wywa_generated_at?: string | null
          low_cost_mode?: boolean
          onboarding_completed?: boolean
          pending_squad_downgrade?: boolean | null
          preferred_squad?: string[] | null
          purchase_celebration_pending?: string | null
          relationship_state?: Json | null
          restored_members_pending?: string[] | null
          session_summary?: string | null
          subscription_tier?: string
          summary_turns?: number | null
          theme?: string | null
          updated_at?: string | null
          user_profile?: Json | null
          username?: string | null
          vibe_profile?: Json | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_tier_members: {
        Row: {
          added_at_tier: string
          character_id: string
          created_at: string
          deactivated_at: string | null
          id: string
          is_active: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          added_at_tier: string
          character_id: string
          created_at?: string
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string | null
          user_id: string
        }
        Update: {
          added_at_tier?: string
          character_id?: string
          created_at?: string
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_tier_members_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_tier_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: string
          product_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id: string
          plan: string
          product_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          product_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_profile_counters: {
        Args: {
          p_abuse_score_increment?: number
          p_daily_msg_increment?: number
          p_last_active_at?: string
          p_relationship_state?: Json
          p_session_summary?: string
          p_summary_turns?: number
          p_user_id: string
          p_user_profile?: Json
        }
        Returns: {
          daily_msg_count: number
          last_msg_reset: string
        }[]
      }
      match_memories: {
        Args: {
          match_count: number
          match_threshold: number
          p_user_id: string
          query_embedding: string
        }
        Returns: {
          category: string
          content: string
          created_at: string
          id: string
          importance: number
          last_used_at: string
          similarity: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
