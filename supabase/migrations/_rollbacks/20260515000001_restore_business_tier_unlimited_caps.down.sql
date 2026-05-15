-- Faithful rollback to the pre-fix state (caps = 999 / 999999 for business).
-- Restores the function bodies exactly as 20260430000002 left them. Run only
-- if the fix forward causes an unexpected regression somewhere — the previous
-- state is known to be wrong for any tenant approaching those numbers.

CREATE OR REPLACE FUNCTION public.check_order_limit() RETURNS TRIGGER
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_plan TEXT;
  v_count INT;
  v_max INT;
BEGIN
  SELECT t.plan INTO v_plan FROM public.tenants t WHERE t.id = NEW.tenant_id;

  v_max := CASE COALESCE(v_plan, 'free')
    WHEN 'free' THEN 100
    WHEN 'standard' THEN 700
    WHEN 'pro' THEN 2200
    WHEN 'business' THEN 999999
    ELSE 100
  END;

  SELECT COUNT(*) INTO v_count FROM public.orders
  WHERE tenant_id = NEW.tenant_id
    AND created_at >= date_trunc('month', NOW());

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Monthly order limit reached for % plan (max %)',
      COALESCE(v_plan, 'free'), v_max;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_table_limit() RETURNS TRIGGER
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_plan TEXT;
  v_count INT;
  v_max INT;
BEGIN
  SELECT t.plan INTO v_plan FROM public.tenants t WHERE t.id = NEW.tenant_id;

  v_max := CASE COALESCE(v_plan, 'free')
    WHEN 'free' THEN 5
    WHEN 'standard' THEN 10
    WHEN 'pro' THEN 20
    WHEN 'business' THEN 999
    ELSE 5
  END;

  SELECT COUNT(*) INTO v_count FROM public.tables WHERE tenant_id = NEW.tenant_id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Table limit reached for % plan (max %)',
      COALESCE(v_plan, 'free'), v_max;
  END IF;

  RETURN NEW;
END;
$$;
