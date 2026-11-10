# Private photo performance rollout

The migration and app changes are prepared locally, not applied to production.

1. Apply `supabase/migrations/202611100001_private_thumbnails.sql` through the existing reviewed migration process. This creates a private derivative bucket and a security-invoker RPC that combines membership and photo RLS checks. It grants no anonymous access and uses no service-role key.
2. Deploy the app. Before migration, image reads retain the old checked fallback and generate thumbnails in memory; durable writes fail harmlessly. Durable thumbnail access and faster RPC require migration.
3. Backfill old photos once for EACH owner. In ignored `.env.local`, set `THUMBNAIL_BACKFILL_EMAIL` and `THUMBNAIL_BACKFILL_PASSWORD` for that account, alongside existing public Supabase config. Never commit credentials. Run `node scripts/backfill-private-thumbnails.mjs` for a metadata-only dry run; inspect the count, then run with `--apply` to write derived photos. It is sequential, owner-scoped, and resumable (immutable existing variants are not overwritten). Remove the temporary credentials after use. This script has NOT been run against production.
4. Compare cold/repeated Mine and Partner images. `Server-Timing` contains identity/access/download/thumbnail/total stages; `X-Thumbnail-Source` distinguishes memory, durable, generated, and original responses. Headers contain no account IDs, tokens, or paths. A missing bucket causes fallback rather than lost originals; investigate failed durable generation before expecting production gains.

New uploads generate 320/640/960 WebP variants after the response. Owner thumbnail misses also attempt durable generation. Partner reads never gain permission to write another owner's variants. Original cleanup removes all three variants before acknowledging its durable cleanup job; failures retain the job for retry.

Browser cache is memory-only: 30-second lifetime, 16 MiB/128-entry bounds, shared pending downloads, timeout and validation. No localStorage/IndexedDB/HTTP public caching. Session end/account-change events clear and abort cache work. Deleted entries are pruned on list refresh. Already-open images remain subject to normal displayed-content lifetime; a cached blob may be reused for up to 30 seconds before a fresh authorization request. This bounded freshness tradeoff must match the app's privacy expectations; no instantaneous remote-revocation guarantee is claimed.

Tiles keep placeholder geometry, show a shadcn-style inline Alert plus Sonner toast on failure, and expose a separate keyboard-accessible retry. The tile-open button and retry are siblings, not nested interactive elements. Detail originals share bounded memory fetches while retaining existing decoded transition behavior.

Validation: `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `npx playwright test -c playwright.photo-performance.config.ts`. These fixture tests use synthetic images and no production credentials. Live RLS migration tests, backfill and actual speedup measurements remain deployment checks. Do not disable authorization or make either bucket public to improve timing.


## Local validation results (2026-11-10)

- Lint, TypeScript and production build pass.
- 15 fixture tests pass: live-access-before-cache, denied reads, rolling-migration fallback, bounded sizes, durable-cache bypass of original downloads, reader isolation, session clearing, cache expiry/deduplication, retry/toast and wishlist mutation races.
- Full Next.js app with synthetic backend: Chrome at 390px and 1440px; 12 Partner wishes; grid/list switching, image rendering, detail close/focus restoration, failure toast and successful retry. No horizontal overflow or runtime exceptions observed. Both local fixture servers stopped afterward.
- The cache test confirms a warm remount causes zero extra thumbnail requests in its 30-second window. The route test confirms durable hits cause zero original downloads. These are behavioral checks, not a measured production speedup.
- SQL policies have been reviewed but not executed against a real/disposable Supabase database; neither live backfill nor production deployment has been run.
