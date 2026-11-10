"use client";

import Image from "next/image";
import { Loader } from "./ui/loader";
import { invalidatePrivatePhoto, privatePhoto } from "@/lib/private-photo-cache";
import { toast } from "sonner";
import { wishLayoutTransition } from "@/lib/wish-transition";
import { useAppSettings } from "./settings-provider";
import { ChevronLeft } from "lucide-react";
import { motion, useIsPresent, useReducedMotion } from "motion/react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

type Photo = { url: string; promise: Promise<string>; controller: AbortController; decoder?: HTMLImageElement; ready: boolean };

function discard(photo: Photo) {
  photo.controller.abort();
  if (photo.decoder) photo.decoder.src = "";
  if (photo.url) URL.revokeObjectURL(photo.url);
}

/** Private, dialog-lifetime decoded-photo cache. No shared/public browser cache. */
export const WishGallery = memo(function WishGallery({ images, preview, sharedId, name }: {
  images: string[]; preview?: string; sharedId?: string; name: string;
}) {
  const present = useIsPresent();
  const { settings } = useAppSettings();
  const reduceMotion = useReducedMotion() || !settings.fluidAnimations;
  const [selected, setSelected] = useState(0);
  const [displayed, setDisplayed] = useState({ index: 0, src: preview || "" });
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const cache = useRef(new Map<string, Photo>());
  const frame = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const navigated = useRef(false);
  const direction = useRef(1);
  const active = Math.min(selected, Math.max(0, images.length - 1));
  const displayedSource = useRef("");
  const activeSource = useRef("");
  const show = useCallback((delta: number) => { navigated.current = true; direction.current = delta < 0 ? -1 : 1; setError(false); setSelected((index) => (index + delta + images.length) % images.length); }, [images.length]);

  const load = useCallback((src: string) => {
    const found = cache.current.get(src);
    if (found) { cache.current.delete(src); cache.current.set(src, found); return found.promise; }
    const controller = new AbortController();
    const entry: Photo = { url: "", controller, promise: Promise.resolve(""), ready: false };
    entry.promise = (async () => {
      const blob = await privatePhoto(src);
      if (controller.signal.aborted) throw new Error("Canceled");
      entry.url = URL.createObjectURL(blob);
      const decoder = new globalThis.Image();
      entry.decoder = decoder;
      decoder.decoding = "async";
      decoder.src = entry.url;
      await decoder.decode();
      if (controller.signal.aborted) throw new Error("Canceled");
      entry.ready = true;
      // Keep at most three originals/decoded resources, so returning to an image
      // doesn't decode it again. Never revoke the image currently on screen.
      for (const [key, old] of cache.current) {
        if (cache.current.size <= 3) break;
        if (key === src || key === activeSource.current || key === displayedSource.current) continue;
        discard(old); cache.current.delete(key);
      }
      return entry.url;
    })().catch((cause) => {
      if (!controller.signal.aborted) invalidatePrivatePhoto(src);
      discard(entry);
      if (cache.current.get(src) === entry) cache.current.delete(src);
      throw cause;
    });
    cache.current.set(src, entry);
    return entry.promise;
  }, []);

  useEffect(() => {
    const entries = cache.current;
    const clear = () => { for (const entry of entries.values()) discard(entry); entries.clear(); };
    window.addEventListener("yourwishes-session-ending", clear);
    return () => { window.removeEventListener("yourwishes-session-ending", clear); clear(); };
  }, []);

  useEffect(() => {
    if (!present || !images[active]) return;
    let current = true;
    let prefetch: ReturnType<typeof setTimeout> | undefined;
    const src = images[active]; activeSource.current = src;
    for (const [key, entry] of cache.current) {
      if (!entry.ready && key !== src && key !== displayedSource.current) { discard(entry); cache.current.delete(key); }
    }
    // Never let a late decode replace a newer gallery selection.
    // Strict Mode replays mount effects in development. Defer initiation so its
    // discarded first pass never starts a duplicate authenticated download.
    queueMicrotask(() => { if (!current) return; void load(src).then((url) => {
      if (!current) return;
      displayedSource.current = src;
      setDisplayed({ index: active, src: url }); setReady(true); setError(false);
      const adjacent = images[active + 1] || images[active - 1];
      // One neighbor, after the selected image and opening morph have settled.
      if (adjacent) prefetch = setTimeout(() => { void load(adjacent).catch(() => {}); }, 350);
    }).catch(() => { if (current) { setError(true); toast.error("Photo could not load", { id: "wish-photo-error", description: "Retry the photo or check your connection." }); } }); });
    return () => { current = false; clearTimeout(prefetch); };
  }, [images, active, load, retry, present]);

  useEffect(() => {
    const element = frame.current;
    if (!element || images.length < 2) return;
    let distance = 0, last = 0;
    const wheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.25) return;
      event.preventDefault();
      if (performance.now() - last < 400) return;
      distance += event.deltaX;
      if (Math.abs(distance) > 45) { show(distance > 0 ? 1 : -1); last = performance.now(); distance = 0; }
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [images.length, show]);

  const cover = cache.current.get(images[0]);
  const exitingCover = !present && (preview || (cover?.ready ? cover.url : undefined));
  const src = exitingCover || displayed.src;
  const shownIndex = exitingCover ? 0 : displayed.index;
  const busy = !ready || active !== displayed.index;
  return (
    <motion.div className="detail-image-frame" ref={frame} layoutId={reduceMotion ? undefined : sharedId}
      style={{ borderRadius: 16 }} transition={reduceMotion ? { duration: 0 } : wishLayoutTransition}
      role="group" aria-label={`Photo ${shownIndex + 1} of ${images.length}`} aria-roledescription={images.length > 1 ? "Image gallery" : undefined}
      aria-live="polite"
      aria-busy={busy} tabIndex={images.length > 1 ? 0 : undefined}
      onKeyDown={(event) => { if (images.length < 2) return; if (event.key === "ArrowLeft") { event.preventDefault(); show(-1); } if (event.key === "ArrowRight") { event.preventDefault(); show(1); } }}
      onTouchStart={(event) => { const point = event.touches[0]; touch.current = point ? { x: point.clientX, y: point.clientY } : null; }}
      onTouchEnd={(event) => { const start = touch.current, end = event.changedTouches[0]; touch.current = null; if (!start || !end || images.length < 2) return; const x = end.clientX - start.x, y = end.clientY - start.y; if (Math.abs(x) > 40 && Math.abs(x) > Math.abs(y) * 1.25) show(x < 0 ? 1 : -1); }}
      onTouchCancel={() => { touch.current = null; }}>
      {src ? <Image key={src} className={`detail-image ${navigated.current && present && !reduceMotion ? "gallery-photo-enter" : ""}`} data-direction={direction.current < 0 ? "back" : "forward"} src={src} alt={`${name}, photo ${shownIndex + 1}`} width={960} height={960} unoptimized draggable={false} /> : <span className="detail-image detail-image-empty" />}
      {busy && !error && <span className="gallery-loading"><Loader label="Loading photo…" /></span>}
      {error && <button className="gallery-status" onClick={() => { setError(false); setRetry((value) => value + 1); }} type="button">Unable to load. Retry</button>}
      {images.length > 1 && <>
        <button aria-label="Previous photo" className="detail-gallery-arrow detail-gallery-previous" onClick={() => show(-1)} type="button"><ChevronLeft aria-hidden="true" className="size-5" /></button>
        <button aria-label="Next photo" className="detail-gallery-arrow detail-gallery-next" onClick={() => show(1)} type="button"><ChevronLeft aria-hidden="true" className="size-5" /></button>
        <div aria-label="Choose photo" className="detail-gallery-pagination" role="group">{images.map((_, index) => <button key={index} aria-current={active === index ? "true" : undefined} aria-label={`View photo ${index + 1}`} className={active === index ? "is-active" : ""} onClick={() => { navigated.current = true; direction.current = index < active ? -1 : 1; setError(false); setSelected(index); }} type="button" />)}</div>
      </>}
    </motion.div>
  );
});
