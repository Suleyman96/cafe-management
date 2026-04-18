-- Baseline migration: squashed from 68 individual migrations (20250101-20260418)
-- Original migrations archived in supabase/migrations/_archive/
-- Generated on 2026-04-19

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."auto_acknowledge_feedback"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  -- If status changed to 'acknowledged', set timestamp
  IF NEW.status = 'acknowledged' AND OLD.status = 'pending' THEN
    NEW.acknowledged_at := NOW();
  END IF;
  
  -- If status changed to 'resolved', set timestamp
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    NEW.resolved_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_acknowledge_feedback"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_acknowledge_feedback"() IS 'Automatically set timestamps when feedback status changes';



CREATE OR REPLACE FUNCTION "public"."calculate_order_total"("order_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  calculated_subtotal DECIMAL(10, 2);
  calculated_tax DECIMAL(10, 2);
  calculated_total DECIMAL(10, 2);
  settings_tax_enabled BOOLEAN;
  settings_tax_percentage DECIMAL(5, 2);
  v_tenant_id UUID;
BEGIN
  -- Get tenant from the order
  SELECT tenant_id INTO v_tenant_id FROM public.orders WHERE id = order_uuid;

  -- Get tax settings for this tenant
  SELECT tax_enabled, tax_percentage
  INTO settings_tax_enabled, settings_tax_percentage
  FROM public.cafe_settings
  WHERE tenant_id = v_tenant_id
  LIMIT 1;

  -- Calculate subtotal
  SELECT COALESCE(SUM(item_price * quantity), 0)
  INTO calculated_subtotal
  FROM public.order_items
  WHERE order_id = order_uuid;

  -- Calculate tax
  IF settings_tax_enabled = true AND settings_tax_percentage > 0 THEN
    calculated_tax := calculated_subtotal * (settings_tax_percentage / 100);
  ELSE
    calculated_tax := 0;
  END IF;

  calculated_total := calculated_subtotal + calculated_tax;

  -- Update order
  UPDATE public.orders
  SET subtotal = calculated_subtotal, tax = calculated_tax, total = calculated_total, updated_at = NOW()
  WHERE id = order_uuid;
END;
$$;


ALTER FUNCTION "public"."calculate_order_total"("order_uuid" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_order_total"("order_uuid" "uuid") IS 'Calculate order total with tax based on cafe_settings (not hardcoded)';



CREATE OR REPLACE FUNCTION "public"."cascade_order_status_to_items"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Only act when status actually changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Map order status to the corresponding item status
  -- Order statuses: pending_approval, new, preparing, ready, served, closed, cancelled
  -- Item statuses:  pending, preparing, ready, served, cancelled

  IF NEW.status = 'preparing' THEN
    UPDATE public.order_items
    SET status = 'preparing', updated_at = NOW()
    WHERE order_id = NEW.id
      AND status = 'pending';

  ELSIF NEW.status = 'ready' THEN
    UPDATE public.order_items
    SET status = 'ready', updated_at = NOW()
    WHERE order_id = NEW.id
      AND status IN ('pending', 'preparing');

  ELSIF NEW.status IN ('served', 'delivered') THEN
    UPDATE public.order_items
    SET status = 'served', updated_at = NOW()
    WHERE order_id = NEW.id
      AND status IN ('pending', 'preparing', 'ready');

  ELSIF NEW.status = 'cancelled' THEN
    UPDATE public.order_items
    SET status = 'cancelled', updated_at = NOW()
    WHERE order_id = NEW.id
      AND status IN ('pending', 'preparing', 'ready');
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cascade_order_status_to_items"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_order_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_plan TEXT;
  v_count INT;
  v_max INT;
BEGIN
  SELECT t.plan INTO v_plan FROM public.tenants t WHERE t.id = NEW.tenant_id;

  v_max := CASE v_plan
    WHEN 'free' THEN 100
    WHEN 'standard' THEN 700
    WHEN 'pro' THEN 2200
    ELSE -1
  END;

  IF v_max = -1 THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_count FROM public.orders
  WHERE tenant_id = NEW.tenant_id
    AND created_at >= date_trunc('month', NOW());

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Monthly order limit reached for % plan (max %)', v_plan, v_max;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_order_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_table_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_plan TEXT;
  v_count INT;
  v_max INT;
BEGIN
  SELECT t.plan INTO v_plan FROM public.tenants t WHERE t.id = NEW.tenant_id;

  v_max := CASE v_plan
    WHEN 'free' THEN 5
    WHEN 'standard' THEN 10
    WHEN 'pro' THEN 20
    ELSE -1
  END;

  IF v_max = -1 THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_count FROM public.tables WHERE tenant_id = NEW.tenant_id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Table limit reached for % plan (max %)', v_plan, v_max;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_table_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_tenant_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID,
    (SELECT tenant_id FROM public.staff WHERE auth_user_id = auth.uid() LIMIT 1)
  );
$$;


ALTER FUNCTION "public"."current_tenant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_order_number"() RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  new_number VARCHAR(15);
  counter INTEGER;
  v_tenant_id UUID;
BEGIN
  -- Try to get tenant from session context (anon) or current user (authenticated)
  v_tenant_id := COALESCE(
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID,
    public.current_tenant_id()
  );

  SELECT COUNT(*) INTO counter
  FROM public.orders
  WHERE DATE(created_at) = CURRENT_DATE
    AND (v_tenant_id IS NULL OR tenant_id = v_tenant_id);

  new_number := 'ORD' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || LPAD((counter + 1)::TEXT, 3, '0');
  RETURN new_number;
END;
$$;


ALTER FUNCTION "public"."generate_order_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_order_count"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COUNT(*)::INT FROM public.orders
  WHERE tenant_id = public.current_tenant_id()
    AND created_at >= date_trunc('month', NOW());
$$;


ALTER FUNCTION "public"."get_monthly_order_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_staff_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT id FROM public.staff
  WHERE auth_user_id = auth.uid()
  AND is_active = true
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_my_staff_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_staff_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT role FROM public.staff
  WHERE auth_user_id = auth.uid()
  AND is_active = true
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_my_staff_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_order_remaining_balance"("order_uuid" "uuid") RETURNS numeric
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
DECLARE
  order_total DECIMAL(10, 2);
  paid_amount DECIMAL(10, 2);
  refunded_amount DECIMAL(10, 2);
BEGIN
  SELECT total INTO order_total
  FROM public.orders
  WHERE id = order_uuid;

  IF order_total IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', order_uuid;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO paid_amount
  FROM public.order_payments
  WHERE order_id = order_uuid;

  SELECT COALESCE(SUM(amount), 0) INTO refunded_amount
  FROM public.refunds
  WHERE order_id = order_uuid;

  -- remaining = total - paid + refunded
  RETURN order_total - paid_amount + refunded_amount;
END;
$$;


ALTER FUNCTION "public"."get_order_remaining_balance"("order_uuid" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_order_remaining_balance"("order_uuid" "uuid") IS 'Calculate remaining balance for an order after all payments';



CREATE OR REPLACE FUNCTION "public"."get_tenant_plan_from_context"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT t.plan FROM public.tenants t
  WHERE t.id = current_setting('app.current_tenant_id', true)::UUID;
$$;


ALTER FUNCTION "public"."get_tenant_plan_from_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_tenant_signup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_tenant_id UUID;
  v_slug TEXT;
  v_plan TEXT;
BEGIN
  -- Only process self-service signups (not admin-created users)
  IF NEW.raw_user_meta_data->>'signup' IS NULL THEN
    RETURN NEW;
  END IF;

  -- Read plan from signup metadata (default to free)
  v_plan := COALESCE(NEW.raw_user_meta_data->>'plan', 'free');
  IF v_plan NOT IN ('free', 'standard', 'pro', 'business') THEN
    v_plan := 'free';
  END IF;

  -- Generate URL-friendly slug from restaurant name
  v_slug := lower(regexp_replace(
    COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'restaurant'),
    '[^a-zA-Z0-9]+', '-', 'g'
  ));
  v_slug := v_slug || '-' || substr(gen_random_uuid()::TEXT, 1, 8);

  -- Create tenant with selected plan
  INSERT INTO public.tenants (name, slug, plan)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'My Restaurant'),
    v_slug,
    v_plan
  )
  RETURNING id INTO v_tenant_id;

  -- Create owner staff record
  INSERT INTO public.staff (auth_user_id, email, full_name, role, tenant_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Owner'),
    'owner',
    v_tenant_id
  );

  -- Create default cafe settings
  INSERT INTO public.cafe_settings (tenant_id, restaurant_name)
  VALUES (v_tenant_id, COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'My Restaurant'));

  -- Create default task categories
  INSERT INTO public.task_categories (tenant_id, name, icon, color) VALUES
    (v_tenant_id, 'Opening', '🌅', '#22c55e'),
    (v_tenant_id, 'Closing', '🌙', '#6366f1'),
    (v_tenant_id, 'Cleaning', '🧹', '#06b6d4'),
    (v_tenant_id, 'Inventory', '📦', '#f59e0b'),
    (v_tenant_id, 'General', '📋', '#64748b');

  -- Create default expense categories
  INSERT INTO public.expense_categories (tenant_id, name, icon) VALUES
    (v_tenant_id, 'Food & Ingredients', '🍕'),
    (v_tenant_id, 'Beverages', '☕'),
    (v_tenant_id, 'Utilities', '💡'),
    (v_tenant_id, 'Rent', '🏠'),
    (v_tenant_id, 'Equipment', '🔧'),
    (v_tenant_id, 'Other', '📌');

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_tenant_signup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_active_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff
    WHERE auth_user_id = auth.uid()
    AND is_active = true
  );
