# Yourwishes UI/UX refinement — 2026-10-23

Implemented without new dependencies, database changes, live wishlist mutations, Git commands, or Xcode tools.

## Causes and resulting behavior

The card and its image both participated in shared layout projection, while detail rendering also maintained a separate preview layer. The source remained visible underneath the dialog. The new transition shares only the exact tapped image, uses a unique source-instance ID, hides that source while retaining its geometry, and restores it and keyboard focus after exit. Fixed/scrolling projection containers are identified explicitly. Rapid cycles, Escape, backdrop dismissal, browser navigation, and reduced motion are covered by automation.

The previous gallery reused an image element with index-dependent load/error handlers and imperative visibility changes. A delayed completion could therefore be attributed to a newer selection. Private originals were downloaded again on revisits. Metadata sorting was already correct; it was not a database ordering defect.

The extracted memoized gallery now fetches and decodes before replacing the visible photo, associates completion with its source, ignores stale completions, and keeps the previous photo visible while loading. It retains up to three completed decoded images in a dialog-local cache, plus transient requests, and preloads one neighbor after the selected image is ready. Obsolete pending loads are aborted. Closing or ending the session releases requests, decoders, and object URLs. Reopening intentionally fetches authenticated originals again. Failures offer retry. Touch swipes and horizontal wheel input preserve vertical scrolling; originals retain their aspect ratio and quality.

## Measurements

These measurements use isolated synthetic data, not live production records.

| Measurement | Before | After |
| --- | --- | --- |
| Laptop grid card | 430.94 × 353.09 CSS px | 180 × 180 CSS px |
| Repeat original requests during gallery revisits | 1 repeat (3 requests, 2 unique images) | 0 repeats (3 requests, 3 unique images across extended navigation) |
| Source card image while detail is open | Visible | Hidden, geometry retained |
| Customer-facing technical photo filenames | Visible | Removed |

The request scenarios differ in the number of distinct photos visited; this demonstrates eliminated repeat downloads, not a reduction in total requests for identical scenarios. Settled baseline DOM already had one detail image; source inspection identified the additional preview layer during loading. Afterward the gallery uses one visible image node and passes delayed-response/race tests.

The same synthetic 3072 × 2048 JPEG is 3,468,413 bytes as an original, 132,528 bytes at 640 px, and 22,000 bytes at 320 px. Responses retain `private, no-store`. Grid loading does not request full originals. This confirms preserved thumbnail delivery; the earlier live 1.35-second/89-KB benchmark was not remeasured. No new quantitative frame-rate or live-network latency improvement is claimed.

## Responsive layout and copy

Desktop/tablet grid tracks are bounded at 180 px, with a 140 px minimum and 12 px gaps. At widths below 700 px, three equal columns use 10 px gaps: measured cards are 88 px at a 320 px viewport and approximately 111.33 px at 390 px. All cards remain square, clipped, image-only, and lazy-loaded. List mode retains its separate presentation.

Add/Edit/Detail now consistently use: `Хүслийн нэр`, `Тайлбар`, `Үнэ`, `Валют`, `Бүтээгдэхүүний холбоос`, `Ач холбогдол`, `Ангилал`, `Зураг`, `Зураг нэмэх`, `Нүүр зураг`, `Хадгалах`, `Болих`, `Засах`, and `Устгах`. Photo processing, ordering/removal controls, retry, validation, deletion confirmation, and wish empty states have Mongolian copy. Internal contracts and filenames remain intact internally. Dialogs identify their language and have unique heading IDs. Focus trapping excludes inert, disabled, and hidden controls, including during HEIC processing.

Dock hover tooltip markup/styles are removed; icon buttons retain accessible names and Discover naming. Discover shows a clear empty state without a wheel when no partner wishes are available. Populated wheel and Instant Pick tests use fixtures only.

## Changed files

