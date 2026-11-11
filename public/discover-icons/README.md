# Discover icons

The app uses optimized transparent 256px WebP icons. Original PNGs remain as
editable source artwork; the app no longer references them directly.

Replace spin-wheel.png / instant-pick.png, then run:
`node scripts/optimize-discover-icons.mjs`

The script regenerates spin-wheel.webp and instant-pick.webp with sharp.
WebP retains alpha and is smaller than the original PNGs; ICO is for app/favicon
use and provides no advantage for these in-page icons.

Discover uses a three-column grid. Append method metadata in
src/lib/discover-icons.ts and implement its screen to add another app-like entry.
No empty dummy buttons are rendered. Labels stay outside the artwork.
