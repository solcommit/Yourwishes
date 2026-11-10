# Production performance audit — 2026-11-10

## Scope and limits

Target: https://yourwishes.vercel.app/. Reported symptom: partner wishlist images load very slowly in production while localhost feels acceptable.

Read-only inspection of repository source, SQL migrations, existing audit scripts, and the October 23 performance report. Live checks used unauthenticated HTTP and a clean headless Chrome profile. No sign-in, private image access, account changes, uploads, migrations, or deployment changes were performed. No credentials were requested or retained.

This checkout has no node_modules, .next, or .env.local. Therefore no new authenticated benchmark, local production build, lint, TypeScript check, or private-image test was run. Repository source is not proven to match the active deployment. Historical measurements are not new production evidence.

## Live public-page measurements

Single ordered browser samples on the audit machine; not field Core Web Vitals or physical-phone results. Browser mobile emulation changes viewport/DPR, not CPU speed. The mobile scenario adds 150 ms browser network latency and 200,000 bytes/s throughput. It runs in the same browser after desktop samples, with HTTP cache disabled, so connections can remain warm. It is not a fully isolated cold mobile visit.

| Scenario | Navigation TTFB | DOMContentLoaded | Load | Observed LCP | Tasks >=50 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop, cache disabled | 631 ms | 976 ms | 1,053 ms | 1,272 ms | 0 |
| Desktop repeat, cache enabled | 173 ms | 472 ms | 472 ms | 504 ms | 0 |
| Mobile 390px, simulated Slow 4G | 332 ms | 915 ms | 1,385 ms | 928 ms | 0 |

All visits redirected to /sign-in. No runtime exceptions or horizontal overflow were observed. Cold desktop resource transfers totaled 164,477 bytes excluding navigation; decoded JavaScript resources totaled 476,104 bytes. Repeat resource transfers were zero from browser cache. Mobile resource transfers totaled 161,442 bytes. Resource timing includes browser-reported overhead and does not isolate application bundle ownership.

Four independent curl sign-in samples had first-byte times 242–438 ms and total HTML times 518–674 ms. The sign-in response reported X-Vercel-Cache: HIT. Anonymous /partner returned 307 in 267 ms; /api/wishlist returned 401 in 262 ms. These only test public/denied paths and do not exercise authenticated backend work. The hkg1 response identifier does not establish the authenticated function region or database region.

Conclusion: the sampled sign-in path does not reproduce the reported severe slowdown. Private wishlist/image requests are the next measurement target.

## Findings ranked by likely relevance

### P1 — Image requests repeat sequential remote authorization before returning even cached bytes

Source: src/lib/auth.ts, src/lib/wishlist/server.ts, src/app/api/wishlist/images/[id]/route.ts, src/proxy.ts.

Each thumbnail request goes through Proxy claims verification, then live getUser(), membership lookup, image-metadata/RLS lookup, and finally thumbnail lookup. On cache miss it additionally downloads the original from private Storage and converts it with Sharp. Calls are sequential within each request; browser image requests can run concurrently. Proxy may add a remote call depending on token algorithm, JWKS state, and refresh behavior. React cache is not a cross-request authorization cache and does not collapse authentication across separate image requests.

Illustrative latency floor, not a measurement: three sequential 200 ms remote calls already cost about 600 ms before download/conversion. Many visible images repeat this work and may increase concurrent backend load. Keep access checks; do not fix this by making private images public or globally caching user authorization.

### P1 — Thumbnail cache is per-process and temporary; misses require full originals

Source: src/lib/wishlist/thumbnail.ts. Cache bounds: 16 MiB, 128 entries, five-minute TTL. Key includes reader, storage path, and width. Cache/pending work is only shared inside one process. Different instances, readers, widths, expiration, and eviction can cause repeated downloads/conversions. Production instance churn is a plausible contributor, not observed in this audit. Cache hits still wait for fresh authorization.

Uploads store a validated original but no durable thumbnail variants. Browser normalization allows a 3,072px maximum edge and up to 5 MiB. Thus a small tile may cause a multi-megabyte server-side original download before the browser receives a small WebP. Exact live original dimensions and sizes are unknown.

Preferred direction after timing confirmation: private durable thumbnail variants generated once, immutable/versioned references, existing access control retained, deletion/cleanup extended to variants, and resumable idempotent backfill for old photos. New-upload-only changes would not fix existing partner photos. Do not run a backfill as part of this audit.

### P1 — Private images deliberately bypass browser/shared HTTP caching

