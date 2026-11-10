# Safari / installed Yourwishes

The app manifest uses a stable root ID/start URL/scope and standalone display. Apple-specific capable/title/icon metadata, a 180px touch icon and viewport safe-area support complement 192/512px manifest icons. public/app-icons contains editable source artwork, generated icons and replacement instructions; scripts/generate-app-icons.mjs uses the existing sharp dependency. The temporary Y monogram uses the existing colorful wordmark palette rather than a final new logo.

Publish over HTTPS, then in Safari use Share → Add to Home Screen (leave Open as Web App enabled if shown). On-device Safari installation has not been physically verified by this session. Manifest/icons can be inspected during dev, but the service worker registers only in production on a secure context. HTTP LAN URLs on an iPhone are not an adequate production PWA test; use the HTTPS deployment or trusted local HTTPS.

The service worker precaches only a fixed list: generic offline.html and public icons. Authenticated HTML, RSC, JS chunks, API/profile/wish/photo responses, uploads and sign-in actions are never cached by it. Navigations remain network-only, with a generic offline fallback on network failure. API calls continue failing normally offline so they cannot receive fake success/offline HTML. Existing in-memory wishes may remain in an already-open tab; cold offline launch does not expose cached private data. New workers activate without forcing a reload or discarding drafts. Only caches with the application's public prefix are cleaned.

The auth proxy excludes only the public PWA entry files/icon folder; private routes and APIs retain existing authentication and no-store behavior. sw.js is served as JavaScript, no-store, root-scoped and nosniff with a self-only CSP. No background sync, push notification permission, offline mutation queue or new dependency is added. After replacing an installed icon, Safari may require removing/re-adding the Home Screen app.

References: https://nextjs.org/docs/app/guides/progressive-web-apps and https://webkit.org/blog/13878/.
