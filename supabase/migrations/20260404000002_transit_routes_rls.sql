ALTER TABLE transit_routes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'transit_routes_select' AND tablename = 'transit_routes') THEN
    CREATE POLICY transit_routes_select ON transit_routes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'transit_routes_insert' AND tablename = 'transit_routes') THEN
    CREATE POLICY transit_routes_insert ON transit_routes FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'transit_routes_update' AND tablename = 'transit_routes') THEN
    CREATE POLICY transit_routes_update ON transit_routes FOR UPDATE USING (true);
  END IF;
END $$;
GRANT ALL ON transit_routes TO service_role;
GRANT SELECT, INSERT, UPDATE ON transit_routes TO anon;
GRANT SELECT, INSERT, UPDATE ON transit_routes TO authenticated;
