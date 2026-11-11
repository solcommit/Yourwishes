# Discover tools

## Activation
Run `supabase/migrations/202611110002_discover_tools.sql` once in the Supabase SQL
Editor after the existing Phase 1/wishlist migrations. It creates four tables,
their grants/RLS policies and two security-invoker RPCs. It sends a PostgREST schema
reload notification. This change does not apply migrations to the live project.
Reload Discover afterward. Until setup, existing Spin/Pick and local budget filtering
remain usable; server-backed tools show a sync error and preserve unsaved form input.

## Behavior
- Within budget: filter partner wishes by one currency and known price, then use
  that candidate set in Spin/Pick. No exchange rates or financial recommendation.
- This or That: compare two own wishes; atomic wins/appearance totals are shared
  with the partner as favorites. Own results can be reset. It leaves wish priorities
  unchanged. Ranking is a simple vote count, not an unbiased survey or price score.
- Surprise shortlist: partner wishes and private notes, optionally linked to a
  shared special day. Owner-only reads/writes apply through REST and RPC as well as
  the UI. Deleting a wish removes its shortlist entry. Deleting a linked occasion
  clears only the occasion link, retaining the note. A second browser for the same
  account reads the same saved plans; the other account cannot.
- Special days: shared title/type/date, optional annual recurrence, edit/delete.
  Anniversary dates use the original relationship start date. The launcher shows
  the next anniversary (or next special day if none), calendar days and anniversary
  years. Today, future starts, past one-time events and year rollover are handled.
  Feb 29 recurs on Feb 28 in non-leap years. Day arithmetic uses local device calendar
  dates with UTC day-number subtraction, avoiding DST and date-string timezone bugs.
  This is a countdown, not a background push/reminder service.
- Our wishlist: both members can create/edit/delete/complete shared text wishes,
  notes, optional price/currency and HTTP(S) links. Completion is optimistic and
  rolls back if saving fails. Shared wishes use a separate table and do not change
  personal wishlist ownership or upload rules.

## Boundaries and sync
The one combined GET uses a single invoker snapshot RPC after existing live member
authorization. Private responses remain no-store, no Service Worker caching or
localStorage of notes. Discover-only provider retains a verified user-scoped
snapshot, deduplicates requests, checks freshness on focus and polls every 60 seconds
only while visible. Hidden Activity cleanup aborts reads; returning restores saving
state. Session-ending events clear the snapshot. Mutations invalidate older reads.
Heavy tool rendering is lazy-loaded; the original Spin/Pick entry remains lightweight.

Mutations validate bounded JSON/text, IDs, URL protocols, currency/price/date and
same-origin requests. Identity/creator fields come from the session. Shared edits
and deletes require the last updated_at and return 409 rather than overwriting
another device. Reopen an item after a conflict. New shared/date forms retain a
draft UUID for safe retries; identical committed creates are idempotent for the
same creator/content. Preferences update both candidates in one transaction with
stable row lock order. Snapshot caps: 500 shortlist, occasions and shared rows;
1000 preference counters. Backend pagination beyond those limits is not included.

## Icons and layout
Seven entries use the existing three-column app launcher. Original two WebP icons
remain. New entries use Lucide fallback artwork until custom icons are supplied;
set their src in src/lib/discover-icons.ts to a local WebP to replace them.
Buttons retain Gooey-style surfaces and the existing motion/reduced-motion behavior.

## Validation
Actual migration executed in an isolated in-memory PostgreSQL engine (PGlite), not
live Supabase: owner/private note isolation, own-only votes, atomic vote failure,
shared edits, immutable creator grants, anonymous/nonmember denial and snapshot
privacy. API fixtures exercise real validation/origin/auth/CAS/idempotency code.
Two-browser HTTP fixtures exercise persistence workflows and account-specific views.
Calendar/budget edge cases and all forms at 375x667 are tested in Chrome and WebKit.
This is not physical iPhone testing or live deployed Supabase validation.

## Files
- src/lib/discover/types.ts: shared data contracts, budget and date logic.
- supabase/migrations/202611110002_discover_tools.sql: persistence, RLS and RPCs.
- src/app/api/discover/route.ts: authenticated validated reads and writes.
- src/components/discover/data-provider.tsx: session-scoped synchronization.
- src/components/discover/countdown.tsx: local calendar subscription and widget.
- src/components/discover/tools.tsx / tools.css: five responsive feature screens.
- src/lib/discover-icons.ts / src/components/discover-action.tsx: launcher entries.
- src/components/workspace-pages.tsx: provider/widget and lazy screen integration.
- tests/e2e/discover-api.spec.ts / discover-tools.spec.ts: API and browser coverage.
- playwright.photo-performance.config.ts: includes the new tests.
