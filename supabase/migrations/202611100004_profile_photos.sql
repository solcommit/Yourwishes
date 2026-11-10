begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-photos','profile-photos',false,1048576,array['image/webp'])
on conflict(id) do update set public=false,file_size_limit=1048576,allowed_mime_types=array['image/webp'];

create policy profile_photos_read_self on storage.objects for select to authenticated using (
  bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists(select 1 from public.app_members where user_id=(select auth.uid()))
);
create policy profile_photos_insert_self on storage.objects for insert to authenticated with check (
  bucket_id='profile-photos' and name ~ ('^'||(select auth.uid())::text||'/[0-9a-f-]{36}\.webp$')
  and exists(select 1 from public.app_members where user_id=(select auth.uid()))
);
create policy profile_photos_delete_self on storage.objects for delete to authenticated using (
  bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists(select 1 from public.app_members where user_id=(select auth.uid()))
  and not exists(select 1 from public.profiles where id=(select auth.uid()) and avatar_path=name)
);
-- Existing profiles RLS already limits updates to the signed-in member's row.
commit;
