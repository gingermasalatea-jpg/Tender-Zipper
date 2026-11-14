-- =====================================================================
-- Phase 1 end-to-end test (run against a disposable database after
-- migrations + seed). Every check raises an exception on failure.
-- =====================================================================
\set ON_ERROR_STOP 1
\set QUIET 1

-- Test users
insert into auth.users (id, phone, email) values
  ('00000000-0000-0000-0000-00000000000b', '+919800000001', 'buyer@test.in'),
  ('00000000-0000-0000-0000-0000000000a1', '+919800000002', 'painter1@test.in'),
  ('00000000-0000-0000-0000-0000000000a2', '+919800000003', 'painter2@test.in'),
  ('00000000-0000-0000-0000-0000000000a3', '+919800000004', 'guard@test.in'),
  ('00000000-0000-0000-0000-00000000ad00', '+919800000005', 'admin@test.in');
update public.profiles set is_admin = true where phone = '+919800000005';
update public.profiles set full_name = 'Riya Buyer', active_role = 'buyer'  where phone = '+919800000001';
update public.profiles set full_name = 'Painter One', active_role = 'vendor' where phone = '+919800000002';

create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.check(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'TEST FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
create or replace function pg_temp.fails(sql text, msg text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'ok - % (blocked: %)', msg, sqlerrm;
    return;
  end;
  raise exception 'TEST FAILED: expected error: %', msg;
end $$;

-- ---------------------------------------------------------------------
-- Vendors onboard
-- ---------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into public.vendors (id, owner_id, business_name, city_id)
  values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'Shree Painters', 1);
insert into public.vendor_categories values ('10000000-0000-0000-0000-000000000001', (select id from categories where slug = 'house-painting'));
insert into public.vendor_service_areas (vendor_id, city_id, pincode) values ('10000000-0000-0000-0000-000000000001', 1, null);
update public.vendors set verification_level = 5, is_suspended = false where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.check((select verification_level from vendors where id = '10000000-0000-0000-0000-000000000001') = 0,
  'vendor cannot self-verify');
select pg_temp.fails($$update public.profiles set is_admin = true where id = auth.uid()$$, 'user cannot make self admin');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
insert into public.vendors (id, owner_id, business_name, city_id)
  values ('10000000-0000-0000-0000-000000000002', auth.uid(), 'Colour Craft', 1);
insert into public.vendor_categories values ('10000000-0000-0000-0000-000000000002', (select id from categories where slug = 'house-painting'));
insert into public.vendor_service_areas (vendor_id, city_id, pincode) values ('10000000-0000-0000-0000-000000000002', 1, '380058');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
insert into public.vendors (id, owner_id, business_name, city_id, type)
  values ('10000000-0000-0000-0000-000000000003', auth.uid(), 'Kavach Security', 1, 'agency');
insert into public.vendor_categories values ('10000000-0000-0000-0000-000000000003', (select id from categories where slug = 'security-guards'));
insert into public.vendor_service_areas (vendor_id, city_id, pincode) values ('10000000-0000-0000-0000-000000000003', 1, null);
reset role;

-- ---------------------------------------------------------------------
-- Buyer posts a painting tender in Bopal (380058)
-- ---------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.tenders (id, buyer_id, category_id, title, form_data, city_id, pincode, area_label, address, budget_min, budget_max)
values ('20000000-0000-0000-0000-000000000001', auth.uid(), (select id from categories where slug = 'house-painting'),
        'Paint my 2BHK flat in Bopal', '{"area_sqft": 1200, "property_type": "2 BHK flat"}', 1, '380058', 'Bopal',
        'B-402, Green Residency, Bopal', 40000, 60000);
select pg_temp.check((select code from tenders where id = '20000000-0000-0000-0000-000000000001') = 'TZ-AMD-000001', 'tender code generated');
select pg_temp.check((select tender_type from tenders where id = '20000000-0000-0000-0000-000000000001') = 'ONE_TIME_JOB', 'tender type from category');
select pg_temp.fails($$insert into public.tenders (buyer_id, category_id, title, city_id) values (auth.uid(), (select id from categories where slug='home-flat'), 'Bad level tender', 1)$$,
  'tender must use a sub-category');
select pg_temp.fails($$insert into public.tenders (buyer_id, category_id, title, city_id) values (auth.uid(), (select id from categories where slug='house-painting'), 'Surat tender test', 4)$$,
  'inactive city rejected');
reset role;

select pg_temp.check((select count(*) from notifications where type = 'new_tender') = 2, 'both painters notified, security vendor not');

-- ---------------------------------------------------------------------
-- Vendor visibility
-- ---------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.check((select count(*) from public.vendor_feed()) = 0, 'security vendor does not see painting tender');
select pg_temp.fails($$select public.vendor_tender_detail('20000000-0000-0000-0000-000000000001')$$, 'non-matching vendor cannot open tender');
select pg_temp.check((select count(*) from public.tenders) = 0, 'vendors cannot read tenders table directly');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select count(*) from public.vendor_feed()) = 1, 'city-wide painter sees tender');
select pg_temp.check((select budget_max from public.vendor_feed()) is null, 'hidden budget not shown');
select pg_temp.check((public.vendor_tender_detail('20000000-0000-0000-0000-000000000001') -> 'contact') = 'null'::jsonb, 'buyer contact hidden before shortlist');
-- save draft, then submit
select (public.save_quote('20000000-0000-0000-0000-000000000001',
  '{"line_items": [{"key":"paint","label":"Paint 2 coats","unit":"sq ft","qty":1200,"rate":18},
                   {"key":"putty","label":"Putty","unit":"sq ft","qty":1200,"rate":7}], "timeline_days": 6}', false)).status;
