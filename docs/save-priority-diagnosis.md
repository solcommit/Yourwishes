# Save failure: outdated priority constraint

The local database returned SQLSTATE 23514, table wishlist_items, constraint wishlist_items_priority_check when saving Legendary. This rejects both inserts and edits because the frontend submits the five-grade priority contract while the database still enforces legacy values. The generic Mongolian UI error hid that diagnosis.

Apply the existing supabase/migrations/202611100003_item_grade_priority.sql in Supabase SQL Editor. It transactionally maps Low to Common, Medium to Rare, High to Legendary and permits all five priorities. This is unrelated to the removed, unapplied reorder migration. No live database changes were executed by this session; successful real saves remain to be verified after the user applies it.

Save diagnostics now serialize only safe SQLSTATE/table/constraint metadata so Next development logs preserve it. No failing row or raw database details are logged. Specific priority/currency migration, unavailable save RPC and permission failures receive actionable Mongolian UI messages. Regression tests stub those database failures for create and edit and check that private details are not returned.

The avatar/empty-folder changes were also verified in the actual synthetic Next app: fixed avatar x/y remains unchanged while the lowest folder opens at 375/768/1440px; profile hover expansion still works; empty folders have zero page elements and still open. Repeatable script: scripts/audit-avatar-folders.mjs. No live user data is used.
