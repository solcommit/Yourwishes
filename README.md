# Yourwishes

A private, two-person wishlist built with the Next.js App Router.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Validate with `npm run lint`,
`npx tsc --noEmit`, and `npm run build`.

Supabase Auth uses administrator-provisioned A/B membership. Follow
[Phase 1 setup](docs/backend-phase-1.md) for the two accounts, then
[Phase 2 setup](docs/backend-phase-2.md) for persistent wishes, private Storage,
the new migration, synchronization, cleanup behavior, and disposable tests.

Wishlist state is persistent; failures never fall back to sample data. Settings
and profile avatars retain their existing local-browser behavior.

## Browser checks

Run `npm run test:e2e` for Chromium checks at the CSS viewport sizes below.
Playwright starts the development server automatically,
or reuses one at `http://127.0.0.1:3000`. Install the browser on a new machine with
`npx playwright install chromium`.

The checks cover workspace routes, Discover picks, wishlist layouts, detail and
add-wish sheets, horizontal overflow, and browser errors. Screenshots are saved
under `test-results/`; open the HTML report with `npx playwright show-report`.

| Project | CSS viewport | Device scale factor |
| --- | --- | --- |
| Desktop baseline | 1920 × 1080 | 1 |
| Laptop | 1440 × 900 | 1 |
| Wide desktop | 2560 × 1440 | 1 |
| Mobile | 375 × 667 | 2 |
| Mobile | 390 × 844 | 3 |
| Mobile | 402 × 874 | 3 |
| Small mobile | 320 × 568 | 2 |

Mobile projects use touch/mobile emulation from iPhone profiles with explicit
viewport overrides; they run Chromium, not Safari. Screenshots use CSS pixel
scale and viewport mode by default. Only the explicit settings scroll-content
check uses full-page mode. Each capture attaches its viewport, device scale
factor, mode, visual viewport scale, CSS zoom, and key element transforms to the
report. Captures wait for fonts, delayed effects, and stable route/dialog geometry
and transforms before taking screenshots. Compare desktop captures with the
1920 × 1080 project before diagnosing layout differences.
