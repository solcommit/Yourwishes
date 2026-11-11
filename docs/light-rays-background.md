# Light Rays

One React Bits Light Rays instance, top-center, behind the authenticated workspace.
Source: https://reactbits.dev/c/backgrounds/light-rays ; existing vendored implementation
and public/licenses/react-bits.txt attribution retained. No new dependencies.

Only Light and Dark app appearances are exposed. Dark is the initial default;
legacy System preferences resolve once to the device appearance on migration.
Light uses a brightness(0) filter to make the rays black while retaining shader
alpha; Dark uses white with atmosphere/color tint disabled. No background controls,
palettes, pointer effects, or scroll bezel. Existing animation accessibility settings
hold a still frame; hidden-tab/offscreen pause and the 24fps cap remain.
Canvas DPR is capped at .75 and its pixel budget at 300k. This is still a GPU effect, not a free CSS background.
