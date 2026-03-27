-- Fix: Add user-level RLS policies for monetization tables and feedback.
-- These tables previously only had service_role access, blocking client-side reads.

-- user_subscriptions: authenticated users can read/insert their own records
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_subscriptions' AND policyname = 'auth_own_read') THEN
    EXECUTE 'CREATE POLICY "auth_own_read" ON public.user_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_subscriptions' AND policyname = 'auth_own_insert') THEN
    EXECUTE 'CREATE POLICY "auth_own_insert" ON public.user_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;

-- destination_purchases
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'destination_purchases' AND policyname = 'auth_own_read') THEN
    EXECUTE 'CREATE POLICY "auth_own_read" ON public.destination_purchases FOR SELECT TO authenticated USING (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'destination_purchases' AND policyname = 'auth_own_insert') THEN
    EXECUTE 'CREATE POLICY "auth_own_insert" ON public.destination_purchases FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;

-- destination_trials
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'destination_trials' AND policyname = 'auth_own_read') THEN
    EXECUTE 'CREATE POLICY "auth_own_read" ON public.destination_trials FOR SELECT TO authenticated USING (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'destination_trials' AND policyname = 'auth_own_insert') THEN
    EXECUTE 'CREATE POLICY "auth_own_insert" ON public.destination_trials FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;

-- trip_day_activity_feedback: user can manage own feedback (via trip ownership)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trip_day_activity_feedback' AND policyname = 'auth_own') THEN
    EXECUTE 'CREATE POLICY "auth_own" ON public.trip_day_activity_feedback FOR ALL TO authenticated USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())) WITH CHECK (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()))';
  END IF;
END $$;
