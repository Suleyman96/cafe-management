-- Remove Staff Notes feature
-- Drops the staff_notes table, its indexes, and trigger

-- Drop the trigger first
DROP TRIGGER IF EXISTS update_staff_notes_updated_at ON staff_notes;

-- Drop indexes
DROP INDEX IF EXISTS idx_staff_notes_created_at;
DROP INDEX IF EXISTS idx_staff_notes_priority;
DROP INDEX IF EXISTS idx_staff_notes_is_pinned;

-- Drop the table
DROP TABLE IF EXISTS staff_notes;
