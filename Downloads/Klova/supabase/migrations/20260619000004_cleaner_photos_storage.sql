-- Cleaner photos storage bucket (public so URLs work without tokens)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cleaner-photos',
  'cleaner-photos',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Optional home address for operational reference
ALTER TABLE public.cleaners ADD COLUMN IF NOT EXISTS address TEXT;
