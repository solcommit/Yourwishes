import { checkDimensions, MAX_OUTPUT_EDGE, type RasterType } from "./image-format";
import { MAX_WISH_IMAGE_BYTES } from "./wishlist/types";

export function orientationMatrix(orientation: number, width: number, height: number): [number, number, number, number, number, number] {
  switch (orientation) {
    case 2: return [-1, 0, 0, 1, width, 0];
    case 3: return [-1, 0, 0, -1, width, height];
    case 4: return [1, 0, 0, -1, 0, height];
    case 5: return [0, 1, 1, 0, 0, 0];
    case 6: return [0, 1, -1, 0, height, 0];
    case 7: return [0, -1, -1, 0, height, width];
    case 8: return [0, -1, 1, 0, 0, width];
    default: return [1, 0, 0, 1, 0, 0];
  }
}

export async function encodePhoto(source: CanvasImageSource, width: number, height: number, orientation = 1, type: RasterType = "image/jpeg"): Promise<Blob> {
  checkDimensions({ width, height });
  const swap = orientation >= 5 && orientation <= 8;
  const orientedWidth = swap ? height : width;
  const orientedHeight = swap ? width : height;
  let scale = Math.min(1, MAX_OUTPUT_EDGE / Math.max(width, height));
  // Both browser paths bake orientation into pixels and copy no original metadata.
  for (let attempt = 0; attempt < 8; attempt++, scale *= 0.8) {
    const w = Math.max(1, Math.round(orientedWidth * scale));
    const h = Math.max(1, Math.round(orientedHeight * scale));
    const inDocument = typeof document !== "undefined";
    const canvas = inDocument ? document.createElement("canvas") : new OffscreenCanvas(w, h);
    canvas.width = w; canvas.height = h;
    try {
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
      if (!ctx) throw new Error("Image processing is unavailable in this browser.");
      if (type === "image/jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); }
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.scale(w / orientedWidth, h / orientedHeight);
      ctx.transform(...orientationMatrix(orientation, width, height));
      ctx.drawImage(source, 0, 0, width, height);
      for (const quality of type === "image/png" ? [0.9] : [0.9, 0.84, 0.78]) {
        const blob = inDocument
          ? await new Promise<Blob>((resolve, reject) => (canvas as HTMLCanvasElement).toBlob((value) => value ? resolve(value) : reject(new Error("Could not encode this photo.")), type, quality))
          : await (canvas as OffscreenCanvas).convertToBlob({ type, quality });
        if (blob.size > 0 && blob.size <= MAX_WISH_IMAGE_BYTES) return blob;
      }
    } finally { canvas.width = 1; canvas.height = 1; }
  }
  throw new Error("This photo could not be reduced below 5 MiB. Try a smaller copy.");
}
