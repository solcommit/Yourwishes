# Manual 1:1 photo cropping

The Add/Edit Wish picker now prepares a validated, oriented photo without center-cropping it, then opens a fixed-square editor. Drag/touch or arrow keys move the image; pinch or the labeled slider controls zoom; Reset restores framing. Use photo confirms the exact selected pixels. JPEG/PNG/WebP and native/worker HEIC paths share this behavior.

Photos in a multiple selection are confirmed sequentially. Cancel crop (including the sheet close control/Escape during cropping) discards the whole current selection batch, preserving previously attached photos and the form's name, price, links and other draft values. Nothing is uploaded before the wish is submitted. Crop source URLs, decoders, workers and pending exports are released/cancelled on dismissal or unmount.

Existing stored photos remain unchanged. Uploads still enforce square dimensions and existing size/content checks. The editor is lazy-loaded and uses the existing theme, buttons and sheet rather than adding another nested modal. No new SQL migration is needed.
