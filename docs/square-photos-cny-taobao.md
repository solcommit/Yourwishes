# Square uploads, yuan and Taobao links

- New images open a manual 1:1 crop editor before attachment, for JPEG/PNG/WebP and both native/worker HEIC paths. Users choose framing and zoom after orientation; no stretching. Existing stored images are unchanged. See `manual-photo-crop.md`.
- The upload endpoint rejects nonsquare new images, so bypassing the picker cannot persist a nonsquare upload.
- CNY (Chinese yuan) is available alongside USD/MNT, including formatting, client/server validation and editing. Apply `supabase/migrations/202611100002_cny_currency.sql` before saving CNY wishes in production. This migration has not been applied here.
- Ordinary HTTP(S) links still work. Taobao/Tmall full URLs, tb.cn short links, supported bare domains and URL-containing Taobao share text are normalized in the form and again on the server. Taobao token-only shares without a URL are rejected. No product scraping, price import or redirect expansion is performed.
- Validation uses synthetic fixtures; no production uploads or database writes are required.
