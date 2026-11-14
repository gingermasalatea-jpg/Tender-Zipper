-- =====================================================================
-- TENDER ZIPPER — seed data (cities, categories, Phase 1 templates)
-- =====================================================================

insert into public.cities (name, state, code, slug, is_active) values
  ('Ahmedabad',  'Gujarat', 'AMD', 'ahmedabad',  true),
  ('Gandhinagar','Gujarat', 'GNR', 'gandhinagar', false),
  ('Vadodara',   'Gujarat', 'VAD', 'vadodara',   false),
  ('Surat',      'Gujarat', 'SUR', 'surat',      false)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Sectors (level 1)
-- ---------------------------------------------------------------------
insert into public.categories (level, name, slug, icon, sort) values
  (1, 'Home & Flat',          'home-flat',          'home',      1),
  (1, 'Building & Society',   'building-society',   'building',  2),
  (1, 'Office & Workspace',   'office-workspace',   'briefcase', 3),
  (1, 'Infra & Construction', 'infra-construction', 'hard-hat',  4)
on conflict (slug) do nothing;

-- Categories (level 2)
insert into public.categories (parent_id, level, name, slug, icon, sort)
select s.id, 2, x.name, x.slug, x.icon, x.sort
from (values
  ('home-flat',          'Painting & Finishing', 'painting-finishing', 'paint-roller', 1),
  ('home-flat',          'Electrical',           'electrical',         'zap',          2),
  ('home-flat',          'Plumbing',             'plumbing',           'droplets',     3),
  ('home-flat',          'Carpentry & Interiors','carpentry-interiors','hammer',       4),
  ('building-society',   'Facility Services',    'facility-services',  'shield',       1),
  ('building-society',   'Building Maintenance', 'building-maintenance','wrench',      2),
  ('office-workspace',   'Furniture',            'furniture',          'armchair',     1),
  ('office-workspace',   'Office Setup',         'office-setup',       'monitor',      2),
  ('infra-construction', 'Civil & Energy',       'civil-energy',       'construction', 1)
) as x(sector, name, slug, icon, sort)
join public.categories s on s.slug = x.sector
on conflict (slug) do nothing;

