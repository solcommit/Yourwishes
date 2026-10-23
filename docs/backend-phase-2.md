# Backend Phase 2

Phase 2 replaces mock wishlist state with persistent wishes and ordered private
images. Slots A/B have identical permissions; every operation derives ownership
from the verified user's UUID. Profile nickname/avatar editing remains the local
browser behavior from Phase 1. There are no reservations, notifications, or gift
claims. The Surprises page remains a view of the partner's list.

## Required manual Supabase setup

Do this first in a separate test project, then back up production before applying
the same migration there. Phase 1 migrations and A/B provisioning must already be
complete. Do not re-run or edit the applied Phase 1 migrations.

1. Open Dashboard → SQL Editor as administrator.
2. Run the **entire** file
   `supabase/migrations/202610220003_phase2_wishlist_storage.sql` once. It is
   transactional. If you use Supabase CLI migration history instead, apply with
   `supabase db push`; do not apply using both methods without reconciling history.
3. Open Storage → `wishlist-images`. Confirm **Public bucket is OFF**, the file
   limit is **5,242,880 bytes (5 MiB)**, and allowed MIME types are exactly
   `image/jpeg`, `image/png`, `image/webp`. The migration creates/configures the
   bucket; do not create a public replacement. Ensure the project-wide upload
   limit and hosting request-body limit allow a 5 MiB file plus multipart overhead.
4. Inspect Storage policies. The migration adds member-only reads, staged
   owner-prefix uploads, and owner-only removal of unreferenced objects. It adds
   **no UPDATE policy**: replacing a photo means a new UUID path, then removing
   the old file after the database save. Audit/remove any older broad policies
   that also cover this bucket; permissive PostgreSQL policies combine with OR.
5. Restart the Next.js server. Existing `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are sufficient. No secret/service-role
   key, new Auth accounts, Realtime publication, or public bucket is required.

As administrator, verify:

```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'wishlist-images';

select schemaname, tablename, policyname, cmd
from pg_policies
where (schemaname = 'public' and tablename in
  ('app_members','profiles','wishlist_items','wishlist_images','wishlist_image_cleanup'))
  or (schemaname = 'storage' and tablename = 'objects');

select n.nspname, c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where (n.nspname = 'public' and c.relname in
  ('app_members','profiles','wishlist_items','wishlist_images','wishlist_image_cleanup'))
  or (n.nspname = 'storage' and c.relname = 'objects');
