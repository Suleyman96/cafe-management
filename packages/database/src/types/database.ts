/**
 * Database type definitions
 * Auto-generated from Supabase schema
 *
 * This file is shared across all platforms
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
          notes: string | null;
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
          name: string;
          description: string | null;
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
          name: string;
          description: string | null;
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
          table_id: string | null; // Nullable for takeout orders
          assigned_waiter_id: string | null;
          order_number: string;
          status:
            | 'pending_approval'
            | 'new'
            | 'preparing'
            | 'ready'
            | 'served'
            | 'out_for_delivery'
            | 'delivered'
            | 'closed'
            | 'cancelled';
          source: 'customer' | 'waiter' | 'phone';
          order_type: 'dine_in' | 'takeout' | 'delivery';
          customer_name: string | null;
          customer_phone: string | null;
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
          // Delivery fields
          delivery_address: string | null;
          delivery_fee: number;
          delivery_notes: string | null;
          estimated_delivery_time: string | null;
          delivered_at: string | null;
          delivery_person_id: string | null;
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
        Insert: Omit<
          Database['public']['Tables']['waiter_calls']['Row'],
          'id' | 'created_at' | 'acknowledged_at' | 'resolved_at'
        >;
        Update: Partial<Database['public']['Tables']['waiter_calls']['Insert']> & {
          acknowledged_at?: string | null;
          resolved_at?: string | null;
        };
      };
      staff: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: 'waiter' | 'admin' | 'kitchen' | 'owner';
          phone: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          last_login_at: string | null;
          auth_user_id: string | null;
          preferred_language: string;
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
        Insert: Omit<
          Database['public']['Tables']['customer_feedback']['Row'],
          'id' | 'created_at' | 'acknowledged_at' | 'resolved_at'
        >;
        Update: Partial<Database['public']['Tables']['customer_feedback']['Insert']> & {
          acknowledged_at?: string | null;
          resolved_at?: string | null;
        };
      };
      order_payments: {
        Row: {
          id: string;
          order_id: string;
          received_by: string;
          payment_type: 'full' | 'partial_amount' | 'specific_items';
          amount: number;
          tip_amount: number;
          payment_method: 'cash' | 'card' | 'digital';
          order_item_ids: string[] | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['order_payments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['order_payments']['Insert']>;
      };
      table_transfers: {
        Row: {
          id: string;
          order_id: string;
          from_table_id: string;
          to_table_id: string;
          transferred_by: string;
          reason: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['table_transfers']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['table_transfers']['Insert']>;
      };
      staff_schedules: {
        Row: {
          id: string;
          staff_id: string;
          date: string;
          planned_start: string;
          planned_end: string;
          actual_start: string | null;
          actual_end: string | null;
          status: 'scheduled' | 'in_progress' | 'completed' | 'missed';
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['staff_schedules']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['staff_schedules']['Insert']>;
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
          // Branding fields
          cafe_logo_url: string | null;
          hero_image_url: string | null;
          brand_primary_color: string;
          brand_secondary_color: string;
          // Welcome screen
          welcome_heading: string | null;
          welcome_message: string | null;
          // Feature controls
          qr_ordering_enabled: boolean;
          tips_enabled: boolean;
          waste_tracking_enabled: boolean;
          // Delivery settings
          delivery_enabled: boolean;
          delivery_fee_default: number;
          minimum_delivery_amount: number;
          delivery_zone_info: string | null;
          // Contact & social
          contact_phone: string | null;
          contact_website: string | null;
          social_instagram: string | null;
          social_whatsapp: string | null;
          location_maps_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['cafe_settings']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['cafe_settings']['Insert']>;
      };
      stock_items: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          category: string;
          quantity: number;
          unit: string;
          cost_price: number;
          minimum_stock_level: number;
          supplier_name: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['stock_items']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['stock_items']['Insert']>;
      };
      stock_movements: {
        Row: {
          id: string;
          stock_item_id: string;
          movement_type: 'in' | 'out' | 'adjustment';
          quantity_change: number;
          quantity_after: number;
          reason: string | null;
          performed_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['stock_movements']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['stock_movements']['Insert']>;
      };
      expense_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          icon: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['expense_categories']['Row'],
          'id' | 'created_at'
        >;
        Update: Partial<Database['public']['Tables']['expense_categories']['Insert']>;
      };
      expenses: {
        Row: {
          id: string;
          category_id: string | null;
          amount: number;
          description: string;
          payment_method: 'cash' | 'card' | 'digital' | 'bank_transfer';
          expense_date: string;
          receipt_url: string | null;
          created_by: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['expenses']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>;
      };
      waste_logs: {
        Row: {
          id: string;
          item_name: string;
          category: string;
          quantity: number;
          unit: string;
          cost_per_unit: number;
          total_cost: number;
          reason:
            | 'expired'
            | 'spoiled'
            | 'overcooked'
            | 'dropped'
            | 'returned_by_customer'
            | 'preparation_waste'
            | 'other';
          stock_item_id: string | null;
          notes: string | null;
          logged_by: string | null;
          waste_date: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['waste_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['waste_logs']['Insert']>;
      };
      task_categories: {
        Row: {
          id: string;
          name: string;
          icon: string | null;
          color: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['task_categories']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['task_categories']['Insert']>;
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          category_id: string | null;
          priority: 'low' | 'normal' | 'high' | 'urgent';
          status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
          assigned_to: string | null;
          created_by: string | null;
          due_date: string | null;
          due_time: string | null;
          completed_at: string | null;
          is_recurring: boolean;
          recurrence_pattern: 'daily' | 'weekly' | 'monthly' | null;
          recurrence_days: number[] | null;
          parent_task_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['tasks']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>;
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
      order_payment_summary: {
        Row: {
          order_id: string;
          order_number: string;
          order_total: number;
          paid_amount: number;
          remaining_balance: number;
          payment_count: number;
          payments: Json | null;
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
      get_order_remaining_balance: {
        Args: { order_uuid: string };
        Returns: number;
      };
      transfer_table: {
        Args: {
          p_order_id: string;
          p_from_table_id: string;
          p_to_table_id: string;
          p_staff_id: string;
          p_reason?: string;
        };
        Returns: boolean;
      };
    };
  };
}
