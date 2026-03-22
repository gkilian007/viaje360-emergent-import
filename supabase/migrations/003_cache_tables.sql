-- Cache tables for places and weather results
-- TTL: places = 7 days, weather = 1 hour

CREATE TABLE IF NOT EXISTS places_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text UNIQUE NOT NULL,
  location text NOT NULL,
  query text NOT NULL,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider text NOT NULL DEFAULT 'gemini',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX idx_places_cache_key ON places_cache(cache_key);
CREATE INDEX idx_places_cache_expires ON places_cache(expires_at);

CREATE TABLE IF NOT EXISTS weather_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text UNIQUE NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  forecast jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour')
);

CREATE INDEX idx_weather_cache_key ON weather_cache(cache_key);
CREATE INDEX idx_weather_cache_expires ON weather_cache(expires_at);

-- Cleanup function to purge expired entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM places_cache WHERE expires_at < now();
  DELETE FROM weather_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;
