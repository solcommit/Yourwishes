# Cross-device audit — 2026-10-23

This audit uses the real application and its Auth/server/API/image paths against
`scripts/performance-fixture-server.mjs`, an isolated synthetic Supabase substitute.
Its authentication responses are deliberately fake: passing these tests does **not**
validate Supabase JWT verification, database RLS, or production Storage policies.
No live wishlist create/edit/delete/upload operation was issued; schema and RLS
were unchanged. Live sign-in exercises the normal app GET path, including its
existing background orphan-cleanup scheduling. Browser sessions
remain in memory; no authenticated storage-state files or traces were saved.

## Confirmed causes and repairs

| Defect | Before | Repair |
| --- | --- | --- |
| LAN development hydration/interactions | All three engines reject the LAN HMR WebSocket. Profile hover and Add Wish do nothing; no wishlist request follows sign-in. Localhost works. | `next.config.ts` permits only private IPv4 addresses actually assigned to this machine. No wildcard, public-interface address, or production CORS change. Restart when the LAN address changes. |
| Add Wish on insecure origins | After HMR is restored, HTTP LAN opening Add Wish throws `crypto.randomUUID is not a function`. | `src/lib/client-uuid.ts` uses native UUID where available, otherwise CSPRNG `crypto.getRandomValues` with UUID v4 version/variant bits. Used by `app-shell.tsx`; no weak random identifiers. |
| Production route becomes invisible | Independent production Chromium reproduction: dock navigation to Mine, Partner and Discover leaves the route at opacity **0**, despite successful requests and rendered content. | An inner presence boundary separates Next's retained/prefetched router descendants from the outer route exit bookkeeping. Direct reproduction after repair: all three destination routes settle at opacity **1**, transform `none`. Outer exit/entrance timings and shared-element animations remain. |
| Development navigation overlay | Next 16.4.2 reports `instant-unrendered-segment` for four workspace routes; the overlay intercepts mobile dock clicks. | Keep page children mounted behind the existing loading state rather than dropping the router segment. Do not suppress the validator or its overlay. |
| Escape during edit/detail handoff | Cancel edit, then Escape during the outgoing animation: an exiting sheet's listener reopens the detail sheet. | `SheetFrame` uses Motion presence to retire exiting listeners. Shared scroll-lock bookkeeping prevents an outgoing sheet unlocking the body beneath an incoming sheet. |
| WebKit local avatar save | Synthetic IndexedDB writes of File and Blob fail on both origins; typed bytes succeed. Profile UI remains open with a save error. | Persist `{bytes: ArrayBuffer, type}` and reconstruct a Blob when reading. Preserve reads of existing Blob avatars. This is a reproduced Playwright WebKit issue; it is not proof that every physical iPhone had the same failure. |
| Wheel blocks its own button | An invisible rotated wheel SVG intercepts “Spin Again.” | Decorative rotor ignores pointer events. No visual change or removed animation. |
| Wheel horizontal overflow | A 390px WebKit viewport reports 400px document width. The invisible rotated square extends to 399.53px. | A bounded decorative paint layer clips invisible corners while leaving the glow outside it and reserving space for the shadow. Shared desktop/mobile wheel-size variables preserve dimensions. WebKit lacks `overflow-clip-margin`, so the final implementation does not depend on it. |

Production plain-HTTP sign-in is a separate, expected transport limitation:
Secure session cookies are rejected on HTTP LAN in all three engines; WebKit also
rejects them on HTTP localhost in this environment. Cookies were **not** downgraded.
Production parity tests use HTTPS on localhost and the LAN address, through a
temporary local reverse proxy. A temporary self-signed certificate is accepted only
by the audit browser contexts, not installed into the system trust store.

Baseline engine/origin observations are in `cross-device-baseline.json`. Source
inspection found no service worker, app-side hardcoded localhost URL, or CSP rule
responsible for these failures. Different origins have independent cookies,
localStorage and IndexedDB; settings and local avatars intentionally do not carry
from localhost to a LAN address or another device. OS reduced-motion and the Fluid
animations/Ambient animation settings also legitimately affect motion.

## Coverage and results

All completed runs passed. Sanitized measurements, capture metadata and browser
versions are recorded in `cross-device-results.json`.

| Run | Passed | Skipped | Failed |
| --- | ---: | ---: | ---: |
| Full development workflow/state matrix | 42 | 18 | 0 |
| Full production HTTPS workflow/state matrix | 42 | 18 | 0 |
| Final wheel paint regression, development | 30 | 0 | 0 |
| Final wheel paint regression, production HTTPS | 30 | 0 | 0 |
| Cross-browser image processing | 15 | 0 | 0 |
| Existing isolated validation/sync/cache/image regressions | 15 | 0 | 0 |
| Live production Auth: anonymous, fabricated token, member reload/sign-out | 3 | 0 | 0 |
| Supplemental controls sweeps | 12 | 0 | 0 |

