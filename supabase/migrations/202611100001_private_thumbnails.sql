begin;

-- Derived images remain private. No service-role key or public URLs required.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('wishlist-thumbnails', 'wishlist-thumbnails', false, 5242880, array['image/webp'])
on conflict (id) do update set public = false;

create policy thumbnails_read_pair on storage.objects for select to authenticated
using (bucket_id = 'wishlist-thumbnails'
  and exists (select 1 from public.app_members where user_id = (select auth.uid()))
  and ((storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.wishlist_images i
    where name in (i.storage_path || '/320.webp', i.storage_path || '/640.webp', i.storage_path || '/960.webp'))));
create policy thumbnails_insert_self on storage.objects for insert to authenticated
with check (bucket_id = 'wishlist-thumbnails'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.app_members where user_id = (select auth.uid()))
  and name ~ '/(320|640|960)\.webp$'
  and (exists (select 1 from public.wishlist_images i
    where name in (i.storage_path || '/320.webp', i.storage_path || '/640.webp', i.storage_path || '/960.webp'))
    or exists (select 1 from public.wishlist_image_cleanup c
      where c.owner_id = (select auth.uid()) and c.claimed_at is null and c.not_before > now()
      and name in (c.storage_path || '/320.webp', c.storage_path || '/640.webp', c.storage_path || '/960.webp'))));
create policy thumbnails_delete_self on storage.objects for delete to authenticated
using (bucket_id = 'wishlist-thumbnails'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.app_members where user_id = (select auth.uid())));

-- Combine membership and metadata checks in one round trip, retaining RLS.
create function public.authorized_wish_photo(p_id uuid) returns setof public.wishlist_images
language sql stable security invoker set search_path = '' as $$
  select i.* from public.wishlist_images i where i.id = p_id
  and exists (select 1 from public.app_members where user_id = (select auth.uid()));
$$;
revoke all on function public.authorized_wish_photo(uuid) from public, anon;
grant execute on function public.authorized_wish_photo(uuid) to authenticated;
commit;