$$;


ALTER FUNCTION "public"."is_active_staff"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_on_discount_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF OLD.discount_type IS DISTINCT FROM NEW.discount_type
    OR OLD.discount_value IS DISTINCT FROM NEW.discount_value THEN
    PERFORM public.calculate_order_total(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."recalculate_on_discount_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_order_total"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  PERFORM public.calculate_order_total(COALESCE(NEW.order_id, OLD.order_id));
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."recalculate_order_total"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_order_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := public.generate_order_number();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_order_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_table_context"("qr_token" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_table_id UUID;
  v_tenant_id UUID;
BEGIN
  SELECT id, tenant_id INTO v_table_id, v_tenant_id
  FROM public.tables WHERE qr_code = qr_token;

  IF v_table_id IS NULL THEN
    RAISE EXCEPTION 'Invalid QR code';
  END IF;

  PERFORM set_config('app.qr_token', qr_token, true);
  PERFORM set_config('app.current_table_id', v_table_id::TEXT, true);
  PERFORM set_config('app.current_tenant_id', v_tenant_id::TEXT, true);
END;
$$;


ALTER FUNCTION "public"."set_table_context"("qr_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transfer_order_items"("p_source_order_id" "uuid", "p_destination_table_id" "uuid", "p_items" "jsonb", "p_staff_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_dest_order_id UUID;
  v_source_table_id UUID;
  v_source_order_status VARCHAR(20);
  v_item RECORD;
  v_source_item RECORD;
  v_remaining_items INTEGER;
BEGIN
  -- Validate source order exists and get its table
  SELECT table_id, status INTO v_source_table_id, v_source_order_status
  FROM public.orders
  WHERE id = p_source_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source order not found';
  END IF;

  IF v_source_order_status IN ('closed', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot transfer items from a closed or cancelled order';
  END IF;

  IF v_source_table_id = p_destination_table_id THEN
    RAISE EXCEPTION 'Cannot transfer to the same table';
  END IF;

  -- Find existing active order on destination table, or create new one
  SELECT id INTO v_dest_order_id
  FROM public.orders
  WHERE table_id = p_destination_table_id
    AND status IN ('new', 'preparing', 'ready', 'served')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_dest_order_id IS NULL THEN
    -- Create new order on destination table
    INSERT INTO public.orders (table_id, order_type, status, assigned_waiter_id)
    VALUES (p_destination_table_id, 'dine_in', 'new', p_staff_id)
    RETURNING id INTO v_dest_order_id;

    -- Occupy destination table
    UPDATE public.tables
    SET
      status = 'occupied',
      current_session_id = v_dest_order_id,
      occupied_at = NOW(),
      updated_at = NOW()
    WHERE id = p_destination_table_id;
  END IF;

  -- Process each item transfer
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(item_id UUID, quantity INTEGER)
  LOOP
    -- Get source item details
    SELECT * INTO v_source_item
    FROM public.order_items
    WHERE id = v_item.item_id
      AND order_id = p_source_order_id
      AND status != 'cancelled';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item % not found in source order or is cancelled', v_item.item_id;
    END IF;

    IF v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Transfer quantity must be positive';
    END IF;

    IF v_item.quantity > v_source_item.quantity THEN
      RAISE EXCEPTION 'Transfer quantity (%) exceeds available quantity (%)',
        v_item.quantity, v_source_item.quantity;
    END IF;

    IF v_item.quantity >= v_source_item.quantity THEN
      -- Transfer entire item: delete from source, create in destination
      DELETE FROM public.order_items WHERE id = v_item.item_id;

      INSERT INTO public.order_items (
        order_id, menu_item_id, item_name, quantity, item_price, notes, status
      ) VALUES (
        v_dest_order_id, v_source_item.menu_item_id, v_source_item.item_name,
        v_source_item.quantity, v_source_item.item_price, v_source_item.notes,
        v_source_item.status
      );
    ELSE
      -- Partial transfer: reduce source quantity, create new in destination
      UPDATE public.order_items
      SET quantity = quantity - v_item.quantity
      WHERE id = v_item.item_id;

      INSERT INTO public.order_items (
        order_id, menu_item_id, item_name, quantity, item_price, notes, status
      ) VALUES (
        v_dest_order_id, v_source_item.menu_item_id, v_source_item.item_name,
        v_item.quantity, v_source_item.item_price, v_source_item.notes,
        v_source_item.status
      );
    END IF;
  END LOOP;

  -- Recalculate totals for both orders
  PERFORM public.calculate_order_total(p_source_order_id);
  PERFORM public.calculate_order_total(v_dest_order_id);

  -- Check if source order has remaining non-cancelled items
  SELECT COUNT(*) INTO v_remaining_items
  FROM public.order_items
  WHERE order_id = p_source_order_id
    AND status != 'cancelled';

  IF v_remaining_items = 0 THEN
    -- All items transferred — cancel source order
    UPDATE public.orders
    SET status = 'cancelled',
        internal_notes = 'All items transferred to another table',
        updated_at = NOW()
    WHERE id = p_source_order_id;

    -- Free source table if no other active orders
    IF NOT EXISTS (
      SELECT 1 FROM public.orders
      WHERE table_id = v_source_table_id
        AND id != p_source_order_id
        AND status IN ('new', 'preparing', 'ready', 'served')
    ) THEN
      UPDATE public.tables
      SET status = 'free',
          current_session_id = NULL,
          updated_at = NOW()
      WHERE id = v_source_table_id;
    END IF;
  END IF;

  -- Log the transfer
  INSERT INTO public.table_transfers (
    order_id, from_table_id, to_table_id, transferred_by, reason
  ) VALUES (
    p_source_order_id, v_source_table_id, p_destination_table_id, p_staff_id, p_reason
  );

  RETURN v_dest_order_id;
END;
$$;


ALTER FUNCTION "public"."transfer_order_items"("p_source_order_id" "uuid", "p_destination_table_id" "uuid", "p_items" "jsonb", "p_staff_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transfer_table"("p_order_id" "uuid", "p_from_table_id" "uuid", "p_to_table_id" "uuid", "p_staff_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_order_status TEXT;
BEGIN
  -- Validate order belongs to source table
  SELECT status INTO v_order_status
  FROM public.orders
  WHERE id = p_order_id AND table_id = p_from_table_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % does not belong to table %', p_order_id, p_from_table_id;
  END IF;

  IF v_order_status = 'closed' OR v_order_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot transfer closed or cancelled order';
  END IF;

  -- Only reject closed tables, allow free/reserved/occupied
  IF EXISTS (
    SELECT 1 FROM public.tables
    WHERE id = p_to_table_id
    AND status = 'closed'
  ) THEN
    RAISE EXCEPTION 'Target table is closed';
  END IF;

  -- Move order to destination table
  UPDATE public.orders
  SET
    table_id = p_to_table_id,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Free source table if no other active orders remain
  IF NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE table_id = p_from_table_id
    AND id != p_order_id
    AND status IN ('new', 'preparing', 'ready', 'served')
  ) THEN
    UPDATE public.tables
    SET
      status = 'free',
      current_session_id = NULL,
      updated_at = NOW()
    WHERE id = p_from_table_id;
  END IF;

  -- Occupy destination table
  UPDATE public.tables
  SET
    status = 'occupied',
    current_session_id = p_order_id,
    occupied_at = NOW(),
    updated_at = NOW()
  WHERE id = p_to_table_id;

  -- Log the transfer
  INSERT INTO public.table_transfers (
    order_id, from_table_id, to_table_id, transferred_by, reason
  ) VALUES (
    p_order_id, p_from_table_id, p_to_table_id, p_staff_id, p_reason
  );

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."transfer_table"("p_order_id" "uuid", "p_from_table_id" "uuid", "p_to_table_id" "uuid", "p_staff_id" "uuid", "p_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."transfer_table"("p_order_id" "uuid", "p_from_table_id" "uuid", "p_to_table_id" "uuid", "p_staff_id" "uuid", "p_reason" "text") IS 'Transfer an order from one table to another';



CREATE OR REPLACE FUNCTION "public"."update_order_payment_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  remaining DECIMAL(10, 2);
  total_paid DECIMAL(10, 2);
  order_table_id UUID;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM public.order_payments
  WHERE order_id = NEW.order_id;

  remaining := public.get_order_remaining_balance(NEW.order_id);

  IF remaining <= 0 THEN
    SELECT table_id INTO order_table_id
    FROM public.orders
    WHERE id = NEW.order_id;

    UPDATE public.orders
    SET
      status = 'closed',
      paid_at = NOW(),
      closed_at = NOW(),
      payment_method = 'split',
      updated_at = NOW()
    WHERE id = NEW.order_id;

    IF order_table_id IS NOT NULL THEN
      UPDATE public.tables
      SET
        status = 'free',
        current_session_id = NULL,
        updated_at = NOW()
      WHERE id = order_table_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_order_payment_status"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_order_payment_status"() IS 'Automatically close order and free table when fully paid (only if no other active orders)';



CREATE OR REPLACE FUNCTION "public"."update_table_status_on_order"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.tables
    SET
      status = 'occupied',
      occupied_at = NOW(),
      current_session_id = NEW.id
    WHERE id = NEW.table_id
      AND status != 'closed';
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'closed' AND OLD.status != 'closed' THEN
    UPDATE public.tables
    SET
      status = 'free',
      current_session_id = NULL
    WHERE id = NEW.table_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_table_status_on_order"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_items_payment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  calculated_amount DECIMAL(10, 2);
BEGIN
  IF NEW.payment_type = 'specific_items' THEN
    IF NEW.order_item_ids IS NULL OR array_length(NEW.order_item_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'order_item_ids must be provided for specific_items payment';
    END IF;

    SELECT COALESCE(SUM(item_price * quantity), 0) INTO calculated_amount
    FROM public.order_items
    WHERE id = ANY(NEW.order_item_ids)
      AND order_id = NEW.order_id
      AND status != 'cancelled';

    IF NEW.amount != calculated_amount THEN
      RAISE EXCEPTION 'Payment amount (%) does not match items total (%)',
        NEW.amount, calculated_amount;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_items_payment"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_items_payment"() IS 'Validate payment amount matches selected items total';



CREATE OR REPLACE FUNCTION "public"."validate_payment_amount"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  remaining_balance DECIMAL(10, 2);
BEGIN
  remaining_balance := public.get_order_remaining_balance(NEW.order_id);

  IF NEW.amount > remaining_balance THEN
    RAISE EXCEPTION 'Payment amount (%) exceeds remaining balance (%)',
      NEW.amount, remaining_balance;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_payment_amount"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_payment_amount"() IS 'Prevent overpayment on orders';



CREATE OR REPLACE FUNCTION "public"."validate_refund_amount"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  total_paid DECIMAL(10, 2);
  total_refunded DECIMAL(10, 2);
  available DECIMAL(10, 2);
BEGIN
  -- Get total paid for this order
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM public.order_payments
  WHERE order_id = NEW.order_id;

  -- Get total already refunded
  SELECT COALESCE(SUM(amount), 0) INTO total_refunded
  FROM public.refunds
  WHERE order_id = NEW.order_id;

  available := total_paid - total_refunded;

  IF NEW.amount > available THEN
    RAISE EXCEPTION 'Refund amount (%) exceeds available amount (%)',
      NEW.amount, available;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_refund_amount"() OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."active_orders_view" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::character varying(15) AS "order_number",
    NULL::character varying(20) AS "status",
    NULL::timestamp with time zone AS "created_at",
    NULL::timestamp with time zone AS "updated_at",
    NULL::character varying(10) AS "table_number",
    NULL::character varying(100) AS "location",
    NULL::character varying(255) AS "waiter_name",
    NULL::bigint AS "item_count",
    NULL::bigint AS "total_quantity",
    NULL::numeric(12,2) AS "total",
    NULL::numeric AS "minutes_elapsed",
    NULL::json AS "items";


ALTER VIEW "public"."active_orders_view" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."cafe_settings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_name" character varying(255) DEFAULT 'Gustri'::character varying NOT NULL,
    "tax_enabled" boolean DEFAULT false NOT NULL,
    "tax_percentage" numeric(5,2) DEFAULT 18.00 NOT NULL,
    "tax_label" character varying(50) DEFAULT 'Tax'::character varying NOT NULL,
    "prices_include_tax" boolean DEFAULT false NOT NULL,
    "show_tax_separately" boolean DEFAULT true NOT NULL,
    "currency_symbol" character varying(10) DEFAULT '₼'::character varying NOT NULL,
    "currency_code" character varying(3) DEFAULT 'AZN'::character varying NOT NULL,
    "currency_position" character varying(10) DEFAULT 'after'::character varying NOT NULL,
    "currency_decimal_places" integer DEFAULT 2 NOT NULL,
    "minimum_order_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "allow_item_notes" boolean DEFAULT true NOT NULL,
    "allow_order_notes" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "cafe_logo_url" "text",
    "hero_image_url" "text",
    "brand_primary_color" character varying(7) DEFAULT '#367B8B'::character varying,
    "brand_secondary_color" character varying(7) DEFAULT '#1E40AF'::character varying,
    "welcome_heading" character varying(255),
    "welcome_message" "text",
    "qr_ordering_enabled" boolean DEFAULT true NOT NULL,
    "contact_phone" character varying(20),
    "contact_website" "text",
    "social_instagram" "text",
    "social_whatsapp" "text",
    "location_maps_url" "text",
    "tips_enabled" boolean DEFAULT false,
    "delivery_enabled" boolean DEFAULT false,
    "delivery_fee_default" numeric(10,2) DEFAULT 0,
    "minimum_delivery_amount" numeric(10,2) DEFAULT 0,
    "delivery_zone_info" "text",
    "waste_tracking_enabled" boolean DEFAULT false NOT NULL,
    "social_tiktok" "text",
    "social_telegram" "text",
    "social_line" "text",
    "restaurant_address" "text",
    "default_language" character varying(5) DEFAULT 'en'::character varying,
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    CONSTRAINT "cafe_settings_currency_position_check" CHECK ((("currency_position")::"text" = ANY ((ARRAY['before'::character varying, 'after'::character varying])::"text"[]))),
    CONSTRAINT "cafe_settings_single_row_check" CHECK (("id" = '00000000-0000-0000-0000-000000000001'::"uuid"))
);


ALTER TABLE "public"."cafe_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."cafe_settings"."tips_enabled" IS 'Enable tip collection during payment';



CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "icon" character varying(50),
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "name" "text" NOT NULL,
    "description" "text",
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."categories" IS 'RLS disabled for development - enable in production';



CREATE TABLE IF NOT EXISTS "public"."customer_feedback" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "table_id" "uuid",
    "order_id" "uuid",
    "feedback_type" character varying(50) NOT NULL,
    "message" "text" NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "responded_by" "uuid",
    "response" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "acknowledged_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    CONSTRAINT "customer_feedback_feedback_type_check" CHECK ((("feedback_type")::"text" = ANY ((ARRAY['complaint'::character varying, 'praise'::character varying])::"text"[]))),
    CONSTRAINT "customer_feedback_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'acknowledged'::character varying, 'resolved'::character varying, 'dismissed'::character varying])::"text"[])))
);


ALTER TABLE "public"."customer_feedback" OWNER TO "postgres";


COMMENT ON TABLE "public"."customer_feedback" IS 'RLS disabled for development - enable in production';



CREATE TABLE IF NOT EXISTS "public"."delivery_customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "address" "text" NOT NULL,
    "notes" "text",
    "order_count" integer DEFAULT 0 NOT NULL,
    "last_order_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL
);


ALTER TABLE "public"."delivery_customers" OWNER TO "postgres";


COMMENT ON TABLE "public"."delivery_customers" IS 'Saved delivery customer profiles for quick order creation';



CREATE TABLE IF NOT EXISTS "public"."expense_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying NOT NULL,
    "description" "text",
    "icon" character varying,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL
);


ALTER TABLE "public"."expense_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid",
    "amount" numeric(12,2) NOT NULL,
    "description" "text" NOT NULL,
    "payment_method" character varying NOT NULL,
    "expense_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "receipt_url" "text",
    "created_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    CONSTRAINT "expenses_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "expenses_payment_method_check" CHECK ((("payment_method")::"text" = ANY ((ARRAY['cash'::character varying, 'card'::character varying, 'digital'::character varying, 'bank_transfer'::character varying])::"text"[])))
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "category_id" "uuid",
    "price" numeric(10,2) NOT NULL,
    "image_url" "text",
    "preparation_time" integer,
    "is_popular" boolean DEFAULT false,
    "is_vegetarian" boolean DEFAULT false,
    "is_vegan" boolean DEFAULT false,
    "is_gluten_free" boolean DEFAULT false,
    "is_spicy" boolean DEFAULT false,
    "allergens" "text"[],
    "is_available" boolean DEFAULT true,
    "is_daily_special" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "name" "text" NOT NULL,
    "description" "text",
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL
);


ALTER TABLE "public"."menu_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."menu_items" IS 'RLS disabled for development - enable in production';



CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "menu_item_id" "uuid" NOT NULL,
    "item_name" character varying(255) NOT NULL,
    "item_price" numeric(12,2) NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "notes" "text",
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    CONSTRAINT "order_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "order_items_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'preparing'::character varying, 'ready'::character varying, 'served'::character varying, 'cancelled'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."order_items" REPLICA IDENTITY FULL;


ALTER TABLE "public"."order_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."order_items" IS 'RLS disabled for development - enable in production';



CREATE TABLE IF NOT EXISTS "public"."order_payments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "received_by" "uuid" NOT NULL,
    "payment_type" character varying(20) NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "payment_method" character varying(20) NOT NULL,
    "order_item_ids" "uuid"[],
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tip_amount" numeric(12,2) DEFAULT 0,
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    CONSTRAINT "order_payments_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "order_payments_payment_method_check" CHECK ((("payment_method")::"text" = ANY ((ARRAY['cash'::character varying, 'card'::character varying, 'digital'::character varying])::"text"[]))),
    CONSTRAINT "order_payments_payment_type_check" CHECK ((("payment_type")::"text" = ANY ((ARRAY['full'::character varying, 'partial_amount'::character varying, 'specific_items'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."order_payments" REPLICA IDENTITY FULL;


ALTER TABLE "public"."order_payments" OWNER TO "postgres";


COMMENT ON TABLE "public"."order_payments" IS 'Realtime enabled for payment tracking';



COMMENT ON COLUMN "public"."order_payments"."order_item_ids" IS 'Array of order_item IDs when payment_type is specific_items';



COMMENT ON COLUMN "public"."order_payments"."tip_amount" IS 'Tip/gratuity amount for this payment';



CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "table_id" "uuid",
    "assigned_waiter_id" "uuid",
    "order_number" character varying(15) NOT NULL,
    "status" character varying(20) DEFAULT 'new'::character varying NOT NULL,
    "subtotal" numeric(12,2) DEFAULT 0 NOT NULL,
    "tax" numeric(12,2) DEFAULT 0 NOT NULL,
    "total" numeric(12,2) DEFAULT 0 NOT NULL,
    "customer_notes" "text",
    "internal_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "preparing_at" timestamp with time zone,
    "ready_at" timestamp with time zone,
    "served_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "payment_method" character varying(20),
    "paid_at" timestamp with time zone,
    "order_type" character varying(20) DEFAULT 'dine_in'::character varying,
    "customer_name" character varying(255),
    "customer_phone" character varying(20),
    "source" character varying(20) DEFAULT 'waiter'::character varying NOT NULL,
    "delivery_address" "text",
    "delivery_fee" numeric(12,2) DEFAULT 0,
    "delivery_notes" "text",
    "estimated_delivery_time" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "delivery_person_id" "uuid",
    "discount_type" character varying(10) DEFAULT 'none'::character varying,
    "discount_value" numeric(10,2) DEFAULT 0,
    "discount_amount" numeric(10,2) DEFAULT 0,
    "discount_reason" "text",
    "discount_applied_by" "uuid",
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    CONSTRAINT "orders_dine_in_table_check" CHECK ((((("order_type")::"text" = 'dine_in'::"text") AND ("table_id" IS NOT NULL)) OR ((("order_type")::"text" = 'takeout'::"text") AND ("table_id" IS NULL)) OR ((("order_type")::"text" = 'delivery'::"text") AND ("table_id" IS NULL)))),
    CONSTRAINT "orders_discount_type_check" CHECK ((("discount_type")::"text" = ANY ((ARRAY['none'::character varying, 'percentage'::character varying, 'fixed'::character varying])::"text"[]))),
    CONSTRAINT "orders_order_type_check" CHECK ((("order_type")::"text" = ANY ((ARRAY['dine_in'::character varying, 'takeout'::character varying, 'delivery'::character varying])::"text"[]))),
    CONSTRAINT "orders_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending_approval'::character varying, 'new'::character varying, 'preparing'::character varying, 'ready'::character varying, 'served'::character varying, 'out_for_delivery'::character varying, 'delivered'::character varying, 'closed'::character varying, 'cancelled'::character varying])::"text"[]))),
    CONSTRAINT "orders_takeout_customer_check" CHECK ((((("order_type")::"text" = 'takeout'::"text") AND ("customer_name" IS NOT NULL) AND ("customer_phone" IS NOT NULL)) OR ((("order_type")::"text" = 'delivery'::"text") AND ("customer_name" IS NOT NULL) AND ("customer_phone" IS NOT NULL)) OR (("order_type")::"text" = 'dine_in'::"text")))
);

ALTER TABLE ONLY "public"."orders" REPLICA IDENTITY FULL;


ALTER TABLE "public"."orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."orders" IS 'Realtime enabled for live kitchen and order updates';



COMMENT ON COLUMN "public"."orders"."order_type" IS 'dine_in or takeout';



COMMENT ON COLUMN "public"."orders"."customer_name" IS 'Required for takeout orders';



COMMENT ON COLUMN "public"."orders"."customer_phone" IS 'Required for takeout orders';



COMMENT ON COLUMN "public"."orders"."source" IS 'Order origin: customer (QR code), waiter (staff), phone (call-in)';



CREATE TABLE IF NOT EXISTS "public"."staff" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" character varying(255) NOT NULL,
    "full_name" character varying(255) NOT NULL,
    "role" character varying(20) NOT NULL,
    "phone" character varying(20),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_login_at" timestamp with time zone,
    "auth_user_id" "uuid",
    "preferred_language" "text" DEFAULT 'en'::"text",
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    CONSTRAINT "staff_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['waiter'::character varying, 'admin'::character varying, 'kitchen'::character varying, 'owner'::character varying])::"text"[])))
);


ALTER TABLE "public"."staff" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."order_payment_summary" WITH ("security_invoker"='on') AS
 SELECT "o"."id" AS "order_id",
    "o"."order_number",
    "o"."total" AS "order_total",
    COALESCE("sum"("op"."amount"), (0)::numeric) AS "paid_amount",
    ("o"."total" - COALESCE("sum"("op"."amount"), (0)::numeric)) AS "remaining_balance",
    "count"("op"."id") AS "payment_count",
    "json_agg"("json_build_object"('payment_id', "op"."id", 'amount', "op"."amount", 'payment_method', "op"."payment_method", 'received_by', "s"."full_name", 'created_at', "op"."created_at") ORDER BY "op"."created_at") FILTER (WHERE ("op"."id" IS NOT NULL)) AS "payments"
   FROM (("public"."orders" "o"
     LEFT JOIN "public"."order_payments" "op" ON (("o"."id" = "op"."order_id")))
     LEFT JOIN "public"."staff" "s" ON (("op"."received_by" = "s"."id")))
  GROUP BY "o"."id", "o"."order_number", "o"."total";


ALTER VIEW "public"."order_payment_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refunds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "processed_by" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "reason" "text" NOT NULL,
    "refund_method" character varying(10) NOT NULL,
    "order_item_ids" "uuid"[],
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    CONSTRAINT "refunds_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "refunds_refund_method_check" CHECK ((("refund_method")::"text" = ANY ((ARRAY['cash'::character varying, 'card'::character varying, 'digital'::character varying])::"text"[])))
);


ALTER TABLE "public"."refunds" OWNER TO "postgres";


COMMENT ON TABLE "public"."refunds" IS 'Refund records for order payments';



CREATE OR REPLACE VIEW "public"."sales_summary_view" WITH ("security_invoker"='on') AS
 SELECT "date"("created_at") AS "date",
    "count"(DISTINCT "id") AS "order_count",
    "sum"("total") AS "total_revenue",
    "avg"("total") AS "average_order_value",
    "count"(DISTINCT "table_id") AS "tables_served",
    "avg"((EXTRACT(epoch FROM ("served_at" - "created_at")) / (60)::numeric)) AS "avg_service_time_minutes"
   FROM "public"."orders"
  WHERE ((("status")::"text" = 'closed'::"text") AND ("closed_at" IS NOT NULL))
  GROUP BY ("date"("created_at"))
  ORDER BY ("date"("created_at")) DESC;


ALTER VIEW "public"."sales_summary_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "planned_start" time without time zone NOT NULL,
    "planned_end" time without time zone NOT NULL,
    "actual_start" timestamp with time zone,
    "actual_end" timestamp with time zone,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    CONSTRAINT "staff_schedules_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'in_progress'::"text", 'completed'::"text", 'missed'::"text"])))
);


ALTER TABLE "public"."staff_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying NOT NULL,
    "description" "text",
    "category" character varying DEFAULT 'General'::character varying NOT NULL,
    "quantity" numeric(12,2) DEFAULT 0 NOT NULL,
    "unit" character varying DEFAULT 'pieces'::character varying NOT NULL,
    "cost_price" numeric(12,2) DEFAULT 0 NOT NULL,
    "minimum_stock_level" numeric(12,2) DEFAULT 0 NOT NULL,
    "supplier_name" character varying,
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL
);


ALTER TABLE "public"."stock_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stock_item_id" "uuid" NOT NULL,
    "movement_type" character varying NOT NULL,
    "quantity_change" numeric(12,2) NOT NULL,
    "quantity_after" numeric(12,2) NOT NULL,
    "reason" "text",
    "performed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    CONSTRAINT "stock_movements_movement_type_check" CHECK ((("movement_type")::"text" = ANY ((ARRAY['in'::character varying, 'out'::character varying, 'adjustment'::character varying])::"text"[])))
);


ALTER TABLE "public"."stock_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."table_transfers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "from_table_id" "uuid" NOT NULL,
    "to_table_id" "uuid" NOT NULL,
    "transferred_by" "uuid" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    CONSTRAINT "different_tables" CHECK (("from_table_id" <> "to_table_id"))
);


