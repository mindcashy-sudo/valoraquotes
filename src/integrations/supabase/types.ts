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
      clients: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          fiscal_code: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          fiscal_code?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          fiscal_code?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      computi: {
        Row: {
          approved_at: string | null
          created_at: string
          id: string
          motivazione: string | null
          nome: string
          parent_computo_id: string | null
          project_id: string
          stato: string
          tipo: string
          totale_imponibile: number
          totale_manodopera: number
          updated_at: string
          user_id: string
          versione: number
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          id?: string
          motivazione?: string | null
          nome: string
          parent_computo_id?: string | null
          project_id: string
          stato?: string
          tipo?: string
          totale_imponibile?: number
          totale_manodopera?: number
          updated_at?: string
          user_id: string
          versione?: number
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          id?: string
          motivazione?: string | null
          nome?: string
          parent_computo_id?: string | null
          project_id?: string
          stato?: string
          tipo?: string
          totale_imponibile?: number
          totale_manodopera?: number
          updated_at?: string
          user_id?: string
          versione?: number
        }
        Relationships: [
          {
            foreignKeyName: "computi_parent_computo_id_fkey"
            columns: ["parent_computo_id"]
            isOneToOne: false
            referencedRelation: "computi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "computi_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      computo_voci: {
        Row: {
          capitolo: string | null
          codice: string | null
          computo_id: string
          created_at: string
          descrizione: string
          descrizione_cliente: string | null
          formula_misura: string | null
          id: string
          importo: number | null
          incidenza_manodopera: number
          macro_categoria_cliente: string | null
          ordine: number
          prezzo_unitario: number
          quantita: number
          source_price_item_id: string | null
          unita_misura: string
          updated_at: string
          user_id: string
          visibile_cliente: boolean
        }
        Insert: {
          capitolo?: string | null
          codice?: string | null
          computo_id: string
          created_at?: string
          descrizione: string
          descrizione_cliente?: string | null
          formula_misura?: string | null
          id?: string
          importo?: number | null
          incidenza_manodopera?: number
          macro_categoria_cliente?: string | null
          ordine?: number
          prezzo_unitario?: number
          quantita?: number
          source_price_item_id?: string | null
          unita_misura?: string
          updated_at?: string
          user_id: string
          visibile_cliente?: boolean
        }
        Update: {
          capitolo?: string | null
          codice?: string | null
          computo_id?: string
          created_at?: string
          descrizione?: string
          descrizione_cliente?: string | null
          formula_misura?: string | null
          id?: string
          importo?: number | null
          incidenza_manodopera?: number
          macro_categoria_cliente?: string | null
          ordine?: number
          prezzo_unitario?: number
          quantita?: number
          source_price_item_id?: string | null
          unita_misura?: string
          updated_at?: string
          user_id?: string
          visibile_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "computo_voci_computo_id_fkey"
            columns: ["computo_id"]
            isOneToOne: false
            referencedRelation: "computi"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      price_list_items: {
        Row: {
          categoria: string | null
          codice: string | null
          created_at: string
          descrizione: string
          id: string
          incidenza_manodopera: number
          prezzo: number
          price_list_id: string
          search_tsv: unknown
          sottocategoria: string | null
          unita_misura: string
        }
        Insert: {
          categoria?: string | null
          codice?: string | null
          created_at?: string
          descrizione: string
          id?: string
          incidenza_manodopera?: number
          prezzo?: number
          price_list_id: string
          search_tsv?: unknown
          sottocategoria?: string | null
          unita_misura?: string
        }
        Update: {
          categoria?: string | null
          codice?: string | null
          created_at?: string
          descrizione?: string
          id?: string
          incidenza_manodopera?: number
          prezzo?: number
          price_list_id?: string
          search_tsv?: unknown
          sottocategoria?: string | null
          unita_misura?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_items_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          anno: number | null
          created_at: string
          id: string
          is_public: boolean
          nome: string
          owner_id: string | null
          regione: string | null
          source: string
          updated_at: string
        }
        Insert: {
          anno?: number | null
          created_at?: string
          id?: string
          is_public?: boolean
          nome: string
          owner_id?: string | null
          regione?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          anno?: number | null
          created_at?: string
          id?: string
          is_public?: boolean
          nome?: string
          owner_id?: string | null
          regione?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          free_quotes_used: number
          id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          free_quotes_used?: number
          id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          free_quotes_used?: number
          id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_id: string | null
          committente: string | null
          created_at: string
          id: string
          indirizzo_cantiere: string | null
          nome: string
          note: string | null
          stato: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          committente?: string | null
          created_at?: string
          id?: string
          indirizzo_cantiere?: string | null
          nome: string
          note?: string | null
          stato?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          committente?: string | null
          created_at?: string
          id?: string
          indirizzo_cantiere?: string | null
          nome?: string
          note?: string | null
          stato?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_counters: {
        Row: {
          last_number: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          last_number?: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          last_number?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      quote_views: {
        Row: {
          id: string
          ip_hash: string | null
          quote_id: string
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          id?: string
          ip_hash?: string | null
          quote_id: string
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          id?: string
          ip_hash?: string | null
          quote_id?: string
          user_agent?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_views_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          client_id: string | null
          client_message: string | null
          content: Json
          created_at: string
          expires_at: string | null
          first_viewed_at: string | null
          id: string
          last_viewed_at: string | null
          project_address: string | null
          public_token: string | null
          quote_number: string | null
          rejected_at: string | null
          share_status: string
          shared_at: string | null
          status: string
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          accepted_at?: string | null
          client_id?: string | null
          client_message?: string | null
          content: Json
          created_at?: string
          expires_at?: string | null
          first_viewed_at?: string | null
          id?: string
          last_viewed_at?: string | null
          project_address?: string | null
          public_token?: string | null
          quote_number?: string | null
          rejected_at?: string | null
          share_status?: string
          shared_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          accepted_at?: string | null
          client_id?: string | null
          client_message?: string | null
          content?: Json
          created_at?: string
          expires_at?: string | null
          first_viewed_at?: string | null
          id?: string
          last_viewed_at?: string | null
          project_address?: string | null
          public_token?: string | null
          quote_number?: string | null
          rejected_at?: string | null
          share_status?: string
          shared_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_price_list: {
        Row: {
          category: string | null
          code: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          unit: string
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          code?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          unit?: string
          unit_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          unit?: string
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      studio_profiles: {
        Row: {
          address: string | null
          albo_number: string | null
          architect_name: string | null
          city: string | null
          created_at: string
          default_terms: string | null
          default_validity_days: number
          default_vat_percent: number
          default_work_zone: string | null
          email: string | null
          fiscal_code: string | null
          iban: string | null
          id: string
          logo_url: string | null
          onboarding_completed: boolean
          pec: string | null
          phone: string | null
          postal_code: string | null
          province: string | null
          studio_name: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          albo_number?: string | null
          architect_name?: string | null
          city?: string | null
          created_at?: string
          default_terms?: string | null
          default_validity_days?: number
          default_vat_percent?: number
          default_work_zone?: string | null
          email?: string | null
          fiscal_code?: string | null
          iban?: string | null
          id?: string
          logo_url?: string | null
          onboarding_completed?: boolean
          pec?: string | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          studio_name?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          albo_number?: string | null
          architect_name?: string | null
          city?: string | null
          created_at?: string
          default_terms?: string | null
          default_validity_days?: number
          default_vat_percent?: number
          default_work_zone?: string | null
          email?: string | null
          fiscal_code?: string | null
          iban?: string | null
          id?: string
          logo_url?: string | null
          onboarding_completed?: boolean
          pec?: string | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          studio_name?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      increment_free_quotes_used: {
        Args: { _user_id: string }
        Returns: number
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      next_quote_number: {
        Args: { _user_id: string; _year: number }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
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
