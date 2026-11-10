begin;
-- Pair members may read only the partner's currently referenced avatar, never stale uploads.
drop policy if exists profile_photos_read_self on storage.objects;
drop policy if exists profile_photos_read_pair on storage.objects;
create policy profile_photos_read_pair on storage.objects for select to authenticated using (
  bucket_id='profile-photos'
  and exists(select 1 from public.app_members where user_id=(select auth.uid()))
  and ((storage.foldername(name))[1]=(select auth.uid())::text
    or exists(select 1 from public.profiles p where p.avatar_path=name and (storage.foldername(name))[1]=p.id::text))
);
-- Existing profile policies already permit pair reads and owner-only nickname writes.
commit;