ALTER TABLE "public"."table_transfers" OWNER TO "postgres";


COMMENT ON TABLE "public"."table_transfers" IS 'History of table transfers for orders';



CREATE TABLE IF NOT EXISTS "public"."tables" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "table_number" character varying(10) NOT NULL,
    "qr_code" "text" NOT NULL,
    "capacity" integer DEFAULT 4 NOT NULL,
    "status" character varying(20) DEFAULT 'free'::character varying NOT NULL,
    "location" character varying(100),
    "current_session_id" "uuid",
    "occupied_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    CONSTRAINT "tables_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['free'::character varying, 'occupied'::character varying, 'reserved'::character varying, 'closed'::character varying])::"text"[])))
);


ALTER TABLE "public"."tables" OWNER TO "postgres";


COMMENT ON TABLE "public"."tables" IS 'RLS disabled for development - enable in production';



COMMENT ON COLUMN "public"."tables"."notes" IS 'Staff notes about the table or current customers';



CREATE TABLE IF NOT EXISTS "public"."task_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying NOT NULL,
    "icon" character varying,
    "color" character varying(7) DEFAULT '#6B7280'::character varying,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL
);


ALTER TABLE "public"."task_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" character varying NOT NULL,
    "description" "text",
    "category_id" "uuid",
    "priority" character varying DEFAULT 'normal'::character varying NOT NULL,
    "status" character varying DEFAULT 'pending'::character varying NOT NULL,
    "assigned_to" "uuid",
    "created_by" "uuid",
    "due_date" "date",
    "due_time" time without time zone,
    "completed_at" timestamp with time zone,
    "is_recurring" boolean DEFAULT false NOT NULL,
    "recurrence_pattern" character varying,
    "recurrence_days" integer[],
    "parent_task_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    CONSTRAINT "tasks_priority_check" CHECK ((("priority")::"text" = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::"text"[]))),
    CONSTRAINT "tasks_recurrence_pattern_check" CHECK ((("recurrence_pattern")::"text" = ANY ((ARRAY['daily'::character varying, 'weekly'::character varying, 'monthly'::character varying])::"text"[]))),
    CONSTRAINT "tasks_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."tasks" REPLICA IDENTITY FULL;


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "plan" character varying(20) DEFAULT 'free'::character varying NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tenants_plan_check" CHECK ((("plan")::"text" = ANY ((ARRAY['free'::character varying, 'standard'::character varying, 'pro'::character varying, 'business'::character varying])::"text"[])))
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waiter_calls" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "table_id" "uuid" NOT NULL,
    "reason" character varying(50) DEFAULT 'assistance'::character varying,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "responded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "acknowledged_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "notes" "text",
    "call_type" character varying(50) DEFAULT 'assistance'::character varying,
    "priority" character varying(20) DEFAULT 'normal'::character varying,
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    CONSTRAINT "waiter_calls_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'acknowledged'::character varying, 'resolved'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."waiter_calls" REPLICA IDENTITY FULL;


