-- =====================================================================
-- Storage buckets
--   tender-media : public read (job photos), buyers upload into <user_id>/...
--   vendor-docs  : private KYC documents, vendor uploads into <user_id>/...
--   portfolio    : public vendor work photos, uploads into <user_id>/...
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('tender-media', 'tender-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
  ('vendor-docs',  'vendor-docs',  false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('portfolio',    'portfolio',    true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Everyone may read public buckets
create policy "public read media" on storage.objects for select
  using (bucket_id in ('tender-media', 'portfolio'));

-- Users upload/delete only inside their own folder
create policy "own folder upload" on storage.objects for insert to authenticated
  with check (bucket_id in ('tender-media', 'vendor-docs', 'portfolio')
              and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own folder delete" on storage.objects for delete to authenticated
  using (bucket_id in ('tender-media', 'vendor-docs', 'portfolio')
         and (storage.foldername(name))[1] = auth.uid()::text);

-- KYC docs: owner or admin can read
create policy "kyc read" on storage.objects for select to authenticated
  using (bucket_id = 'vendor-docs'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
