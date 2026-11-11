"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type ComponentPropsWithoutRef } from "react";
import "./wish-batch.css";
import { CircleLoader } from "./ui/circle-loader";

export const WishFlightOrigin = createContext<(() => DOMRect | undefined) | null>(null);
const BatchPhotos = createContext(false);
export const useBatchPhotos = () => useContext(BatchPhotos);

/** Mount every thumbnail eagerly, then reveal the entire list after decode or failure. */
export function WishBatch({ children, className, ...props }: { children: ReactNode; className: string } & Omit<ComponentPropsWithoutRef<"div">,"children"|"className">) {
  const getOrigin = useContext(WishFlightOrigin);
  const [arriving, setArriving] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let frame = 0;
    let alive = true;
    const flights: Animation[] = [];
    const observer = new MutationObserver(check);
    function check() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!element!.querySelector('[data-photo-pending="true"]')) {
          const origin = getOrigin?.();
          const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.fluidAnimations === "false";
          if (origin && !reduced && typeof element!.animate === "function") {
            const cards = Array.from(element!.children) as HTMLElement[];
            const boxes = cards.map(card => card.getBoundingClientRect());
            cards.forEach((card, index) => {
              const box = boxes[index];
              const x = origin.left + origin.width / 2 - box.left - box.width / 2;
              const y = origin.top + origin.height / 2 - box.top - box.height / 2;
              flights.push(card.animate([
                {transform:`translate(${x}px, ${y}px) scale(.18) rotate(${(index % 3 - 1) * 9}deg)`,opacity:0},
                {transform:"translate(0, 0) scale(1) rotate(0deg)",opacity:1},
              ], {duration:650,delay:Math.min(index * 38,230),easing:"cubic-bezier(.18,.8,.2,1)",fill:"backwards"}));
            });
            if (flights.length) {
              setArriving(true);
              void Promise.all(flights.map(flight => flight.finished.catch(() => {}))).then(() => { if (alive) setArriving(false); });
            }
          }
          setReady(true); observer.disconnect();
        }
      });
    }
    observer.observe(element, {subtree:true,childList:true,attributes:true,attributeFilter:["data-photo-pending"]});
    check();
    return () => { alive = false; observer.disconnect(); cancelAnimationFrame(frame); flights.forEach(flight => flight.cancel()); };
  }, [getOrigin]);
  return <BatchPhotos.Provider value={true}><div className="wish-batch-stage">{!ready && <div className="wish-batch-loading"><CircleLoader /></div>}<div {...props} ref={host} className={`wish-batch ${className}`} data-ready={ready} data-flight={!!getOrigin} data-arriving={arriving} aria-busy={!ready} inert={!ready || arriving}>{children}</div></div></BatchPhotos.Provider>;
}