ALTER TABLE "public"."waiter_calls" OWNER TO "postgres";


COMMENT ON TABLE "public"."waiter_calls" IS 'Realtime enabled for live staff notifications';



COMMENT ON COLUMN "public"."waiter_calls"."call_type" IS 'assistance, bill, complaint, question, emergency';



COMMENT ON COLUMN "public"."waiter_calls"."priority" IS 'low, normal, high, urgent';



CREATE TABLE IF NOT EXISTS "public"."waste_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_name" character varying NOT NULL,
    "category" character varying DEFAULT 'General'::character varying NOT NULL,
    "quantity" numeric(12,2) NOT NULL,
    "unit" character varying DEFAULT 'pieces'::character varying NOT NULL,
    "cost_per_unit" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_cost" numeric(12,2) DEFAULT 0 NOT NULL,
    "reason" character varying NOT NULL,
    "stock_item_id" "uuid",
    "notes" "text",
    "logged_by" "uuid",
    "waste_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" DEFAULT "public"."current_tenant_id"() NOT NULL,
    CONSTRAINT "waste_logs_quantity_check" CHECK (("quantity" > (0)::numeric)),
    CONSTRAINT "waste_logs_reason_check" CHECK ((("reason")::"text" = ANY ((ARRAY['expired'::character varying, 'spoiled'::character varying, 'overcooked'::character varying, 'dropped'::character varying, 'returned_by_customer'::character varying, 'preparation_waste'::character varying, 'other'::character varying])::"text"[])))
);


