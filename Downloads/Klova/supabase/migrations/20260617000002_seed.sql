-- Klova seed data
-- Static reference tables: zones, services, pricing, addons
-- Amounts stored in kobo (1 NGN = 100 kobo)
-- Prices from MASTER-ROADMAP.md Section 9 (updated 2026-06-17)

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
-- Standard Clean: ₦5k / ₦9.5k / ₦14k / ₦18k
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '1',   500000 from services where slug = 'standard';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '2',   950000 from services where slug = 'standard';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '3',  1400000 from services where slug = 'standard';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '4+', 1800000 from services where slug = 'standard';

-- Deep Clean: ₦18.5k / ₦30k / ₦44k / ₦65k
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '1',  1850000 from services where slug = 'deep';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '2',  3000000 from services where slug = 'deep';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '3',  4400000 from services where slug = 'deep';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '4+', 6500000 from services where slug = 'deep';

-- Move-in / Move-out: ₦40k / ₦56k / ₦74k / ₦90k
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '1',  4000000 from services where slug = 'move-in-move-out';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '2',  5600000 from services where slug = 'move-in-move-out';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '3',  7400000 from services where slug = 'move-in-move-out';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '4+', 9000000 from services where slug = 'move-in-move-out';

-- Post-construction: ₦45k / ₦66k / ₦88k / ₦110k
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '1',   4500000 from services where slug = 'post-construction';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '2',   6600000 from services where slug = 'post-construction';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '3',   8800000 from services where slug = 'post-construction';
insert into pricing (service_id, bedrooms, amount_kobo)
select id, '4+', 11000000 from services where slug = 'post-construction';

-- ─── addons ──────────────────────────────────────────────────────────────────
-- Laundry ₦3.5k · Ironing ₦4.6k · Wardrobe organisation ₦4k
insert into addons (name, slug, amount_kobo) values
  ('Laundry',             'laundry',             350000),
  ('Ironing',             'ironing',             460000),
  ('Wardrobe organising', 'wardrobe-organising', 400000);
