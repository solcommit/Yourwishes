"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, LayoutGroup, animate, motion, useIsPresent, useMotionValueEvent, useScroll, useSpring, useReducedMotion } from "motion/react";
import { Camera, ChevronLeft, Home, Pencil, Settings2, X } from "lucide-react";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { type WishlistItem, type WishInput, validateWish } from "@/lib/wishlist/types";
import { prepareWishImages } from "@/lib/prepare-wish-image";
import { createClientUuid } from "@/lib/client-uuid";
import { AppDock } from "@/components/app-dock";
import { WishGallery } from "@/components/wish-gallery";
import { wishPhotoProgress, wishUiError } from "@/lib/wish-copy";
import { useWishlistData, wishRequest } from "@/components/use-wishlist-data";
import { formatWishPrice, normalizeWishCurrency } from "@/lib/format-price";
import {
  getWishImages,
  WISH_IMAGE_ACCEPT,
  MAX_WISH_IMAGES,
  revokeTemporaryWishImage,
} from "@/lib/wish-media";
import { useAppSettings } from "@/components/settings-provider";
import { Button, IconButton } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";

type WorkspaceContextValue = {
  items: WishlistItem[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  openAddItem: () => void;
  addSheetOpen: boolean;
  openItem: (item: WishlistItem, preview?: string, sourceId?: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const WorkspaceActionsContext = createContext<Pick<WorkspaceContextValue, "openItem" | "openAddItem"> | null>(null);
const MotionLink = motion.create(Link);

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("useWorkspace must be used inside AppShell.");
  return workspace;
}

export function useWorkspaceActions() {
  const actions = useContext(WorkspaceActionsContext);
  if (!actions) throw new Error("useWorkspaceActions must be used inside AppShell.");
  return actions;
}

function ScrollBezel() {
  const { settings } = useAppSettings();
  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const scaleX = useSpring(1, { stiffness: 230, damping: 23, mass: 0.35 });
  const scaleY = useSpring(1, { stiffness: 230, damping: 23, mass: 0.35 });
  const opacity = useSpring(0, { stiffness: 190, damping: 23 });
  const previous = useRef({ y: 0, time: 0 });
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useMotionValueEvent(scrollY, "change", (y) => {
    if (reduceMotion || !settings.scrollBezel || !settings.fluidAnimations) return;
    const now = performance.now();
    const elapsed = now - previous.current.time;
    if (elapsed > 0) {
      const velocity = (y - previous.current.y) / elapsed;
      const intensity = Math.min(Math.abs(velocity) / 1.6, 0.45);
      scaleX.set(1 + intensity);
      scaleY.set(1 - intensity * 0.38);
      opacity.set(Math.min(intensity * 0.38, 0.16));
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => {
        animate(scaleX, 1, { type: "spring", stiffness: 230, damping: 23 });
        animate(scaleY, 1, { type: "spring", stiffness: 230, damping: 23 });
        animate(opacity, 0, { type: "spring", stiffness: 190, damping: 23 });
      }, 120);
    }
    previous.current = { y, time: now };
  });

  useEffect(() => () => {
    if (timeout.current) clearTimeout(timeout.current);
  }, []);

  if (!settings.fluidAnimations || !settings.scrollBezel) return null;
  return (
    <>
      <motion.div aria-hidden="true" className="scroll-bezel scroll-bezel-left" style={{ scaleX, scaleY, opacity }} />
      <motion.div aria-hidden="true" className="scroll-bezel scroll-bezel-right" style={{ scaleX, scaleY, opacity }} />
    </>
  );
}

const ProfileControl = memo(function ProfileControl({
  editNickname,
  changePhoto,
}: {
  editNickname: () => void;
  changePhoto: () => void;
}) {
  const pathname = usePathname();
  const { settings, profilePhoto } = useAppSettings();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hoverEnabled, setHoverEnabled] = useState(false);
  const avatarPointerType = useRef<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setHoverEnabled(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) {
        setOpen(false);
        setSettingsOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setSettingsOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function closeProfile() {
    setOpen(false);
    setSettingsOpen(false);
  }

  return (
    <div
      className="profile-control"
      onPointerEnter={(event) => {
        if (hoverEnabled && event.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (hoverEnabled && event.pointerType === "mouse") {
          setOpen(false);
          setSettingsOpen(false);
        }
      }}
      ref={panelRef}
    >
      <motion.button
        aria-expanded={open}
        aria-label={open ? "Collapse profile" : "Open profile"}
        className={`profile-avatar ${open ? "profile-avatar-expanded" : ""}`}
        layoutId="profile-surface"
        onPointerDown={(event) => {
          avatarPointerType.current = event.pointerType;
        }}
        onClick={(event) => {
          const pointerType = avatarPointerType.current;
          avatarPointerType.current = null;
          if (hoverEnabled && pointerType === "mouse" && event.detail > 0) return;
          if (open) closeProfile();
          else setOpen(true);
        }}
        type="button"
        whileTap={{ scale: 0.94 }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 32, mass: 0.9 }}
      >
        {profilePhoto ? (
          <Image alt="" className="profile-photo" fill sizes="56px" src={profilePhoto} unoptimized />
        ) : (
          settings.nickname.trim().charAt(0).toLocaleUpperCase() || "Y"
        )}
      </motion.button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.button
            aria-expanded={settingsOpen}
            aria-label="Profile settings menu"
            className="profile-settings-button icon-button icon-button-surface"
            initial={{ opacity: 0, y: reduceMotion ? 0 : -5, scale: reduceMotion ? 1 : 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -4, scale: reduceMotion ? 1 : 0.96 }}
            onClick={() => {
              setSettingsOpen((value) => !value);
            }}
            type="button"
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 430, damping: 30, delay: reduceMotion ? 0 : 0.04 }}
          >
            <Settings2 aria-hidden="true" className="size-[19px]" />
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {open && settingsOpen && (
          <motion.div
            animate={{ height: "auto", opacity: 1, y: 0 }}
            aria-label="Profile actions"
            className="profile-menu"
            exit={{ height: 0, opacity: 0, y: reduceMotion ? 0 : -4 }}
            initial={{ height: 0, opacity: 0, y: reduceMotion ? 0 : -4 }}
            role="group"
            transition={reduceMotion ? { duration: 0 } : { duration: 0.14, ease: "easeOut" }}
          >
            <Link
              aria-current={pathname === "/settings" ? "page" : undefined}
              className="profile-menu-action"
              href="/settings"
              onClick={closeProfile}
            >
              <Settings2 aria-hidden="true" className="size-4" />
              <span>Open Settings</span>
            </Link>
            <button className="profile-menu-action" onClick={() => { closeProfile(); editNickname(); }} type="button">
              <Pencil aria-hidden="true" className="size-4" />
              <span>Edit Nickname</span>
            </button>
            <button className="profile-menu-action" onClick={() => { closeProfile(); changePhoto(); }} type="button">
              <Camera aria-hidden="true" className="size-4" />
              <span>Change Profile Photo</span>
            </button>
            <SignOutButton />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

const openSheets = new Set<HTMLElement>();
let originalBodyOverflow = "";

function SheetFrame({
  title,
  hideTitle = false,
  close,
  children,
  sharedItemId,
  sharedAdd = false,
  closeLabel = "Close",
  language,
}: {
  title: string;
  hideTitle?: boolean;
  close: () => void;
  children: ReactNode;
  sharedItemId?: string;
  sharedAdd?: boolean;
  closeLabel?: string;
  language?: string;
}) {
  const sheetRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const isPresent = useIsPresent();
  const { settings } = useAppSettings();
  const reduceMotion = useReducedMotion() || !settings.fluidAnimations;
  useEffect(() => {
    if (!isPresent || !sheetRef.current) return;
    const panel = sheetRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    if (!openSheets.size) originalBodyOverflow = document.body.style.overflow;
    openSheets.add(panel);
    document.body.style.overflow = "hidden";
    sheetRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      if (event.key !== "Tab" || !sheetRef.current) return;
      const focusable = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled") && !element.closest("[inert]") && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
      if (!sheetRef.current.contains(document.activeElement)) {
        event.preventDefault(); focusable[0]?.focus(); return;
      }
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
        event.preventDefault();
        focusable[0]?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      openSheets.delete(panel);
      if (openSheets.size) return;
      document.body.style.overflow = originalBodyOverflow;
      if (previouslyFocused?.isConnected && previouslyFocused !== document.body) previouslyFocused.focus();
      else if (sharedAdd) document.querySelector<HTMLElement>("[data-home-add-trigger]")?.focus();
    };
  }, [close, sharedAdd, isPresent]);

  return (
    <motion.div
      layoutRoot
      animate={{ opacity: 1 }}
      className={`sheet-backdrop ${sharedItemId ? "shared-item-backdrop" : ""}`}
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      transition={{ duration: reduceMotion ? 0 : 0.18 }}
    >
      <motion.section
        layoutScroll
        lang={language}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`sheet-panel ${sharedItemId ? "shared-item-sheet" : ""} ${sharedAdd ? "shared-add-sheet" : ""}`}
        layoutId={sharedAdd ? "home-add-surface" : undefined}
        ref={sheetRef}
        role="dialog"
        initial={sharedItemId || sharedAdd ? false : { y: reduceMotion ? 0 : 28, scale: reduceMotion ? 1 : 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={sharedItemId || sharedAdd ? undefined : { y: reduceMotion ? 0 : 18, scale: reduceMotion ? 1 : 0.98 }}
        transition={reduceMotion
          ? { duration: 0 }
          : sharedItemId
            ? { type: "spring", stiffness: 300, damping: 32, mass: 0.9 }
            : sharedAdd
              ? {
                  layout: { type: "spring", duration: 0.48, bounce: 0.04 },
                  default: { type: "spring", stiffness: 420, damping: 36 },
                  opacity: { duration: 0.18 },
                }
            : { type: "spring", stiffness: 420, damping: 36 }}
      >
        <div className="sheet-grabber" aria-hidden="true" />
        <header className={`sheet-header ${hideTitle ? "sheet-header-titleless" : ""}`}>
          <h2 className={hideTitle ? "sr-only" : undefined} id={titleId}>{title}</h2>
          <IconButton label={closeLabel} onClick={close} variant="quiet">
            <X aria-hidden="true" className="size-5" />
          </IconButton>
        </header>
        {sharedAdd ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="add-sheet-content"
            initial={{ opacity: 0, y: 8 }}
            transition={{ delay: 0.14, duration: 0.24, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        ) : children}
      </motion.section>
    </motion.div>
  );
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function ItemForm({
  close,
  save,
  item,
}: {
  close: () => void;
  save: (input: WishInput) => Promise<void>;
  item?: WishlistItem;
}) {
  const [images, setImages] = useState(() => item ? getWishImages(item) : []);
  const [mediaNames, setMediaNames] = useState(() =>
    item?.mediaNames?.slice(0, images.length) ?? (item?.mediaName ? [item.mediaName] : []),
  );
  const [currency, setCurrency] = useState(() => normalizeWishCurrency(item?.currency));
  const [error, setError] = useState("");
  const createdUrls = useRef(new Set<string>());
  const localFiles = useRef(new Map<string, File>());
  const uploaded = useRef(new Map<string, { path: string; name: string }>());
  const [wishId] = useState(() => item?.id ?? createClientUuid());
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const [processing, setProcessing] = useState(false);
  const [failedSelection, setFailedSelection] = useState<File[]>([]);
  const selecting = useRef(false);
  const selectionAbort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const submitting = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const urls = createdUrls.current;
    return () => {
      mounted.current = false;
      selectionAbort.current?.abort();
      for (const url of urls) revokeTemporaryWishImage(url);
    };
  }, []);

  function chooseImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length || selecting.current || submitting.current) return;
    void processSelection(files);
  }

  async function processSelection(files: File[]) {
    if (selecting.current || submitting.current) return;
    if (images.length + files.length > MAX_WISH_IMAGES) {
      setError(`Нэг хүсэлд ${MAX_WISH_IMAGES} хүртэл зураг нэмээрэй.`);
      return;
    }
    selecting.current = true; setProcessing(true); setError(""); setFailedSelection([]);
    const controller = new AbortController(); selectionAbort.current = controller;
    try {
      const processed = await prepareWishImages(files, images.length, (state) => { if (mounted.current) setProgress(wishPhotoProgress(state)); }, controller.signal);
      if (!mounted.current || controller.signal.aborted) return;
      const urls = processed.map((file) => URL.createObjectURL(file));
      urls.forEach((url, index) => { createdUrls.current.add(url); localFiles.current.set(url, processed[index]); });
      setImages((current) => [...current, ...urls]);
      setMediaNames((current) => [...current, ...processed.map((file) => file.name)]);
    } catch (cause) {
      if (mounted.current && !controller.signal.aborted) {
        setFailedSelection(files);
        setError(wishUiError(cause, "photo"));
      }
    } finally {
      selecting.current = false;
      if (mounted.current) { setProcessing(false); setProgress(""); }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || selecting.current) return;
    const formData = new FormData(event.currentTarget);
    const input: WishInput = {
      id: wishId, name: String(formData.get("name") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      price: formData.get("price") ? Number(formData.get("price")) : null,
      currency: normalizeWishCurrency(formData.get("currency")),
      url: String(formData.get("url") ?? "").trim(),
      priority: String(formData.get("priority")) as WishlistItem["priority"],
      category: String(formData.get("category") ?? "").trim(),
      photos: images.map((src, index) => ({ path: src, name: mediaNames[index] || "Photo" })),
      expectedUpdatedAt: item?.updatedAt ?? null,
    };
    try { validateWish(input); } catch (cause) { setError(wishUiError(cause)); return; }
    submitting.current = true; setSaving(true); setError("");
    try {
      for (let index = 0; index < images.length; index++) {
        const src = images[index];
        const file = localFiles.current.get(src);
        if (file) {
          setProgress((index + 1) + "/" + images.length + " photos uploading…");
          if (!uploaded.current.has(src)) {
            const body = new FormData(); body.set("file", file); body.set("wishId", wishId);
            uploaded.current.set(src, await wishRequest<{ path: string; name: string }>("/api/wishlist/uploads", { method: "POST", body }));
          }
          input.photos[index] = uploaded.current.get(src)!;
        } else {
          const originalIndex = item?.images.indexOf(src) ?? -1;
          const photo = item?.photos[originalIndex];
          if (!photo) throw new Error("This photo is unavailable. Remove it and add it again.");
          input.photos[index] = photo;
        }
      }
      setProgress("Saving wish…");
      await save(input);
      close();
    } catch (cause) { uploaded.current.clear(); setError(wishUiError(cause)); }
    finally { submitting.current = false; setSaving(false); setProgress(""); }
  }
  return (
    <SheetFrame close={() => { if (!submitting.current) close(); }} sharedAdd={!item} title={item ? "Edit wish" : "Add wish"}>
      {progress && <p className="wish-media-hint px-6" role="status">{progress}</p>}
      <form inert={saving || processing} aria-busy={saving || processing} className={`sheet-form ${item ? "" : "add-sheet-form"}`} onSubmit={handleSubmit}
        onInvalid={(event) => { const field = event.target; if (field instanceof HTMLInputElement) field.setCustomValidity(field.name === "name" ? "Хүслийн нэрээ бичээрэй." : field.name === "url" ? "Бүтээгдэхүүний зөв холбоос оруулна уу." : "Зөв үнэ оруулна уу."); }}
        onInput={(event) => { const field = event.target; if (field instanceof HTMLInputElement) field.setCustomValidity(""); }}>
        <label className="field-label">Хүслийн нэр
          <input className="field-input" defaultValue={item?.name} maxLength={100} name="name" required />
        </label>
        <label className="field-label">Тайлбар
          <textarea className="field-input min-h-20 resize-y" defaultValue={item?.description} maxLength={500} name="description" rows={2} />
        </label>
        <div className="grid grid-cols-[1fr_130px] gap-3">
          <label className="field-label">Үнэ
            <input className="field-input" defaultValue={item?.price ?? ""} min="0" name="price" placeholder="0" step={currency === "MNT" ? "1" : "0.01"} type="number" />
          </label>
          <label className="field-label">Валют
            <select className="field-input" onChange={(event) => setCurrency(event.currentTarget.value as WishlistItem["currency"])} value={currency} name="currency">
              <option value="USD">Ам.доллар ($)</option><option value="MNT">Төгрөг (₮)</option>
            </select>
          </label>
        </div>
        <label className="field-label">Бүтээгдэхүүний холбоос
          <input className="field-input" defaultValue={item?.url} maxLength={2048} name="url" placeholder="https://" type="url" />
        </label>
        <label className="field-label">Ач холбогдол
          <select className="field-input" defaultValue={item?.priority ?? "Medium"} name="priority"><option value="Low">Бага</option><option value="Medium">Дунд</option><option value="High">Өндөр</option></select>
        </label>
        <label className="field-label">Ангилал
          <input className="field-input" defaultValue={item?.category} maxLength={64} name="category" />
        </label>
        <div className="wish-media-field">
          <label className="field-label" htmlFor="wish-images">Зураг ({images.length}/{MAX_WISH_IMAGES})</label>
          <input
            accept={WISH_IMAGE_ACCEPT}
            hidden
            disabled={images.length >= MAX_WISH_IMAGES}
            id="wish-images"
            multiple
            onChange={chooseImages}
            type="file"
          />
          <Button disabled={images.length >= MAX_WISH_IMAGES} onClick={() => document.getElementById("wish-images")?.click()} variant="secondary">Зураг нэмэх</Button>
          {images.length > 0 && (
            <ol aria-label="Сонгосон зургууд" className="wish-media-list">
              {images.map((src, index) => (
                <li className="wish-media-preview" key={src}>
                  <Image alt={`${index + 1}-р зураг`} height={80} src={src} unoptimized width={80} />
                  <span>{index === 0 ? "Нүүр зураг" : `${index + 1}-р зураг`}</span>
                  <div className="wish-media-actions">
                    <IconButton disabled={index === 0} label={`${index + 1}-р зургийг урагшлуулах`} onClick={() => {
                      setImages((current) => moveItem(current, index, index - 1));
                      setMediaNames((current) => moveItem(current, index, index - 1));
                    }} variant="quiet"><ChevronLeft aria-hidden="true" className="size-4" /></IconButton>
                    <IconButton disabled={index === images.length - 1} label={`${index + 1}-р зургийг хойшлуулах`} onClick={() => {
                      setImages((current) => moveItem(current, index, index + 1));
                      setMediaNames((current) => moveItem(current, index, index + 1));
                    }} variant="quiet"><ChevronLeft aria-hidden="true" className="size-4 rotate-180" /></IconButton>
                    <IconButton label={`${index + 1}-р зургийг хасах`} onClick={() => {
                      setImages((current) => current.filter((_, position) => position !== index));
                      setMediaNames((current) => current.filter((_, position) => position !== index));
                    }} variant="quiet"><X aria-hidden="true" className="size-4" /></IconButton>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          {!!failedSelection.length && <Button onClick={() => void processSelection(failedSelection)} variant="secondary">Дахин оролдох</Button>}
        </div>
        <div className="sheet-actions">
          <Button onClick={close} variant="secondary">Cancel</Button>
          <Button type="submit">{saving ? "Saving…" : item ? "Save" : "Add wish"}</Button>
        </div>
      </form>
    </SheetFrame>
  );
}

function NicknameForm({ close }: { close: () => void }) {
  const { settings, updateSettings } = useAppSettings();
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nickname = String(formData.get("nickname") ?? "").trim();
    if (!nickname || nickname.length > 32) {
      setError("Enter a nickname between 1 and 32 characters.");
      return;
    }
    updateSettings({ nickname });
    close();
  }

  return (
    <SheetFrame close={close} title="Edit Nickname">
      <form className="sheet-form" onSubmit={handleSubmit}>
        <label className="field-label">
          Nickname
          <input
            autoComplete="nickname"
            className="field-input"
            defaultValue={settings.nickname}
            maxLength={32}
            name="nickname"
            required
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="sheet-actions">
          <Button onClick={close} variant="secondary">Cancel</Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </SheetFrame>
  );
}

function ProfilePhotoForm({ close }: { close: () => void }) {
  const { settings, profilePhoto, saveProfilePhoto } = useAppSettings();
  const [selection, setSelection] = useState<{ file: File; preview: string } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (selection) URL.revokeObjectURL(selection.preview);
    };
  }, [selection]);

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      setSelection(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Choose an image smaller than 5 MB.");
      setSelection(null);
      return;
    }
    setError("");
    setSelection({ file, preview: URL.createObjectURL(file) });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection) {
      setError("Choose a photo before saving.");
      return;
    }
    setSaving(true);
    try {
      await saveProfilePhoto(selection.file);
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the profile photo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SheetFrame close={close} title="Change Profile Photo">
      <form className="sheet-form" onSubmit={handleSubmit}>
        <div className="profile-photo-preview">
          {selection ? (
            <Image alt="Selected profile photo preview" fill sizes="96px" src={selection.preview} unoptimized />
          ) : profilePhoto ? (
            <Image alt="Current profile photo" fill sizes="96px" src={profilePhoto} unoptimized />
          ) : (
            <span aria-hidden="true">{settings.nickname.trim().charAt(0).toLocaleUpperCase() || "Y"}</span>
          )}
        </div>
        <label className="field-label">
          Photo
          <input accept="image/*" className="field-input" onChange={choosePhoto} type="file" />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="sheet-actions">
          <Button disabled={saving} onClick={close} variant="secondary">Cancel</Button>
          <Button disabled={saving || !selection} type="submit">{saving ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </SheetFrame>
  );
}

function ItemDetail({
  item,
  sharedId,
  preview = "",
  close,
  edit,
  remove,
  pending = false,
  error = "",
}: {
  item: WishlistItem;
  sharedId?: string;
  preview?: string;
  close: () => void;
  edit?: () => void;
  remove?: () => void;
  pending?: boolean;
  error?: string;
}) {
  const reduceMotion = useReducedMotion();
  const price = item.price !== null ? formatWishPrice(item.price, item.currency) : "No price";
  const images = useMemo(() => getWishImages(item), [item]);
  return (
    <SheetFrame close={close} sharedItemId={item.id} title={item.name} hideTitle>
      <div className="detail-content">
        {images.length > 0 && <WishGallery images={images} preview={preview} sharedId={sharedId} name={item.name} />}
        <motion.div
          className="detail-copy"
          initial={{ opacity: 0, y: reduceMotion ? 0 : 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2, delay: reduceMotion ? 0 : 0.16 }}
        >
          <h3 className="text-xl font-semibold tracking-tight">{item.name}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">{price}</p>
          {item.description && <p className="detail-description">{item.description}</p>}
          <dl className="detail-rows">
            <div><dt>Priority</dt><dd className="wish-priority" data-priority={item.priority}>{item.priority}</dd></div>
            <div><dt>Wishlist</dt><dd>{item.owner === "you" ? "Mine" : "Partner"}</dd></div>
            
          </dl>
          {error && <p className="form-error" role="alert">Unable to delete wish. Check your connection and retry.</p>}
          <div className="sheet-actions">
            {item.url && <a className="text-sm text-[var(--interactive)] hover:underline" href={item.url} rel="noreferrer" target="_blank">View product</a>}
            {remove && <Button disabled={pending} className="mr-auto text-red-600 dark:text-red-400" onClick={remove} variant="ghost">{pending ? "Deleting…" : "Delete"}</Button>}
            {edit && <Button disabled={pending} onClick={edit} variant="secondary">Edit</Button>}
          </div>
        </motion.div>
      </div>
    </SheetFrame>
  );
}

export function AppShell({ children, userId }: { children: ReactNode; userId: string }) {
  const { items, loading, hasLoaded, error, warning, refresh, saveItem, deleteItem } = useWishlistData(userId);
  const [sheet, setSheet] = useState<"add" | "detail" | "edit" | null>(null);
  const [profileEditor, setProfileEditor] = useState<"nickname" | "photo" | null>(null);
  const [activeItem, setActiveItem] = useState<WishlistItem | null>(null);
  const [activePreview, setActivePreview] = useState("");
  const [activeSharedId, setActiveSharedId] = useState<string | undefined>();
  const sourceElement = useRef<HTMLElement | null>(null);
  const releaseSource = useCallback(() => {
    const source = sourceElement.current;
    if (source) { delete source.dataset.detailExpanded; source.closest("button")?.focus({ preventScroll: true }); }
    sourceElement.current = null;
  }, []);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const deleteInFlight = useRef(false);
  const pathname = usePathname();
  const { settings } = useAppSettings();
  const reduceMotion = useReducedMotion() || !settings.fluidAnimations;
  const closeSheet = useCallback(() => setSheet(null), []);
  const closeEditSheet = useCallback(() => setSheet("detail"), []);
  const closeProfileEditor = useCallback(() => setProfileEditor(null), []);
  const openNicknameEditor = useCallback(() => setProfileEditor("nickname"), []);
  const openPhotoEditor = useCallback(() => setProfileEditor("photo"), []);
  useEffect(() => {
    const clear = () => { releaseSource(); setActiveItem(null); setActivePreview(""); setSheet(null); setProfileEditor(null); };
    window.addEventListener("yourwishes-private-data-cleared", clear);
    return () => window.removeEventListener("yourwishes-private-data-cleared", clear);
  }, [releaseSource]);
  useEffect(() => () => { releaseSource(); setSheet(null); setProfileEditor(null); }, [pathname, releaseSource]);
  const currentActiveItem = items.find((item) => item.id === activeItem?.id);
  const openAddItem = useCallback(() => setSheet("add"), []);
  const openItem = useCallback((item: WishlistItem, preview = "", sourceId?: string) => {
    releaseSource();
    sourceElement.current = sourceId ? document.getElementById(sourceId) : null;
    if (sourceElement.current) sourceElement.current.dataset.detailExpanded = "true";
    setActiveSharedId(sourceId);
    setActiveItem(item);
    setActivePreview(preview);
    setDeleteError("");
    setSheet("detail");
  }, [releaseSource]);
  const canMutateActiveItem = activeItem?.owner === "you" &&
    items.some((item) => item.id === activeItem.id && item.owner === "you");
  const openEditItem = useCallback(() => {
    if (!canMutateActiveItem) {
      console.warn("Rejected opening the edit form for an item not owned by the current user.");
      return;
    }
    if (currentActiveItem) setActiveItem(currentActiveItem);
    setSheet("edit");
  }, [canMutateActiveItem, currentActiveItem]);
  const addSheetOpen = sheet === "add";
  const loadingRoute = pathname !== "/" && pathname !== "/settings" && !hasLoaded && (loading || !!error);
  const contextValue = useMemo(
    () => ({ items, loading, error, refresh, openAddItem, addSheetOpen, openItem }),
    [items, loading, error, refresh, openAddItem, addSheetOpen, openItem],
  );
  const actionsValue = useMemo(() => ({ openAddItem, openItem }), [openAddItem, openItem]);

  return (
    <WorkspaceContext.Provider value={contextValue}>
      <WorkspaceActionsContext.Provider value={actionsValue}>
      <LayoutGroup id="yourwishes-shared-elements">
        <div className="app-frame">
          <header className="app-topbar">
            {pathname !== "/" ? (
              <MotionLink
                aria-label="Back to Home"
                className="home-control"
                href="/"
                whileTap={reduceMotion ? undefined : { scale: 0.92 }}
                transition={{ type: "spring", stiffness: 440, damping: 30 }}
              >
                <Home aria-hidden="true" className="size-[19px]" />
              </MotionLink>
            ) : <span aria-hidden="true" />}
            <ProfileControl
              editNickname={openNicknameEditor}
              changePhoto={openPhotoEditor}
            />
          </header>
          <main className={`page-content ${pathname === "/" ? "home-content" : ""}`}>
            {warning && <p className="text-sm text-[var(--muted)]" role="status">{warning}</p>}
            {hasLoaded && error && (
              <section aria-live="polite" className="mb-4 text-sm text-[var(--muted)]">
                <p role="alert">{error}</p>
                <Button className="mt-2" onClick={() => void refresh()} variant="secondary">Retry</Button>
              </section>
            )}
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="route-transition"
                exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.992, y: reduceMotion ? 0 : 3 }}
                initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.992, y: reduceMotion ? 0 : 3 }}
                key={pathname}
                transition={reduceMotion
                  ? { duration: 0 }
                  : { opacity: { duration: 0.16 }, scale: { duration: 0.2 }, y: { duration: 0.2, ease: "easeOut" } }}
              >
                {loadingRoute && (
                  <section aria-live="polite" className="py-10 text-sm text-[var(--muted)]">
                    {loading ? <p role="status">Loading wishes…</p> : <><p role="alert">{error}</p><Button className="mt-4" onClick={() => void refresh()} variant="secondary">Retry</Button></>}
                  </section>
                )}
                {/* Keep the router segment mounted during client data loading.
                    Dropping it breaks Next's instant-navigation validation. */}
                {/* Next preserves/prefetches router children with Activity.
                    Their presence registrations must not hold the route exit
                    open after its own fade has completed. */}
                <AnimatePresence initial={false}>
                  <div style={{ display: loadingRoute ? "none" : "contents" }}>{children}</div>
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
        <AppDock />
        <ScrollBezel />
        <AnimatePresence initial={false} onExitComplete={() => { if (!sheet) releaseSource(); }}>
          {sheet === "add" && <ItemForm key="add" close={closeSheet} save={saveItem} />}
          {sheet === "detail" && currentActiveItem && (
            <ItemDetail
              key={`detail-${currentActiveItem.id}`}
              item={currentActiveItem}
              preview={activePreview}
              sharedId={activeSharedId}
              close={closeSheet}
              pending={deleting}
              error={deleteError}
              edit={canMutateActiveItem ? openEditItem : undefined}
              remove={canMutateActiveItem ? async () => {
                if (deleteInFlight.current || !currentActiveItem || !window.confirm("Delete “" + currentActiveItem.name + "”?")) return;
                deleteInFlight.current = true; setDeleting(true); setDeleteError("");
                try { await deleteItem(currentActiveItem); setSheet(null); setActiveItem(null); }
                catch (cause) { setDeleteError(cause instanceof Error ? cause.message : "Could not delete the wish."); }
                finally { deleteInFlight.current = false; setDeleting(false); }
              } : undefined}
            />
          )}
          {sheet === "edit" && activeItem && canMutateActiveItem && (
            <ItemForm
              key="edit"
              close={closeEditSheet}
              item={activeItem}
              save={saveItem}
            />
          )}
          {profileEditor === "nickname" && (
            <NicknameForm key="nickname" close={closeProfileEditor} />
          )}
          {profileEditor === "photo" && (
            <ProfilePhotoForm key="photo" close={closeProfileEditor} />
          )}
        </AnimatePresence>
      </LayoutGroup>
      </WorkspaceActionsContext.Provider>
    </WorkspaceContext.Provider>
  );
}