ALTER TABLE "public"."waste_logs" OWNER TO "postgres";


ALTER TABLE ONLY "public"."cafe_settings"
    ADD CONSTRAINT "cafe_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_feedback"
    ADD CONSTRAINT "customer_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_customers"
    ADD CONSTRAINT "delivery_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expense_categories"
    ADD CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_payments"
    ADD CONSTRAINT "order_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_schedules"
    ADD CONSTRAINT "staff_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_items"
    ADD CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_transfers"
    ADD CONSTRAINT "table_transfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tables"
    ADD CONSTRAINT "tables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tables"
    ADD CONSTRAINT "tables_qr_code_key" UNIQUE ("qr_code");



ALTER TABLE ONLY "public"."tables"
    ADD CONSTRAINT "tables_table_number_key" UNIQUE ("table_number");



ALTER TABLE ONLY "public"."task_categories"
    ADD CONSTRAINT "task_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."waiter_calls"
    ADD CONSTRAINT "waiter_calls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waste_logs"
    ADD CONSTRAINT "waste_logs_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_cafe_settings_tenant" ON "public"."cafe_settings" USING "btree" ("tenant_id");



CREATE UNIQUE INDEX "idx_cafe_settings_tenant_unique" ON "public"."cafe_settings" USING "btree" ("tenant_id");



CREATE INDEX "idx_categories_active" ON "public"."categories" USING "btree" ("is_active");



CREATE INDEX "idx_categories_order" ON "public"."categories" USING "btree" ("display_order");



CREATE INDEX "idx_categories_tenant" ON "public"."categories" USING "btree" ("tenant_id");



CREATE INDEX "idx_customer_feedback_created" ON "public"."customer_feedback" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_customer_feedback_status" ON "public"."customer_feedback" USING "btree" ("status");



CREATE INDEX "idx_customer_feedback_table" ON "public"."customer_feedback" USING "btree" ("table_id");



CREATE INDEX "idx_customer_feedback_tenant" ON "public"."customer_feedback" USING "btree" ("tenant_id");



CREATE INDEX "idx_customer_feedback_type" ON "public"."customer_feedback" USING "btree" ("feedback_type");



CREATE INDEX "idx_delivery_customers_name" ON "public"."delivery_customers" USING "btree" ("name");



CREATE INDEX "idx_delivery_customers_phone" ON "public"."delivery_customers" USING "btree" ("phone");



CREATE INDEX "idx_delivery_customers_tenant" ON "public"."delivery_customers" USING "btree" ("tenant_id");



CREATE INDEX "idx_expense_categories_tenant" ON "public"."expense_categories" USING "btree" ("tenant_id");



CREATE INDEX "idx_expenses_category_id" ON "public"."expenses" USING "btree" ("category_id");



CREATE INDEX "idx_expenses_created_by" ON "public"."expenses" USING "btree" ("created_by");



CREATE INDEX "idx_expenses_expense_date" ON "public"."expenses" USING "btree" ("expense_date");



CREATE INDEX "idx_expenses_tenant" ON "public"."expenses" USING "btree" ("tenant_id");



CREATE INDEX "idx_menu_items_available" ON "public"."menu_items" USING "btree" ("is_available");



CREATE INDEX "idx_menu_items_available_order" ON "public"."menu_items" USING "btree" ("is_available", "display_order");



CREATE INDEX "idx_menu_items_category" ON "public"."menu_items" USING "btree" ("category_id");



CREATE INDEX "idx_menu_items_category_available" ON "public"."menu_items" USING "btree" ("category_id", "is_available");



CREATE INDEX "idx_menu_items_order" ON "public"."menu_items" USING "btree" ("display_order");



CREATE INDEX "idx_menu_items_popular" ON "public"."menu_items" USING "btree" ("is_popular");



CREATE INDEX "idx_menu_items_tenant" ON "public"."menu_items" USING "btree" ("tenant_id");



CREATE INDEX "idx_order_items_menu" ON "public"."order_items" USING "btree" ("menu_item_id");



CREATE INDEX "idx_order_items_order" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_order_items_status" ON "public"."order_items" USING "btree" ("status");



CREATE INDEX "idx_order_items_tenant" ON "public"."order_items" USING "btree" ("tenant_id");



CREATE INDEX "idx_order_items_with_notes" ON "public"."order_items" USING "btree" ("order_id") WHERE ("notes" IS NOT NULL);



COMMENT ON INDEX "public"."idx_order_items_with_notes" IS 'Optimize queries for items with special notes';



CREATE INDEX "idx_order_payments_created" ON "public"."order_payments" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_order_payments_order" ON "public"."order_payments" USING "btree" ("order_id");



CREATE INDEX "idx_order_payments_order_created" ON "public"."order_payments" USING "btree" ("order_id", "created_at" DESC);



CREATE INDEX "idx_order_payments_staff" ON "public"."order_payments" USING "btree" ("received_by");



CREATE INDEX "idx_order_payments_tenant" ON "public"."order_payments" USING "btree" ("tenant_id");



CREATE INDEX "idx_orders_created" ON "public"."orders" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_orders_number" ON "public"."orders" USING "btree" ("order_number");



CREATE INDEX "idx_orders_source" ON "public"."orders" USING "btree" ("source");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_orders_status_created" ON "public"."orders" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_orders_table" ON "public"."orders" USING "btree" ("table_id");



CREATE INDEX "idx_orders_table_status" ON "public"."orders" USING "btree" ("table_id", "status");



CREATE INDEX "idx_orders_tenant" ON "public"."orders" USING "btree" ("tenant_id");



CREATE INDEX "idx_orders_type" ON "public"."orders" USING "btree" ("order_type");



CREATE INDEX "idx_orders_waiter" ON "public"."orders" USING "btree" ("assigned_waiter_id");



CREATE INDEX "idx_refunds_created_at" ON "public"."refunds" USING "btree" ("created_at");



CREATE INDEX "idx_refunds_order_id" ON "public"."refunds" USING "btree" ("order_id");



