-- Migration: Add notes features
-- 1. Add notes column to tables
-- 2. Create staff_notes table for internal communication

-- Add notes column to tables
ALTER TABLE tables ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create staff_notes table
CREATE TABLE IF NOT EXISTS staff_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_staff_notes_created_at ON staff_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_notes_priority ON staff_notes(priority);
CREATE INDEX IF NOT EXISTS idx_staff_notes_is_pinned ON staff_notes(is_pinned);

-- Add trigger to update updated_at
CREATE TRIGGER update_staff_notes_updated_at
    BEFORE UPDATE ON staff_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Disable RLS for staff_notes (following dev pattern)
ALTER TABLE staff_notes DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE staff_notes IS 'Internal staff communication notes/memos';
COMMENT ON COLUMN staff_notes.priority IS 'Note priority: low, normal, high, urgent';
COMMENT ON COLUMN staff_notes.is_pinned IS 'Pinned notes appear at the top';
COMMENT ON COLUMN staff_notes.expires_at IS 'Optional expiration date for the note';
COMMENT ON COLUMN tables.notes IS 'Staff notes about the table or current customers';
