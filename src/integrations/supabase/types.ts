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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          ai_recommendation: string | null
          breakdown: Json | null
          carrier: string
          created_at: string
          deliver_by_time: string | null
          details: Json | null
          estimated_delivery_date: string | null
          features: string[] | null
          guaranteed: boolean | null
          id: string
          is_top_pick: boolean | null
          original_price: number | null
          price: number
          promo: Json | null
          provider_type: string
          rank_score: number | null
          service_id: string
          service_name: string
          shipment_request_id: string
          tier: string
          transit_days: number
        }
        Insert: {
          ai_recommendation?: string | null
          breakdown?: Json | null
          carrier: string
          created_at?: string
          deliver_by_time?: string | null
          details?: Json | null
          estimated_delivery_date?: string | null
          features?: string[] | null
          guaranteed?: boolean | null
          id?: string
          is_top_pick?: boolean | null
          original_price?: number | null
          price: number
          promo?: Json | null
          provider_type: string
          rank_score?: number | null
          service_id: string
          service_name: string
          shipment_request_id: string
          tier: string
          transit_days: number
        }
        Update: {
          ai_recommendation?: string | null
          breakdown?: Json | null
          carrier?: string
          created_at?: string
          deliver_by_time?: string | null
          details?: Json | null
          estimated_delivery_date?: string | null
          features?: string[] | null
          guaranteed?: boolean | null
          id?: string
          is_top_pick?: boolean | null
          original_price?: number | null
          price?: number
          promo?: Json | null
          provider_type?: string
          rank_score?: number | null
          service_id?: string
          service_name?: string
          shipment_request_id?: string
          tier?: string
          transit_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_shipment_request_id_fkey"
            columns: ["shipment_request_id"]
            isOneToOne: false
            referencedRelation: "shipment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      redirect_tracking: {
        Row: {
          carrier: string
          created_at: string
          destination: string | null
          id: string
          origin: string | null
          redirect_url: string
          service_id: string
          service_name: string
          user_id: string | null
        }
        Insert: {
          carrier: string
          created_at?: string
          destination?: string | null
          id?: string
          origin?: string | null
          redirect_url: string
          service_id: string
          service_name: string
          user_id?: string | null
        }
        Update: {
          carrier?: string
          created_at?: string
          destination?: string | null
          id?: string
          origin?: string | null
          redirect_url?: string
          service_id?: string
          service_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      saved_options: {
        Row: {
          ai_recommendation: string | null
          book_url: string | null
          breakdown: Json | null
          carrier: string
          created_at: string
          deliver_by_time: string | null
          destination: string
          details: Json | null
          drop_off_date: string | null
          estimated_delivery: string | null
          expected_delivery_date: string | null
          features: string[] | null
          guaranteed: boolean | null
          id: string
          origin: string
          original_price: number | null
          package_summary: string | null
          price: number
          promo: Json | null
          quote_service_id: string
          service_name: string
          tier: string
          transit_days: number
          user_id: string
        }
        Insert: {
          ai_recommendation?: string | null
          book_url?: string | null
          breakdown?: Json | null
          carrier: string
          created_at?: string
          deliver_by_time?: string | null
          destination: string
          details?: Json | null
          drop_off_date?: string | null
          estimated_delivery?: string | null
          expected_delivery_date?: string | null
          features?: string[] | null
          guaranteed?: boolean | null
          id?: string
          origin: string
          original_price?: number | null
          package_summary?: string | null
          price: number
          promo?: Json | null
          quote_service_id: string
          service_name: string
          tier: string
          transit_days: number
          user_id: string
        }
        Update: {
          ai_recommendation?: string | null
          book_url?: string | null
          breakdown?: Json | null
          carrier?: string
          created_at?: string
          deliver_by_time?: string | null
          destination?: string
          details?: Json | null
          drop_off_date?: string | null
          estimated_delivery?: string | null
          expected_delivery_date?: string | null
          features?: string[] | null
          guaranteed?: boolean | null
          id?: string
          origin?: string
          original_price?: number | null
          package_summary?: string | null
          price?: number
          promo?: Json | null
          quote_service_id?: string
          service_name?: string
          tier?: string
          transit_days?: number
          user_id?: string
        }
        Relationships: []
      }
      shipment_requests: {
        Row: {
          created_at: string
          destination: string
          drop_off_date: string
          expected_delivery_date: string
          id: string
          origin: string
          packages: Json
          total_items: number
          total_weight: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          destination: string
          drop_off_date: string
          expected_delivery_date: string
          id?: string
          origin: string
          packages?: Json
          total_items?: number
          total_weight?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          destination?: string
          drop_off_date?: string
          expected_delivery_date?: string
          id?: string
          origin?: string
          packages?: Json
          total_items?: number
          total_weight?: number
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
