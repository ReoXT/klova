-- Standalone, flat reference list of well-known areas/axis across Lagos
-- State — deliberately decoupled from transport_estimates.
--
-- transport_estimates is a Lekki/Ajah-only fare-corridor matrix: it only
-- makes sense for area pairs Klova actually has advisory fare data for,
-- and the admin always confirms the real fare regardless (see
-- 20260620000002_transport_estimates_helper.sql). It should not double as
-- "the list of places that exist in Lagos".
--
-- This table is that master list instead: a flat set of general areas
-- (Ogombo and Sangotedo sit at the same level as Ikeja or Surulere, not
-- nested under a "Lekki/Ajah" parent) spanning the whole state, so Klova
-- can reuse it for the keeper home-area picker now and the customer-facing
-- site later, without re-deriving location data every time a new zone
-- goes live.
CREATE TABLE IF NOT EXISTS lagos_areas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lagos_areas ENABLE ROW LEVEL SECURITY;
-- No policies: service role bypasses RLS; anon/authenticated get DENY ALL
-- (project-wide pattern — see supabase/migrations/20260617000003_rls.sql).

INSERT INTO lagos_areas (name) VALUES
  -- Lekki / Ajah / Ibeju-Lekki corridor (currently the only live zone)
  ('Lekki Phase 1'), ('Lekki Phase 2'), ('Chevron'), ('Ikate'), ('Agungi'),
  ('VGC'), ('Jakande'), ('Osapa London'), ('Ilasan'), ('Osborne'),
  ('Ajah'), ('Badore'), ('Sangotedo'), ('Awoyaya'), ('Abraham Adesanya'),
  ('Ogombo'), ('Abijo'), ('Eputu'), ('Ibeju-Lekki'),

  -- Lagos Island / Victoria Island / Ikoyi
  ('Lagos Island'), ('Marina'), ('Obalende'), ('Ikoyi'), ('Victoria Island'), ('Oniru'),

  -- Mainland central
  ('Yaba'), ('Ebute Metta'), ('Costain'), ('Iponri'), ('Surulere'),
  ('Ojuelegba'), ('Itire'), ('Aguda'), ('Bariga'), ('Shomolu'),
  ('Gbagada'), ('Palmgrove'), ('Onipanu'), ('Fadeyi'),

  -- Ikeja axis
  ('Ikeja'), ('Ikeja GRA'), ('Opebi'), ('Allen Avenue'), ('Maryland'),
  ('Anthony'), ('Ojota'), ('Ketu'), ('Mile 12'), ('Ogba'),
  ('Omole'), ('Alausa'), ('Magodo'), ('Ojodu'), ('Ojodu Berger'),

  -- Agege / Oshodi / Alimosho axis
  ('Agege'), ('Oshodi'), ('Isolo'), ('Mushin'), ('Ejigbo'),
  ('Okota'), ('Egbeda'), ('Iyana Ipaja'), ('Ipaja'), ('Ayobo'),
  ('Abule Egba'), ('Idimu'), ('Ikotun'), ('Igando'), ('Alimosho'),

  -- Apapa / Festac / Amuwo Odofin axis
  ('Apapa'), ('Ajegunle'), ('Tin Can Island'), ('Festac Town'),
  ('Amuwo Odofin'), ('Satellite Town'), ('Ojo'), ('Okokomaiko'),
  ('Trade Fair'), ('LASU'),

  -- Ikorodu axis
  ('Ikorodu'), ('Igbogbo'), ('Ijede'), ('Owutu'),

  -- Epe axis
  ('Epe'), ('Poka'), ('Eredo'),

  -- Badagry axis
  ('Badagry'), ('Ajara'), ('Topo'), ('Seme')
ON CONFLICT (name) DO NOTHING;