reset role;
select pg_temp.check((select quote_count from tenders where id = '20000000-0000-0000-0000-000000000001') = 0, 'draft does not count');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) from public.quotes) = 0, 'buyer cannot see drafts');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((public.save_quote('20000000-0000-0000-0000-000000000001',
  '{"line_items": [{"key":"paint","label":"Paint 2 coats","unit":"sq ft","qty":1200,"rate":18,"amount":1},
                   {"key":"putty","label":"Putty","unit":"sq ft","qty":1200,"rate":7}], "gst_percent": 18, "timeline_days": 6}', true)).total = 35400,
  'server computes total (30,000 + 18% GST = 35,400) ignoring client amount');
select pg_temp.fails($$select public.save_quote('20000000-0000-0000-0000-000000000001', '{"line_items":[{"label":"x","qty":-1,"rate":5}]}', true)$$, 'negative qty rejected');
reset role;
select pg_temp.check((select quote_count from tenders where id = '20000000-0000-0000-0000-000000000001') = 1, 'quote counted once');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select (public.save_quote('20000000-0000-0000-0000-000000000001',
  '{"line_items": [{"key":"paint","label":"Paint 2 coats","unit":"sq ft","qty":1200,"rate":22}], "gst_percent": 18}', true)).total;
select pg_temp.check((select count(*) from public.quotes) = 1, 'vendor sees only own quote');
reset role;
select pg_temp.check((select quote_count from tenders where id = '20000000-0000-0000-0000-000000000001') = 2, 'direct submit (no draft) is counted');

-- ---------------------------------------------------------------------
-- Buyer compares, shortlists, awards
-- ---------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check(jsonb_array_length(public.buyer_tender_quotes('20000000-0000-0000-0000-000000000001')) = 2, 'buyer sees 2 quotes');
select pg_temp.check((public.buyer_tender_quotes('20000000-0000-0000-0000-000000000001') -> 0 -> 'vendor' ->> 'phone') is null, 'vendor phone hidden before shortlist');
select public.shortlist_quote((select id from quotes where vendor_id = '10000000-0000-0000-0000-000000000001'));
select pg_temp.check((select v ->> 'phone' from jsonb_array_elements(public.buyer_tender_quotes('20000000-0000-0000-0000-000000000001')) v
                      where v -> 'vendor' ->> 'business_name' = 'Shree Painters') is null, 'phone is on vendor object');
select pg_temp.check((select v -> 'vendor' ->> 'phone' from jsonb_array_elements(public.buyer_tender_quotes('20000000-0000-0000-0000-000000000001')) v
                      where v -> 'vendor' ->> 'business_name' = 'Shree Painters') = '+919800000002', 'vendor phone revealed after shortlist');