- `src/components/app-shell.tsx`: transition lifecycle, forms/copy, focus handling, dock, detail integration.
- `src/components/workspace-pages.tsx`: exact source image identity, compact card hints, empty states.
- `src/components/wish-gallery.tsx` (new): bounded gallery loading/decoding/cache and gestures.
- `src/lib/wish-copy.ts` (new): customer-facing error/progress/priority wording.
- `src/app/globals.css`: square grid, source visibility, gallery indicators and subtle transitions.
- `playwright.ux.config.ts`, `tests/e2e/ux-refinement.spec.ts` (new): isolated device and race coverage.
- `scripts/performance-fixture-server.mjs`: distinct portrait/landscape fixture photos with deliberately unordered metadata.
- Existing `workspace`, `wishlist-crud`, `performance`, and `cross-device` Playwright specs and the `audit-cross-device-controls`/`audit-live-performance` scripts: selectors aligned with intentional copy/accessibility changes; functional scenarios retained.
- This report. Temporary audit-generated TypeScript includes were removed after stopping the audit dev server.

Auth, RLS, private image route, database schema, upload conversion, and synchronization implementation were not changed.

## Verification

| Check | Result |
| --- | --- |
| Focused development UI tests | 22 passed, 8 intentionally skipped |
| Focused production UI tests | 22 passed, 8 intentionally skipped |
| Existing validation, image cache, synchronization, HEIC tests | 15 passed |
| Existing Chromium desktop/WebKit mobile workspace regressions | 6 passed |
| Lint, standalone TypeScript, production build | Passed |

The eight skips per focused run are the race scenario restricted to two representative projects, not failed tests. Both engines cover 320 × 568, 390 × 844, 768 × 1024, 1440 × 900, and 1920 × 1080 CSS viewports. The 390 px mobile project uses DPR 3; other projects use DPR 1. Captures are viewport-only at CSS scale, after transitions settle, with size/DPR/mode recorded per capture. Browser/CSS zoom remained normal. Production WebKit used a temporary local HTTPS proxy to preserve secure cookie behavior; cookie security was not weakened.

Coverage includes grid/list, one/multiple photos, correct secondary image dimensions/order, both swipe directions, horizontal wheel events, slow/failed/out-of-order photos, repeated open/close, focus restoration, backdrop/Escape/navigation, reduced motion, form validation, PNG/HEIC selection and reorder, populated/empty Discover, dock input, offline retention, overflow and console errors. Final desktop grid and mobile gallery/form screenshots were visually inspected.

Evidence is under ignored `performance-results/`: `ux-before.json`, `ux-image-bytes.json`, `ux-development.log`, `ux-production.log`, `ux-regressions.log`, `ux-workspace-regressions.log`, and mode-specific screenshot folders. No authenticated storage-state file was created.

Limitations: WebKit automation is not physical iPhone Safari verification. Touch and touchpad wheel events were synthesized; physical gesture feel, OS/GPU behavior and long-session device memory were not measured. Live Supabase security/CRUD were not retested. No production wishes were created. Decoded original images still consume memory, bounded here by dialog-local retention rather than reduced detail quality.

## Ranked patterns for possible future adoption

1. [Aceternity Expandable Card](https://ui.aceternity.com/components/expandable-card): closest match for shared-image expansion and outside dismissal. Adapt the pattern to existing Motion, focus, cached routes and private images; wholesale replacement would duplicate behavior. Its [Layout Grid](https://ui.aceternity.com/components/layout-grid) is less suited to the requested uniform compact squares.
2. [21st.dev Morphing Dialog](https://21st.dev/@ibelick/components/morphing-dialog/video-preview): useful reference for restrained trigger-to-dialog composition. A future adoption needs source/dependency/license review and adaptation to the existing sheet lifecycle and reduced-motion handling.
3. [21st.dev Image Gallery](https://21st.dev/@prebuiltui/components/image-gallery): consider minimal navigation/thumbnail patterns only if a future gallery feature requires them. Public-image examples need private fetch, bounded decoding and gesture conflict handling before use here.

Reviewed the [Aceternity card catalogue](https://ui.aceternity.com/categories/card), [21st.dev](https://21st.dev/), and relevant previews. No library or paid component was installed. The dynamically served previews do not constitute a full source/license audit. Motion's [layout documentation](https://motion.dev/docs/react-layout-animations) informed fixed and scrolling projection container handling.
