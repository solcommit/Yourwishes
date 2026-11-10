"use client";

import { useId, useRef, useState, useEffect } from "react";
import Cropper from "react-easy-crop";
import { cropWishImage, type SquareCropArea } from "@/lib/prepare-wish-image";
import { Button } from "./ui/button";
import "./photo-crop-editor.css";

export function PhotoCropEditor({ file, src, index, total, onConfirm, onCancel }: {
  file: File; src: string; index: number; total: number;
  onConfirm: (file: File) => void; onCancel: () => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<SquareCropArea | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const exportAbort = useRef<AbortController | null>(null);
  const exporting = useRef(false);
  const helpId = useId();
  useEffect(() => () => exportAbort.current?.abort(), []);
  async function confirm() {
    if (!area || exporting.current || !loaded) return;
    exporting.current = true; setBusy(true); setError("");
    const controller = new AbortController(); exportAbort.current = controller;
    try {
      const output = await cropWishImage(file, area, controller.signal);
      if (!controller.signal.aborted) onConfirm(output);
    } catch {
      if (!controller.signal.aborted) { setError("Зургийг тайрч чадсангүй. Дахин оролдоорой."); setBusy(false); }
    } finally { exporting.current = false; }
  }
  return <div className="photo-crop-editor">
    <p className="wish-media-hint" role="status">Зураг {index}/{total} · 1:1</p>
    <p id={helpId} className="wish-media-hint">Зургаа чирж байрлуулаад, томруулалтыг тохируулаарай. Сумтай товчоор мөн хөдөлгөж болно.</p>
    <div className="photo-crop-stage">
      <Cropper image={src} crop={crop} zoom={zoom} aspect={1} objectFit="cover" minZoom={1} maxZoom={3}
        onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setArea(pixels)}
        onMediaLoaded={() => setLoaded(true)} roundCropAreaPixels zoomWithScroll={false}
        mediaProps={{ onError: () => { setLoaded(false); setError("Зураг ачаалсангүй. Цуцлаад дахин сонгоорой."); } }}
        cropperProps={{ "aria-label": "Зураг тайрах хэсэг", "aria-describedby": helpId }} />
    </div>
    <label className="field-label">Томруулах · {zoom.toFixed(1)}×
      <input type="range" min={1} max={3} step={0.05} value={zoom} disabled={busy} aria-label="Зураг томруулах"
        onChange={(event) => setZoom(Number(event.currentTarget.value))} />
    </label>
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="photo-crop-actions">
      <Button variant="ghost" disabled={busy} onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); }}>Reset</Button>
      <Button variant="secondary" onClick={onCancel}>Cancel crop</Button>
      <Button disabled={!area || busy || !loaded} onClick={() => void confirm()}>{busy ? "Тайрч байна…" : "Use photo"}</Button>
    </div>
  </div>;
}
