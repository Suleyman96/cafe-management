-- Fix generate_order_number function return type
-- The function generates 'ORD' + YYMMDD (6) + counter (3) = 12 chars
-- But was returning VARCHAR(10), causing insert failures

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR(15) AS $$
DECLARE
  new_number VARCHAR(15);
  counter INTEGER;
BEGIN
  SELECT COUNT(*) INTO counter
  FROM orders
  WHERE DATE(created_at) = CURRENT_DATE;

  new_number := 'ORD' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || LPAD((counter + 1)::TEXT, 3, '0');

  RETURN new_number;
END;
$$ LANGUAGE plpgsql;
