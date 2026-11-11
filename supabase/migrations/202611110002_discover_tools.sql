begin;
create table public.discover_shortlist (
 owner_id uuid not null references public.app_members(user_id) on delete restrict,
 wish_id uuid not null references public.wishlist_items(id) on delete cascade,
 note text not null default '' check(char_length(note)<=500),
 occasion_id uuid,
 updated_at timestamptz not null default now(), primary key(owner_id,wish_id)
);
create table public.discover_preferences (
 owner_id uuid not null references public.app_members(user_id) on delete restrict,
 wish_id uuid not null references public.wishlist_items(id) on delete cascade,
 wins integer not null default 0 check(wins>=0),
 compared integer not null default 0 check(compared>=wins), primary key(owner_id,wish_id)
);
create table public.discover_occasions (
 id uuid primary key default gen_random_uuid(),
 created_by uuid not null default auth.uid() references public.app_members(user_id) on delete restrict,
 title text not null check(char_length(btrim(title)) between 1 and 100),
 date date not null check(date between date '1900-01-01' and date '2199-12-31'),
 annual boolean not null default true,
 kind text not null default 'other' check(kind in ('anniversary','birthday','other')),
 updated_at timestamptz not null default now()
);
create table public.discover_shared_wishes (
 id uuid primary key default gen_random_uuid(),
 created_by uuid not null default auth.uid() references public.app_members(user_id) on delete restrict,
 title text not null check(char_length(btrim(title)) between 1 and 100),
 description text not null default '' check(char_length(description)<=500),
 price numeric(14,2) check(price>=0 and price<1e12 and price<>'NaN'::numeric),
 currency text not null default 'MNT' check(currency in ('MNT','USD','CNY')),
 url text not null default '' check(url='' or (char_length(url)<=2048 and url ~* '^https?://[^[:space:]]+$')),
 done boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.discover_shortlist add constraint shortlist_occasion_fk foreign key(occasion_id) references public.discover_occasions(id) on delete set null;
create trigger discover_shortlist_updated before update on public.discover_shortlist for each row execute function public.set_updated_at();
create trigger discover_occasions_updated before update on public.discover_occasions for each row execute function public.set_updated_at();
create trigger discover_shared_updated before update on public.discover_shared_wishes for each row execute function public.set_updated_at();
alter table public.discover_shortlist enable row level security;
alter table public.discover_preferences enable row level security;
alter table public.discover_occasions enable row level security;
alter table public.discover_shared_wishes enable row level security;
revoke all on public.discover_shortlist,public.discover_preferences,public.discover_occasions,public.discover_shared_wishes from public,anon,authenticated;
grant select,insert,update,delete on public.discover_shortlist to authenticated;
grant select,insert,delete on public.discover_preferences to authenticated;
grant update(wins,compared) on public.discover_preferences to authenticated;
grant select,delete on public.discover_occasions,public.discover_shared_wishes to authenticated;
grant insert(id,created_by,title,date,annual,kind),update(title,date,annual,kind) on public.discover_occasions to authenticated;
grant insert(id,created_by,title,description,price,currency,url,done),update(title,description,price,currency,url,done) on public.discover_shared_wishes to authenticated;

-- Private, including via direct REST/RPC: the partner never sees these notes.
create policy shortlist_select on public.discover_shortlist for select to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.app_members where user_id=(select auth.uid())));
create policy shortlist_insert on public.discover_shortlist for insert to authenticated with check(owner_id=(select auth.uid()) and exists(select 1 from public.app_members where user_id=(select auth.uid())) and exists(select 1 from public.wishlist_items where id=wish_id and owner_id<>(select auth.uid())));
create policy shortlist_update on public.discover_shortlist for update to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.app_members where user_id=(select auth.uid()))) with check(owner_id=(select auth.uid()) and exists(select 1 from public.wishlist_items where id=wish_id and owner_id<>(select auth.uid())));
create policy shortlist_delete on public.discover_shortlist for delete to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.app_members where user_id=(select auth.uid())));
create policy preferences_read_pair on public.discover_preferences for select to authenticated using(exists(select 1 from public.app_members where user_id=(select auth.uid())));
create policy preferences_insert_self on public.discover_preferences for insert to authenticated with check(owner_id=(select auth.uid()) and exists(select 1 from public.wishlist_items where id=wish_id and owner_id=(select auth.uid())));
create policy preferences_update_self on public.discover_preferences for update to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.app_members where user_id=(select auth.uid()))) with check(owner_id=(select auth.uid()) and exists(select 1 from public.wishlist_items where id=wish_id and owner_id=(select auth.uid())));
create policy preferences_delete_self on public.discover_preferences for delete to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.app_members where user_id=(select auth.uid())));

