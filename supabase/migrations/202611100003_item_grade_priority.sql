begin;
alter table public.wishlist_items drop constraint wishlist_items_priority_check;
update public.wishlist_items set priority = case priority
  when 'Low' then 'Common' when 'Medium' then 'Rare' when 'High' then 'Legendary'
  else priority end
where priority in ('Low', 'Medium', 'High');
-- Flush deferred wish/image constraint triggers from the UPDATE before further DDL.
set constraints all immediate;
alter table public.wishlist_items alter column priority set default 'Rare';
alter table public.wishlist_items add constraint wishlist_items_priority_check
  check (priority in ('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'));
commit;
