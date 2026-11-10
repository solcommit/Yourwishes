begin;
alter table public.wishlist_items drop constraint wishlist_items_currency_check;
alter table public.wishlist_items add constraint wishlist_items_currency_check
  check (currency in ('USD', 'MNT', 'CNY'));
commit;
