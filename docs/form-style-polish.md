# Form style polish

Priority and currency now use a reusable Radix Select composition following the shadcn pattern. Priorities include text, colored indicators and descriptions; selected state includes a checkmark. Both dropdowns serialize into native FormData. Existing priority values and USD/MNT/CNY values are unchanged.

Shared form styling now uses consistent 48px control heights, subtle surfaces, clear focus rings, improved spacing, mobile 16px inputs and consistent action buttons. Base page layout, backgrounds and theme palette are preserved. Menu content is portaled above sheets and collision-aware; Escape closes the menu without dismissing its parent sheet. Reduced motion is respected.

Local synthetic full-app Chrome checks: 320px, 390px and 1440px, light/dark; keyboard selection, focus restoration, form values, menu bounds, and no horizontal overflow/runtime errors. Screenshots reviewed after transitions settled. Live account data was not used. Additional isolated regression tests cover serialization, disabled state and Escape.
