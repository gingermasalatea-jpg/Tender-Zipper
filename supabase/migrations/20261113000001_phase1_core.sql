-- =====================================================================
-- TENDER ZIPPER — Phase 1 core schema
-- Post tender -> vendors quote -> buyer compares, shortlists, awards.
-- Zero commission: no job money is handled by the platform.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.user_role         as enum ('buyer', 'vendor');
create type public.vendor_type       as enum ('individual', 'agency');
create type public.tender_type       as enum ('ONE_TIME_JOB', 'RECURRING_CONTRACT', 'SUPPLY', 'PROJECT');
create type public.tender_status     as enum ('open', 'closed', 'awarded', 'completed', 'cancelled');
create type public.tender_visibility as enum ('open', 'invite');
create type public.quote_status      as enum ('draft', 'submitted', 'withdrawn', 'shortlisted', 'awarded', 'rejected');
create type public.doc_status        as enum ('pending', 'verified', 'rejected');
create type public.contract_status   as enum ('active', 'completed', 'cancelled');

-- ---------------------------------------------------------------------
-- Users / profiles
-- ---------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  phone        text,
  email        text,
  full_name    text,
  active_role  public.user_role,
  is_admin     boolean not null default false,
  language     text not null default 'en' check (language in ('en', 'hi', 'gu')),
  created_at   timestamptz not null default now()
);

