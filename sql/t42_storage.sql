-- T42: مخزن صور الزيارات (Supabase Storage) — خاص + RLS حسب الشركة
-- شغّله مرة وحدة بـ Supabase → SQL Editor. آمن لإعادة التشغيل.
-- مسار الملف: <tenant_code>/<contractId>/<visitId>/<photoId>.jpg  → المجلد الأول = رمز الشركة.
insert into storage.buckets (id, name, public)
values ('visit-photos', 'visit-photos', false)
on conflict (id) do nothing;

drop policy if exists visit_photos_owner_all on storage.objects;
create policy visit_photos_owner_all on storage.objects
  for all to authenticated
  using (
    bucket_id = 'visit-photos'
    and exists (select 1 from public.companies c
                where c.tenant_code = (storage.foldername(name))[1] and c.owner_uid = auth.uid())
  )
  with check (
    bucket_id = 'visit-photos'
    and exists (select 1 from public.companies c
                where c.tenant_code = (storage.foldername(name))[1] and c.owner_uid = auth.uid())
  );
