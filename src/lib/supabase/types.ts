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
      categories: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          role: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          context: Json | null
          created_at: string
          freeform: string | null
          id: string
          quick_reasons: string[] | null
          rating: number | null
          suggestion_ref: Json | null
          user_id: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          freeform?: string | null
          id?: string
          quick_reasons?: string[] | null
          rating?: number | null
          suggestion_ref?: Json | null
          user_id?: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          freeform?: string | null
          id?: string
          quick_reasons?: string[] | null
          rating?: number | null
          suggestion_ref?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          acquired_note: string | null
          added_date: string
          brand: string | null
          care: string | null
          category_id: string | null
          colours: Json | null
          confidence: Json | null
          created_at: string
          cutout_path: string | null
          formality: string | null
          id: string
          material: string | null
          notes: string | null
          original_photo_path: string
          pattern: string | null
          price: number | null
          retired: boolean
          season_suitability: string | null
          silhouette: string | null
          size: string | null
          subcategory: string | null
          user_id: string
        }
        Insert: {
          acquired_note?: string | null
          added_date?: string
          brand?: string | null
          care?: string | null
          category_id?: string | null
          colours?: Json | null
          confidence?: Json | null
          created_at?: string
          cutout_path?: string | null
          formality?: string | null
          id?: string
          material?: string | null
          notes?: string | null
          original_photo_path: string
          pattern?: string | null
          price?: number | null
          retired?: boolean
          season_suitability?: string | null
          silhouette?: string | null
          size?: string | null
          subcategory?: string | null
          user_id?: string
        }
        Update: {
          acquired_note?: string | null
          added_date?: string
          brand?: string | null
          care?: string | null
          category_id?: string | null
          colours?: Json | null
          confidence?: Json | null
          created_at?: string
          cutout_path?: string | null
          formality?: string | null
          id?: string
          material?: string | null
          notes?: string | null
          original_photo_path?: string
          pattern?: string | null
          price?: number | null
          retired?: boolean
          season_suitability?: string | null
          silhouette?: string | null
          size?: string | null
          subcategory?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      outfit_items: {
        Row: {
          id: string
          item_id: string
          outfit_id: string
          user_id: string
        }
        Insert: {
          id?: string
          item_id: string
          outfit_id: string
          user_id?: string
        }
        Update: {
          id?: string
          item_id?: string
          outfit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfit_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_items_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      outfits: {
        Row: {
          created_at: string
          id: string
          last_worn_date: string | null
          name: string
          rating: number | null
          saved_date: string
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_worn_date?: string | null
          name: string
          rating?: number | null
          saved_date?: string
          source?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_worn_date?: string | null
          name?: string
          rating?: number | null
          saved_date?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      preferences: {
        Row: {
          colouring_profile: Json | null
          created_at: string
          id: string
          naming_playfulness: string
          occasion_tags: string[]
          style_principles: Json | null
          user_id: string
        }
        Insert: {
          colouring_profile?: Json | null
          created_at?: string
          id?: string
          naming_playfulness?: string
          occasion_tags?: string[]
          style_principles?: Json | null
          user_id?: string
        }
        Update: {
          colouring_profile?: Json | null
          created_at?: string
          id?: string
          naming_playfulness?: string
          occasion_tags?: string[]
          style_principles?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      wear_events: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          occasion: string | null
          outfit_id: string | null
          user_id: string
          weather: Json | null
          worn_on: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          occasion?: string | null
          outfit_id?: string | null
          user_id?: string
          weather?: Json | null
          worn_on: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          occasion?: string | null
          outfit_id?: string | null
          user_id?: string
          weather?: Json | null
          worn_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "wear_events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wear_events_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
