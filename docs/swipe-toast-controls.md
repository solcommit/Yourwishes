# Swipe Toast and action controls

SwipeToast.tsx/CSS are the actual React Bits Swipe Toast registry source:
https://reactbits.dev/r/SwipeToast-TS-CSS.json . Existing React Bits attribution/license
is in public/licenses/react-bits.txt. Reused installed Motion and Lucide; no new dependencies.
Adaptations: Lucide close icon, commit-phase refs, React effect events instead of
dependency suppressions, cancel mount animation frame and fuse resources on cleanup.
The official swipe/flick physics, remaining-time fuse, focus/hover/visibility pause,
close button and Escape behavior remain.

Sonner remains only the installed event bus for existing toast.success/error calls;
the app mounts SwipeToast instead of Sonner's visual renderer. Notifications queue
with four visible, ID-based deduplication and session-ending dismissal. All current
app toast callers send a title/description with optional ID. No new notification
types or backend work. Root notifications sit above the bottom navigation safe area.

gooey-controls.css applies the existing Gooey Nav frame, pill and monochrome active
colors to shared buttons, Add, Sort, Grid/List, profile actions and gallery controls.
It adds no WebGL/canvas renderer to buttons. Destructive actions retain red; keyboard
focus and disabled states remain, and Reduce transparency removes background blur.
