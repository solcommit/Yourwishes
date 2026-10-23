# Phase 2 performance audit — October 23, 2026

Live development and production baselines were recorded before changing
performance behavior. Credentials were loaded by `@next/env` from `.env.local`.
Retained results contain no credentials; the generated-report privacy issue and
its cleanup are described below. Authentication state stayed in memory.
No wishlist edits/deletions, uploads, migrations, or destructive live CRUD tests
were performed. Normal application reads retain their existing queued-photo
cleanup behavior. Public/synthetic fixtures supplied mutation-race and HEIC tests.

**Measured results.** These are pooled medians of the nine online scenarios per
mode, not INP scores or statistically controlled promises about an actual phone.
Each mode has 12 before and 12 after scenarios: three viewports × four networks.
The sanitized individual results are in [performance-metrics.json](performance-metrics.json).

| Measurement | Development before → after | Production before → after |
| --- | --- | --- |
| Initial usable wishlist, unthrottled | 2,980 → 1,935 ms | 2,758 → 1,354 ms |
| Background wishlist response TTFB | 1,672 → 985 ms | 1,719 → 876 ms |
| Warm navigation to available heading | 801 → 296 ms | 21 → 16 ms |
| Detail click to dialog DOM | 35 → 21 ms | 25 → 29 ms |
| Main-thread tasks ≥50 ms during measured interactions/scroll | 0 → 0 | 0 → 0 |
| Frame-interval p95 | about 16.7–16.8 → 16.7–16.8 ms | about 16.7–16.8 → 16.7–16.8 ms |
| Median browser task time in the sampled window | 285 → 253 ms | 216 → 207 ms |
| Median layout count in sampled window | 23 → 53 | 19 → 18 |
| Median style-recalculation count | 227 → 207 | 196 → 156 |
| Existing tiles remaining after offline refresh, all three viewports | 0 → 2 | 0 → 2 |

Production detail responsiveness did not measurably improve; its small increase
is within these samples' variability. Frame stability was already good in this
desktop Chromium environment. Development layout counts increased, despite fewer
component renders; there is no evidence here that every kind of rendering work
decreased. The frame sampler measures requestAnimationFrame intervals, not actual
GPU presentation or an iPhone's dropped-frame rate.