The 18 skips per full matrix are repeated synthetic mutation/state cases at
laptop/tablet/narrow sizes; the complete workflow still runs at every size.
Mutation/state cases run at desktop and mobile. The final wheel-only change was
then checked in all 60 browser/origin/mode/viewport combinations, including
mid-spin overflow, repeated clicks, reduced motion, unchanged artwork dimensions
and uncut glow. This avoids treating a CSS-only follow-up as proof of the entire
application without a targeted rerun. The existing isolated run overlaps five
image cases with the later image run; counts are execution counts, not unique
test definitions.

Lint, standalone `tsc --noEmit`, and production builds with both fixture and normal
project configuration passed. Live Auth checks ran only in Chromium at 1920×1080
on loopback; they do not constitute a live RLS audit. Synthetic POST/DELETE/upload
interceptions never reached live Supabase.

The matrix in `playwright.cross-device.config.ts` covers:

- Playwright 1.64.1: Chromium 156.0.8078.4 (revision 1248), WebKit 27.2 (2370),
  Firefox 157.0 (1555), on this Mac. WebKit and Firefox browser binaries were
  installed with explicit approval; no new npm dependency was added.
- Development HTTP: localhost and the Mac's actual private IPv4 address, port 3101.
- Production HTTPS: both origins, port 3104 proxying the fixture app on 3102.
- CSS viewports: 1920×1080 and 1440×900 at DPR 1; tablet 768×1024 at DPR 1;
  mobile 390×844 at DPR 3; narrow 320×568 at DPR 2.
- Touch/mobile viewport emulation for Chromium/WebKit. Mobile WebKit uses the
  iPhone 13 user agent. Firefox uses touch and viewport emulation; Playwright
  Firefox does not implement `isMobile`. These are **not physical device tests**.
- Normal motion, changing to reduced motion, mouse hover, touch avatar activation,
  keyboard profile activation, Escape, and gallery arrow keys.

`tests/e2e/cross-device.spec.ts` exercises complete workflows at every viewport;
its additional synthetic state/mutation case runs at desktop and mobile sizes.
POST/DELETE/upload requests in that case are intercepted in the browser, with a
per-test in-memory snapshot. They never reach the database or Storage.

Every inventory row below **passed within its listed automated scope**. Physical
device verification and live backend CRUD/RLS remain unverified.

| Feature inventory | Automated scope |
| --- | --- |
| `/sign-in` | Anonymous redirect, fixture password sign-in, reload/session restoration, sign-out, subsequent private-route rejection |
| `/` | Add Wish trigger and settled shared-element form transition; dock and profile remain interactive |
| Add Wish | Required name validation; multiple PNGs; ordering/removal; invalid HEIC error/retry control; actual HEIC-to-JPEG worker conversion; Escape/dismissal; intercepted save/upload |
| `/wishlist`, `/partner` | Dock navigation; 12 own/12 partner fixtures; grid/list toggle; own edit/cancel/save/delete; partner has no edit action; empty lists |
| Detail/gallery | Card/detail morph settles; photo loading; next/page selection and keyboard previous; three-photo fixture; edit/detail handoff; confirmed delete through intercepted API |
| Profile | Mouse expansion/leave, touch expansion, keyboard activation, actions menu, nickname save, avatar save and persistence after reload |
| `/settings` | Switches, background preset and reload persistence; supplemental controls sweep covers every appearance/background/gradient/layout/density choice and default-list behavior |
| `/discover` | Landing → methods; Instant Pick result; switch to wheel; actual rotor transform; spin result; Spin Again; reduced motion; no-partner-wishes state |
| `/surprises` | Partner-derived page, shared cards and navigation; no invented reservation/surprise backend feature |
| Synchronization/error/offline | Pending initial fetch, failed background refresh, retained content, retry, offline banner, online recovery. Existing hook tests cover deduplication, fresh focus, hidden/offline polling, late replies, save/delete races and sign-out clearing. |
| Private images/cache | Real fixture image API and thumbnail rendering; existing cache test covers reader separation, deduplication, expiration/clearing of pending work |
| Image processor | Real HEIC/HEIF, container/EXIF rotation, all eight orientations, metadata removal, size bounds, output resizing, five-image limit, cancellation/retry and button interaction passed in all three engines via `playwright.image-cross-device.config.ts` |

There is no implemented search/category filter to test. Nickname/avatar and
appearance preferences remain local to a browser origin. The Settings Account
preview is an existing placeholder. Auto-play preference wiring exists, but the
wishlist accepts photos and has no implemented video upload feature.

## Screenshots

Only synthetic content is captured. The matrix saves Home and fully settled Add
Wish viewport screenshots for Chromium at 1920×1080/DPR 1 and 390×844/DPR 3, on
both origins in each mode. Images use CSS scale, not full-page capture. Each capture
logs viewport, DPR, visual viewport scale, CSS zoom and route/dialog transforms.
The final wheel sweep also captures settled idle wheels at those Chromium sizes
and at WebKit 390×844/DPR 3, both origins/modes. There are 28 final captures plus
one initial WebKit overflow diagnostic (390×844/DPR 3, viewport, CSS scale).
All final capture metadata reports visual viewport scale 1 and CSS zoom 1.
Other matrix cases make no screenshots. Outputs are ignored under
`performance-results/cross-device-{development,production}/` and corresponding
`-wheel/` directories. Mobile Add Wish content scrolls within its sheet; viewport
captures intentionally do not show the whole form at once. Its actions were
reached and exercised without changing its layout.

