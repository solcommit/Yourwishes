begin;

-- Administrator-managed singleton pair: the check and unique constraint cap it at two.
create table public.app_members (
  user_id uuid primary key references auth.users(id) on delete restrict,
  slot text not null unique check (slot in ('A', 'B')),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  -- Only the two provisioned members can have profiles.
  constraint profiles_member foreign key (id) references public.app_members(user_id) on delete restrict,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 32),
  avatar_path text check (avatar_path is null or char_length(avatar_path) between 1 and 1024),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.app_members(user_id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 500),
  price numeric(14, 2) check (price >= 0 and price <> 'NaN'::numeric),
  currency text not null default 'USD' check (currency in ('USD', 'MNT')),
  product_url text check (product_url is null or (char_length(product_url) <= 2048 and product_url ~* '^https?://[^[:space:]]+$')),
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High')),
  category text check (category is null or char_length(btrim(category)) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index wishlist_items_owner_created_idx on public.wishlist_items(owner_id, created_at desc);

-- Metadata only in Phase 1. No bucket, upload API, or public media URLs.
create table public.wishlist_images (
  id uuid primary key default gen_random_uuid(),
  wish_id uuid not null references public.wishlist_items(id) on delete cascade,
  storage_path text not null check (char_length(storage_path) between 1 and 1024),
  sort_order smallint not null check (sort_order between 0 and 4),
  created_at timestamptz not null default now(),
  unique (wish_id, sort_order),
  unique (wish_id, storage_path)
);

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public, anon, authenticated;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger wishlist_items_updated_at before update on public.wishlist_items
for each row execute function public.set_updated_at();

alter table public.app_members enable row level security;
alter table public.profiles enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.wishlist_images enable row level security;

-- Revoke Supabase's default table grants before assigning the minimal privileges.
revoke all on public.app_members, public.profiles, public.wishlist_items, public.wishlist_images from public, anon, authenticated;
grant select on public.app_members to authenticated;
grant select on public.profiles to authenticated;
grant insert (id, nickname, avatar_path), update (nickname, avatar_path) on public.profiles to authenticated;
grant select, delete on public.wishlist_items to authenticated;
grant insert (id, owner_id, title, description, price, currency, product_url, priority, category),
  update (title, description, price, currency, product_url, priority, category)
  on public.wishlist_items to authenticated;
grant select, delete on public.wishlist_images to authenticated;
grant insert (id, wish_id, storage_path, sort_order), update (storage_path, sort_order)
  on public.wishlist_images to authenticated;

commit;
