# Native browser interactions

The root theme provider mounts BrowserInteractions once. Non-editable page text cannot be selected, native image/link/text HTML dragstart is cancelled, and the page context menu / mobile callout is suppressed. Input, textarea and contenteditable controls retain text selection and their native editing menu so typing, copying/pasting and selection remain usable.

No pointerdown, pointermove, touchmove, keyboard shortcut, scrolling, zoom, focus or clipboard handlers are intercepted. React Bits folder pointer drag and crop controls therefore retain their existing event paths. This is a UX choice, not a protection against screenshots, source inspection or downloading content through browser tools.