```

Do not delete real data to resolve migration errors. Phase 1 did not write real
wishes through the UI, but manually inserted legacy photo metadata may reference
objects that never existed. Inspect any such records separately. Editing requires
at least one valid uploaded image; missing photos can be removed and re-added.
The migration does not delete or automatically rewrite legacy wishes.

## Data, authorization, and synchronization

- `/api/wishlist` reads/saves/deletes using a fresh verified member session and
  the publishable key. Every mutation checks same-origin requests. No owner ID
  sent by the browser is used to assign ownership.
- `save_wish` is a SECURITY INVOKER transaction: it locks/checks the current wish,
  derives `owner_id` from `auth.uid()`, and persists fields plus image ordering
  atomically. Existing Phase 1 RLS and column grants still enforce owner writes
  and pair reads. Category is an optional field in the existing form.
- Database constraints and deferred triggers enforce 1–5 images, even through
  direct API calls. All metadata mutations lock their parent, preventing
  concurrent deletions from evading the minimum count. Image paths must match
  the wish owner's UUID and wish UUID and point to an existing private object.
- Updates and deletes check `updated_at` to reject stale edits. A form uses one
  stable wish UUID, a submission latch, and disabled interactions while saving.
  A lost reply cannot cause a second wish to be created; refresh/reopen the saved
  wish if the app reports a conflict after a network interruption.
- Both lists load newest first (`created_at DESC, id DESC`); photo ordering is
  deterministic. Queries never fall back to mock data. Initial loading, empty,
  retry, mutation errors, and per-photo upload progress are shown in the existing
  surfaces. Fixtures now live only in `tests/fixtures/`.
- Visible, online pages revalidate on a 30-second polling schedule and stale
  focus/visibility restoration. Data remains fresh for 30 seconds; overlapping
  reads share one request. Failed polling backs off to at most two minutes.
  Reconnection and explicit retry refresh immediately. Mutations start background
  revalidation after commit without waiting for it. Unchanged snapshots retain
  their references, and background failures preserve loaded content. This is
  polling/revalidation, **not Realtime subscriptions**.
- Items are held only in component memory, keyed by authenticated user UUID.
  Sign-out clears private state and notifies other tabs; identity mismatches,
  expired sessions, and account switches drop the old data. Event listeners,
  timers, auth listeners, and requests are cleaned up on unmount. HTTP responses
  use `private, no-store`; no persistent wishlist cache is created.
- Discover uses the same real partner items. Remote candidate changes clear
  pending/results from removed wishes; the wheel and instant-pick animations are
  otherwise unchanged. An empty partner list is handled without synthetic items.

## Private images and failure recovery

Uploads pass through `/api/wishlist/uploads`, which verifies membership, bounds
actual request bytes, checks size/MIME, image magic bytes and dimension headers, and generates
`<owner UUID>/<wish UUID>/<random image UUID>.<jpg|png|webp>`. Bucket restrictions
also apply to direct Storage API calls. Corrupt images with plausible signatures
may still be rejected by browser decoding; the gallery displays an empty photo
surface rather than crashing. Client-side HEIC conversion and metadata removal
are documented in [heic-uploads.md](heic-uploads.md). No conversion service is added.

Images render through `/api/wishlist/images/<metadata UUID>` as authenticated
private downloads, not public or signed URLs. The handler checks the session and
RLS and sets no-store/nosniff headers. Partners can read registered photos, but
only an owner can read their uncommitted staged uploads. Missing/deleted objects
return 404 and render as empty image surfaces.

Grid/list thumbnails use the same authorized endpoint with `?width=320`, `640`
or `960`. Server-side Sharp emits proportional WebP thumbnails; originals are
unchanged and loaded on demand in the detail gallery. A bounded, five-minute
in-memory thumbnail cache is isolated by reader UUID and path. Identity,
membership and photo RLS are checked before every cache lookup. Sign-out clears
that reader's cache in the serving process; other instances remain protected by
the same checks and expiry. No public Next image-optimizer cache is used.

Storage and PostgreSQL do not share a transaction, so compensation is durable:

1. Before uploading bytes, create an owner-scoped `wishlist_image_cleanup` row
   with a one-hour grace period. A crash or lost upload reply leaves a tracked
   cleanup task, not an untracked filename.
2. Saving metadata removes the corresponding task in the same transaction.
3. Removing/replacing metadata queues the old path for immediate cleanup in the
   database transaction. The app deletes bytes via the **Storage API**, never by
   deleting `storage.objects` rows in SQL.
4. Failed upload/save attempts expire their staged tasks and attempt cleanup.
   Local previews remain available for retry. If an HTTP response is lost after
   commit, committed photos have no staging task and cannot be deleted by this
   compensation step; Storage DELETE also refuses referenced files.
5. Cleanup claims batches using database time and row locks. A claimed/expired
   path cannot be registered by a racing save. Failed cleanup tasks remain for
   retry on subsequent reads/mutations. Success with cleanup pending is reported
   as a warning rather than pretending the committed wish failed. Normal reads
   and successful mutations schedule cleanup with Next.js `after()` so it does
   not hold the response open. Read-triggered cleanup is throttled to once per
   minute per owner in each server process; failures allow retries and their
   last-known status is reported on a subsequent response. Hosting must support
   Next.js `after()` for this work to complete after the HTTP response.

Canceled forms or abrupt disconnects can leave staged files for up to the grace
period **plus the time until that owner next visits**. If both users remain
offline, the durable queue remains pending; no unattended worker is deployed by
this phase. To guarantee cleanup while both are offline, schedule a trusted
server worker that consumes these tasks and calls the Storage API, with the same
reference/claim safeguards. Never use raw SQL deletion of Storage metadata as a
substitute. Administrators can inspect pending tasks with:

```sql
select owner_id, not_before, claimed_at, created_at
from public.wishlist_image_cleanup order by created_at;
```

## Verification and disposable integration tests

Run:

```sh
npm run lint
npx tsc --noEmit
npm run build
npm run test:e2e
```

Anonymous/auth-layout tests and wishlist validation tests do not need account
passwords. Existing workspace tests remain available and require Account A
credentials. Live mutation tests explicitly skip unless enabled for a disposable
project, and never reset existing tables. The mutation suite also skips if the
test accounts' wishlists are not initially empty.

For live tests, provision A/B in an **empty disposable Supabase project**, apply
all three migrations, and put the following in ignored `.env.phase2-test`:

```text
NEXT_PUBLIC_SUPABASE_URL=your_disposable_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_test_publishable_key
E2E_DISPOSABLE_SUPABASE=true
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001
E2E_MEMBER_A_EMAIL=account_a_email
E2E_MEMBER_A_PASSWORD=account_a_password
E2E_MEMBER_B_EMAIL=account_b_email
E2E_MEMBER_B_PASSWORD=account_b_password
# Optional: manually create a third user ONLY in this disposable project,
# without adding it to app_members, for nonmember RLS/Storage checks.
E2E_MEMBER_NONMEMBER_EMAIL=nonmember_email
E2E_MEMBER_NONMEMBER_PASSWORD=nonmember_password
```

Do not leave the optional third-account variables set to placeholders; omit them
if no third test user exists. Do not set disposable opt-in against production.
Start a fresh test server with the test environment (the configuration refuses
to reuse an existing server in disposable mode):

```sh
node --env-file=.env.phase2-test node_modules/@playwright/test/cli.js test
```

The live CRUD suite runs once at the desktop baseline, creates only its own UUID
fixtures, and attempts cleanup of only those IDs. It covers create/edit/delete,
reload persistence, reciprocal partner read-only access, cross-context refresh,
image upload/reorder/removal, direct Storage overwrite/removal denial, minimum/
maximum image counts, empty lists, real partner Discover choices, and optional
nonmember reads. Traces remain disabled to avoid recording credentials/tokens.
The old Phase 1 `scripts/verify-rls.mjs` predates the required-image constraints;
use the Phase 2 suite for a project with this migration applied.

No live RLS/Storage verification is implied by compilation or anonymous-browser
checks. Applying migrations, bucket-policy compatibility, successful member
CRUD, actual Storage behavior, cleanup races, and cross-account synchronization
require the disposable environment above to be exercised.

## Files changed

- New migration `202610220003_phase2_wishlist_storage.sql`; Phase 1 SQL unchanged.
- New API handlers: `src/app/api/wishlist/route.ts`, `uploads/route.ts`, and
  `images/[id]/route.ts`.
- New `src/lib/wishlist/{types,server}.ts` and
  `src/components/use-wishlist-data.ts`.
- Updated `app-shell.tsx`, `workspace-pages.tsx`, workspace `layout.tsx`,
  `sign-out-button.tsx`, `proxy.ts`, and the Supabase server request timeout.
- Updated `wish-media.ts` and `format-price.ts` to use real domain types;
  fictional data moved from `src/lib/mock-data.ts` to `tests/fixtures/mock-data.ts`.
- Added CRUD/validation Playwright specs; updated auth/workspace specs and
  test-server configuration. Updated README and backend setup documentation.

References: [Storage access control](https://supabase.com/docs/guides/storage/security/access-control),
[private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals),
[upload limits](https://supabase.com/docs/guides/storage/uploads/file-limits).