CREATE INDEX "idx_refunds_tenant" ON "public"."refunds" USING "btree" ("tenant_id");



CREATE INDEX "idx_staff_active" ON "public"."staff" USING "btree" ("is_active");



CREATE INDEX "idx_staff_auth_user" ON "public"."staff" USING "btree" ("auth_user_id");



CREATE INDEX "idx_staff_role" ON "public"."staff" USING "btree" ("role");



CREATE INDEX "idx_staff_role_active" ON "public"."staff" USING "btree" ("role", "is_active");



CREATE INDEX "idx_staff_schedules_tenant" ON "public"."staff_schedules" USING "btree" ("tenant_id");



CREATE UNIQUE INDEX "idx_staff_schedules_unique" ON "public"."staff_schedules" USING "btree" ("staff_id", "date", "planned_start");



CREATE INDEX "idx_staff_tenant" ON "public"."staff" USING "btree" ("tenant_id");



CREATE INDEX "idx_stock_items_category" ON "public"."stock_items" USING "btree" ("category");



CREATE INDEX "idx_stock_items_is_active" ON "public"."stock_items" USING "btree" ("is_active");



CREATE INDEX "idx_stock_items_tenant" ON "public"."stock_items" USING "btree" ("tenant_id");



CREATE INDEX "idx_stock_movements_created_at" ON "public"."stock_movements" USING "btree" ("created_at");



CREATE INDEX "idx_stock_movements_item_created" ON "public"."stock_movements" USING "btree" ("stock_item_id", "created_at" DESC);



CREATE INDEX "idx_stock_movements_stock_item_id" ON "public"."stock_movements" USING "btree" ("stock_item_id");



CREATE INDEX "idx_stock_movements_tenant" ON "public"."stock_movements" USING "btree" ("tenant_id");



CREATE INDEX "idx_table_transfers_created" ON "public"."table_transfers" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_table_transfers_from" ON "public"."table_transfers" USING "btree" ("from_table_id");



CREATE INDEX "idx_table_transfers_order" ON "public"."table_transfers" USING "btree" ("order_id");



CREATE INDEX "idx_table_transfers_tenant" ON "public"."table_transfers" USING "btree" ("tenant_id");



CREATE INDEX "idx_table_transfers_to" ON "public"."table_transfers" USING "btree" ("to_table_id");



CREATE INDEX "idx_tables_number" ON "public"."tables" USING "btree" ("table_number");



CREATE INDEX "idx_tables_qr" ON "public"."tables" USING "btree" ("qr_code");



CREATE INDEX "idx_tables_status" ON "public"."tables" USING "btree" ("status");



CREATE INDEX "idx_tables_tenant" ON "public"."tables" USING "btree" ("tenant_id");



CREATE INDEX "idx_task_categories_tenant" ON "public"."task_categories" USING "btree" ("tenant_id");



CREATE INDEX "idx_tasks_assigned_to" ON "public"."tasks" USING "btree" ("assigned_to");



CREATE INDEX "idx_tasks_category" ON "public"."tasks" USING "btree" ("category_id");



CREATE INDEX "idx_tasks_due_date" ON "public"."tasks" USING "btree" ("due_date");



CREATE INDEX "idx_tasks_parent" ON "public"."tasks" USING "btree" ("parent_task_id");



CREATE INDEX "idx_tasks_priority" ON "public"."tasks" USING "btree" ("priority");



CREATE INDEX "idx_tasks_recurring" ON "public"."tasks" USING "btree" ("is_recurring") WHERE ("is_recurring" = true);



CREATE INDEX "idx_tasks_status" ON "public"."tasks" USING "btree" ("status");



CREATE INDEX "idx_tasks_tenant" ON "public"."tasks" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenants_active" ON "public"."tenants" USING "btree" ("is_active");



CREATE INDEX "idx_tenants_slug" ON "public"."tenants" USING "btree" ("slug");



CREATE INDEX "idx_waiter_calls_created" ON "public"."waiter_calls" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_waiter_calls_status" ON "public"."waiter_calls" USING "btree" ("status");



CREATE INDEX "idx_waiter_calls_table" ON "public"."waiter_calls" USING "btree" ("table_id");



CREATE INDEX "idx_waiter_calls_tenant" ON "public"."waiter_calls" USING "btree" ("tenant_id");



CREATE INDEX "idx_waste_logs_date" ON "public"."waste_logs" USING "btree" ("waste_date");



CREATE INDEX "idx_waste_logs_logged_by" ON "public"."waste_logs" USING "btree" ("logged_by");



CREATE INDEX "idx_waste_logs_reason" ON "public"."waste_logs" USING "btree" ("reason");



CREATE INDEX "idx_waste_logs_stock_item" ON "public"."waste_logs" USING "btree" ("stock_item_id");



CREATE INDEX "idx_waste_logs_tenant" ON "public"."waste_logs" USING "btree" ("tenant_id");



CREATE OR REPLACE VIEW "public"."active_orders_view" WITH ("security_invoker"='on') AS
 SELECT "o"."id",
    "o"."order_number",
    "o"."status",
    "o"."created_at",
    "o"."updated_at",
    "t"."table_number",
    "t"."location",
    "s"."full_name" AS "waiter_name",
    "count"("oi"."id") AS "item_count",
    "sum"("oi"."quantity") AS "total_quantity",
    "o"."total",
    (EXTRACT(epoch FROM ("now"() - "o"."created_at")) / (60)::numeric) AS "minutes_elapsed",
    "json_agg"("json_build_object"('item_name', "oi"."item_name", 'quantity', "oi"."quantity", 'notes', "oi"."notes", 'status', "oi"."status") ORDER BY "oi"."created_at") AS "items"
   FROM ((("public"."orders" "o"
     JOIN "public"."tables" "t" ON (("o"."table_id" = "t"."id")))
     LEFT JOIN "public"."staff" "s" ON (("o"."assigned_waiter_id" = "s"."id")))
     LEFT JOIN "public"."order_items" "oi" ON (("o"."id" = "oi"."order_id")))
  WHERE (("o"."status")::"text" = ANY ((ARRAY['new'::character varying, 'preparing'::character varying, 'ready'::character varying])::"text"[]))
  GROUP BY "o"."id", "t"."id", "s"."id"
  ORDER BY "o"."created_at";



CREATE OR REPLACE TRIGGER "auto_acknowledge_feedback_trigger" BEFORE UPDATE ON "public"."customer_feedback" FOR EACH ROW EXECUTE FUNCTION "public"."auto_acknowledge_feedback"();



CREATE OR REPLACE TRIGGER "cascade_order_status_trigger" AFTER UPDATE OF "status" ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."cascade_order_status_to_items"();



CREATE OR REPLACE TRIGGER "enforce_order_limit" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."check_order_limit"();



CREATE OR REPLACE TRIGGER "enforce_table_limit" BEFORE INSERT ON "public"."tables" FOR EACH ROW EXECUTE FUNCTION "public"."check_table_limit"();



CREATE OR REPLACE TRIGGER "recalculate_on_discount_change" AFTER UPDATE OF "discount_type", "discount_value" ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."recalculate_on_discount_change"();



CREATE OR REPLACE TRIGGER "recalculate_on_item_delete" AFTER DELETE ON "public"."order_items" FOR EACH ROW EXECUTE FUNCTION "public"."recalculate_order_total"();



CREATE OR REPLACE TRIGGER "recalculate_on_item_insert" AFTER INSERT ON "public"."order_items" FOR EACH ROW EXECUTE FUNCTION "public"."recalculate_order_total"();



CREATE OR REPLACE TRIGGER "recalculate_on_item_update" AFTER UPDATE ON "public"."order_items" FOR EACH ROW EXECUTE FUNCTION "public"."recalculate_order_total"();



CREATE OR REPLACE TRIGGER "set_order_number_trigger" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_order_number"();



CREATE OR REPLACE TRIGGER "update_cafe_settings_timestamp" BEFORE UPDATE ON "public"."cafe_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_categories_updated_at" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_expenses_updated_at" BEFORE UPDATE ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_menu_items_updated_at" BEFORE UPDATE ON "public"."menu_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_order_items_updated_at" BEFORE UPDATE ON "public"."order_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_order_payment_status_trigger" AFTER INSERT ON "public"."order_payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_order_payment_status"();



CREATE OR REPLACE TRIGGER "update_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_staff_updated_at" BEFORE UPDATE ON "public"."staff" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_stock_items_updated_at" BEFORE UPDATE ON "public"."stock_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_table_on_order" AFTER INSERT OR UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_table_status_on_order"();



CREATE OR REPLACE TRIGGER "update_tables_updated_at" BEFORE UPDATE ON "public"."tables" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tenants_updated_at" BEFORE UPDATE ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "validate_items_payment_trigger" BEFORE INSERT ON "public"."order_payments" FOR EACH ROW EXECUTE FUNCTION "public"."validate_items_payment"();



CREATE OR REPLACE TRIGGER "validate_payment_amount_trigger" BEFORE INSERT ON "public"."order_payments" FOR EACH ROW EXECUTE FUNCTION "public"."validate_payment_amount"();



CREATE OR REPLACE TRIGGER "validate_refund_amount_trigger" BEFORE INSERT ON "public"."refunds" FOR EACH ROW EXECUTE FUNCTION "public"."validate_refund_amount"();



