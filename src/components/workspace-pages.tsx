"use client";

import Link from "next/link";
import { memo, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  Grid2X2,
  List,
  Moon,
  SlidersHorizontal,
  Palette,
  Plus,
  Sun,
} from "lucide-react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useAppSettings, type AppSettings } from "@/components/settings-provider";
import { useWorkspace, useWorkspaceActions } from "@/components/app-shell";
import { Button, IconButton } from "@/components/ui/button";
import type { WishlistItem } from "@/lib/wishlist/types";
import { formatWishPrice } from "@/lib/format-price";
import { getWishImages } from "@/lib/wish-media";
import { PrivateWishPhoto } from "./private-wish-photo";
import { useProfilePhoto } from "./profile-photo-provider";
import { PriorityFolders } from "./priority/priority-folders";
import { WishBatch } from "./wish-batch";
import { ColourfulText } from "./ui/colourful-text";
import "./settings-page.css";
import { DISCOVER_METHODS } from "@/lib/discover-icons";
import { DiscoverAction } from "./discover-action";
import { wishLayoutTransition } from "@/lib/wish-transition";

function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="page-title">{children}</h1>;
}

const WishTile = memo(function WishTile({ item, list = false }: { item: WishlistItem; list?: boolean }) {
  const { openItem } = useWorkspaceActions();
  const imageRef = useRef<HTMLImageElement>(null);
  const { settings } = useAppSettings();
  const reduceMotion = useReducedMotion() || !settings.fluidAnimations;
  const sourceId = useId();
  const price = item.price !== null ? formatWishPrice(item.price, item.currency) : null;
  const thumbnail = getWishImages(item)[0];
  return (
    <div className={`wish-tile-wrapper ${list ? "wish-tile-wrapper-list" : ""}`}>
    <motion.div
      className={`wish-tile ${list ? "wish-tile-list" : ""}`}
      layoutId={reduceMotion ? undefined : `${sourceId}-card`}
      data-wish-card={sourceId}
      style={{ borderRadius: list ? 12 : 14 }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      transition={{ layout: reduceMotion ? { duration: 0 } : wishLayoutTransition, default: { type: "spring", stiffness: 360, damping: 34, mass: 0.8 } }}
    >
      <button type="button" className="wish-open-target"
        aria-label={`${item.name}${price ? `, ${price}` : ""}. View details`}
        onClick={() => openItem(item, imageRef.current?.currentSrc, sourceId)} />
      <motion.span
        className="wish-shared-image"
        id={sourceId}
        layoutId={reduceMotion ? undefined : sourceId}
        style={{ borderRadius: list ? 10 : 14 }}
        transition={reduceMotion ? { duration: 0 } : wishLayoutTransition}
      >
        {thumbnail ? (
          <PrivateWishPhoto key={`${thumbnail}-${list}`} src={thumbnail} name={item.name} list={list} imageRef={imageRef} />
        ) : <span aria-hidden="true" className="wish-image wish-image-empty" />}
      </motion.span>
      <span className="wish-meta">
        <span className="wish-name">{item.name}</span>
        {price && <span className="wish-price">{price}</span>}
      </span>
    </motion.div>
    </div>
  );
});

export function Dashboard() {
  const { addSheetOpen, openAddItem } = useWorkspace();
  return (
    <div className="home-screen">
      {!addSheetOpen && <h1 className="home-wordmark"><ColourfulText text="yourwishes." /></h1>}
      {!addSheetOpen && (
        <motion.button
          aria-label="Add wish"
          className="home-add-icon"
          data-home-add-trigger=""
          layoutId="home-add-surface"
          onClick={openAddItem}
          type="button"
          whileTap={{ scale: 0.9 }}
          transition={{
            layout: { type: "spring", duration: 0.48, bounce: 0.04 },
            default: { type: "spring", stiffness: 430, damping: 34 },
            opacity: { duration: 0.18 },
          }}
        >
          <Plus aria-hidden="true" className="size-9" strokeWidth={1.65} />
        </motion.button>
      )}
    </div>
  );
}

/** Bound initial private downloads; later pages keep the already visible cards mounted. */
function WishPages({items,list=false,identity}:{items:WishlistItem[];list?:boolean;identity:string}) {
  const [pages,setPages]=useState(1);
  const pageSize=24;
  return <div className="wish-pages">{Array.from({length:Math.min(pages,Math.ceil(items.length/pageSize))},(_,page)=>{
    const batch=items.slice(page*pageSize,(page+1)*pageSize);
    return <WishBatch key={`${identity}:${page}:${batch.map(item=>`${item.id}:${getWishImages(item)[0] ?? ""}`).join("|")}`} className={list ? "wishlist-list" : "wishlist-grid"}>
      {batch.map(item=><WishTile key={item.id} item={item} list={list} />)}
    </WishBatch>;
  })}{items.length>pages*pageSize && <Button className="wish-load-more" variant="secondary" onClick={()=>setPages(value=>value+1)}>Show more wishes</Button>}</div>;
}

export function WishlistPage({ owner }: { owner: WishlistItem["owner"] }) {
  const {partner}=useProfilePhoto();
  const { openItem } = useWorkspaceActions();
  const { items } = useWorkspace();
  const { settings } = useAppSettings();
  const [layoutOverride, setLayoutOverride] = useState<"grid" | "list" | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const layout = layoutOverride ?? settings.defaultLayout;
  const isMine = owner === "you";
  const wishes = items.filter((item) => item.owner === owner);

  return (
    <div className="page-enter">
      <div className="desktop-page-heading">
        <PageTitle>{isMine ? "Mine" : partner.nickname}</PageTitle>
        <div className="toolbar-actions">
          <div aria-label="Wishlist layout" className="layout-picker" role="group">
            <IconButton aria-pressed={!sortOpen && layout === "grid"} className={!sortOpen && layout === "grid" ? "selected" : ""} label="Grid layout" onClick={() => { setLayoutOverride("grid"); setSortOpen(false); }} variant="quiet">
              <Grid2X2 aria-hidden="true" className="size-[17px]" />
            </IconButton>
            <IconButton aria-pressed={!sortOpen && layout === "list"} className={!sortOpen && layout === "list" ? "selected" : ""} label="List layout" onClick={() => { setLayoutOverride("list"); setSortOpen(false); }} variant="quiet">
              <List aria-hidden="true" className="size-[17px]" />
            </IconButton>
          </div>
          {!isMine && <Button aria-pressed={sortOpen} className="priority-sort-toggle" onClick={() => setSortOpen(open => !open)} variant={sortOpen ? "primary" : "secondary"}>Sort</Button>}
        </div>
      </div>
      {!isMine && sortOpen ? (
        <PriorityFolders key={owner} items={wishes} onOpenItem={item => openItem(item)} render={filtered => (
          <WishPages key={`${owner}:priority`} identity={`${owner}:priority`} items={filtered} />
        )} />
      ) : wishes.length ? (
        <WishPages key={`${owner}:${layout}`} identity={`${owner}:${layout}`} items={wishes} list={layout === "list"} />
      ) : (
        null
      )}
    </div>
  );
}

export function DiscoverPage() {
  const { items } = useWorkspace();
  const { settings } = useAppSettings();
  const partnerWishes = items.filter((item) => item.owner === "partner");
  const [screen, setScreen] = useState<"select" | "wheel" | "instant">("select");
  const [instantResult, setInstantResult] = useState<WishlistItem | null>(null);
  const [instantRevealId, setInstantRevealId] = useState(0);
  const [confettiVisible, setConfettiVisible] = useState(false);
  const [wheelResult, setWheelResult] = useState<WishlistItem | null>(null);
  const [rotation, setRotation] = useState(0);
  const [spinDuration, setSpinDuration] = useState(4.4);
  const [pendingWheelResult, setPendingWheelResult] = useState<WishlistItem | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [restoringWheel, setRestoringWheel] = useState(false);
  const spinTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useReducedMotion() || !settings.fluidAnimations;
  const partnerIds = partnerWishes.map((item) => item.id).join(",");
  const previousPartnerIds = useRef(partnerIds);
  const currentInstantResult = partnerWishes.find((item) => item.id === instantResult?.id) ?? null;
  const currentWheelResult = partnerWishes.find((item) => item.id === wheelResult?.id) ?? null;

  useEffect(() => {
    if (previousPartnerIds.current === partnerIds) return;
    previousPartnerIds.current = partnerIds;
    if (spinTimeout.current) clearTimeout(spinTimeout.current);
    spinTimeout.current = null;
    // A remotely removed/added wish must not remain a pending gift candidate.
    setInstantResult(null); setWheelResult(null); setPendingWheelResult(null);
    setSpinning(false); setRestoringWheel(false);
  }, [partnerIds]);

  useEffect(() => () => {
    if (spinTimeout.current) clearTimeout(spinTimeout.current);
    if (confettiTimeout.current) clearTimeout(confettiTimeout.current);
  }, []);

  function chooseInstant() {
    if (!partnerWishes.length) return;
    setInstantResult(partnerWishes[randomIndex(partnerWishes.length)]);
    setInstantRevealId((current) => current + 1);
    setConfettiVisible(!reduceMotion);

    if (confettiTimeout.current) clearTimeout(confettiTimeout.current);
    confettiTimeout.current = setTimeout(() => {
      setConfettiVisible(false);
      confettiTimeout.current = null;
    }, 1250);
  }

  function startSpin() {
    if (!partnerWishes.length || spinning) return;
    const winnerIndex = randomIndex(partnerWishes.length);
    const winner = partnerWishes[winnerIndex];
    const segmentAngle = 360 / partnerWishes.length;
    const desiredAngle = ((360 - ((winnerIndex + 0.5) * segmentAngle) % 360) + 360) % 360;
    const currentAngle = ((rotation % 360) + 360) % 360;
    const alignment = (desiredAngle - currentAngle + 360) % 360;
    const laps = 4 + randomIndex(3);
    const targetRotation = rotation + laps * 360 + alignment;
    setPendingWheelResult(winner);
    setSpinning(true);
    setSpinDuration(4 + randomIndex(11) / 10);
    setRotation(targetRotation);
    if (reduceMotion) {
      setWheelResult(winner);
      setPendingWheelResult(null);
      setSpinning(false);

    }
  }

  function spinWheel() {
    if (spinning || restoringWheel) return;
    if (!wheelResult) {
      startSpin();
      return;
    }
    setRestoringWheel(true);
    spinTimeout.current = setTimeout(() => {
      setWheelResult(null);
      setRestoringWheel(false);
      startSpin();
      spinTimeout.current = null;
    }, reduceMotion ? 0 : 600);
  }

  return (
    <div className="page-enter">
      <div className="desktop-page-heading">
        <PageTitle>Discover</PageTitle>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {screen === "select" && (
          <motion.section
            animate={{ opacity: 1, y: 0 }}
            className="discover-stage"
            exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
            key="select"
            transition={{ duration: reduceMotion ? 0 : 0.22 }}
          >
            <div className="discovery-method-list">
              {DISCOVER_METHODS.map(method => <DiscoverAction key={method.id} icon={method.icon} label={method.label} onClick={() => setScreen(method.id)} />)}
            </div>
          </motion.section>
        )}
        {screen === "wheel" && (
          <motion.section
            animate={{ opacity: 1, y: 0 }}
            className="discover-stage discovery-experience"
            exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
            key="wheel"
            transition={{ duration: reduceMotion ? 0 : 0.22 }}
          >
            <button className="discover-back" onClick={() => {
              if (spinTimeout.current) clearTimeout(spinTimeout.current);
              spinTimeout.current = null;
              if (spinning) {
                setSpinning(false);
                setPendingWheelResult(null);
              }
              setRestoringWheel(false);
              setScreen("select");
            }} type="button">
              <ChevronLeft aria-hidden="true" className="size-4" /> Choose a method
            </button>
            <h2>Spin the Wheel</h2>
            {partnerWishes.length ? (
              <>
                <PrizeWheel
                  items={partnerWishes}
                  rotation={rotation}
                  spinDuration={spinDuration}
                  reduceMotion={reduceMotion}
                  winner={currentWheelResult}
                  restoring={restoringWheel}
                  onComplete={(definition) => {
                    if (
                      !pendingWheelResult ||
                      typeof definition !== "object" ||
                      definition === null ||
                      !("rotate" in definition) ||
                      definition.rotate !== rotation
                    ) return;
                    if (!pendingWheelResult) return;
                    const winner = pendingWheelResult;
                    setPendingWheelResult(null);
                    setSpinning(false);
                    if (reduceMotion) {
                      setWheelResult(winner);

                    } else {
                      spinTimeout.current = setTimeout(() => {
                        setWheelResult(winner);

                        spinTimeout.current = null;
                      }, 320);
                    }
                  }}
                />
                <div className="discovery-wheel-actions">
                  <Button disabled={spinning || restoringWheel} onClick={spinWheel}>Spin</Button>
                </div>
              </>
            ) : null}
          </motion.section>
        )}
        {screen === "instant" && (
          <motion.section
            animate={{ opacity: 1, y: 0 }}
            className="discover-stage discovery-experience"
            exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
            key="instant"
            transition={{ duration: reduceMotion ? 0 : 0.22 }}
          >
            <button className="discover-back" onClick={() => setScreen("select")} type="button">
              <ChevronLeft aria-hidden="true" className="size-4" /> Choose a method
            </button>
            <h2>Instant Pick</h2>
            <div className="discovery-instant-actions"><Button disabled={!partnerWishes.length} onClick={chooseInstant}>Pick</Button></div>
            <AnimatePresence mode="wait" initial={false}>
              {currentInstantResult && (
                <motion.div
                  aria-live="polite"
                  className="discovery-result instant-result"
                  initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.92, y: reduceMotion ? 0 : 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
                  key={instantRevealId}
                  transition={{ duration: reduceMotion ? 0 : 0.28, ease: "easeOut" }}
                >
                  <span>Your pick</span>
                  <strong>{currentInstantResult.name}</strong>
                  {confettiVisible && !reduceMotion && <ConfettiBurst />}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

const WHEEL_COLORS = [
  ["#d84dff", "#8d36ff", "#632bdb"],
  ["#ff4fa3", "#ed287c", "#bb246e"],
  ["#ff6a70", "#ff4b58", "#d92e56"],
  ["#ff9454", "#ff6b32", "#dc482c"],
  ["#ffd84e", "#ffb91f", "#ed8520"],
  ["#c9f35a", "#89d936", "#52ad3b"],
  ["#39e8d4", "#12bfbd", "#1194af"],
  ["#48cfff", "#259bef", "#3868e8"],
];

function randomIndex(length: number) {
  const limit = Math.floor(0x1_0000_0000 / length) * length;
  const sample = new Uint32Array(1);
  do {
    crypto.getRandomValues(sample);
  } while (sample[0] >= limit);
  return sample[0] % length;
}

function wheelSlicePath(index: number, count: number, radius: number) {
  const startAngle = -Math.PI / 2 + (index * Math.PI * 2) / count;
  const endAngle = -Math.PI / 2 + ((index + 1) * Math.PI * 2) / count;
  const start = { x: 200 + radius * Math.cos(startAngle), y: 200 + radius * Math.sin(startAngle) };
  const end = { x: 200 + radius * Math.cos(endAngle), y: 200 + radius * Math.sin(endAngle) };
  if (count === 1) {
    return `M 200 200 m 0 -${radius} a ${radius} ${radius} 0 1 1 0 ${radius * 2} a ${radius} ${radius} 0 1 1 0 -${radius * 2} Z`;
  }
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M 200 200 L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

function PrizeWheel({
  items,
  rotation,
  spinDuration,
  reduceMotion,
  winner,
  restoring,
  onComplete,
}: {
  items: WishlistItem[];
  rotation: number;
  spinDuration: number;
  reduceMotion: boolean | null;
  winner: WishlistItem | null;
  restoring: boolean;
  onComplete: (definition: unknown) => void;
}) {
  const labelRadius = items.length === 1 ? 106 : items.length === 2 ? 116 : items.length > 6 ? 137 : 125;
  const labelFontSize = Math.max(9, Math.min(16, 19 - items.length * 0.8));
  const gradientPrefix = useId().replaceAll(":", "");
  const labels = items.map((item, index) => {
    const count = items.length;
    const centerAngle = count === 1 ? -90 : -90 + (index + 0.5) * (360 / count);
    const radians = (centerAngle * Math.PI) / 180;
    const labelX = 200 + labelRadius * Math.cos(radians);
    const labelY = 200 + labelRadius * Math.sin(radians);
    const segmentWidth = count === 1 ? 200 : Math.min(190, 2 * labelRadius * Math.sin(Math.PI / count));
    const maxChars = Math.max(5, Math.min(20, Math.floor(segmentWidth / (labelFontSize * 0.62))));
    const title = item.name.length > maxChars ? `${item.name.slice(0, maxChars - 1).trimEnd()}…` : item.name;
    return { id: item.id, title, left: `${(labelX / 400) * 100}%`, top: `${(labelY / 400) * 100}%` };
  });
  const labelRotation = items.length === 1 ? 0 : rotation;
  const winnerIndex = winner ? items.findIndex((item) => item.id === winner.id) : -1;
  const winnerColors = WHEEL_COLORS[(winnerIndex < 0 ? 0 : winnerIndex) % WHEEL_COLORS.length];
  return (
    <div className="prize-wheel-wrap">
      <span aria-hidden="true" className="prize-wheel-pointer" />
      <div className="prize-wheel-paint">
      <div className="prize-wheel-artwork">
      <motion.div
        animate={{ rotate: rotation, opacity: winner && !restoring ? 0 : 1 }}
        className="prize-wheel-rotor"
        onAnimationComplete={onComplete}
        transition={{
          rotate: reduceMotion
            ? { duration: 0 }
            : { duration: spinDuration, ease: [0.12, 0.82, 0.16, 1] },
          opacity: { duration: reduceMotion ? 0 : 0.36, ease: "easeOut" },
        }}
      >
        <svg aria-hidden="true" className="prize-wheel-svg" viewBox="0 0 400 400">
          <defs>
            {items.map((_, index) => {
              const [start, middle, end] = WHEEL_COLORS[index % WHEEL_COLORS.length];
              return (
                <linearGradient
                  gradientUnits="userSpaceOnUse"
                  id={`${gradientPrefix}-prize-${index}`}
                  key={index}
                  x1="35"
                  x2="365"
                  y1="45"
                  y2="355"
                >
                  <stop offset="0%" stopColor={start} />
                  <stop offset="55%" stopColor={middle} />
                  <stop offset="100%" stopColor={end} />
                </linearGradient>
              );
            })}
            <linearGradient id={`${gradientPrefix}-hub`} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity=".98" />
              <stop offset="100%" stopColor="#f4eaff" stopOpacity=".9" />
            </linearGradient>
          </defs>
          {items.map((item, index) => {
            const count = items.length;
            return (
              <g key={item.id}>
                <path d={wheelSlicePath(index, count, 194)} fill={`url(#${gradientPrefix}-prize-${index})`} />
              </g>
            );
          })}
          <circle className="prize-wheel-hub" cx="200" cy="200" fill={`url(#${gradientPrefix}-hub)`} r="15" />
        </svg>
      </motion.div>
      <motion.div
        aria-hidden="true"
        animate={{ rotate: labelRotation, opacity: winner && !restoring ? 0 : 1 }}
        className="prize-wheel-label-layer"
        transition={{
          rotate: reduceMotion
            ? { duration: 0 }
            : { duration: spinDuration, ease: [0.12, 0.82, 0.16, 1] },
          opacity: { duration: reduceMotion ? 0 : 0.36, ease: "easeOut" },
        }}
      >
        {labels.map((label) => (
          <span className="prize-wheel-label-anchor" key={label.id} style={{ left: label.left, top: label.top }}>
            <motion.span
              animate={{ rotate: -labelRotation }}
              className="prize-wheel-label"
              transition={reduceMotion
                ? { duration: 0 }
                : { duration: spinDuration, ease: [0.12, 0.82, 0.16, 1] }}
              style={{ fontSize: `clamp(8px, ${(labelFontSize / 460) * 100}cqw, ${labelFontSize}px)` }}
            >
              {label.title}
            </motion.span>
          </span>
        ))}
      </motion.div>
      </div>
      </div>
      <AnimatePresence initial={false}>
        {winner && !restoring && (
          <motion.div
            animate={{ opacity: 1, scale: 1 }}
            aria-live="polite"
            className="prize-wheel-winner"
            exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.7 }}
            initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.24 }}
            key={winner.id}
            role="status"
            style={{
              background: `linear-gradient(145deg, ${winnerColors[0]}, ${winnerColors[1]} 55%, ${winnerColors[2]})`,
              "--winner-glow": winnerColors[1],
            } as CSSProperties}
            transition={reduceMotion
              ? { duration: 0 }
              : { duration: 0.58, ease: [0.2, 0.75, 0.2, 1] }}
          >
            <span>{winner.name}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const CONFETTI_PARTICLES = [
  [-86, -98, -36], [-52, -126, 42], [-18, -108, 18], [22, -132, -52],
  [58, -102, 70], [91, -120, -24], [-104, 48, 62], [-66, 58, -58],
  [-30, -54, 33], [12, -66, -40], [48, -50, 55], [84, 64, -14],
  [-78, -20, -28], [-42, 46, 48], [4, -18, 72], [44, -30, -66],
  [103, -38, 30], [-8, -146, 36], [71, -142, -42], [-112, -130, 16],
] as const;

function ConfettiBurst() {
  return (
    <span aria-hidden="true" className="instant-confetti">
      {CONFETTI_PARTICLES.map(([x, y, rotation], index) => (
        <span
          className="instant-confetti-piece"
          key={index}
          style={{
            "--confetti-x": `${x}px`,
            "--confetti-y": `${y}px`,
            "--confetti-rotation": `${rotation + (index % 2 ? 360 : -360)}deg`,
            "--confetti-delay": `${(index % 5) * 18}ms`,
            "--confetti-color": ["#ff4fa3", "#ff9454", "#ffd84e", "#39e8d4", "#48cfff", "#9b62ff"][index % 6],
          } as CSSProperties}
        />
      ))}
    </span>
  );
}

export function SurprisesPage() {
  const { items } = useWorkspace();
  const partner = items.filter((item) => item.owner === "partner");
  return (
    <div className="page-enter">
      <div className="desktop-page-heading">
        <PageTitle>Surprises</PageTitle>
        <Link className="text-link" href="/partner"><ArrowLeft className="size-4" /> Partner list</Link>
      </div>
      {partner.length ? (
        <WishBatch key={partner.map(item => `${item.id}:${getWishImages(item)[0] ?? ""}`).join("|")} className="wishlist-grid">
          {partner.map((item) => <WishTile item={item} key={item.id} />)}
        </WishBatch>
      ) : null}
    </div>
  );
}

function ChoiceRow<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const groupId = useId();
  return (
    <div className="setting-row setting-choice-row">
      <span className="setting-copy"><span className="setting-title">{label}</span><span className="setting-description">{description}</span></span>
      <LayoutGroup id={`choice-${groupId}`}>
        <div aria-label={label} className="setting-choices" role="group">
          {options.map((option) => (
            <motion.button
              aria-pressed={value === option.value}
              className={value === option.value ? "selected" : ""}
              key={option.value}
              onClick={() => onChange(option.value)}
              type="button"
              whileTap={{ scale: 0.97 }}
            >
              {value === option.value && <motion.span className="segment-indicator" layoutId="selection" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <span className="segment-label">{option.label}</span>
            </motion.button>
          ))}
        </div>
      </LayoutGroup>
    </div>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="setting-row">
      <span className="setting-copy"><span className="setting-title">{label}</span><span className="setting-description">{description}</span></span>
      <motion.button
        aria-checked={checked}
        aria-label={label}
        className="native-switch"
        onClick={() => onChange(!checked)}
        role="switch"
        type="button"
        whileTap={{ scale: 0.96 }}
      >
        <motion.span animate={{ x: checked ? 23 : 0 }} transition={{ type: "spring", stiffness: 520, damping: 34 }} />
      </motion.button>
    </div>
  );
}

function AppearanceRow() {
  const { settings, updateSettings } = useAppSettings();
  const groupId = useId();
  const choices = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
  ];
  return (
    <div className="appearance-row">
      <span className="setting-copy"><span className="setting-title">Make it yours</span><span className="setting-description">Light or dark. Your space, your choice.</span></span>
      <LayoutGroup id={`appearance-${groupId}`}>
        <div aria-label="Appearance" className="appearance-options" role="group">
          {choices.map(({ value, label, icon: Icon }) => (
            <motion.button
              aria-pressed={settings.appearance === value}
              className={settings.appearance === value ? "selected" : ""}
              key={value}
              onClick={() => updateSettings({ appearance: value })}
              type="button"
              whileTap={{ scale: 0.98 }}
            >
              {settings.appearance === value && <motion.span className="segment-indicator" layoutId="selection" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <Icon aria-hidden="true" className="size-[17px]" />
              <span>{label}</span>
            </motion.button>
          ))}
        </div>
      </LayoutGroup>
    </div>
  );
}

export function SettingsPage() {
  const { settings, updateSettings } = useAppSettings();
  function change<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    updateSettings({ [key]: value } as Pick<AppSettings, K>);
  }
  return (
    <div className="page-enter settings-page">
      <PageTitle>Settings</PageTitle>
      <div className="settings-groups">
        <section className="settings-group settings-appearance" aria-label="Appearance">
          <h2 className="settings-section-title"><Palette aria-hidden="true" size={17} />Appearance</h2>
          <AppearanceRow />
        </section>
        <section className="settings-group" aria-label="Wishlist">
          <h2 className="settings-section-title"><Grid2X2 aria-hidden="true" size={17} />Wishlist</h2>
          <ChoiceRow label="Default layout" description="How your wishes appear." value={settings.defaultLayout} onChange={(value) => change("defaultLayout", value)} options={[
            { value: "grid", label: "Grid" }, { value: "list", label: "List" },
          ]} />
          <ChoiceRow label="Layout density" description="A little breathing room, or more in view." value={settings.density} onChange={(value) => change("density", value)} options={[
            { value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" },
          ]} />
        </section>
        <section className="settings-group" aria-label="Motion and display">
          <h2 className="settings-section-title"><SlidersHorizontal aria-hidden="true" size={17} />Motion & display</h2>
          <SwitchRow checked={settings.fluidAnimations} label="Animations" description="Smooth transitions and moving light rays." onChange={(value) => change("fluidAnimations", value)} />
          <SwitchRow checked={settings.reduceTransparency} label="Reduce transparency" description="Solid surfaces for a clearer view." onChange={(value) => change("reduceTransparency", value)} />
          <SwitchRow checked={settings.autoPlayVideos} label="Auto-play videos" description="Let videos start automatically." onChange={(value) => change("autoPlayVideos", value)} />
        </section>
        <p className="settings-device-note">Preferences are saved on this device.</p>
      </div>
    </div>
  );
}
