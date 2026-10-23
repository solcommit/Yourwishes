begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wishlist-images', 'wishlist-images', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.wishlist_images add column original_name text not null default 'Photo'
  check (char_length(original_name) between 1 and 255);
alter table public.wishlist_images drop constraint wishlist_images_wish_id_sort_order_key;
alter table public.wishlist_images add constraint wishlist_images_wish_id_sort_order_key
  unique (wish_id, sort_order) deferrable initially immediate;
grant insert (original_name), update (original_name) on public.wishlist_images to authenticated;

-- Durable compensation for uploads/DB changes: Storage bytes are removed via its
-- API, NEVER by deleting storage.objects rows in SQL.
create table public.wishlist_image_cleanup (
  storage_path text primary key,
  owner_id uuid not null references public.app_members(user_id),
  not_before timestamptz not null default (now() + interval '1 hour'),
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  check (storage_path ~ ('^' || owner_id::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'))
);
alter table public.wishlist_image_cleanup enable row level security;
revoke all on public.wishlist_image_cleanup from public, anon, authenticated;
grant select, delete on public.wishlist_image_cleanup to authenticated;
grant insert (storage_path, owner_id), update (not_before, claimed_at) on public.wishlist_image_cleanup to authenticated;
create policy cleanup_self on public.wishlist_image_cleanup for all to authenticated
using (owner_id = (select auth.uid()) and exists (select 1 from public.app_members where user_id = (select auth.uid())))
with check (owner_id = (select auth.uid()) and exists (select 1 from public.app_members where user_id = (select auth.uid())));

create policy wishlist_storage_read on storage.objects for select to authenticated using (
  bucket_id = 'wishlist-images'
  and exists (select 1 from public.app_members where user_id = (select auth.uid()))
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.wishlist_images where storage_path = name)
  )
);
create policy wishlist_storage_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'wishlist-images'
  and exists (select 1 from public.app_members where user_id = (select auth.uid()))
  and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$')
  and exists (select 1 from public.wishlist_image_cleanup c where c.storage_path = name
    and c.owner_id = (select auth.uid()) and c.claimed_at is null and c.not_before > now())
  and not exists (select 1 from public.wishlist_items w
    where w.id::text = (storage.foldername(name))[2] and w.owner_id <> (select auth.uid()))
);
-- Replacements always use fresh paths. No UPDATE/upsert policy: committed bytes
-- cannot be overwritten underneath a partner or concurrent edit.
create policy wishlist_storage_delete on storage.objects for delete to authenticated using (
  bucket_id = 'wishlist-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.app_members where user_id = (select auth.uid()))
  and not exists (select 1 from public.wishlist_images where storage_path = name)
);

create function public.validate_wish_image() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare image_owner uuid; target uuid; staged public.wishlist_image_cleanup%rowtype;
begin
  target := case when tg_op = 'DELETE' then old.wish_id else new.wish_id end;
  select owner_id into image_owner from public.wishlist_items where id = target for update;
  if image_owner is null and tg_op = 'DELETE' then return old; end if;
  if image_owner is null or image_owner <> auth.uid() then
    raise exception 'Image ownership denied' using errcode = '42501';
  end if;
  -- Serialize ALL metadata mutations against the parent, including direct API
  -- deletes/reorders, so concurrent deletes cannot commit an image-less wish.
  update public.wishlist_items set title = title where id = target;
  if tg_op = 'DELETE' then return old; end if;
  if new.storage_path !~ ('^' || image_owner::text || '/' || new.wish_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$') then
    raise exception 'Invalid image path' using errcode = '23514';
  end if;
  select * into staged from public.wishlist_image_cleanup where storage_path = new.storage_path for update;
  if found and (staged.claimed_at is not null or staged.not_before <= now()) then
    raise exception 'Upload expired; upload it again' using errcode = '23514';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'wishlist-images' and name = new.storage_path) then
    raise exception 'Image object is missing; upload it again' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger validate_wish_image before insert or update or delete on public.wishlist_images
for each row execute function public.validate_wish_image();

create function public.queue_removed_wish_image() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.wishlist_image_cleanup(storage_path, owner_id)
  values (old.storage_path, split_part(old.storage_path, '/', 1)::uuid)
  on conflict (storage_path) do nothing;
  update public.wishlist_image_cleanup set not_before = now() where storage_path = old.storage_path;
  return old;
end;
$$;
create trigger queue_removed_wish_image after delete on public.wishlist_images
for each row execute function public.queue_removed_wish_image();
create trigger queue_replaced_wish_image after update of storage_path on public.wishlist_images
for each row when (old.storage_path is distinct from new.storage_path)
execute function public.queue_removed_wish_image();

