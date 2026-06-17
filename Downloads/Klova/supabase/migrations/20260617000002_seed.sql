-- Klova seed data
-- Static reference tables: zones, services, pricing, addons
-- Amounts stored in kobo (1 NGN = 100 kobo)

-- ─── zones ───────────────────────────────────────────────────────────────────
insert into zones (name, slug, is_active) values
  ('Lekki / Ajah',    'lekki-ajah',      true),
  ('Victoria Island', 'victoria-island',  false),
  ('Ikeja',           'ikeja',            false),
  ('Surulere',        'surulere',         false);

-- ─── services ────────────────────────────────────────────────────────────────
insert into services (name, slug, description) values
  ('Standard Clean',     'standard',          'Regular home cleaning covering all rooms, surfaces, and floors.'),
  ('Deep Clean',         'deep',              'Thorough clean including inside appliances, grout, and hard-to-reach areas.'),
  ('Move-in / Move-out', 'move-in-move-out',  'Full clean for a property being vacated or moved into.'),
  ('Post-construction',  'post-construction', 'Heavy-duty clean after building or renovation work.');

-- ─── pricing ─────────────────────────────────────────────────────────────────
-- Standard Clean: ₦18k / ₦22k / ₦28k / ₦35k
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '1',  1800000 from services where slug = 'standard';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '2',  2200000 from services where slug = 'standard';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '3',  2800000 from services where slug = 'standard';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '4+', 3500000 from services where slug = 'standard';

-- Deep Clean: ₦32k / ₦40k / ₦52k / ₦65k
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '1',  3200000 from services where slug = 'deep';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '2',  4000000 from services where slug = 'deep';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '3',  5200000 from services where slug = 'deep';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '4+', 6500000 from services where slug = 'deep';

-- Move-in / Move-out: ₦45k / ₦55k / ₦70k / ₦85k
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '1',  4500000 from services where slug = 'move-in-move-out';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '2',  5500000 from services where slug = 'move-in-move-out';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '3',  7000000 from services where slug = 'move-in-move-out';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '4+', 8500000 from services where slug = 'move-in-move-out';

-- Post-construction: ₦60k / ₦75k / ₦95k / ₦120k
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '1',   6000000 from services where slug = 'post-construction';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '2',   7500000 from services where slug = 'post-construction';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '3',   9500000 from services where slug = 'post-construction';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '4+', 12000000 from services where slug = 'post-construction';

-- ─── addons ──────────────────────────────────────────────────────────────────
-- Laundry ₦3k · Ironing ₦2k · Wardrobe organising ₦2.5k
insert into addons (name, slug, amount_kobo) values
  ('Laundry',             'laundry',             300000),
  ('Ironing',             'ironing',             200000),
  ('Wardrobe organising', 'wardrobe-organising', 250000);