select pg_temp.fails($$update public.tenders set status = 'awarded' where id = '20000000-0000-0000-0000-000000000001'$$, 'buyer cannot set awarded directly');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((public.vendor_tender_detail('20000000-0000-0000-0000-000000000001') -> 'contact' ->> 'phone') = '+919800000001', 'buyer contact revealed to shortlisted vendor');
select pg_temp.fails($$select public.shortlist_quote((select id from quotes limit 1))$$, 'vendor cannot shortlist');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.check((public.vendor_tender_detail('20000000-0000-0000-0000-000000000001') -> 'contact') = 'null'::jsonb, 'non-shortlisted vendor still sees no contact');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select (public.award_quote((select id from quotes where vendor_id = '10000000-0000-0000-0000-000000000002'))).code;
select pg_temp.check((select status from tenders where id = '20000000-0000-0000-0000-000000000001') = 'awarded', 'tender awarded');
select pg_temp.check((select count(*) from contracts) = 1, 'work order created');
select pg_temp.fails($$select public.award_quote((select id from quotes where vendor_id = '10000000-0000-0000-0000-000000000001'))$$, 'cannot award twice');
reset role;

select pg_temp.check((select status from quotes where vendor_id = '10000000-0000-0000-0000-000000000001') = 'rejected', 'other quote rejected');
select pg_temp.check((select count(*) from notifications where type = 'not_selected') = 1, 'losing vendor notified');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.fails($$select public.work_order_detail((select id from contracts limit 1))$$, 'losing vendor cannot open work order');
select pg_temp.check((select count(*) from contracts) = 0, 'losing vendor cannot read contract row');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.check((public.work_order_detail((select id from contracts limit 1)) -> 'buyer' ->> 'phone') = '+919800000001', 'winning vendor sees work order');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.complete_contract((select id from contracts limit 1));
select pg_temp.check((select status from tenders where id = '20000000-0000-0000-0000-000000000001') = 'completed', 'job completed');
reset role;

-- ---------------------------------------------------------------------
-- Quote cap + deadline expiry (security tender, cap 1)
-- ---------------------------------------------------------------------
update category_templates set max_quotes = 1 where category_id = (select id from categories where slug = 'security-guards');
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000a4', '+919800000006');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
insert into public.vendors (id, owner_id, business_name, city_id) values ('10000000-0000-0000-0000-000000000004', auth.uid(), 'Raksha Guards', 1);
insert into public.vendor_categories values ('10000000-0000-0000-0000-000000000004', (select id from categories where slug = 'security-guards'));
insert into public.vendor_service_areas (vendor_id, city_id) values ('10000000-0000-0000-0000-000000000004', 1);
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.tenders (id, buyer_id, category_id, title, city_id, area_label)
values ('20000000-0000-0000-0000-000000000002', auth.uid(), (select id from categories where slug = 'security-guards'),
        'Security guards for society', 1, 'Satellite');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select (public.save_quote('20000000-0000-0000-0000-000000000002', '{"line_items":[{"label":"Guard day","qty":2,"rate":18000}]}', true)).status;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
select pg_temp.fails($$select public.save_quote('20000000-0000-0000-0000-000000000002', '{"line_items":[{"label":"Guard day","qty":2,"rate":17000}]}', true)$$, 'quote cap enforced');
reset role;

update tenders set quote_deadline = now() - interval '1 minute' where id = '20000000-0000-0000-0000-000000000002';
select pg_temp.check(public.close_expired_tenders() = 1, 'expired tender closed by cron');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.fails($$select public.withdraw_quote((select id from quotes limit 1)) ; select public.save_quote('20000000-0000-0000-0000-000000000002', '{"line_items":[{"label":"x","qty":1,"rate":1}]}', true)$$, 'no quoting after close');
reset role;

-- ---------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into public.vendor_documents (id, vendor_id, doc_type, file_path)
values ('30000000-0000-0000-0000-000000000001', public.my_vendor_id(), 'gst', 'x/gst.pdf');
select pg_temp.fails($$select public.admin_review_document('30000000-0000-0000-0000-000000000001', 'verified')$$, 'vendor cannot verify own doc');
select pg_temp.fails($$select public.admin_stats()$$, 'non-admin blocked from stats');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000ad00');
select public.admin_review_document('30000000-0000-0000-0000-000000000001', 'verified', 'GST verified');
select pg_temp.check((public.admin_stats() ->> 'verified_vendors')::int = 1, 'admin verification updates vendor');
select pg_temp.check((select count(*) from public.tenders) = 2, 'admin sees all tenders');
reset role;

\echo ALL PHASE 1 TESTS PASSED