Image responses use private, no-store; detail fetch also uses no-store. The process cache avoids some conversion work but not browser re-requests or access checks. Route remounts/reloads can request thumbnails again; a detail viewer caches only during its own lifetime and fetches the original again after reopening. This is a privacy tradeoff, not automatically a bug. Evaluate a bounded in-memory, session-scoped image cache only with explicit sign-out/account-switch clearing and revocation requirements. Do not enable public CDN caching as a quick fix.

### P2 — Initial wishlist is client-fetched after protected workspace authorization

Source: workspace layout, app-shell.tsx, use-wishlist-data.ts, wishlist/server.ts.

Private layout awaits getMember(); the client then starts /api/wishlist with its own authorization and list query. This creates a critical startup chain before tile image discovery. Consider passing a verified initial snapshot from the server only after measuring the current shell/list/image sequence and preserving request isolation and mutation reconciliation.

### P2 — Full pair metadata is refetched periodically without pagination

fetchWishes reads the pair's full item list and all nested image metadata. Filtering Mine/Partner happens on the client. Visible online tabs poll every 30 seconds, with existing freshness deduplication and error backoff. Cost grows with item count and multiple open clients. Confirm actual list sizes and payload bytes before adding pagination, visibility-based refresh changes, or incremental sync.

### P2 — All tiles are lazy-loaded; image failures disappear silently

workspace-pages.tsx uses loading=lazy for every tile. This is appropriate offscreen, but visible first-row image discovery starts only after list fetch/render. Consider measured priority for a small above-the-fold set, not eager loading every image. onError hides the image without a visible error/retry control, so a failed request can look like endless loading. Add a scoped fallback/retry to distinguish errors from slowness.

### P2 — Detail viewer waits for original fetch and decode

wish-gallery.tsx fetches the full original and awaits decode before replacing the preview. This preserves a decoded thumbnail when available, caches up to three originals during the dialog lifetime, and prefetches one neighbor after 350 ms. These are existing optimizations. Measure original TTFB, bytes, download duration, and decode time separately before changing animations.

### P3 — Upload latency and rendering are secondary candidates

prepareWishImages processes photos serially; app-shell uploads serially. This bounds memory but makes multi-photo saves additive. Browser JPEG/PNG encoding can run through canvas on the main thread; the HEIC fallback uses a worker. Bounded concurrency needs physical-device memory testing. This is separate from the reported partner image viewing issue.

AppShell statically imports add/detail/image-preparation modules. Bundle splitting may reduce workspace startup bytes, but authenticated bundle transfer was not measured. Do not assume heavy HEIC libraries are in the initial bundle: heic-to/exifr imports are inside the conversion worker.

CSS includes backdrop blur and ambient/wheel effects. Existing reduced-motion/transparency settings and historical profiling exist; public-page profiling does not test these private UI effects. No evidence currently justifies removing the design.

## Partner-specific assessment

Mine and Partner use the same WishTile renderer and authenticated image endpoint; no partner-only thumbnail pipeline was found. SQL read policies allow the pair rather than imposing a separate partner query branch. Different source sizes, image counts, viewport/DPR, cache warmth, and failed requests could explain different observed speed. Actual query plans and deployed RLS performance have not been measured.

## Next measurement and implementation order

1. Add sanitized Server-Timing stages to the private image route: session, metadata/RLS, cache lookup/hit, Storage download, Sharp conversion, response bytes/total. Record generic timings and cache status only; never cookies, tokens, signed URLs, storage paths, account identifiers, or photo content. Time Proxy separately when relevant. No instrumentation was deployed in this audit.
2. Capture authenticated Mine and Partner at cold/repeated loads and grid/list/detail modes. Record visible tile count, statuses, requested widths, TTFB, download bytes, decode times, and failures. Avoid exporting raw HAR files containing credentials/private data.
3. Inspect the actual Vercel function and Supabase project regions/settings. Align placement when justified by network measurements. Do not infer database region from CDN headers.
4. If download/conversion dominates: durable private thumbnails plus existing-image backfill. If authorization dominates: reduce safe redundant work within requests while preserving live membership/RLS/revocation semantics. If transfer dominates: fix source sizing/variants first.
5. Add user-visible image failure/retry handling, then assess initial snapshot delivery, payload growth, and session-scoped caching separately.

Acceptance: compare repeated cold/warm authenticated runs at the same network and item/image counts; report median and p95 for tile-visible time, image TTFB/bytes, list response, and detail-ready time. Verify partner reads, unauthorized denials, account switching/sign-out, deletion/revocation, pending-request races, and privacy boundaries. Do not claim a speedup before an equivalent baseline/after measurement.

## Changes during audit

Only this report was added to Yourwishes. No application code, dependencies, migrations, production data, or deployment changed. Public browser tooling ran from ignored temporary artifacts in the existing writable Zespace workspace; no private session was used. No commit or push.
