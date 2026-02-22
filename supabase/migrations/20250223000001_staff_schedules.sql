-- Staff Schedules table for managing staff work schedules
CREATE TABLE staff_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  date DATE NOT NULL,
  planned_start TIME NOT NULL,
  planned_end TIME NOT NULL,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'missed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate schedules for same staff on same date+time
CREATE UNIQUE INDEX idx_staff_schedules_unique
  ON staff_schedules(staff_id, date, planned_start);

-- Enable RLS
ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;

-- Authenticated staff can read all schedules
CREATE POLICY "staff_schedules_select" ON staff_schedules FOR SELECT TO authenticated USING (true);
-- Authenticated staff can insert schedules
CREATE POLICY "staff_schedules_insert" ON staff_schedules FOR INSERT TO authenticated WITH CHECK (true);
-- Authenticated staff can update schedules
CREATE POLICY "staff_schedules_update" ON staff_schedules FOR UPDATE TO authenticated USING (true);
-- Authenticated staff can delete schedules
CREATE POLICY "staff_schedules_delete" ON staff_schedules FOR DELETE TO authenticated USING (true);