ALTER TABLE ONLY "public"."cafe_settings"
    ADD CONSTRAINT "cafe_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."customer_feedback"
    ADD CONSTRAINT "customer_feedback_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_feedback"
    ADD CONSTRAINT "customer_feedback_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_feedback"
    ADD CONSTRAINT "customer_feedback_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_feedback"
    ADD CONSTRAINT "customer_feedback_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."delivery_customers"
    ADD CONSTRAINT "delivery_customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."expense_categories"
    ADD CONSTRAINT "expense_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."order_payments"
    ADD CONSTRAINT "order_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_payments"
    ADD CONSTRAINT "order_payments_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "public"."staff"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."order_payments"
    ADD CONSTRAINT "order_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_assigned_waiter_id_fkey" FOREIGN KEY ("assigned_waiter_id") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_delivery_person_id_fkey" FOREIGN KEY ("delivery_person_id") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_discount_applied_by_fkey" FOREIGN KEY ("discount_applied_by") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_schedules"
    ADD CONSTRAINT "staff_schedules_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."staff_schedules"
    ADD CONSTRAINT "staff_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."stock_items"
    ADD CONSTRAINT "stock_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."table_transfers"
    ADD CONSTRAINT "table_transfers_from_table_id_fkey" FOREIGN KEY ("from_table_id") REFERENCES "public"."tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_transfers"
    ADD CONSTRAINT "table_transfers_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_transfers"
    ADD CONSTRAINT "table_transfers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."table_transfers"
    ADD CONSTRAINT "table_transfers_to_table_id_fkey" FOREIGN KEY ("to_table_id") REFERENCES "public"."tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_transfers"
    ADD CONSTRAINT "table_transfers_transferred_by_fkey" FOREIGN KEY ("transferred_by") REFERENCES "public"."staff"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."tables"
    ADD CONSTRAINT "tables_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."task_categories"
    ADD CONSTRAINT "task_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."task_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."waiter_calls"
    ADD CONSTRAINT "waiter_calls_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."waiter_calls"
    ADD CONSTRAINT "waiter_calls_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."waiter_calls"
    ADD CONSTRAINT "waiter_calls_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."waste_logs"
    ADD CONSTRAINT "waste_logs_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."waste_logs"
    ADD CONSTRAINT "waste_logs_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."waste_logs"
    ADD CONSTRAINT "waste_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



CREATE POLICY "Admins can create tables" ON "public"."tables" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can delete cafe settings" ON "public"."cafe_settings" FOR DELETE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can delete expense_categories" ON "public"."expense_categories" FOR DELETE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can delete expenses" ON "public"."expenses" FOR DELETE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can delete feedback" ON "public"."customer_feedback" FOR DELETE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can delete menu items" ON "public"."menu_items" FOR DELETE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can delete orders" ON "public"."orders" FOR DELETE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can delete payments" ON "public"."order_payments" FOR DELETE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can delete schedules" ON "public"."staff_schedules" FOR DELETE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can delete stock_items" ON "public"."stock_items" FOR DELETE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can delete stock_movements" ON "public"."stock_movements" FOR DELETE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can delete tables" ON "public"."tables" FOR DELETE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can delete task_categories" ON "public"."task_categories" FOR DELETE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can delete tasks" ON "public"."tasks" FOR DELETE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can delete transfers" ON "public"."table_transfers" FOR DELETE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can delete waste_logs" ON "public"."waste_logs" FOR DELETE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can insert cafe settings" ON "public"."cafe_settings" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can insert expense_categories" ON "public"."expense_categories" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can insert menu items" ON "public"."menu_items" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can insert schedules" ON "public"."staff_schedules" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can insert task_categories" ON "public"."task_categories" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can manage categories" ON "public"."categories" TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can manage menu items" ON "public"."menu_items" TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can manage staff" ON "public"."staff" TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can update cafe settings" ON "public"."cafe_settings" FOR UPDATE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can update expense_categories" ON "public"."expense_categories" FOR UPDATE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can update menu items" ON "public"."menu_items" FOR UPDATE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can update schedules" ON "public"."staff_schedules" FOR UPDATE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Admins can update task_categories" ON "public"."task_categories" FOR UPDATE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "Anon can cancel early-stage orders" ON "public"."orders" FOR UPDATE USING ((("status")::"text" = ANY ((ARRAY['pending_approval'::character varying, 'new'::character varying])::"text"[]))) WITH CHECK ((("status")::"text" = 'cancelled'::"text"));



CREATE POLICY "Anon can cancel pending order items" ON "public"."order_items" FOR UPDATE USING ((("status")::"text" = 'pending'::"text")) WITH CHECK ((("status")::"text" = 'cancelled'::"text"));



CREATE POLICY "Anon can create orders with safe defaults" ON "public"."orders" FOR INSERT WITH CHECK (((("status")::"text" = ANY ((ARRAY['pending_approval'::character varying, 'new'::character varying])::"text"[])) AND (("source")::"text" = 'customer'::"text")));



CREATE POLICY "Anon can create pending feedback" ON "public"."customer_feedback" FOR INSERT WITH CHECK ((("status")::"text" = 'pending'::"text"));



CREATE POLICY "Anon can create pending order items" ON "public"."order_items" FOR INSERT WITH CHECK ((("status")::"text" = 'pending'::"text"));



CREATE POLICY "Anon can create pending waiter calls" ON "public"."waiter_calls" FOR INSERT WITH CHECK ((("status")::"text" = 'pending'::"text"));



CREATE POLICY "Anon can free occupied tables" ON "public"."tables" FOR UPDATE USING ((("status")::"text" = 'occupied'::"text")) WITH CHECK ((("status")::"text" = 'free'::"text"));



CREATE POLICY "Anyone can read cafe settings" ON "public"."cafe_settings" FOR SELECT USING (true);



CREATE POLICY "Anyone can view active tables" ON "public"."tables" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view cafe settings" ON "public"."cafe_settings" FOR SELECT USING (true);



CREATE POLICY "Anyone can view categories" ON "public"."categories" FOR SELECT USING (true);



CREATE POLICY "Anyone can view feedback" ON "public"."customer_feedback" FOR SELECT USING (true);



CREATE POLICY "Anyone can view menu_items" ON "public"."menu_items" FOR SELECT USING (true);



CREATE POLICY "Anyone can view order items" ON "public"."order_items" FOR SELECT USING (true);



CREATE POLICY "Anyone can view order payments" ON "public"."order_payments" FOR SELECT USING (true);



CREATE POLICY "Anyone can view orders" ON "public"."orders" FOR SELECT USING (true);



CREATE POLICY "Anyone can view tables" ON "public"."tables" FOR SELECT USING (true);



CREATE POLICY "Anyone can view waiter calls" ON "public"."waiter_calls" FOR SELECT USING (true);



CREATE POLICY "High priority calls notify all staff" ON "public"."waiter_calls" FOR SELECT TO "authenticated" USING (((("priority")::"text" = ANY ((ARRAY['high'::character varying, 'urgent'::character varying])::"text"[])) OR "public"."is_active_staff"()));



CREATE POLICY "Staff can add order items" ON "public"."order_items" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_staff_role"() = ANY (ARRAY['waiter'::"text", 'admin'::"text", 'owner'::"text"])));



CREATE POLICY "Staff can create orders" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_staff_role"() = ANY (ARRAY['waiter'::"text", 'admin'::"text", 'owner'::"text"])));



CREATE POLICY "Staff can create payments" ON "public"."order_payments" FOR INSERT TO "authenticated" WITH CHECK ((("public"."get_my_staff_role"() = ANY (ARRAY['waiter'::"text", 'admin'::"text", 'owner'::"text"])) AND ("received_by" = "public"."get_my_staff_id"())));



CREATE POLICY "Staff can delete order items" ON "public"."order_items" FOR DELETE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['waiter'::"text", 'admin'::"text", 'owner'::"text"])));



CREATE POLICY "Staff can insert expenses" ON "public"."expenses" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "Staff can insert stock_items" ON "public"."stock_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "Staff can insert stock_movements" ON "public"."stock_movements" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "Staff can insert tasks" ON "public"."tasks" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "Staff can insert waste_logs" ON "public"."waste_logs" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_active_staff"());



CREATE POLICY "Staff can log transfers" ON "public"."table_transfers" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_staff_role"() = ANY (ARRAY['waiter'::"text", 'admin'::"text", 'owner'::"text"])));



CREATE POLICY "Staff can update expenses" ON "public"."expenses" FOR UPDATE TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "Staff can update feedback" ON "public"."customer_feedback" FOR UPDATE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['waiter'::"text", 'admin'::"text", 'owner'::"text"])));



CREATE POLICY "Staff can update order items" ON "public"."order_items" FOR UPDATE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['waiter'::"text", 'admin'::"text", 'kitchen'::"text", 'owner'::"text"])));



CREATE POLICY "Staff can update orders" ON "public"."orders" FOR UPDATE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['waiter'::"text", 'admin'::"text", 'owner'::"text"])));



CREATE POLICY "Staff can update stock_items" ON "public"."stock_items" FOR UPDATE TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "Staff can update stock_movements" ON "public"."stock_movements" FOR UPDATE TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "Staff can update tables" ON "public"."tables" FOR UPDATE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['waiter'::"text", 'admin'::"text", 'owner'::"text"])));



CREATE POLICY "Staff can update tasks" ON "public"."tasks" FOR UPDATE TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "Staff can update waiter calls" ON "public"."waiter_calls" FOR UPDATE TO "authenticated" USING (("public"."get_my_staff_role"() = ANY (ARRAY['waiter'::"text", 'admin'::"text", 'owner'::"text"])));



