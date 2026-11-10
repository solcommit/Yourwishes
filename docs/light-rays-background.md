# Theme-aware Light Rays

The existing React Bits Light Rays integration is now active for all 11 background presets, retaining the selected palette and light/dark appearance. The dedicated Light Rays preset keeps its existing blue tint; other presets use their own primary palette color. The existing source and React Bits license notice are preserved.

The component remains lazy-loaded with an isolated loading boundary. Only one canvas is mounted for the workspace; it cannot intercept clicks. Existing gradient surfaces remain as a fallback. Turning gradient intensity Off removes the ray layer. Ambient animation Off, Fluid animations Off, Reduce transparency or system reduced motion removes the WebGL renderer and leaves a static, theme-tinted fallback. The original ambient drift is stopped while the ray layer is present to avoid stacking background animation work. Existing renderer caps DPR to 1 and rendering to 30fps, pauses in hidden tabs and cleans up its WebGL resources.

No authentication, data, database, image upload or deployment changes are needed for this integration.

Validation: synthetic Chrome/WebGL checks passed for all 11 presets in both light and dark (22 combinations), static fallback settings, gradient Off, system reduced motion, mobile 390px and click-through. Zero runtime/hydration errors after adding a hydration-safe boundary. Screenshots reviewed for Sunset Glow light/dark. Headless software WebGL is not a physical-device GPU performance measurement.
