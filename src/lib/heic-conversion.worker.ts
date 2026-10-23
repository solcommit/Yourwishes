import { heifInfo } from "./heif-container";
import { encodePhoto } from "./heic-render";
import { MAX_SOURCE_BYTES, checkDimensions } from "./image-format";

self.onmessage = async (event: MessageEvent<{ file: File }>) => {
  let bitmap: ImageBitmap | undefined;
  try {
    const { file } = event.data;
    if (!file.size || file.size > MAX_SOURCE_BYTES) throw new Error("Choose a HEIC photo up to 32 MiB.");
    const info = heifInfo(new Uint8Array(await file.arrayBuffer()));
    if (!info) throw new Error("This is not a valid HEIC/HEIF photo.");
    const { heicTo } = await import("heic-to/csp");
    // libheif applies container irot/imir. Only apply EXIF when those are absent.
    let orientation = 1;
    if (!info.containerOrientation) {
      const exifr = await import("exifr");
      orientation = (await exifr.orientation(file)) ?? 1;
      if (orientation < 1 || orientation > 8) orientation = 1;
    }
    bitmap = await heicTo({ blob: file, type: "bitmap" });
    checkDimensions(bitmap);
    const blob = await encodePhoto(bitmap, bitmap.width, bitmap.height, orientation);
    self.postMessage({ blob });
  } catch {
    self.postMessage({ error: "This HEIC/HEIF photo could not be converted. Try selecting it again, or export a JPEG from Photos." });
  } finally { bitmap?.close(); }
};
