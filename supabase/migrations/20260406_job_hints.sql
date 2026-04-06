-- Add optional user hint fields to jobs table
-- meeting_title_hint: user-provided title from wizard (falls back to AI-extracted title)
-- meeting_date_hint:  user-selected date from wizard (falls back to AI-extracted date)

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS meeting_title_hint TEXT,
  ADD COLUMN IF NOT EXISTS meeting_date_hint  TEXT;
