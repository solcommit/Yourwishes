-- Permit genuinely photo-free wishes; retain existing triggers, ownership checks,
-- invoker security, grants, cleanup and maximum image count.
begin;

create or replace function public.check_wish_image_count() returns trigger
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
    if total > 5 then raise exception 'A wish allows up to 5 images' using errcode = '23514'; end if;
  end if;
  return null;
end;
$$;
create or replace function public.save_wish(
  p_id uuid, p_title text, p_description text, p_price numeric, p_currency text,
  p_product_url text, p_priority text, p_category text, p_images jsonb,
  p_expected_updated_at timestamptz default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare existing public.wishlist_items%rowtype; photo jsonb; image_position integer := 0;
begin
  if auth.uid() is null or not exists (select 1 from public.app_members where user_id = auth.uid()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_images is null or jsonb_typeof(p_images) <> 'array' or jsonb_array_length(p_images) not between 0 and 5 then
    raise exception 'A wish allows up to 5 images' using errcode = '23514';
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

commit;
