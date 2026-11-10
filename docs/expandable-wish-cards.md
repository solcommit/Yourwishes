# Expandable wish-card motion

Card surfaces and image frames now have matching shared layout IDs, with a single 460ms spring for opening and returning to the original tile. The backdrop fades independently, avoiding fading the whole moving card. Existing geometry, sheet actions, authenticated image loading and gallery gestures are preserved. Detail copy follows with a small delayed reveal. The return morph uses the tile thumbnail preview so it matches its source.

Removed manual source-image visibility hiding and imperative overflow toggles; Motion handles shared-element crossfading and rounded corners. Stable scrollbar gutters prevent grid shifts during body scroll lock. System reduced motion and the app Fluid animations setting both disable shared layout travel. Escape, outside click, focus restoration and existing form controls remain supported.

Inspired by the interaction at https://ui.aceternity.com/components/expandable-card, implemented with the existing Motion dependency and existing components. No new package, database or deployment changes.


Local validation: synthetic Chrome at 390px/1440px, grid/list; recorded intermediate card bounds to verify a real surface morph, inspected settled screenshots, checked image visibility, focus/scroll restoration, Escape, outside dismissal, and system reduced motion. Zero runtime exceptions. This does not claim a physical-device frame-rate improvement.

`node scripts/audit-card-expansion.mjs` repeats this check when the existing synthetic backend is on 3119 and the isolated fixture-configured Next app on 3102. It verifies the fixture before using its synthetic account, and writes screenshots only to ignored `performance-results/expansion/`. Never point it at a real backend.
