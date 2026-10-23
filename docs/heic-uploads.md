# iPhone photo uploads

The existing picker accepts HEIC/HEIF extensions and MIME types, including empty
or generic MIME declarations when the actual container verifies. JPEG, PNG and
WebP remain supported. No raw HEIC file is uploaded to the server or Storage.

Processing happens locally, sequentially, before upload. Native browser decoding
is tried first; when unavailable, a lazily loaded, per-photo worker uses
`heic-to` 1.6.6 (libheif 1.23.6, CSP build). `exifr` 7.1.3 reads orientation for
the fallback when container rotation/mirroring is absent. Native decoders and
libheif apply container transforms; the encoder avoids applying those twice.
Canvas encoding bakes orientation into pixels and discards original EXIF/GPS.
HEIC becomes JPEG; existing PNG/WebP transparency is preserved.

The output is decoded again and checked against its byte signature, declared
MIME, dimensions, and 5 MiB limit. Filenames use the resulting jpg/png/webp
extension. The upload API independently checks signature and dimension headers.
Storage remains private, restricted to JPEG, PNG and WebP, with existing RLS,
staging, ordering, and cleanup behavior. No migration is required for this change.

To bound memory usage, inputs are limited to 32 MiB, 52 megapixels and a maximum
side of 16,384 pixels. Output is proportionally resized to at most 3,072 pixels
on its longest side. Encoding tries quality 0.90, 0.84 and 0.78, then smaller
dimensions if needed to stay within 5 MiB. PNG uses lossless resizing instead.
Conversions run one at a time, with progress messages and a five-image combined
limit. A failed batch preserves existing previews and offers Retry photos.
Closing the form cancels its worker and releases temporary preview resources.

## Compatibility and verification

Modern Safari may decode HEIC natively; Chromium typically uses the fallback.
The fallback needs workers, ImageBitmap and OffscreenCanvas 2D encoding. A future
CSP must permit same-origin workers and blob workers (`worker-src 'self' blob:`).
There is no CDN or conversion service. Older browsers or memory-constrained
phones can fail conversion; the error offers retry or export as JPEG in Photos.
Only a still image is imported, not Live Photo video, animation, depth or HDR
metadata. Exotic multi-image containers and every iPhone camera variant are not
guaranteed; test representative personal photos locally before release.

The worker is bundled by the development dependency `esbuild` 0.28.2.
`npm run dev`, `npm run build`, and `npm run test:e2e` generate the ignored
`public/generated/heic-worker.js` automatically. After editing worker sources
while a dev server is running, run `npm run build:image-worker` again. Direct
`npx playwright test` invocations also need that build first. Keep the generated
file in the deployment output; the source worker cannot be served directly as
TypeScript by Turbopack. The approximately 3.1 MiB bundle is fetched only when
native decoding fails, and photos are never sent to another conversion service.

Playwright exercises the real processing modules and decoder with a public
libheif fixture, generated container/EXIF rotations, synthetic GPS metadata,
invalid files, source/output limits, cancellation/retry, and ordered batches.
The harness runs on desktop and mobile-emulated Chromium, without authentication
or uploading photos. Mobile emulation is not an actual iPhone/Safari test.
Live authenticated uploads require the existing disposable Supabase test setup.

Dependency licenses and attribution are in `public/licenses/` and
`tests/fixtures/images/README.md`. Upstreams:
https://github.com/hoppergee/heic-to and https://github.com/MikeKovarik/exifr.
