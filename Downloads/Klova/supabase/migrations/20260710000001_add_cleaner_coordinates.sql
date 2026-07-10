-- Add WGS-84 decimal-degree coordinates to cleaners.
-- Nullable so existing rows are unaffected.
-- Used for distance-based transport estimates (replaces text home_area lookup).
ALTER TABLE cleaners
  ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

COMMENT ON COLUMN cleaners.latitude  IS 'WGS-84 decimal degrees. Used for distance-based transport estimates.';
COMMENT ON COLUMN cleaners.longitude IS 'WGS-84 decimal degrees. Used for distance-based transport estimates.';