The 1920×1080 captures are the desktop reference. No UI was resized to fit a
misleading screenshot or physical display resolution.

During iteration an audit dev process served stale compiled CSS until restarted.
Fresh-server tests verified the current rules; the underlying watcher/cache cause
was not isolated. Restart the existing development server before manual retesting.
No dependency or vendor patch was introduced to mask this observation.

Image responsiveness telemetry explicitly records whether Long Tasks observation
is supported. Chromium supports it; WebKit and Firefox do not in these builds.
Their empty arrays are not evidence of zero long tasks. Button clicks during five
HEIC conversions succeeded in all engines. These concurrent audit measurements
are not a new before/after performance benchmark.

## Reproducing the isolated suite

Start `node scripts/performance-fixture-server.mjs`. Start a separate Next dev
server with these environment overrides (never reuse the live project for fixture
CRUD):

```sh
YOURWISHES_AUDIT_DIST_DIR=.next-perf \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3119 \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_local_audit_only \
npm run dev -- --hostname 0.0.0.0 --port 3101

E2E_CROSS_DEVICE_FIXTURE=true CROSS_DEVICE_LAN=YOUR_MAC_LAN_IP \
npx playwright test --config playwright.cross-device.config.ts
```

Build/start with the same overrides on port 3102 and put a local HTTPS reverse
proxy on 3104 that preserves Host and forwards `X-Forwarded-Proto: https`.
Then add `CROSS_DEVICE_MODE=production` to the test command. Do not send real user
passwords to the fixture service. `scripts/audit-cross-device-controls.mjs` uses
the same fixture opt-in and LAN variable for the supplemental controls sweep.
Use `CROSS_DEVICE_WHEEL_ONLY=true` with `--grep='wheel paint'` to keep wheel
artifacts separate. Run image regressions with
`npx playwright test --config playwright.image-cross-device.config.ts`.

All temporary audit servers were stopped and the temporary TLS certificate/key
were deleted after verification. Existing user development servers were left alone.

## Files changed

- Runtime: `next.config.ts`, `src/lib/client-uuid.ts`,
  `src/components/app-shell.tsx`, `src/components/settings-provider.tsx`,
  `src/components/workspace-pages.tsx` (wheel paint wrappers only),
  `src/app/globals.css` (wheel containment/hit testing only).
- Regression coverage: `playwright.cross-device.config.ts`,
  `playwright.image-cross-device.config.ts`, `tests/e2e/cross-device.spec.ts`,
  `tests/e2e/heic.spec.ts` (additional engines and honest telemetry support flag),
  `scripts/audit-cross-device-controls.mjs`.
- Evidence: this document, `docs/cross-device-baseline.json`,
  `docs/cross-device-results.json`.

Next's generated audit type includes were removed from `tsconfig.json` after the
audit server stopped. No npm dependencies, SQL migrations, RLS policies, dock
styles, form layouts or Supabase cookie-security settings were changed. No Git
commands or Xcode tools were used.

## Physical iPhone / Windows verification still required

1. Restart Next with `npm run dev -- --hostname 0.0.0.0`; use the Mac's current
   private LAN IP on the same network. Restart again after an IP change. Ensure
   the Mac firewall allows the chosen port. Verify the LAN HMR handshake succeeds.
2. For production, use a trusted HTTPS deployment or a LAN HTTPS proxy/certificate
   trusted by the actual device. Plain HTTP production is intentionally unsupported
   for authenticated sessions. Do not disable Secure cookies to work around it.
3. In iPhone Safari and Windows Chrome/Edge, sign in independently on that origin;
   localhost cookies/settings are not shared. Confirm Add Wish visibly opens, select
   real camera HEIC photos, reorder/remove and dismiss without saving existing data.
4. Navigate all dock destinations and Back. Open both own and partner cards; check
   gallery swipe/arrows, edit/cancel, and dismiss. Use only an isolated test account
   to perform real save/delete operations.
5. On Windows, hover the avatar and move into its menu; on iPhone, tap it. Save a
   local nickname/avatar and reload. Exercise settings, Instant Pick, wheel and
   Spin Again. Compare reduced-motion off/on and test Safari's actual photo picker.
6. Disconnect/reconnect networking after loading a list; existing wishes should
   remain visible. Inspect Safari Web Inspector / Windows DevTools for runtime,
   hydration, HMR and failed-asset errors. Report browser/OS versions and origin.

Playwright WebKit is not an actual iPhone, and Mac Chromium/Firefox do not verify
Windows rendering, Edge, OS photo pickers, GPU behavior or Safari memory limits.
Live database CRUD/RLS and physical-device network/firewall behavior remain outside
this synthetic audit.
