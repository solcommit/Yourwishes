begin;

-- No policy queries app_members from app_members: no recursive RLS or definer helper.
-- Clients can only inspect their own membership and have no membership write grants.
create policy members_read_self on public.app_members
for select to authenticated using (user_id = (select auth.uid()));

-- The profiles FK ensures every profile belongs to one of the permanent pair.
create policy profiles_read_pair on public.profiles
for select to authenticated using (
  exists (select 1 from public.app_members where user_id = (select auth.uid()))
);
create policy profiles_insert_self on public.profiles
for insert to authenticated with check (
  id = (select auth.uid()) and
  exists (select 1 from public.app_members where user_id = (select auth.uid()))
);
create policy profiles_update_self on public.profiles
for update to authenticated using (
  id = (select auth.uid()) and
  exists (select 1 from public.app_members where user_id = (select auth.uid()))
) with check (
  id = (select auth.uid()) and
  exists (select 1 from public.app_members where user_id = (select auth.uid()))
);

create policy wishes_read_pair on public.wishlist_items
for select to authenticated using (
  exists (select 1 from public.app_members where user_id = (select auth.uid()))
);
create policy wishes_insert_self on public.wishlist_items
for insert to authenticated with check (
  owner_id = (select auth.uid()) and
  exists (select 1 from public.app_members where user_id = (select auth.uid()))
);
create policy wishes_update_self on public.wishlist_items
for update to authenticated using (
  owner_id = (select auth.uid()) and
  exists (select 1 from public.app_members where user_id = (select auth.uid()))
) with check (
  owner_id = (select auth.uid()) and
  exists (select 1 from public.app_members where user_id = (select auth.uid()))
);
create policy wishes_delete_self on public.wishlist_items
for delete to authenticated using (
  owner_id = (select auth.uid()) and
  exists (select 1 from public.app_members where user_id = (select auth.uid()))
);

-- wishlist_items enforces membership on reads; writes additionally check ownership.
create policy images_read_pair on public.wishlist_images
for select to authenticated using (
  exists (select 1 from public.wishlist_items where id = wish_id)
);
create policy images_insert_self on public.wishlist_images
for insert to authenticated with check (
  exists (select 1 from public.wishlist_items where id = wish_id and owner_id = (select auth.uid()))
);
create policy images_update_self on public.wishlist_images
for update to authenticated using (
  exists (select 1 from public.wishlist_items where id = wish_id and owner_id = (select auth.uid()))
) with check (
  exists (select 1 from public.wishlist_items where id = wish_id and owner_id = (select auth.uid()))
);
create policy images_delete_self on public.wishlist_images
for delete to authenticated using (
  exists (select 1 from public.wishlist_items where id = wish_id and owner_id = (select auth.uid()))
);

commit;