create function public.check_wish_image_count() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare target uuid; total integer;
begin
  if tg_table_name = 'wishlist_items' then target := new.id;
  elsif tg_op = 'DELETE' then target := old.wish_id;
  else target := new.wish_id;
  end if;
  -- Deleting a parent legitimately cascades all of its image metadata.
  if exists (select 1 from public.wishlist_items where id = target) then
    select count(*) into total from public.wishlist_images where wish_id = target;
    if total < 1 or total > 5 then raise exception 'A wish requires 1–5 images' using errcode = '23514'; end if;
  end if;
  return null;
end;
$$;
create constraint trigger wish_requires_images after insert or update on public.wishlist_items
deferrable initially deferred for each row execute function public.check_wish_image_count();
create constraint trigger image_count_valid after insert or update or delete on public.wishlist_images
deferrable initially deferred for each row execute function public.check_wish_image_count();

create function public.save_wish(
  p_id uuid, p_title text, p_description text, p_price numeric, p_currency text,
  p_product_url text, p_priority text, p_category text, p_images jsonb,
  p_expected_updated_at timestamptz default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare existing public.wishlist_items%rowtype; photo jsonb; image_position integer := 0;
begin
  if auth.uid() is null or not exists (select 1 from public.app_members where user_id = auth.uid()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(p_images) <> 'array' or jsonb_array_length(p_images) not between 1 and 5 then
    raise exception 'A wish requires 1–5 images' using errcode = '23514';
  end if;
  if (select count(distinct value->>'path') from jsonb_array_elements(p_images)) <> jsonb_array_length(p_images) then
    raise exception 'Images must have distinct paths' using errcode = '23514';
  end if;
  if p_price is not null and (p_price < 0 or p_price >= 1000000000000 or p_price = 'NaN'::numeric or scale(p_price) > 2) then
    raise exception 'Invalid price' using errcode = '23514';
  end if;
  select * into existing from public.wishlist_items where id = p_id for update;
  if found then
    if existing.owner_id <> auth.uid() then raise exception 'Not the owner' using errcode = '42501'; end if;
    if p_expected_updated_at is null or existing.updated_at <> p_expected_updated_at then
      raise exception 'Wish changed on another device; refresh before editing' using errcode = '40001';
    end if;
    update public.wishlist_items set title = p_title, description = p_description,
      price = p_price, currency = p_currency, product_url = p_product_url,
      priority = p_priority, category = p_category where id = p_id;
  else
    if p_expected_updated_at is not null then raise exception 'Wish was deleted' using errcode = '40001'; end if;
    insert into public.wishlist_items(id, owner_id, title, description, price, currency, product_url, priority, category)
    values (p_id, auth.uid(), p_title, p_description, p_price, p_currency, p_product_url, p_priority, p_category);
  end if;
  set constraints public.wishlist_images_wish_id_sort_order_key deferred;
  delete from public.wishlist_images where wish_id = p_id and storage_path not in
    (select value->>'path' from jsonb_array_elements(p_images));
  for photo in select value from jsonb_array_elements(p_images) loop
    insert into public.wishlist_images(wish_id, storage_path, sort_order, original_name)
    values (p_id, photo->>'path', image_position, coalesce(photo->>'name', 'Photo'))
    on conflict (wish_id, storage_path) do update
      set sort_order = excluded.sort_order, original_name = excluded.original_name;
    delete from public.wishlist_image_cleanup where storage_path = photo->>'path';
    image_position := image_position + 1;
  end loop;
  return p_id;
end;
$$;

-- Restrict every function explicitly; trigger functions are not callable RPCs.
create function public.claim_wish_image_cleanup() returns table(storage_path text)
language sql security invoker set search_path = '' as $$
  with due as (
    select c.storage_path from public.wishlist_image_cleanup c
    where c.owner_id = auth.uid() and c.not_before <= now()
    order by c.not_before, c.storage_path limit 20 for update skip locked
  )
  update public.wishlist_image_cleanup c set claimed_at = now()
  from due where c.storage_path = due.storage_path returning c.storage_path;
$$;
create function public.expire_wish_uploads(p_paths text[]) returns void
language sql security invoker set search_path = '' as $$
  update public.wishlist_image_cleanup set not_before = now()
  where owner_id = auth.uid() and storage_path = any(p_paths);
$$;
revoke all on function public.claim_wish_image_cleanup(), public.expire_wish_uploads(text[]) from public, anon;
grant execute on function public.claim_wish_image_cleanup(), public.expire_wish_uploads(text[]) to authenticated;
revoke all on function public.validate_wish_image(), public.queue_removed_wish_image(), public.check_wish_image_count() from public, anon, authenticated;
revoke all on function public.save_wish(uuid,text,text,numeric,text,text,text,text,jsonb,timestamptz) from public, anon;
grant execute on function public.save_wish(uuid,text,text,numeric,text,text,text,text,jsonb,timestamptz) to authenticated;

commit;
