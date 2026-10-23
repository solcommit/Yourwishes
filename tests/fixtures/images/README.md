# HEIC test fixture

`libheif-example.heic` is the public, nonpersonal example from
https://github.com/strukturag/libheif/blob/master/examples/example.heic,
downloaded October 23, 2026. Upstream licensing is preserved in
`libheif-COPYING.txt`. No user photos or real location data are used.

`tests/helpers/heic-fixtures.ts` generates ISO-BMFF irot and EXIF-only orientation
variants in memory without changing original image extents. The EXIF variant
contains synthetic GPS coordinates solely to verify metadata stripping. These
fixtures are never deployed as public assets or sent to Supabase.