-- Sub-categories (level 3). Only the six with templates are active at launch.
insert into public.categories (parent_id, level, name, slug, icon, tender_type, sort, is_active)
select c.id, 3, x.name, x.slug, x.icon, x.ttype::public.tender_type, x.sort, x.active
from (values
  ('painting-finishing',   'Flat & House Painting',      'house-painting',      'paint-roller', 'ONE_TIME_JOB',       1, true),
  ('painting-finishing',   'Waterproofing',              'waterproofing',       'umbrella',     'ONE_TIME_JOB',       2, false),
  ('electrical',           'Electrical & Wiring Work',   'electrical-wiring',   'zap',          'ONE_TIME_JOB',       1, true),
  ('plumbing',             'Plumbing Work',              'plumbing-work',       'droplets',     'ONE_TIME_JOB',       1, true),
  ('carpentry-interiors',  'Modular Kitchen',            'modular-kitchen',     'chef-hat',     'PROJECT',            1, false),
  ('facility-services',    'Housekeeping Services',      'housekeeping',        'sparkles',     'RECURRING_CONTRACT', 1, true),
  ('facility-services',    'Security Guard Services',    'security-guards',     'shield',       'RECURRING_CONTRACT', 2, true),
  ('facility-services',    'Water Tanker Supply',        'water-tanker',        'truck',        'RECURRING_CONTRACT', 3, false),
  ('building-maintenance', 'Lift AMC',                   'lift-amc',            'arrow-up-down','RECURRING_CONTRACT', 1, false),
  ('building-maintenance', 'Building Exterior Painting', 'building-painting',   'paint-bucket', 'PROJECT',            2, false),
  ('building-maintenance', 'CCTV & Intercom',            'cctv-intercom',       'cctv',         'SUPPLY',             3, false),
  ('furniture',            'Furniture Supply',           'furniture-supply',    'armchair',     'SUPPLY',             1, true),
  ('office-setup',         'Office Fit-out',             'office-fitout',       'layout',       'PROJECT',            1, false),
  ('office-setup',         'AC Installation & AMC',      'ac-amc',              'air-vent',     'RECURRING_CONTRACT', 2, false),
  ('civil-energy',         'Civil Work',                 'civil-work',          'construction', 'PROJECT',            1, false),
  ('civil-energy',         'Rooftop Solar',              'rooftop-solar',       'sun',          'PROJECT',            2, false)
) as x(cat, name, slug, icon, ttype, sort, active)
join public.categories c on c.slug = x.cat
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------
insert into public.category_templates (category_id, form_schema, quote_schema, required_vendor_docs, max_quotes)
select c.id, x.form::jsonb, x.quote::jsonb, x.docs, x.maxq
from (values
-- 1. House painting ---------------------------------------------------
('house-painting',
$${"fields": [
  {"key": "property_type", "label": "Property type", "type": "select", "required": true,
   "options": ["1 BHK flat", "2 BHK flat", "3 BHK flat", "4+ BHK flat", "Bungalow / Row house", "Shop", "Office"]},
  {"key": "scope", "label": "What needs painting?", "type": "select", "required": true,
   "options": ["Interior walls & ceiling", "Exterior walls", "Interior + Exterior", "Only selected rooms"]},
  {"key": "area_sqft", "label": "Approx. paintable area", "type": "number", "unit": "sq ft", "required": true,
   "help": "Rough rule: carpet area × 3.5 for walls + ceiling"},
  {"key": "rooms", "label": "Number of rooms", "type": "number"},
  {"key": "surface_condition", "label": "Wall condition", "type": "select", "required": true,
   "options": ["New plaster (first paint)", "Repaint – walls in good condition", "Repaint – dampness / peeling"]},
  {"key": "paint_tier", "label": "Paint quality", "type": "select", "required": true,
   "options": ["Economy (distemper / basic emulsion)", "Premium emulsion", "Luxury emulsion"]},
  {"key": "preferred_brand", "label": "Preferred brand (optional)", "type": "text"},
  {"key": "putty_required", "label": "Putty work required", "type": "boolean"},
  {"key": "furniture_moving", "label": "Vendor to move & cover furniture", "type": "boolean"}
]}$$,
$${"gst_default": 18, "allow_custom_items": true,
  "line_items": [
    {"key": "putty", "label": "Surface preparation & putty", "unit": "sq ft", "qty_from": "area_sqft"},
    {"key": "primer", "label": "Primer coat", "unit": "sq ft", "qty_from": "area_sqft"},
    {"key": "paint", "label": "Paint – 2 coats (material + labour)", "unit": "sq ft", "qty_from": "area_sqft"},
    {"key": "furniture", "label": "Furniture moving, covering & cleanup", "unit": "lot", "qty": 1}
  ],
  "extra_fields": [
    {"key": "paint_product", "label": "Paint brand & product you will use", "type": "text", "required": true},
    {"key": "coats", "label": "Number of coats", "type": "number"}
  ]}$$,
'{}'::text[], 10),

-- 2. Electrical -------------------------------------------------------
('electrical-wiring',
$${"fields": [
  {"key": "work_type", "label": "Type of work", "type": "select", "required": true,
   "options": ["New wiring (new property)", "Full rewiring", "Add new points", "Repair / fault finding", "DB & MCB upgrade"]},
  {"key": "property_type", "label": "Property type", "type": "select", "required": true,
   "options": ["Flat", "Bungalow / Row house", "Shop", "Office", "Society common area"]},
  {"key": "points", "label": "Approx. number of points", "type": "number", "unit": "points", "required": true,
   "help": "Each switch, socket, light or fan outlet is one point"},
  {"key": "load_kw", "label": "Sanctioned load (if known)", "type": "number", "unit": "kW"},
  {"key": "wiring_style", "label": "Wiring style", "type": "select", "options": ["Concealed", "Surface conduit", "Not sure"]},
  {"key": "wire_brand", "label": "Preferred wire brand (optional)", "type": "text"},
  {"key": "db_mcb", "label": "New distribution board / MCBs needed", "type": "boolean"}
]}$$,
$${"gst_default": 18, "allow_custom_items": true,
  "line_items": [
    {"key": "points", "label": "Wiring per point (material + labour)", "unit": "point", "qty_from": "points"},
    {"key": "db", "label": "Distribution board with MCBs", "unit": "set", "qty": 1},
    {"key": "chasing", "label": "Wall chasing & patch repair", "unit": "lot", "qty": 1}
  ],
  "extra_fields": [
    {"key": "wire_brand", "label": "Wire & switch brand you will use", "type": "text", "required": true},
    {"key": "licence_no", "label": "Electrical contractor licence no. (if any)", "type": "text"}
  ]}$$,
'{}'::text[], 10),

-- 3. Plumbing ---------------------------------------------------------
('plumbing-work',
$${"fields": [
  {"key": "work_type", "label": "Type of work", "type": "select", "required": true,
   "options": ["New plumbing line", "Leakage repair", "Bathroom fittings replacement", "Water tank & pump", "Drainage / blockage"]},
  {"key": "bathrooms", "label": "Number of bathrooms involved", "type": "number"},
  {"key": "kitchen", "label": "Kitchen included", "type": "boolean"},
  {"key": "pipe_material", "label": "Pipe material", "type": "select", "options": ["CPVC", "UPVC", "PPR", "GI", "Not sure"]},
  {"key": "fixtures_by", "label": "Fixtures (taps, sanitaryware) supplied by", "type": "select", "options": ["Vendor", "Me (buyer)"]},
  {"key": "details", "label": "Describe the problem / requirement", "type": "textarea", "required": true}
]}$$,
$${"gst_default": 18, "allow_custom_items": true,
  "line_items": [
    {"key": "points", "label": "Plumbing points (material + labour)", "unit": "point"},
    {"key": "fixtures", "label": "Fixture installation", "unit": "nos"},
    {"key": "repair", "label": "Repair / leakage work", "unit": "lot", "qty": 1}
  ],
  "extra_fields": [
    {"key": "pipe_brand", "label": "Pipe & fitting brand you will use", "type": "text"}
  ]}$$,
'{}'::text[], 10),

-- 4. Housekeeping -----------------------------------------------------
('housekeeping',
$${"fields": [
  {"key": "premises_type", "label": "Premises type", "type": "select", "required": true,
   "options": ["Residential society", "Office", "Commercial complex", "School / College", "Hospital / Clinic", "Factory"]},
  {"key": "built_up_sqft", "label": "Total area to maintain", "type": "number", "unit": "sq ft", "required": true},
  {"key": "floors", "label": "Number of floors / towers", "type": "text"},
  {"key": "staff_count", "label": "Housekeeping staff required", "type": "number", "unit": "persons", "required": true},
  {"key": "supervisor", "label": "Supervisor required", "type": "boolean"},
  {"key": "shift_hours", "label": "Shift length", "type": "select", "options": ["8 hours", "12 hours"], "required": true},
  {"key": "days_per_week", "label": "Days per week", "type": "select", "options": ["6 days", "7 days"], "required": true},
  {"key": "materials_included", "label": "Cleaning materials to be supplied by vendor", "type": "boolean"},
  {"key": "contract_months", "label": "Contract duration", "type": "number", "unit": "months", "required": true}
]}$$,
$${"gst_default": 18, "period_label": "per month", "allow_custom_items": true,
  "line_items": [
    {"key": "staff", "label": "Housekeeping staff", "unit": "person/month", "qty_from": "staff_count"},
    {"key": "supervisor", "label": "Supervisor", "unit": "person/month"},
    {"key": "materials", "label": "Cleaning materials & consumables", "unit": "month", "qty": 1}
  ],
  "extra_fields": [
    {"key": "pf_esi", "label": "Minimum wages, PF & ESI included in rate", "type": "boolean", "required": true},
    {"key": "replacement_hours", "label": "Absent staff replacement within", "type": "number", "unit": "hours"}
  ]}$$,
array['gst', 'labour_licence', 'pf_esi'], 8),

-- 5. Security guards --------------------------------------------------
('security-guards',
$${"fields": [
  {"key": "site_type", "label": "Site type", "type": "select", "required": true,
   "options": ["Residential society", "Office", "Factory / Warehouse", "Shop / Showroom", "School / College", "Construction site"]},
  {"key": "guards_day", "label": "Guards – day shift", "type": "number", "unit": "guards", "required": true},
  {"key": "guards_night", "label": "Guards – night shift", "type": "number", "unit": "guards", "required": true},
  {"key": "shift_hours", "label": "Shift length", "type": "select", "options": ["8 hours", "12 hours"], "required": true},
  {"key": "supervisor", "label": "Field supervisor required", "type": "boolean"},
  {"key": "armed", "label": "Armed guard required", "type": "boolean"},
  {"key": "lady_guard", "label": "Lady guard required", "type": "boolean"},
  {"key": "contract_months", "label": "Contract duration", "type": "number", "unit": "months", "required": true}
]}$$,
$${"gst_default": 18, "period_label": "per month", "allow_custom_items": true,
  "line_items": [
    {"key": "day", "label": "Security guard – day shift", "unit": "guard/month", "qty_from": "guards_day"},
    {"key": "night", "label": "Security guard – night shift", "unit": "guard/month", "qty_from": "guards_night"},
    {"key": "supervisor", "label": "Field supervisor", "unit": "person/month"},
    {"key": "equipment", "label": "Uniform, torch, baton & registers", "unit": "month", "qty": 1}
  ],
  "extra_fields": [
    {"key": "psara_no", "label": "PSARA licence number", "type": "text", "required": true},
    {"key": "pf_esi", "label": "Minimum wages, PF & ESI included in rate", "type": "boolean", "required": true}
  ]}$$,
array['psara_licence', 'gst', 'pf_esi'], 8),

-- 6. Furniture supply -------------------------------------------------
('furniture-supply',
$${"fields": [
  {"key": "items", "label": "Items required", "type": "items", "required": true,
   "columns": [
     {"key": "item", "label": "Item", "placeholder": "Office chair"},
     {"key": "spec", "label": "Material / size / spec", "placeholder": "Mesh back, revolving"},
     {"key": "qty", "label": "Qty", "type": "number"}
   ]},
  {"key": "usage", "label": "For", "type": "select", "options": ["Home", "Office", "School / Institute", "Hotel / Restaurant", "Hospital"]},
  {"key": "delivery_by", "label": "Delivery needed by", "type": "date"},
  {"key": "installation", "label": "Installation / assembly required", "type": "boolean"},
  {"key": "samples", "label": "Want to see samples before order", "type": "boolean"}
]}$$,
$${"gst_default": 18, "allow_custom_items": true, "items_from": "items",
  "line_items": [
    {"key": "delivery", "label": "Delivery charges", "unit": "lot", "qty": 1},
    {"key": "installation", "label": "Installation / assembly", "unit": "lot", "qty": 1}
  ],
  "extra_fields": [
    {"key": "brand_models", "label": "Brand / model details", "type": "textarea", "required": true},
    {"key": "delivery_days", "label": "Delivery within", "type": "number", "unit": "days"}
  ]}$$,
array['gst'], 10)
) as x(slug, form, quote, docs, maxq)
join public.categories c on c.slug = x.slug
on conflict (category_id) do nothing;

-- To make yourself admin after first login:
--   update public.profiles set is_admin = true where phone = '+91XXXXXXXXXX';
