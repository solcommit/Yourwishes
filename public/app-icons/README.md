# Yourwishes app icons

This folder is public. Store only app icon artwork here, never credentials or private profile photos.

The current source.svg is a temporary Y monogram using the existing colorful wordmark palette. Replace it with your final square artwork (1024×1024 PNG recommended). Avoid baked-in rounded corners: Safari applies the platform shape itself. Keep the important mark inside the central safe area so maskable icons do not clip it.

Generate all outputs with the existing sharp dependency:

    node scripts/generate-app-icons.mjs public/app-icons/source.png

Or edit source.svg and run:

    node scripts/generate-app-icons.mjs

Outputs: apple-touch-icon.png (180×180), icon-192.png (192×192), icon-512.png (512×512), and src/app/favicon.ico (32×32 PNG-in-ICO). The default artwork fits the maskable safe zone; custom artwork must do the same because the 512px icon serves both normal and maskable purposes. Commit the generated files so production does not depend on an icon-generation build step. Safari may require re-adding the Home Screen app after replacing an installed icon.