The same navigation/refresh/detail sequence in development committed these
component renders (React's devtools fiber timing, with retained flags excluded):

| Component | Before | After |
| --- | ---: | ---: |
| AppShell | 4 | 3 |
| WishTile, two wishes combined | 10 | 2 |
| WishlistPage | 5 | 2 |
| ProfileControl | 4 | 1 |
| AppDock | 4 | 1 |

Production component render counts are unavailable from the ordinary production
React build; they are deliberately reported as null. A separate isolated React
hook test reproduced an extra committed render on an identical refresh before
the change (2 → 3 total renders), and passes with no added render afterward.

**Confirmed causes and changes.**

- Each normal wishlist read previously waited for six sequential Supabase-shaped
  requests: Auth and membership in Proxy, Auth and membership in the DAL, wish
  data, and orphan cleanup. A repeatable local fixture with 150 ms per backend
  request measured a 935 ms median. The optimized median is 636 ms: four critical
  requests with the fixture's legacy HS256 token, with cleanup deferred/throttled.
  Asymmetric production JWTs can verify in Proxy using cached JWKS. The DAL still
  calls live `getUser()`, checks membership, and applies RLS. No incoming user
  header or unverified session is trusted. This follows
  [Supabase's SSR guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs).
- Cleanup now uses Next.js `after()` after responses. Reads schedule at most
  once per minute per owner/process; mutations explicitly schedule cleanup.
  Failures retain durable database jobs for retry, and last-known failure status
  can appear on a later response. Cleanup does not determine whether a committed
  mutation was successful. Deployment must support `after()`.
- Every unchanged JSON snapshot previously replaced all item references. Full
  payload reconciliation now retains unchanged objects/arrays, with transitions
  for nonurgent snapshot updates. There is one in-flight read. Aborted replies
  cannot update state, and mutations cancel older reads. Tests cover races and
  sign-out while a reply is pending.
- Sheet state was part of the shared workspace context dependency even when
  `addSheetOpen` remained false. Actions now have a stable separate context; tiles
  and navigation/profile controls are memoized with stable callbacks. Shared
  layout IDs, spring definitions, dock behavior, and Discover animations remain.
- A failed background read previously replaced page children with the error
  surface. Loaded children now stay mounted, with a scoped error/retry notice.
  The first load still has a loading state. A successful mutation returns after
  commit and starts revalidation without waiting for a subsequent list request.
- Focus previously refetched after only five seconds. Fresh snapshots now have
  a 30-second revalidation window. Polling pauses in hidden/offline tabs; failures
  back off to 60/120 seconds. Reconnection and explicit retry bypass freshness.
  Focus storms share one request; fresh focus storms issue none. Deferring the
  first effect request by one microtask also avoids Strict Mode's duplicate
  initial request: two observed development reads became one.
- Images use stable authenticated API URLs; there was **no signed-URL generation
  waterfall** to fix. Two original PNGs transferred 1,550,339 payload bytes.
  Their 640-pixel WebP thumbnails total 88,686 bytes, a 94.3% reduction. The
  320-pixel list variants total 25,396 bytes. Grid source selection respects
  display size/device density, images remain lazy, and existing aspect-ratio
  boxes prevent layout shifts. Original photos are requested only in the detail
  gallery; its morph retains the decoded thumbnail while the original loads.
  This deliberately adds one original-image request on the first detail open.
- Thumbnails use an authenticated, server-only Sharp pipeline, with only
  320/640/960 sizes allowed. It preserves proportions/transparency, strips
  metadata, and never changes original Storage objects. The reader/path/size
  cache has a 16 MiB/128-entry bound and five-minute lifetime, and shares pending
  work. Fresh identity, membership and photo RLS checks precede every cache hit.
  HTTP stays `private, no-store`; Next's public image optimizer is bypassed.
  Sign-out clears the serving process's reader entries and pending cache fills.
  Other processes still enforce authorization and expiry. Nothing is persisted
  in a browser wishlist/image-URL cache.
- Auth SDK initialization read time during speculative Cache Components
  rendering, producing prerender diagnostics. Server client construction now
  awaits `connection()` before initializing the SDK. Proxy also has bounded
  network timeouts. The public conversion worker avoids unnecessary auth work.

**Network and profiling method.** CSS viewports were 390×844 (DPR 3), 1440×900
and 1920×1080 (DPR 1). Chromium ran on the Mac; mobile emulation is not Safari or
a physical iPhone. Local means no additional browser throttle, while Supabase
remains remote. Hotspot adds 300 ms latency and 5 Mbit/s throughput; the Slow 4G
simulation uses 150 ms and 1.6 Mbit/s. Offline is temporary, after content is
loaded. Throttling applies to browser ↔ Next.js, not Next.js ↔ Supabase.

The before/after runs first load online and warm both routes, then apply network
conditions to background refreshes, navigation, detail opening, and scrolling.
Focus is made stale in the final runner by advancing browser `Date.now()` by
31 seconds; performance clocks and server clocks are unchanged. Earlier baseline
runs used the prior five-second focus interval. Initial-ready numbers therefore
describe the unthrottled startup phase, not a cold Slow 4G download. Additional
after-only cold-cache checks hold the initial GET while exercising Home and Add
Wish under hotspot/Slow 4G; there is no matched cold-load baseline improvement
claim. Authentication setup permits 30 seconds because live sign-in occasionally
exceeded five seconds before network emulation even started.

WAN latency was variable: a production baseline background response reached
9.57 seconds. These are single ordered samples, so the controlled fixture
waterfall reduction is stronger causal evidence than every live timing delta.
The sample account had two own wishes and an empty partner list. Populated
synthetic partner data separately exercises the wheel and instant-pick flows.

Screenshots remain in ignored `performance-results/` or `test-results/`, contain
private UI, and are not committed. Audit captures use viewport mode at the
dimensions/DPR above and CSS screenshot scale. Functional modal captures wait
for animation/layout settling; only the explicit settings-scroll check uses
full-page mode. Browser zoom/visual viewport were 1, and settled route/modal
transforms were `none`. A missing-icon artifact in one instrumented capture
was checked in a fresh browser run: DOM visibility/styles and the normal rendered
icons were correct. No UI/CSS change was made to match that capture.

**Animation, HEIC, and remaining limits.** Ambient backgrounds already animate
transforms; scroll feedback uses Motion values without React updates per scroll
frame. Blur/backdrop surfaces were inspected but not removed or redesigned.
Reduced-motion CSS and MotionConfig remain in effect. Headless frame samples
provide no reason to remove effects, but do not rule out GPU cost on an older
iPhone. Development's larger JS transfer (about 1.28 MB versus 304 KB production,
including HTTP overhead), compilation, validation, and lack of equivalent warm
prefetch behavior explain why it must not be used as a release-speed proxy.

No browser heap/GPU-memory reduction is claimed. The measured original image
extents imply about 5.5 MB of RGBA pixels, versus about 2.9 MB for their 640-pixel
variants, but actual decoder/GPU allocations and caches were not measured.

Five real public-fixture HEIC conversions in sequence left a separate button
usable: desktop test action completed in 73 ms and mobile emulation in 42 ms,
with no ≥50 ms main-thread tasks observed during conversion. Decoding/encoding
fallback work stays in its worker. This does not verify native Safari decoding,
48-megapixel iPhone memory behavior, or HEIC uploads against live Storage.

The first thumbnail cache miss still downloads the original from Storage before
Sharp can resize it. Full-quality galleries still pay that download cost, with
a preview keeping the modal useful. Persistent pre-generated variants could
remove the cold server transfer in a future upload phase; no schema, bucket,
RLS, or upload format policy was changed in this pass. In-memory data survives
background errors, not a fresh offline app load; this is not a PWA/offline-write
implementation. Actual slow-device CPU/GPU profiling remains valuable if users
still see jank after these network changes.

Realtime was considered and deferred. With two active users, the normal upper
bound is about four polling reads/minute, fewer while hidden/offline. The measured
problem was request waterfalls and redundant work, not a need for a permanently
connected subscription. Polling retains existing freshness semantics without
new publication/configuration, reconnect logic, or database changes.

**Verification and reproduction.** Sharp 0.35.5 was already installed through
Next.js and is now an explicit runtime dependency. No Xcode tools or new browser
binaries were installed, and no Git commands were run. Lint, TypeScript and the
production build pass. Production browser regressions at the three target
viewports passed 45 tests with 24 skipped (including all live CRUD). Isolated
tests cover identical snapshots, deduplication, hidden/offline polling, stale
responses, nonblocking post-save refresh, and cache isolation/clear/deduplication.
Anonymous live requests to both originals and all thumbnail sizes returned 401;
unbounded size parameters returned 400. This is not a fresh three-user RLS audit.

Six additional cold-cache hotspot/Slow 4G cases passed with wishlist GET held
pending: Home navigation took 353–857 ms and Add Wish actions 51–284 ms. These
include Playwright actionability/transition waits and are after-only results,
not INP measurements. Two populated-fixture workspace runs also passed, including
instant pick, the animated wheel, detail morph and Add Wish at desktop/mobile.

The scripts load credentials without displaying them and never write storage
state files. A final scan found sign-in field values inside Playwright's embedded
HTML ZIP, despite tracing being off. That generated report was removed. Runs with
E2E credentials now use a redacting text reporter, no automatic screenshots or
DOM snapshots, and no HTML report. Deliberate post-login UI captures remain in
the ignored results directory. Sanitized text logs/metrics passed a credential
scan. Start normal dev on port 3000 and production on 3103, then use:

```sh
node scripts/audit-live-performance.mjs http://127.0.0.1:3000 local-development
node scripts/audit-live-performance.mjs http://127.0.0.1:3103 local-production
node scripts/audit-private-images.mjs
```

The controlled fixture service binds only localhost:3119. It is never an app
route or authentication bypass. Build/start Next with
`YOURWISHES_AUDIT_DIST_DIR=.next-perf`, the local fixture URL, and a dummy
publishable key; then `node scripts/benchmark-backend.mjs <label>` targets its
production port 3102. Do not point that fixture build at a deployment. Its
results are synthetic latency evidence, not live security verification.

Read-only performance tests require `E2E_PERFORMANCE_READ_ONLY=true`; keep
`E2E_DISPOSABLE_SUPABASE=false`. Existing destructive tests require a separate,
explicitly disposable database and must stay disabled against the live project.
