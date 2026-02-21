/**
 * Database type definitions
 * Auto-generated from Supabase schema
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      tables: {
        Row: {
          id: string;
          table_number: string;
          qr_code: string;
          capacity: number;
          status: 'free' | 'occupied' | 'reserved' | 'closed';
          location: string | null;
          current_session_id: string | null;
          occupied_at: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['tables']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['tables']['Insert']>;
      };
      categories: {
        Row: {
          id: string;
          name_en: string;
          name_az: string | null;
          name_ru: string | null;
          name_tr: string | null;
          description_en: string | null;
          description_az: string | null;
          description_ru: string | null;
          description_tr: string | null;
          icon: string | null;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['categories']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['categories']['Insert']>;
      };
      menu_items: {
        Row: {
          id: string;
          category_id: string | null;
          name_en: string;
          name_az: string | null;
          name_ru: string | null;
          name_tr: string | null;
          description_en: string | null;
          description_az: string | null;
          description_ru: string | null;
          description_tr: string | null;
          price: number;
          image_url: string | null;
          preparation_time: number | null;
          is_popular: boolean;
          is_vegetarian: boolean;
          is_vegan: boolean;
          is_gluten_free: boolean;
          is_spicy: boolean;
          allergens: string[] | null;
          is_available: boolean;
          is_daily_special: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['menu_items']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['menu_items']['Insert']>;
      };
      orders: {
        Row: {
          id: string;
          table_id: string;
          assigned_waiter_id: string | null;
          order_number: string;
          status: 'new' | 'preparing' | 'ready' | 'served' | 'closed' | 'cancelled';
          subtotal: number;
          tax: number;
          total: number;
          customer_notes: string | null;
          internal_notes: string | null;
          created_at: string;
          updated_at: string;
          preparing_at: string | null;
          ready_at: string | null;
          served_at: string | null;
          closed_at: string | null;
          payment_method: string | null;
          paid_at: string | null;
        };
        Insert: Omit<
          Database['public']['Tables']['orders']['Row'],
          'id' | 'order_number' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['orders']['Insert']>;
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          menu_item_id: string;
          item_name: string;
          item_price: number;
          quantity: number;
          notes: string | null;
          status: 'pending' | 'preparing' | 'ready' | 'served';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['order_items']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>;
      };
      waiter_calls: {
        Row: {
          id: string;
          table_id: string;
          reason: string;
          call_type: 'assistance' | 'bill' | 'complaint' | 'question' | 'emergency';
          priority: 'low' | 'normal' | 'high' | 'urgent';
          status: 'pending' | 'acknowledged' | 'resolved';
          responded_by: string | null;
          created_at: string;
          acknowledged_at: string | null;
          resolved_at: string | null;
          notes: string | null;
        };
        Insert: {
          table_id: string;
          reason: string;
          call_type: 'assistance' | 'bill' | 'complaint' | 'question' | 'emergency';
          priority: 'low' | 'normal' | 'high' | 'urgent';
          status: 'pending' | 'acknowledged' | 'resolved';
          responded_by?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database['public']['Tables']['waiter_calls']['Insert']>;
      };
      staff: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: 'waiter' | 'admin' | 'kitchen';
          phone: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          last_login_at: string | null;
          auth_user_id: string | null;
        };
        Insert: Omit<
          Database['public']['Tables']['staff']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['staff']['Insert']>;
      };
      customer_feedback: {
        Row: {
          id: string;
          table_id: string | null;
          order_id: string | null;
          feedback_type:
            | 'complaint_food'
            | 'complaint_service'
            | 'complaint_staff'
            | 'question_menu'
            | 'request_general'
            | 'praise';
          subject: string | null;
          message: string;
          status: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
          responded_by: string | null;
          response: string | null;
          created_at: string;
          acknowledged_at: string | null;
          resolved_at: string | null;
        };
        Insert: {
          table_id?: string | null;
          order_id?: string | null;
          feedback_type:
            | 'complaint_food'
            | 'complaint_service'
            | 'complaint_staff'
            | 'question_menu'
            | 'request_general'
            | 'praise';
          subject?: string | null;
          message: string;
          status?: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
          responded_by?: string | null;
          response?: string | null;
        };
        Update: Partial<Database['public']['Tables']['customer_feedback']['Insert']>;
      };
      cafe_settings: {
        Row: {
          id: string;
          restaurant_name: string;
          tax_enabled: boolean;
          tax_percentage: number;
          tax_label: string;
          prices_include_tax: boolean;
          show_tax_separately: boolean;
          currency_symbol: string;
          currency_code: string;
          currency_position: 'before' | 'after';
          currency_decimal_places: number;
          minimum_order_amount: number;
          allow_item_notes: boolean;
          allow_order_notes: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['cafe_settings']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['cafe_settings']['Insert']>;
      };
    };
    Views: {
      active_orders_view: {
        Row: {
          id: string;
          order_number: string;
          status: string;
          created_at: string;
          updated_at: string;
          table_number: string;
          location: string | null;
          waiter_name: string | null;
          item_count: number;
          total_quantity: number;
          total: number;
          minutes_elapsed: number;
          items: Json;
        };
      };
      sales_summary_view: {
        Row: {
          date: string;
          order_count: number;
          total_revenue: number;
          average_order_value: number;
          tables_served: number;
          avg_service_time_minutes: number;
        };
      };
    };
    Functions: {
      set_table_context: {
        Args: { qr_token: string };
        Returns: undefined;
      };
      generate_order_number: {
        Args: {};
        Returns: string;
      };
      calculate_order_total: {
        Args: { order_uuid: string };
        Returns: undefined;
      };
    };
  };
}
