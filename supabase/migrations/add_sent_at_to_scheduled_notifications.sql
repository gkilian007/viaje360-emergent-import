-- Migration: add sent_at column to scheduled_notifications
-- Tracks when a notification was actually delivered by the cron worker.

DO $$ BEGIN
  ALTER TABLE public.scheduled_notifications ADD COLUMN sent_at timestamptz;
EXCEPTION WHEN duplicate_column THEN
  NULL;
END $$;