create policy occasions_read on public.discover_occasions for select to authenticated using(exists(select 1 from public.app_members where user_id=(select auth.uid())));
create policy occasions_insert on public.discover_occasions for insert to authenticated with check(created_by=(select auth.uid()) and exists(select 1 from public.app_members where user_id=(select auth.uid())));
create policy occasions_update on public.discover_occasions for update to authenticated using(exists(select 1 from public.app_members where user_id=(select auth.uid()))) with check(exists(select 1 from public.app_members where user_id=(select auth.uid())));
create policy occasions_delete on public.discover_occasions for delete to authenticated using(exists(select 1 from public.app_members where user_id=(select auth.uid())));
create policy shared_read on public.discover_shared_wishes for select to authenticated using(exists(select 1 from public.app_members where user_id=(select auth.uid())));
create policy shared_insert on public.discover_shared_wishes for insert to authenticated with check(created_by=(select auth.uid()) and exists(select 1 from public.app_members where user_id=(select auth.uid())));
create policy shared_update on public.discover_shared_wishes for update to authenticated using(exists(select 1 from public.app_members where user_id=(select auth.uid()))) with check(exists(select 1 from public.app_members where user_id=(select auth.uid())));
create policy shared_delete on public.discover_shared_wishes for delete to authenticated using(exists(select 1 from public.app_members where user_id=(select auth.uid())));

-- Atomic pair vote: no partial increment and no rating a partner's wishes.
create function public.record_wish_preference(p_winner uuid,p_loser uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if p_winner=p_loser or (select count(*) from public.wishlist_items where id in (p_winner,p_loser) and owner_id=(select auth.uid()))<>2 then
  raise exception 'Choose two distinct wishes you own' using errcode='22023';
 end if;
 insert into public.discover_preferences(owner_id,wish_id,wins,compared)
 select (select auth.uid()),entry.wish_id,entry.wins,1 from (values(p_winner,1),(p_loser,0)) as entry(wish_id,wins) order by entry.wish_id
 on conflict(owner_id,wish_id) do update set wins=public.discover_preferences.wins+excluded.wins,compared=public.discover_preferences.compared+excluded.compared;
end; $$;
revoke all on function public.record_wish_preference(uuid,uuid) from public,anon;
grant execute on function public.record_wish_preference(uuid,uuid) to authenticated;

-- One authorized database roundtrip for all tools; row policies apply inside it.
create function public.discover_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'shortlist',coalesce((select jsonb_agg(to_jsonb(s)) from (select * from public.discover_shortlist where owner_id=(select auth.uid()) order by updated_at desc limit 500) s),'[]'::jsonb),
 'preferences',coalesce((select jsonb_agg(to_jsonb(s)) from (select * from public.discover_preferences order by wins desc limit 1000) s),'[]'::jsonb),
 'occasions',coalesce((select jsonb_agg(to_jsonb(s)) from (select * from public.discover_occasions order by date limit 500) s),'[]'::jsonb),
 'shared',coalesce((select jsonb_agg(to_jsonb(s)) from (select * from public.discover_shared_wishes order by updated_at desc limit 500) s),'[]'::jsonb)
 ); $$;
revoke all on function public.discover_snapshot() from public,anon;
grant execute on function public.discover_snapshot() to authenticated;
notify pgrst, 'reload schema';
commit;
