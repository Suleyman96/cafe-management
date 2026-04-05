-- Simplify feedback types: reduce 6 types to 2 (complaint + praise)
-- Migrate existing data before updating the constraint

-- 1. Migrate existing feedback_type values
UPDATE customer_feedback
SET feedback_type = 'complaint'
WHERE feedback_type IN ('complaint_food', 'complaint_service', 'complaint_staff', 'question_menu', 'request_general');

-- 2. Drop old CHECK constraint and add new one
ALTER TABLE customer_feedback DROP CONSTRAINT IF EXISTS customer_feedback_feedback_type_check;
ALTER TABLE customer_feedback ADD CONSTRAINT customer_feedback_feedback_type_check
  CHECK (feedback_type IN ('complaint', 'praise'));

-- 3. Drop subject column (no longer used)
ALTER TABLE customer_feedback DROP COLUMN IF EXISTS subject;
