"use client";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PRIORITY_OPTIONS } from "../wish-form-options";
import { useAppSettings } from "../settings-provider";
import type { WishlistItem } from "@/lib/wishlist/types";
import { getWishImages } from "@/lib/wish-media";
import { WishBatch, WishFlightOrigin } from "../wish-batch";
import { PrivateWishPhoto } from "../private-wish-photo";
import { Button } from "../ui/button";
import Folder from "./Folder";
import "./priority-folders.css";

const COLORS = { Common:"#94a3b8", Uncommon:"#22c55e", Rare:"#3b82f6", Epic:"#a855f7", Legendary:"#f59e0b" };
function FolderPhoto({ item }: { item: WishlistItem }) {
  const ref = useRef<HTMLImageElement>(null);
  const src = getWishImages(item)[0];
  return <div className="priority-preview">{src ? <><span className="sr-only">{item.name}</span><PrivateWishPhoto src={src} name={item.name} list={false} imageRef={ref} /></> : <span className="priority-preview-name">{item.name}</span>}</div>;
}
export function PriorityFolders({ items, render, onOpenItem }: { items: WishlistItem[]; render: (items: WishlistItem[]) => ReactNode; onOpenItem?: (item: WishlistItem) => void }) {
  const [slot, setSlot] = useState<{top:number;left:number;width:number;minHeight:number} | null>(null);
  const [selected, setSelected] = useState<WishlistItem["priority"] | null>(null);
  const { settings } = useAppSettings();
  const reduced = useReducedMotion() || !settings.fluidAnimations;
  const root = useRef<HTMLElement>(null);
  const lastSelected = useRef<WishlistItem["priority"] | null>(null);
  const getOrigin = useCallback(() => root.current?.querySelector<HTMLElement>(`[data-priority="${selected}"] .folder-root`)?.getBoundingClientRect(), [selected]);
  const active = PRIORITY_OPTIONS.find(option => option.value === selected);
  const filtered = items.filter(item => item.priority === selected);
  const choose = (priority: WishlistItem["priority"] | null) => {
    if (priority) {
      const container = root.current?.querySelector<HTMLElement>(".priority-folders");
      const group = root.current?.querySelector<HTMLElement>(`[data-priority="${priority}"]`);
      if (container && group && root.current) {
        const bounds = container.getBoundingClientRect(), chosen = group.getBoundingClientRect();
        setSlot({top:chosen.top-bounds.top,left:chosen.left-bounds.left,width:chosen.width,minHeight:root.current.getBoundingClientRect().height});
      }
      lastSelected.current = priority;
    } else setSlot(null);
    setSelected(priority);
    if (!priority) requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-priority="${lastSelected.current}"] .folder-stage`)?.focus({preventScroll:true}));
  };
  return <WishFlightOrigin.Provider value={getOrigin}><section ref={root} aria-label="Partner wishes by priority" className="priority-browser" style={active && slot ? {minHeight:slot.minHeight} : undefined}
    onKeyDown={event => { if(event.key === "Escape" && selected) { event.preventDefault(); choose(null); } }}>
    {active && <div className="priority-back-row"><Button onClick={() => choose(null)} variant="secondary">← Бүх ангилал</Button><span className="priority-folder-count">{filtered.length} wishes</span></div>}
    <WishFlightOrigin.Provider value={null}><WishBatch className="priority-folders" data-active={!!selected} style={active && slot ? {paddingTop:slot.top} : undefined}>
      <AnimatePresence mode="popLayout" initial={false}>
      {PRIORITY_OPTIONS.filter(option => !selected || option.value === selected).map(option => {
        const group = items.filter(item => item.priority === option.value);
        // React Bits supports six interactive pages; the full grid below includes every wish.
        const previews = group.slice(0,6).map(item => <FolderPhoto key={item.id} item={item} />);
        return <motion.div layout={false} style={selected && slot ? {width:`min(100%, ${slot.width}px)`,marginLeft:`clamp(0px, ${slot.left}px, max(0px, calc(100% - ${slot.width}px)))`} : undefined} initial={{opacity:0,scale:.94}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:.9}}
          transition={{duration:reduced ? 0 : .24}} className="priority-folder-group" key={option.value} data-priority={option.value}>
          <div className="priority-folder-visual"><Folder key={`motion-${reduced}`} items={previews} label={option.label} size={.68} color={COLORS[option.value]} open={selected === option.value}
            onOpenChange={open => choose(open ? option.value : null)} onItemClick={(_,index) => { if(group[index]) onOpenItem?.(group[index]); }} draggable={!reduced} zoomOnClick={false} closeOnOutsideClick={false}
            intro={false} peek={!reduced} tilt={reduced ? 0 : .5} bounce={reduced ? 0 : .4} /></div>
          <span className="priority-folder-label">{option.label}</span>
          <span className="priority-folder-count">{group.length} wishes</span>
        </motion.div>;
      })}
      </AnimatePresence>
    </WishBatch></WishFlightOrigin.Provider>
    {active && <section className="priority-folder-content" aria-label={active.label}>
      <h2 className="priority-folder-heading" data-priority={active.value}><span className="priority-dot" />{active.label}</h2>
      {filtered.length ? render(filtered) : <p className="priority-folder-empty" role="status">Энэ ангилалд хүсэл алга.</p>}
    </section>}
  </section></WishFlightOrigin.Provider>;
}
