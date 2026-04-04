CREATE TABLE IF NOT EXISTS transit_routes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  origin_lat double precision NOT NULL,
  origin_lng double precision NOT NULL,
  dest_lat double precision NOT NULL,
  dest_lng double precision NOT NULL,
  origin_name text,
  dest_name text,
  city text NOT NULL,
  -- Route data
  total_distance_meters integer,
  total_duration_seconds integer,
  polyline text, -- encoded polyline
  -- Structured steps
  steps jsonb NOT NULL, -- array of {travelMode, startLocation, endLocation, polyline, distance, duration, transitDetails?}
  -- Transit details extracted for quick queries
  transit_lines jsonb, -- array of {lineName, lineShort, vehicle, color, textColor, agency, departureStop, arrivalStop, stopCount, headsign}
  -- Cache metadata
  fetched_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  cache_key text UNIQUE NOT NULL, -- for quick lookups: "{originLat4},{originLng4}->{destLat4},{destLng4}"
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transit_routes_city ON transit_routes(city);
CREATE INDEX IF NOT EXISTS idx_transit_routes_cache_key ON transit_routes(cache_key);
CREATE INDEX IF NOT EXISTS idx_transit_routes_expires ON transit_routes(expires_at);

-- RLS policies
ALTER TABLE transit_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY transit_routes_select ON transit_routes FOR SELECT USING (true);
CREATE POLICY transit_routes_insert ON transit_routes FOR INSERT WITH CHECK (true);
CREATE POLICY transit_routes_update ON transit_routes FOR UPDATE USING (true);

-- Grant permissions
GRANT ALL ON transit_routes TO service_role;
GRANT SELECT, INSERT, UPDATE ON transit_routes TO anon;
GRANT SELECT, INSERT, UPDATE ON transit_routes TO authenticated;
