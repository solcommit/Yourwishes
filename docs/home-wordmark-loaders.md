# Home wordmark and loading feedback

The lowercase colorful yourwishes. wordmark remains above the Home add button.

Animated loaders now appear only inside the expanded card gallery while its full image decodes. Route, thumbnail, sign-in, crop and upload animated loaders were removed; upload/crop progress remains as accessible text.

Mine, Partner and Surprises thumbnail lists mount all their photos eagerly while hidden and inert. After all photos have loaded (including offscreen images), or failed with their existing retry state, the whole list reveals together with a 380ms fade/8px rise. Image-free cards do not block readiness. The reveal respects system reduced motion and Fluid animations. A changed list/image/layout creates a new batch; routine identical revalidation does not replay the animation. Failed/retried photos do not hide an already revealed list.

Reordering, its API, local preferences and the unapplied shared-order SQL migration have been removed. No database action is required. No dependencies were added.