-- Create a profile automatically for every new auth user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone, email, full_name)
  values (new.id, new.phone, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', null))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Users cannot make themselves admin
create or replace function public.protect_profile_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_admin is distinct from old.is_admin and not public.is_admin() and auth.uid() is not null then
    raise exception 'Not allowed to change admin flag';
  end if;
  return new;
end $$;

create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ---------------------------------------------------------------------
-- Master data: cities, categories, templates
-- ---------------------------------------------------------------------
create table public.cities (
  id         serial primary key,
  name       text not null,
  state      text not null,
  code       text not null unique,          -- used in tender codes, e.g. AMD
  slug       text not null unique,
  is_active  boolean not null default false
);

-- level 1 = sector, 2 = category, 3 = sub-category (tenders attach to level 3)
create table public.categories (
  id          serial primary key,
  parent_id   int references public.categories (id) on delete cascade,
  level       smallint not null check (level between 1 and 3),
  name        text not null,
  slug        text not null unique,
  icon        text,
  tender_type public.tender_type,
  sort        int not null default 0,
  is_active   boolean not null default true,
  check ((level = 3) = (tender_type is not null))
);

-- form_schema  : { "fields": [ { key, label, type, unit?, options?, required?, help? } ] }
--   field types: text | textarea | number | select | multiselect | boolean | date | items
-- quote_schema : { "period_label"?: "per month", "gst_default": 18,
--                  "line_items": [ { key, label, unit, qty_from? } ],
--                  "allow_custom_items": true, "extra_fields": [ ...same shape as form fields ] }
create table public.category_templates (
  id                    serial primary key,
  category_id           int not null unique references public.categories (id) on delete cascade,
  form_schema           jsonb not null default '{"fields": []}',
  quote_schema          jsonb not null default '{"line_items": [], "allow_custom_items": true}',
  required_vendor_docs  text[] not null default '{}',
  max_quotes            int not null default 10 check (max_quotes between 1 and 50),
  version               int not null default 1,
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Vendors
-- ---------------------------------------------------------------------
create table public.vendors (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null unique references public.profiles (id) on delete cascade,
  type                public.vendor_type not null default 'individual',
  business_name       text not null,
  gstin               text,
  about               text,
  years_experience    int check (years_experience >= 0),
  team_size           int check (team_size >= 0),
  city_id             int references public.cities (id),
  verification_level  smallint not null default 0,   -- 0 = unverified, 1 = documents verified
  is_suspended        boolean not null default false,
  created_at          timestamptz not null default now()
);

create table public.vendor_categories (
  vendor_id    uuid references public.vendors (id) on delete cascade,
  category_id  int  references public.categories (id) on delete cascade,
  primary key (vendor_id, category_id)
);

-- pincode null => vendor serves the whole city
create table public.vendor_service_areas (
  id         serial primary key,
  vendor_id  uuid not null references public.vendors (id) on delete cascade,
  city_id    int  not null references public.cities (id),
  pincode    text check (pincode ~ '^[1-9][0-9]{5}$'),
  unique nulls not distinct (vendor_id, city_id, pincode)
);

create table public.vendor_documents (
  id           uuid primary key default gen_random_uuid(),
  vendor_id    uuid not null references public.vendors (id) on delete cascade,
  doc_type     text not null,                    -- gst, pan, aadhaar, psara, labour_licence ...
  file_path    text not null,                    -- path inside private bucket vendor-docs
  status       public.doc_status not null default 'pending',
  review_note  text,
  reviewed_by  uuid references public.profiles (id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- Vendors may not change their own verification/suspension
create or replace function public.protect_vendor_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_admin() and auth.uid() is not null then
    new.verification_level := old.verification_level;
    new.is_suspended       := old.is_suspended;
  end if;
  return new;
end $$;

create trigger vendors_protect before update on public.vendors
  for each row execute function public.protect_vendor_fields();

create or replace function public.my_vendor_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.vendors where owner_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- Tenders
-- ---------------------------------------------------------------------
create sequence public.tender_code_seq start 1;

create table public.tenders (
  id                  uuid primary key default gen_random_uuid(),
  code                text unique,
  buyer_id            uuid not null references public.profiles (id) on delete cascade,
  category_id         int  not null references public.categories (id),
  tender_type         public.tender_type,
  title               text not null check (char_length(title) between 5 and 140),
  description         text,
  form_data           jsonb not null default '{}',
  budget_min          numeric(14,2) check (budget_min >= 0),
  budget_max          numeric(14,2) check (budget_max >= 0),
  budget_visible      boolean not null default false,
  city_id             int not null references public.cities (id),
  pincode             text check (pincode ~ '^[1-9][0-9]{5}$'),
  area_label          text,                                -- shown to vendors, e.g. "Bopal"
  address             text,                                -- private until shortlist
  lat                 double precision,
  lng                 double precision,
  visibility          public.tender_visibility not null default 'open',
  status              public.tender_status not null default 'open',
  quote_deadline      timestamptz not null default (now() + interval '72 hours'),
  start_date          date,
  site_visit_allowed  boolean not null default false,
  max_quotes          int,
  quote_count         int not null default 0,
  is_flagged          boolean not null default false,
  flag_reason         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (budget_max is null or budget_min is null or budget_max >= budget_min)
);

create index tenders_feed_idx on public.tenders (status, city_id, category_id, quote_deadline);
create index tenders_buyer_idx on public.tenders (buyer_id, created_at desc);

create table public.tender_media (
  id          uuid primary key default gen_random_uuid(),
  tender_id   uuid not null references public.tenders (id) on delete cascade,
  file_path   text not null,                 -- path inside public bucket tender-media
  media_type  text not null default 'image',
  created_at  timestamptz not null default now()
);

create table public.tender_invites (
  tender_id  uuid references public.tenders (id) on delete cascade,
  vendor_id  uuid references public.vendors (id) on delete cascade,
  primary key (tender_id, vendor_id)
);

-- Fill code, tender type and quote cap; guard the fields buyers may change
create or replace function public.tenders_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_city_code text;
  v_type      public.tender_type;
  v_level     smallint;
  v_max       int;
begin
  if tg_op = 'INSERT' then
    select level, tender_type into v_level, v_type from public.categories where id = new.category_id and is_active;
    if v_level is distinct from 3 then
      raise exception 'Tender must use an active sub-category';
    end if;
    if not exists (select 1 from public.cities where id = new.city_id and is_active) and not public.is_admin() then
      raise exception 'Tender Zipper is not live in this city yet';
    end if;
    if new.quote_deadline < now() + interval '1 hour' then
      raise exception 'Quote deadline must be at least 1 hour from now';
    end if;
    select code into v_city_code from public.cities where id = new.city_id;
    select max_quotes into v_max from public.category_templates where category_id = new.category_id;
    new.code        := 'TZ-' || v_city_code || '-' || lpad(nextval('public.tender_code_seq')::text, 6, '0');
    new.tender_type := v_type;
    new.max_quotes  := coalesce(v_max, 10);
    new.status      := 'open';
    new.quote_count := 0;
    new.is_flagged  := false;
  else
    -- Fields controlled by the system
    new.code        := old.code;
    new.buyer_id    := old.buyer_id;
    new.tender_type := old.tender_type;
    new.max_quotes  := old.max_quotes;
    new.created_at  := old.created_at;
    if not public.is_admin() and current_setting('tz.system', true) is distinct from 'on' then
      new.quote_count := old.quote_count;
      new.is_flagged  := old.is_flagged;
      new.flag_reason := old.flag_reason;
      new.category_id := old.category_id;
      new.city_id     := old.city_id;
      -- buyers may only cancel or close manually; awarding goes through award_quote()
      if new.status is distinct from old.status and new.status not in ('cancelled', 'closed', 'completed') then
        raise exception 'Invalid status change';
      end if;
      if old.status in ('awarded', 'cancelled', 'completed') and new.status is distinct from old.status
         and not (old.status = 'awarded' and new.status = 'completed') then
        raise exception 'Tender is already %', old.status;
      end if;
      if old.quote_count > 0 and (new.form_data is distinct from old.form_data or new.title is distinct from old.title) then
        raise exception 'Tender details cannot be changed after quotes are received';
      end if;
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;

create trigger tenders_before_write before insert or update on public.tenders
  for each row execute function public.tenders_before_write();

-- ---------------------------------------------------------------------
-- Quotes
-- ---------------------------------------------------------------------
create table public.quotes (
  id               uuid primary key default gen_random_uuid(),
  tender_id        uuid not null references public.tenders (id) on delete cascade,
  vendor_id        uuid not null references public.vendors (id) on delete cascade,
  line_items       jsonb not null default '[]',   -- [{key,label,unit,qty,rate,amount}]
  extra            jsonb not null default '{}',   -- answers to quote_schema.extra_fields
  gst_percent      numeric(5,2) not null default 18 check (gst_percent between 0 and 28),
  subtotal         numeric(14,2) not null default 0,
  gst_amount       numeric(14,2) not null default 0,
  total            numeric(14,2) not null default 0,
  timeline_days    int check (timeline_days > 0),
  warranty_months  int check (warranty_months >= 0),
  payment_terms    text,
  notes            text,
  status           public.quote_status not null default 'draft',
  submitted_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (tender_id, vendor_id)
);

create index quotes_tender_idx on public.quotes (tender_id, status);

-- ---------------------------------------------------------------------
-- Contracts / work orders
-- ---------------------------------------------------------------------
create sequence public.work_order_seq start 1;

create table public.contracts (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  tender_id   uuid not null unique references public.tenders (id) on delete cascade,
  quote_id    uuid not null unique references public.quotes (id),
  vendor_id   uuid not null references public.vendors (id),
  buyer_id    uuid not null references public.profiles (id),
  amount      numeric(14,2) not null,
  status      public.contract_status not null default 'active',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Notifications & audit
-- ---------------------------------------------------------------------
create table public.notifications (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  link        text,
  emailed_at  timestamptz,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.audit_logs (
  id          bigserial primary key,
  actor_id    uuid,
  action      text not null,
  entity      text not null,
  entity_id   text,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, title, body, link) values (p_user, p_type, p_title, p_body, p_link);
$$;

create or replace function public.audit(p_action text, p_entity text, p_entity_id text, p_meta jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_meta, '{}'));
$$;

-- =====================================================================
-- Business logic (RPC functions)
-- =====================================================================

-- Does this vendor match this tender? (category + service area + not suspended, or invited)
create or replace function public.vendor_matches_tender(p_vendor uuid, p_tender uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.tenders t
    join public.vendors v on v.id = p_vendor and not v.is_suspended
    where t.id = p_tender
      and t.buyer_id <> v.owner_id
      and (
        exists (select 1 from public.tender_invites i where i.tender_id = t.id and i.vendor_id = v.id)
        or (
          t.visibility = 'open'
          and exists (select 1 from public.vendor_categories vc where vc.vendor_id = v.id and vc.category_id = t.category_id)
          and exists (
            select 1 from public.vendor_service_areas a
            where a.vendor_id = v.id and a.city_id = t.city_id
              and (a.pincode is null or a.pincode = t.pincode)
          )
        )
      )
  );
$$;

-- Vendor tender feed: only public-safe fields, never buyer identity or exact address
create or replace function public.vendor_feed(p_category int default null, p_search text default null)
returns table (
  id uuid, code text, title text, category_id int, category_name text, tender_type public.tender_type,
  city_name text, area_label text, pincode text, budget_min numeric, budget_max numeric,
  quote_deadline timestamptz, start_date date, quote_count int, max_quotes int,
  site_visit_allowed boolean, created_at timestamptz, my_quote_status public.quote_status
)
language sql stable security definer set search_path = public as $$
  select t.id, t.code, t.title, t.category_id, c.name, t.tender_type,
         ci.name, t.area_label, t.pincode,
         case when t.budget_visible then t.budget_min end,
         case when t.budget_visible then t.budget_max end,
         t.quote_deadline, t.start_date, t.quote_count, t.max_quotes,
         t.site_visit_allowed, t.created_at, q.status
  from public.tenders t
  join public.categories c on c.id = t.category_id
  join public.cities ci on ci.id = t.city_id
  left join public.quotes q on q.tender_id = t.id and q.vendor_id = public.my_vendor_id()
  where public.my_vendor_id() is not null
    and not t.is_flagged
    and (
      (t.status = 'open' and t.quote_deadline > now() and public.vendor_matches_tender(public.my_vendor_id(), t.id))
      or q.id is not null
    )
    and (p_category is null or t.category_id = p_category)
    and (p_search is null or t.title ilike '%' || p_search || '%' or t.area_label ilike '%' || p_search || '%')
  order by (t.status = 'open') desc, t.created_at desc
  limit 200;
$$;

-- Full tender detail for a vendor; buyer contact only after the vendor is shortlisted/awarded
create or replace function public.vendor_tender_detail(p_tender uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_vendor  uuid := public.my_vendor_id();
  v_quote   public.quotes;
  v_result  jsonb;
  v_reveal  boolean;
begin
  if v_vendor is null then
    raise exception 'Vendor profile required';
  end if;

  select * into v_quote from public.quotes where tender_id = p_tender and vendor_id = v_vendor;

  if v_quote.id is null and not public.vendor_matches_tender(v_vendor, p_tender) then
    raise exception 'Tender not available';
  end if;

  v_reveal := v_quote.status in ('shortlisted', 'awarded');

  select jsonb_build_object(
    'id', t.id, 'code', t.code, 'title', t.title, 'description', t.description,
    'category_id', t.category_id, 'category_name', c.name, 'tender_type', t.tender_type,
    'form_data', t.form_data, 'city_name', ci.name, 'area_label', t.area_label, 'pincode', t.pincode,
    'budget_min', case when t.budget_visible then t.budget_min end,
    'budget_max', case when t.budget_visible then t.budget_max end,
    'status', t.status, 'quote_deadline', t.quote_deadline, 'start_date', t.start_date,
    'site_visit_allowed', t.site_visit_allowed, 'quote_count', t.quote_count, 'max_quotes', t.max_quotes,
    'created_at', t.created_at,
    'form_schema', ct.form_schema, 'quote_schema', ct.quote_schema,
    'media', coalesce((select jsonb_agg(jsonb_build_object('path', m.file_path, 'type', m.media_type)) from public.tender_media m where m.tender_id = t.id), '[]'),
    'my_quote', case when v_quote.id is null then null else to_jsonb(v_quote) end,
    'contact', case when v_reveal then jsonb_build_object(
        'name', p.full_name, 'phone', p.phone, 'email', p.email,
        'address', t.address, 'lat', t.lat, 'lng', t.lng) end
  ) into v_result
  from public.tenders t
  join public.categories c on c.id = t.category_id
  join public.cities ci on ci.id = t.city_id
  join public.profiles p on p.id = t.buyer_id
  left join public.category_templates ct on ct.category_id = t.category_id
  where t.id = p_tender;

  return v_result;
end $$;

-- Save or submit a quote. Totals are always computed on the server.
create or replace function public.save_quote(p_tender uuid, p_payload jsonb, p_submit boolean default false)
returns public.quotes language plpgsql security definer set search_path = public as $$
declare
  v_vendor    uuid := public.my_vendor_id();
  v_tender    public.tenders;
  v_existing  public.quotes;
  v_items     jsonb := '[]';
  v_item      jsonb;
  v_qty       numeric;
  v_rate      numeric;
  v_subtotal  numeric := 0;
  v_gst_pct   numeric := coalesce((p_payload ->> 'gst_percent')::numeric, 18);
  v_result    public.quotes;
  v_was_submitted boolean;
begin
  if v_vendor is null then raise exception 'Vendor profile required'; end if;

  select * into v_tender from public.tenders where id = p_tender for update;
  if v_tender.id is null then raise exception 'Tender not found'; end if;
  if v_tender.status <> 'open' or v_tender.quote_deadline <= now() then
    raise exception 'This tender is no longer accepting quotes';
  end if;
  if not public.vendor_matches_tender(v_vendor, p_tender) then
    raise exception 'You are not eligible to quote on this tender';
  end if;

  select * into v_existing from public.quotes where tender_id = p_tender and vendor_id = v_vendor;
  if v_existing.status in ('withdrawn', 'shortlisted', 'awarded', 'rejected') then
    raise exception 'Quote can no longer be edited (status: %)', v_existing.status;
  end if;
  v_was_submitted := coalesce(v_existing.status = 'submitted', false);

  -- Normalise line items and compute amounts
  for v_item in select * from jsonb_array_elements(coalesce(p_payload -> 'line_items', '[]'))
  loop
    v_qty  := coalesce(nullif(v_item ->> 'qty', '')::numeric, 0);
    v_rate := coalesce(nullif(v_item ->> 'rate', '')::numeric, 0);
    if v_qty < 0 or v_rate < 0 then raise exception 'Quantity and rate cannot be negative'; end if;
    if coalesce(trim(v_item ->> 'label'), '') = '' then continue; end if;
    v_items := v_items || jsonb_build_object(
      'key',    coalesce(v_item ->> 'key', 'custom'),
      'label',  left(v_item ->> 'label', 120),
      'unit',   left(coalesce(v_item ->> 'unit', ''), 20),
      'qty',    v_qty,
      'rate',   v_rate,
      'amount', round(v_qty * v_rate, 2));
    v_subtotal := v_subtotal + round(v_qty * v_rate, 2);
  end loop;

  if p_submit and jsonb_array_length(v_items) = 0 then
    raise exception 'Add at least one line item before submitting';
  end if;
  if p_submit and v_subtotal <= 0 then
    raise exception 'Quote total must be greater than zero';
  end if;

  -- Quote cap per tender (only counts new submissions)
  if p_submit and not v_was_submitted and v_tender.quote_count >= v_tender.max_quotes then
    raise exception 'This tender has reached its maximum of % quotes', v_tender.max_quotes;
  end if;

  insert into public.quotes as q (
    tender_id, vendor_id, line_items, extra, gst_percent, subtotal, gst_amount, total,
    timeline_days, warranty_months, payment_terms, notes, status, submitted_at, updated_at)
  values (
    p_tender, v_vendor, v_items, coalesce(p_payload -> 'extra', '{}'), v_gst_pct,
    v_subtotal, round(v_subtotal * v_gst_pct / 100, 2), round(v_subtotal * (1 + v_gst_pct / 100), 2),
    nullif(p_payload ->> 'timeline_days', '')::int, nullif(p_payload ->> 'warranty_months', '')::int,
    left(p_payload ->> 'payment_terms', 1000), left(p_payload ->> 'notes', 2000),
    case when p_submit or v_was_submitted then 'submitted'::public.quote_status else 'draft' end,
    case when p_submit and not v_was_submitted then now() else v_existing.submitted_at end,
    now())
  on conflict (tender_id, vendor_id) do update set
    line_items = excluded.line_items, extra = excluded.extra, gst_percent = excluded.gst_percent,
    subtotal = excluded.subtotal, gst_amount = excluded.gst_amount, total = excluded.total,
    timeline_days = excluded.timeline_days, warranty_months = excluded.warranty_months,
    payment_terms = excluded.payment_terms, notes = excluded.notes,
    status = excluded.status, submitted_at = excluded.submitted_at, updated_at = now()
  returning * into v_result;

  if p_submit and not v_was_submitted then
    perform set_config('tz.system', 'on', true);
    update public.tenders set quote_count = quote_count + 1 where id = p_tender;
    perform set_config('tz.system', 'off', true);
    perform public.notify(v_tender.buyer_id, 'quote_received',
      'New quote on ' || v_tender.code,
      'A verified vendor has quoted ₹' || to_char(v_result.total, 'FM99,99,99,999') || ' for "' || v_tender.title || '".',
      '/buyer/tenders/' || v_tender.id);
  elsif v_was_submitted then
    perform public.notify(v_tender.buyer_id, 'quote_updated',
      'Quote updated on ' || v_tender.code, 'A vendor revised their quote.', '/buyer/tenders/' || v_tender.id);
  end if;

  return v_result;
end $$;

create or replace function public.withdraw_quote(p_quote uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_quote public.quotes;
begin
  select * into v_quote from public.quotes where id = p_quote and vendor_id = public.my_vendor_id() for update;
  if v_quote.id is null then raise exception 'Quote not found'; end if;
  if v_quote.status not in ('draft', 'submitted') then raise exception 'Quote cannot be withdrawn now'; end if;
  update public.quotes set status = 'withdrawn', updated_at = now() where id = p_quote;
  if v_quote.status = 'submitted' then
    perform set_config('tz.system', 'on', true);
    update public.tenders set quote_count = greatest(quote_count - 1, 0) where id = v_quote.tender_id;
    perform set_config('tz.system', 'off', true);
  end if;
end $$;

-- Buyer view of quotes with vendor details; vendor phone only after shortlist
create or replace function public.buyer_tender_quotes(p_tender uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.tenders where id = p_tender and (buyer_id = auth.uid() or public.is_admin())) then
    raise exception 'Tender not found';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id, 'status', q.status, 'line_items', q.line_items, 'extra', q.extra,
      'gst_percent', q.gst_percent, 'subtotal', q.subtotal, 'gst_amount', q.gst_amount, 'total', q.total,
      'timeline_days', q.timeline_days, 'warranty_months', q.warranty_months,
      'payment_terms', q.payment_terms, 'notes', q.notes, 'submitted_at', q.submitted_at,
      'vendor', jsonb_build_object(
        'id', v.id, 'business_name', v.business_name, 'type', v.type,
        'years_experience', v.years_experience, 'team_size', v.team_size,
        'verified', v.verification_level >= 1, 'gstin', v.gstin,
        'completed_jobs', (select count(*) from public.contracts c where c.vendor_id = v.id and c.status = 'completed'),
        'phone', case when q.status in ('shortlisted', 'awarded') then p.phone end,
        'email', case when q.status in ('shortlisted', 'awarded') then p.email end,
        'contact_name', case when q.status in ('shortlisted', 'awarded') then p.full_name end)
    ) order by q.total asc)
    from public.quotes q
    join public.vendors v on v.id = q.vendor_id
    join public.profiles p on p.id = v.owner_id
    where q.tender_id = p_tender and q.status in ('submitted', 'shortlisted', 'awarded', 'rejected')
  ), '[]'::jsonb);
end $$;

create or replace function public.shortlist_quote(p_quote uuid, p_shortlist boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_quote  public.quotes;
  v_tender public.tenders;
  v_owner  uuid;
begin
  select * into v_quote from public.quotes where id = p_quote for update;
  select * into v_tender from public.tenders where id = v_quote.tender_id;
  if v_tender.buyer_id is distinct from auth.uid() then raise exception 'Not your tender'; end if;
  if v_tender.status not in ('open', 'closed') then raise exception 'Tender is %', v_tender.status; end if;

  if p_shortlist then
    if v_quote.status <> 'submitted' then raise exception 'Only submitted quotes can be shortlisted'; end if;
    if (select count(*) from public.quotes where tender_id = v_tender.id and status = 'shortlisted') >= 3 then
      raise exception 'You can shortlist up to 3 vendors';
    end if;
    update public.quotes set status = 'shortlisted', updated_at = now() where id = p_quote;
    select owner_id into v_owner from public.vendors where id = v_quote.vendor_id;
    perform public.notify(v_owner, 'shortlisted', 'You are shortlisted for ' || v_tender.code,
      'The buyer shortlisted your quote for "' || v_tender.title || '". Their contact details are now visible.',
      '/vendor/tenders/' || v_tender.id);
  else
    if v_quote.status <> 'shortlisted' then raise exception 'Quote is not shortlisted'; end if;
    update public.quotes set status = 'submitted', updated_at = now() where id = p_quote;
  end if;
  perform public.audit(case when p_shortlist then 'shortlist' else 'unshortlist' end, 'quote', p_quote::text);
end $$;

create or replace function public.award_quote(p_quote uuid)
returns public.contracts language plpgsql security definer set search_path = public as $$
declare
  v_quote    public.quotes;
  v_tender   public.tenders;
  v_contract public.contracts;
  r          record;
begin
  select * into v_quote from public.quotes where id = p_quote for update;
  select * into v_tender from public.tenders where id = v_quote.tender_id for update;
  if v_tender.buyer_id is distinct from auth.uid() then raise exception 'Not your tender'; end if;
  if v_tender.status not in ('open', 'closed') then raise exception 'Tender is already %', v_tender.status; end if;
  if v_quote.status not in ('submitted', 'shortlisted') then raise exception 'This quote cannot be awarded'; end if;

  update public.quotes set status = 'awarded', updated_at = now() where id = p_quote;

  perform set_config('tz.system', 'on', true);
  update public.tenders set status = 'awarded' where id = v_tender.id;
  perform set_config('tz.system', 'off', true);

  insert into public.contracts (code, tender_id, quote_id, vendor_id, buyer_id, amount)
  values ('WO-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('public.work_order_seq')::text, 5, '0'),
          v_tender.id, v_quote.id, v_quote.vendor_id, v_tender.buyer_id, v_quote.total)
  returning * into v_contract;

  -- Winner
  perform public.notify((select owner_id from public.vendors where id = v_quote.vendor_id), 'awarded',
    'You won ' || v_tender.code || '!',
    'Your quote for "' || v_tender.title || '" was selected. Work order ' || v_contract.code || ' is ready.',
    '/work-orders/' || v_contract.id);

  -- Everyone else
  for r in
    select q.id, v.owner_id from public.quotes q join public.vendors v on v.id = q.vendor_id
    where q.tender_id = v_tender.id and q.id <> p_quote and q.status in ('submitted', 'shortlisted', 'draft')
  loop
    update public.quotes set status = 'rejected', updated_at = now() where id = r.id;
    perform public.notify(r.owner_id, 'not_selected', 'Update on ' || v_tender.code,
      'The buyer selected another vendor for "' || v_tender.title || '". Thank you for quoting.',
      '/vendor/quotes');
  end loop;

  perform public.notify(v_tender.buyer_id, 'work_order', 'Work order ' || v_contract.code || ' created',
    'You awarded "' || v_tender.title || '". Download the work order and deal directly with your vendor — zero commission.',
    '/work-orders/' || v_contract.id);

  perform public.audit('award', 'tender', v_tender.id::text, jsonb_build_object('quote_id', p_quote, 'contract_id', v_contract.id));
  return v_contract;
end $$;

create or replace function public.complete_contract(p_contract uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_c public.contracts;
begin
  select * into v_c from public.contracts where id = p_contract for update;
  if v_c.buyer_id is distinct from auth.uid() then raise exception 'Only the buyer can mark the job complete'; end if;
  if v_c.status <> 'active' then raise exception 'Work order is %', v_c.status; end if;
  update public.contracts set status = 'completed' where id = p_contract;
  update public.tenders set status = 'completed' where id = v_c.tender_id;
  perform public.notify((select owner_id from public.vendors where id = v_c.vendor_id), 'completed',
    'Job marked complete', 'The buyer marked work order ' || v_c.code || ' as complete.', '/work-orders/' || v_c.id);
end $$;

-- Work order details for buyer, winning vendor or admin
create or replace function public.work_order_detail(p_contract uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_c public.contracts;
begin
  select * into v_c from public.contracts where id = p_contract;
  if v_c.id is null or not (v_c.buyer_id = auth.uid()
      or v_c.vendor_id = public.my_vendor_id() or public.is_admin()) then
    raise exception 'Work order not found';
  end if;

  return (
    select jsonb_build_object(
      'id', v_c.id, 'code', v_c.code, 'status', v_c.status, 'amount', v_c.amount, 'created_at', v_c.created_at,
      'tender', jsonb_build_object('id', t.id, 'code', t.code, 'title', t.title, 'description', t.description,
          'category_name', cat.name, 'tender_type', t.tender_type, 'form_data', t.form_data,
          'form_schema', ct.form_schema, 'address', t.address, 'area_label', t.area_label,
          'city_name', ci.name, 'pincode', t.pincode, 'start_date', t.start_date),
      'quote', to_jsonb(q),
      'buyer', jsonb_build_object('name', bp.full_name, 'phone', bp.phone, 'email', bp.email),
      'vendor', jsonb_build_object('business_name', v.business_name, 'gstin', v.gstin,
          'contact_name', vp.full_name, 'phone', vp.phone, 'email', vp.email,
          'verified', v.verification_level >= 1)
    )
    from public.tenders t
    join public.categories cat on cat.id = t.category_id
    join public.cities ci on ci.id = t.city_id
    left join public.category_templates ct on ct.category_id = t.category_id
    join public.quotes q on q.id = v_c.quote_id
    join public.profiles bp on bp.id = v_c.buyer_id
    join public.vendors v on v.id = v_c.vendor_id
    join public.profiles vp on vp.id = v.owner_id
    where t.id = v_c.tender_id
  );
end $$;

-- Notify matching vendors when a tender goes live
create or replace function public.tenders_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  for r in
    select v.owner_id from public.vendors v
    where public.vendor_matches_tender(v.id, new.id)
    limit 500
  loop
    perform public.notify(r.owner_id, 'new_tender', 'New tender: ' || new.title,
      coalesce(new.area_label, '') || ' — quotes close ' || to_char(new.quote_deadline at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM'),
      '/vendor/tenders/' || new.id);
  end loop;
  return null;
end $$;

create trigger tenders_after_insert after insert on public.tenders
  for each row execute function public.tenders_after_insert();

-- Close tenders whose deadline passed (call from cron)
create or replace function public.close_expired_tenders()
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
  r record;
begin
  perform set_config('tz.system', 'on', true);
  for r in
    update public.tenders set status = 'closed'
    where status = 'open' and quote_deadline <= now()
    returning id, buyer_id, code, title, quote_count
  loop
    perform public.notify(r.buyer_id, 'tender_closed', 'Quotes closed for ' || r.code,
      r.quote_count || ' quote(s) received for "' || r.title || '". Compare and award now.',
      '/buyer/tenders/' || r.id);
  end loop;
  get diagnostics n = row_count;
  perform set_config('tz.system', 'off', true);
  return n;
end $$;

-- Admin: review a vendor document and recompute verification level
create or replace function public.admin_review_document(p_doc uuid, p_status public.doc_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_vendor uuid;
  v_owner  uuid;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.vendor_documents set status = p_status, review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_doc returning vendor_id into v_vendor;

  update public.vendors set verification_level =
    case when exists (select 1 from public.vendor_documents where vendor_id = v_vendor and status = 'verified') then 1 else 0 end
  where id = v_vendor
  returning owner_id into v_owner;

  perform public.notify(v_owner, 'kyc_' || p_status, 'Document ' || p_status,
    coalesce(p_note, 'Your document review is complete.'), '/vendor/profile');
  perform public.audit('review_document', 'vendor_document', p_doc::text, jsonb_build_object('status', p_status));
end $$;

-- Admin dashboard numbers
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'buyers',            (select count(*) from public.profiles where active_role = 'buyer'),
    'vendors',           (select count(*) from public.vendors),
    'verified_vendors',  (select count(*) from public.vendors where verification_level >= 1),
    'tenders_open',      (select count(*) from public.tenders where status = 'open'),
    'tenders_total',     (select count(*) from public.tenders),
    'tenders_awarded',   (select count(*) from public.tenders where status in ('awarded', 'completed')),
    'quotes_submitted',  (select count(*) from public.quotes where status <> 'draft'),
    'awarded_value',     (select coalesce(sum(amount), 0) from public.contracts),
    'pending_documents', (select count(*) from public.vendor_documents where status = 'pending'),
    'flagged_tenders',   (select count(*) from public.tenders where is_flagged)
  );
end $$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles              enable row level security;
alter table public.cities                enable row level security;
alter table public.categories            enable row level security;
alter table public.category_templates    enable row level security;
alter table public.vendors               enable row level security;
alter table public.vendor_categories     enable row level security;
alter table public.vendor_service_areas  enable row level security;
alter table public.vendor_documents      enable row level security;
alter table public.tenders               enable row level security;
alter table public.tender_media          enable row level security;
alter table public.tender_invites        enable row level security;
alter table public.quotes                enable row level security;
alter table public.contracts             enable row level security;
alter table public.notifications         enable row level security;
alter table public.audit_logs            enable row level security;

-- profiles
create policy profiles_self_read   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update using (id = auth.uid() or public.is_admin());

-- master data (public read, admin write)
create policy cities_read      on public.cities for select using (is_active or public.is_admin());
create policy cities_admin     on public.cities for all using (public.is_admin()) with check (public.is_admin());
create policy categories_read  on public.categories for select using (is_active or public.is_admin());
create policy categories_admin on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy templates_read   on public.category_templates for select using (true);
create policy templates_admin  on public.category_templates for all using (public.is_admin()) with check (public.is_admin());

-- vendors (public business profile)
create policy vendors_read   on public.vendors for select using (true);
create policy vendors_insert on public.vendors for insert with check (owner_id = auth.uid());
create policy vendors_update on public.vendors for update using (owner_id = auth.uid() or public.is_admin());
create policy vendors_admin_delete on public.vendors for delete using (public.is_admin());

create policy vc_read  on public.vendor_categories for select using (true);
create policy vc_write on public.vendor_categories for all
  using (vendor_id = public.my_vendor_id() or public.is_admin())
  with check (vendor_id = public.my_vendor_id() or public.is_admin());

create policy vsa_read  on public.vendor_service_areas for select using (true);
create policy vsa_write on public.vendor_service_areas for all
  using (vendor_id = public.my_vendor_id() or public.is_admin())
  with check (vendor_id = public.my_vendor_id() or public.is_admin());

-- KYC documents: owner + admin only
create policy vdocs_read   on public.vendor_documents for select using (vendor_id = public.my_vendor_id() or public.is_admin());
create policy vdocs_insert on public.vendor_documents for insert with check (vendor_id = public.my_vendor_id() and status = 'pending');
create policy vdocs_delete on public.vendor_documents for delete using ((vendor_id = public.my_vendor_id() and status <> 'verified') or public.is_admin());

-- tenders: buyers own theirs; vendors use vendor_feed()/vendor_tender_detail()
create policy tenders_buyer_read   on public.tenders for select using (buyer_id = auth.uid() or public.is_admin());
create policy tenders_buyer_insert on public.tenders for insert with check (buyer_id = auth.uid());
create policy tenders_buyer_update on public.tenders for update using (buyer_id = auth.uid() or public.is_admin());

create policy tmedia_read  on public.tender_media for select using (
  exists (select 1 from public.tenders t where t.id = tender_id and (t.buyer_id = auth.uid() or public.is_admin())));
create policy tmedia_write on public.tender_media for insert with check (
  exists (select 1 from public.tenders t where t.id = tender_id and t.buyer_id = auth.uid()));
create policy tmedia_delete on public.tender_media for delete using (
  exists (select 1 from public.tenders t where t.id = tender_id and (t.buyer_id = auth.uid() or public.is_admin())));

create policy tinvites_buyer on public.tender_invites for all
  using (exists (select 1 from public.tenders t where t.id = tender_id and (t.buyer_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.tenders t where t.id = tender_id and t.buyer_id = auth.uid()));

-- quotes: read own (vendor) / own tender's non-draft quotes (buyer); writes only via RPC
create policy quotes_vendor_read on public.quotes for select using (vendor_id = public.my_vendor_id() or public.is_admin());
create policy quotes_buyer_read  on public.quotes for select using (
  status <> 'draft' and exists (select 1 from public.tenders t where t.id = tender_id and t.buyer_id = auth.uid()));

-- contracts
create policy contracts_read on public.contracts for select using (
  buyer_id = auth.uid() or vendor_id = public.my_vendor_id() or public.is_admin());

-- notifications
create policy notif_read   on public.notifications for select using (user_id = auth.uid());
create policy notif_update on public.notifications for update using (user_id = auth.uid());

-- audit logs
create policy audit_admin on public.audit_logs for select using (public.is_admin());

-- Only server-side functions may call these
revoke execute on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.audit(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.close_expired_tenders() from public, anon, authenticated;
revoke execute on function public.vendor_matches_tender(uuid, uuid) from public, anon;
