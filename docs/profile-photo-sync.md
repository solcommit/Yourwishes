# Account-scoped profile photos

Previously avatars were written exclusively to the browser's IndexedDB (`yourwishes-profile`, key `avatar`); no upload or profile-row update existed. Those blobs cannot appear on another device.

New profile uploads are authenticated, size-bounded, decoded, metadata-stripped and encoded as bounded 512px WebP, preserving animated input where supported. Originals are not stored. The immutable object is saved to private `profile-photos` storage and its pointer to the existing `profiles.avatar_path`. The self-only photo endpoint checks membership and ownership on every read, sends private/no-store responses and never serves arbitrary paths. Direct storage policies restrict writes/reads to the signed-in member's folder; currently referenced files cannot be deleted. Versioned photo URLs refresh devices without public signed URLs.

Apply `supabase/migrations/202611100004_profile_photos.sql` once in Supabase SQL Editor. This creates only the private bucket/policies; existing profiles/RLS are reused. This session does not apply live migrations. After applying, upload once on PC, or open Change Profile Photo and explicitly choose the button to sync the old browser image. Legacy bytes are preserved and never auto-uploaded or displayed to a different account. Appearance settings remain browser-local; nickname sync and partner avatar reads are documented in navigation-profile-upgrade.md.

The photo provider is mounted only inside the authenticated workspace, scoped/keyed by user ID, and clears on logout/unmount. Refresh, focus, online and visible-tab polling (30s) obtain the authoritative profile; stale pre-save responses cannot overwrite newer uploads. Save errors retain the old confirmed photo. Browser-local legacy data is only read through the user's explicit import action. Same-origin validation and normal user/RLS credentials protect uploads; no service key is used.

Concurrent uploads use compare-and-swap on avatar_path. The loser is reported as a conflict. Replaced photos are removed only after a confirmed new pointer; ambiguous network/write errors retain the new file to avoid deleting a potentially committed avatar. Such rare unreferenced files may need future cleanup. Physical PC/mobile sync and live storage RLS must be verified after applying the migration and deploying these changes.

See navigation-profile-upgrade.md for the added manual crop flow, server nickname persistence and partner-avatar read policy.
