"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo } from "react";
import { Compass, Gift, Heart } from "lucide-react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "motion/react";
import { useAppSettings } from "@/components/settings-provider";

const links = [
  { href: "/partner", label: "Partner Wishlist", icon: Gift },
  { href: "/wishlist", label: "My Wishlist", icon: Heart },
  { href: "/discover", label: "Discover", icon: Compass },
];
const influence = (cursor: number, index: number) => {
  const distance = Math.abs(cursor - (index - 1) * 60);
  return distance < 110 ? (1 + Math.cos(Math.PI * distance / 110)) / 2 : 0;
};

function DockItem({ index, cursor, enabled, active }: { index: number; cursor: MotionValue<number>; enabled: boolean; active: boolean }) {
  const { href, label, icon: Icon } = links[index];
  const targetScale = useTransform(cursor, (value) => enabled ? 1 + influence(value, index) * 0.32 : 1);
  const targetX = useTransform(cursor, (value) => enabled ? links.reduce((offset, _, other) => other === index ? offset : offset + (other < index ? 1 : -1) * influence(value, other) * 8.32, 0) : 0);
  const scale = useSpring(targetScale, { stiffness: 420, damping: 30 });
  const x = useSpring(targetX, { stiffness: 420, damping: 30 });
  return (
    <motion.div style={{ x }} className="dock-slot">
      <Link aria-current={active ? "page" : undefined} aria-label={label} className={`dock-link ${active ? "is-active" : ""}`} href={href}>
        <motion.span className="dock-magnifier" style={{ scale, transformOrigin: "50% 100%" }}>
          <motion.span className="dock-icon" whileTap={enabled ? { scale: 0.9, y: 2 } : { opacity: 0.7 }} transition={{ type: "spring", stiffness: 460, damping: 26 }}>
            <Icon aria-hidden="true" className="size-[21px]" strokeWidth={1.8} />
          </motion.span>
        </motion.span>
      </Link>
    </motion.div>
  );
}

export const AppDock = memo(function AppDock() {
  const pathname = usePathname();
  const cursor = useMotionValue(Infinity);
  const reduced = useReducedMotion();
  const { settings } = useAppSettings();
  const enabled = !reduced && settings.fluidAnimations;
  return (
    <nav aria-label="Wishlists" className="app-dock" onPointerMove={(event) => {
      if (!enabled || event.pointerType !== "mouse" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      cursor.set(event.clientX - bounds.left - bounds.width / 2);
    }} onPointerLeave={() => cursor.set(Infinity)} onPointerCancel={() => cursor.set(Infinity)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) cursor.set(Infinity); }}>
      {links.map(({ href }, index) => <DockItem key={href} index={index} cursor={cursor} enabled={enabled} active={pathname === href || (href === "/discover" && pathname === "/surprises")} />)}
    </nav>
  );
});