CREATE POLICY "Staff can update waste_logs" ON "public"."waste_logs" FOR UPDATE TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "Staff can view all feedback" ON "public"."customer_feedback" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "Staff can view all order items" ON "public"."order_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Staff can view all orders" ON "public"."orders" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Staff can view all payments" ON "public"."order_payments" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "Staff can view all staff" ON "public"."staff" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "Staff can view all waiter calls" ON "public"."waiter_calls" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Staff can view expense_categories" ON "public"."expense_categories" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "Staff can view expenses" ON "public"."expenses" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "Staff can view schedules" ON "public"."staff_schedules" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "Staff can view stock_items" ON "public"."stock_items" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "Staff can view stock_movements" ON "public"."stock_movements" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "Staff can view table transfers" ON "public"."table_transfers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."staff"
  WHERE ("staff"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Staff can view task_categories" ON "public"."task_categories" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "Staff can view tasks" ON "public"."tasks" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "Staff can view transfers" ON "public"."table_transfers" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "Staff can view waste_logs" ON "public"."waste_logs" FOR SELECT TO "authenticated" USING ("public"."is_active_staff"());



CREATE POLICY "Users can view their own staff record" ON "public"."staff" FOR SELECT TO "authenticated" USING (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "anon_insert_feedback" ON "public"."customer_feedback" FOR INSERT TO "anon" WITH CHECK (("tenant_id" = ( SELECT "t"."tenant_id"
   FROM "public"."tables" "t"
  WHERE ("t"."id" = "customer_feedback"."table_id"))));



CREATE POLICY "anon_insert_order_items" ON "public"."order_items" FOR INSERT TO "anon" WITH CHECK (("tenant_id" = ( SELECT "o"."tenant_id"
   FROM "public"."orders" "o"
  WHERE ("o"."id" = "order_items"."order_id"))));



CREATE POLICY "anon_insert_orders" ON "public"."orders" FOR INSERT TO "anon" WITH CHECK (((("table_id" IS NOT NULL) AND ("tenant_id" = ( SELECT "t"."tenant_id"
   FROM "public"."tables" "t"
  WHERE ("t"."id" = "orders"."table_id")))) OR (("table_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "orders"."tenant_id"))))));



CREATE POLICY "anon_insert_waiter_calls" ON "public"."waiter_calls" FOR INSERT TO "anon" WITH CHECK (("tenant_id" = ( SELECT "t"."tenant_id"
   FROM "public"."tables" "t"
  WHERE ("t"."id" = "waiter_calls"."table_id"))));



CREATE POLICY "anon_read_cafe_settings" ON "public"."cafe_settings" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_read_categories" ON "public"."categories" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_read_feedback" ON "public"."customer_feedback" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_read_menu_items" ON "public"."menu_items" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_read_order_items" ON "public"."order_items" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_read_orders" ON "public"."orders" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_read_tables" ON "public"."tables" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_read_via_context" ON "public"."order_payments" FOR SELECT TO "anon" USING ((("tenant_id")::"text" = "current_setting"('app.current_tenant_id'::"text", true)));



CREATE POLICY "anon_read_waiter_calls" ON "public"."waiter_calls" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_update_cancel" ON "public"."orders" FOR UPDATE TO "anon" USING (true) WITH CHECK ((("status")::"text" = 'cancelled'::"text"));



ALTER TABLE "public"."cafe_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."delivery_customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expense_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."refunds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_transfers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_isolation" ON "public"."cafe_settings" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."categories" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."customer_feedback" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."delivery_customers" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."expense_categories" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."expenses" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."menu_items" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."order_items" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."order_payments" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."orders" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."refunds" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."staff" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."staff_schedules" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."stock_items" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."stock_movements" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."table_transfers" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."tables" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."task_categories" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."tasks" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."waiter_calls" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_isolation" ON "public"."waste_logs" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_read_own" ON "public"."tenants" FOR SELECT TO "authenticated" USING (("id" = "public"."current_tenant_id"()));



ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."waiter_calls" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."waste_logs" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."order_items";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."order_payments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."orders";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tasks";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."waiter_calls";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";































































































































































GRANT ALL ON FUNCTION "public"."auto_acknowledge_feedback"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_acknowledge_feedback"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_acknowledge_feedback"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_order_total"("order_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_order_total"("order_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_order_total"("order_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cascade_order_status_to_items"() TO "anon";
GRANT ALL ON FUNCTION "public"."cascade_order_status_to_items"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cascade_order_status_to_items"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_order_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_order_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_order_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_table_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_table_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_table_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_order_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_order_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_order_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_staff_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_staff_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_staff_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_staff_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_staff_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_staff_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_order_remaining_balance"("order_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_order_remaining_balance"("order_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_order_remaining_balance"("order_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tenant_plan_from_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_tenant_plan_from_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tenant_plan_from_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_tenant_signup"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_tenant_signup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_tenant_signup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_active_staff"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_active_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_active_staff"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_on_discount_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_on_discount_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_on_discount_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_order_total"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_order_total"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_order_total"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_order_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_table_context"("qr_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_table_context"("qr_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_table_context"("qr_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."transfer_order_items"("p_source_order_id" "uuid", "p_destination_table_id" "uuid", "p_items" "jsonb", "p_staff_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."transfer_order_items"("p_source_order_id" "uuid", "p_destination_table_id" "uuid", "p_items" "jsonb", "p_staff_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transfer_order_items"("p_source_order_id" "uuid", "p_destination_table_id" "uuid", "p_items" "jsonb", "p_staff_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."transfer_table"("p_order_id" "uuid", "p_from_table_id" "uuid", "p_to_table_id" "uuid", "p_staff_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."transfer_table"("p_order_id" "uuid", "p_from_table_id" "uuid", "p_to_table_id" "uuid", "p_staff_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transfer_table"("p_order_id" "uuid", "p_from_table_id" "uuid", "p_to_table_id" "uuid", "p_staff_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_order_payment_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_order_payment_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_order_payment_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_table_status_on_order"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_table_status_on_order"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_table_status_on_order"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_items_payment"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_items_payment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_items_payment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_payment_amount"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_payment_amount"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_payment_amount"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_refund_amount"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_refund_amount"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_refund_amount"() TO "service_role";


















GRANT ALL ON TABLE "public"."active_orders_view" TO "anon";
GRANT ALL ON TABLE "public"."active_orders_view" TO "authenticated";
GRANT ALL ON TABLE "public"."active_orders_view" TO "service_role";



GRANT ALL ON TABLE "public"."cafe_settings" TO "anon";
GRANT ALL ON TABLE "public"."cafe_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."cafe_settings" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."customer_feedback" TO "anon";
GRANT ALL ON TABLE "public"."customer_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_customers" TO "anon";
GRANT ALL ON TABLE "public"."delivery_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_customers" TO "service_role";



GRANT ALL ON TABLE "public"."expense_categories" TO "anon";
GRANT ALL ON TABLE "public"."expense_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_categories" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."menu_items" TO "anon";
GRANT ALL ON TABLE "public"."menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."order_payments" TO "anon";
GRANT ALL ON TABLE "public"."order_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."order_payments" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."staff" TO "anon";
GRANT ALL ON TABLE "public"."staff" TO "authenticated";
GRANT ALL ON TABLE "public"."staff" TO "service_role";



GRANT ALL ON TABLE "public"."order_payment_summary" TO "anon";
GRANT ALL ON TABLE "public"."order_payment_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."order_payment_summary" TO "service_role";



GRANT ALL ON TABLE "public"."refunds" TO "anon";
GRANT ALL ON TABLE "public"."refunds" TO "authenticated";
GRANT ALL ON TABLE "public"."refunds" TO "service_role";



GRANT ALL ON TABLE "public"."sales_summary_view" TO "anon";
GRANT ALL ON TABLE "public"."sales_summary_view" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_summary_view" TO "service_role";



GRANT ALL ON TABLE "public"."staff_schedules" TO "anon";
GRANT ALL ON TABLE "public"."staff_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."stock_items" TO "anon";
GRANT ALL ON TABLE "public"."stock_items" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_items" TO "service_role";



GRANT ALL ON TABLE "public"."stock_movements" TO "anon";
GRANT ALL ON TABLE "public"."stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_movements" TO "service_role";



GRANT ALL ON TABLE "public"."table_transfers" TO "anon";
GRANT ALL ON TABLE "public"."table_transfers" TO "authenticated";
GRANT ALL ON TABLE "public"."table_transfers" TO "service_role";



GRANT ALL ON TABLE "public"."tables" TO "anon";
GRANT ALL ON TABLE "public"."tables" TO "authenticated";
GRANT ALL ON TABLE "public"."tables" TO "service_role";



GRANT ALL ON TABLE "public"."task_categories" TO "anon";
GRANT ALL ON TABLE "public"."task_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."task_categories" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT ALL ON TABLE "public"."waiter_calls" TO "anon";
GRANT ALL ON TABLE "public"."waiter_calls" TO "authenticated";
GRANT ALL ON TABLE "public"."waiter_calls" TO "service_role";



GRANT ALL ON TABLE "public"."waste_logs" TO "anon";
GRANT ALL ON TABLE "public"."waste_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."waste_logs" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

-- Restore search_path so seed.sql can reference tables without schema prefix
RESET search_path;





























